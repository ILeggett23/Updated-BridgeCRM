import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

await import(new URL("../src/contact-logic.js", import.meta.url));
const logic = globalThis.BridgeLogic;
const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const cssSource = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

const day = 24 * 60 * 60 * 1000;
const baseContact = overrides => ({
  id: Math.random().toString(),
  role: "Prospect",
  interestLevel: "Unsure",
  stages: { MSA: false, DTM: false, PQI: false, "QI/P": false, FUP: false, LA: false, CNA: false },
  stageDates: {},
  stageEvents: [],
  followUps: [],
  conversations: [],
  createdAt: "2026-01-01T12:00:00.000Z",
  updatedAt: "2026-01-01T12:00:00.000Z",
  archivedAt: null,
  isFilteredOut: false,
  ...overrides
});

test("dashboard uses shared spacing for icon, value, label, and goal hierarchy", () => {
  assert.match(cssSource, /--space-1:/);
  assert.match(cssSource, /\.stat[^}]+gap: var\(--space-3\)/);
  assert.match(cssSource, /\.goal-copy[^}]+gap: var\(--space-2\)/);
});

test("sorts by newest and oldest conversation while keeping missing activity last", () => {
  const newer = baseContact({ id: "newer", conversations: [{ conversationDate: "2026-07-10T12:00:00Z" }] });
  const older = baseContact({ id: "older", conversations: [{ conversationDate: "2026-06-01T12:00:00Z" }] });
  const missing = baseContact({ id: "missing" });
  const rank = { High: 0, Medium: 1, Low: 2, Unsure: 3 };
  assert.deepEqual(logic.sortContacts([missing, older, newer], "recentConversation", rank, () => 0).map(x => x.id), ["newer", "older", "missing"]);
  assert.deepEqual(logic.sortContacts([missing, newer, older], "oldestConversation", rank, () => 0).map(x => x.id), ["older", "newer", "missing"]);
});

test("filters contacts by conversation date range", () => {
  const contact = baseContact({ conversations: [{ conversationDate: "2026-07-08T12:00:00Z" }] });
  assert.equal(logic.hasConversationInRange(contact, "2026-07-07", "2026-07-09"), true);
  assert.equal(logic.hasConversationInRange(contact, "2026-07-09", "2026-07-11"), false);
  assert.equal(logic.hasConversationInRange(baseContact({}), "2026-07-01", "2026-07-31"), false);
});

test("follow-up creation is independent from filtered-out status", () => {
  assert.match(appSource, /isFilteredOut:false,filteredOutAt:null,checkBackDate:/);
  assert.doesNotMatch(appSource, /isFilteredOut:Boolean\(form\.get\('checkBackDate'\)\)/);
  const contact = baseContact({ followUps: [{ dueDate: "2026-07-15T12:00:00Z", completedAt: null }] });
  assert.equal(contact.isFilteredOut, false);
  logic.setFilteredOut(contact, true, "2026-07-11T12:00:00Z");
  assert.equal(contact.isFilteredOut, true);
  assert.equal(contact.filteredOutAt, "2026-07-11T12:00:00Z");
  logic.setFilteredOut(contact, false);
  assert.equal(contact.isFilteredOut, false);
  assert.equal(contact.filteredOutAt, null);
});

test("automatic archival is optional and only archives inactive no-stage prospects", () => {
  const now = new Date("2026-07-11T12:00:00Z").getTime();
  const eligible = baseContact({ id: "eligible", createdAt: new Date(now - 40 * day).toISOString(), updatedAt: new Date(now - 40 * day).toISOString() });
  const customer = baseContact({ id: "customer", role: "Customer", createdAt: new Date(now - 40 * day).toISOString(), updatedAt: new Date(now - 40 * day).toISOString() });
  const team = baseContact({ id: "team", role: "Team", createdAt: new Date(now - 40 * day).toISOString(), updatedAt: new Date(now - 40 * day).toISOString() });
  const staged = baseContact({ id: "staged", stages: { MSA: true }, createdAt: new Date(now - 40 * day).toISOString(), updatedAt: new Date(now - 40 * day).toISOString() });
  const followed = baseContact({ id: "followed", followUps: [{ dueDate: new Date(now + day).toISOString(), completedAt: null }], createdAt: new Date(now - 40 * day).toISOString(), updatedAt: new Date(now - 40 * day).toISOString() });
  const disabled = baseContact({ id: "disabled", createdAt: new Date(now - 40 * day).toISOString(), updatedAt: new Date(now - 40 * day).toISOString() });
  assert.equal(logic.archiveInactiveContacts([disabled], false, now), 0);
  assert.equal(disabled.archivedAt, null);
  assert.equal(logic.archiveInactiveContacts([eligible, customer, team, staged, followed], true, now), 1);
  assert.ok(eligible.archivedAt);
  assert.equal(customer.archivedAt, null);
  assert.equal(team.archivedAt, null);
  assert.equal(staged.archivedAt, null);
  assert.equal(followed.archivedAt, null);
});

test("Team contacts retain stored fit data but cannot become No-Go or enter a pipeline", () => {
  const team = baseContact({
    role: "Team",
    interestLevel: "High",
    isFilteredOut: true,
    filteredOutAt: "2026-07-01T12:00:00Z",
    stages: { PQI: true, "QI/P": true }
  });
  assert.equal(logic.normalizePipelineStages(team, []), "");
  assert.deepEqual(Object.values(team.stages).filter(Boolean), []);
  logic.setFilteredOut(team, true, "2026-07-12T12:00:00Z");
  assert.equal(team.isFilteredOut, false);
  assert.equal(team.filteredOutAt, null);
  assert.match(appSource, /<option>Team<\/option>/);
  assert.match(appSource, /Team contacts do not participate in the prospect or customer pipeline/);
  assert.match(appSource, /role!=="Team"&&c\.interestLevel/);
});

test("restoring an archived contact preserves historical analytics records", () => {
  const contact = baseContact({ archivedAt: "2026-07-11T12:00:00Z", archiveReason: "inactive-30-days", stages: { MSA: true }, conversations: [{ id: "log", conversationDate: "2026-05-01T12:00:00Z", isCountedConversation: true }] });
  const history = JSON.stringify({ stages: contact.stages, conversations: contact.conversations });
  logic.restoreContact(contact, "2026-07-12T12:00:00Z");
  assert.equal(contact.archivedAt, null);
  assert.equal(contact.archiveReason, null);
  assert.equal(JSON.stringify({ stages: contact.stages, conversations: contact.conversations }), history);
});

test("migration preserves timestamps and clears legacy implicit filtered-out values", () => {
  assert.match(appSource, /createdAt: log\.createdAt \|\| log\.conversationDate/);
  assert.match(appSource, /role === "Team" \? false : Boolean\(contact\.isFilteredOut && filteredOutAt\)/);
  assert.match(appSource, /archivedAt: contact\.archivedAt \|\| null/);
  assert.match(appSource, /stageEvents/);
  assert.match(appSource, /contact\.stageEvents\|\|\[\]/);
  assert.match(appSource, /validCurrentStages\.has\(stage\)/);
  assert.match(appSource, /stageEvents: currentStageEvents, followUps/);
});

test("prospect and customer stages normalize to exactly one active stage", () => {
  const prospectStages = ["PQI", "QI/P", "FUP", "LA"];
  const customerStages = ["CNA", "Proposal", "Follow-Up", "Order Placed", "Active Customer"];
  const prospect = baseContact({
    stages: { PQI: true, "QI/P": true, FUP: true, LA: false },
    stageEvents: [
      { stage: "PQI", occurredAt: "2026-06-01T12:00:00Z" },
      { stage: "FUP", occurredAt: "2026-07-01T12:00:00Z" }
    ]
  });
  const customer = baseContact({
    role: "Customer",
    stages: { CNA: true, Proposal: true, "Order Placed": true },
    stageDates: {
      CNA: "2026-05-01T12:00:00Z",
      Proposal: "2026-06-01T12:00:00Z",
      "Order Placed": "2026-07-01T12:00:00Z"
    }
  });
  assert.equal(logic.normalizePipelineStages(prospect, prospectStages), "FUP");
  assert.deepEqual(prospectStages.filter(stage => prospect.stages[stage]), ["FUP"]);
  assert.equal(logic.normalizePipelineStages(customer, customerStages), "Order Placed");
  assert.deepEqual(customerStages.filter(stage => customer.stages[stage]), ["Order Placed"]);
});

test("pipeline labels are concise and legacy customer stages migrate without rewriting history", () => {
  assert.match(appSource, /Customer: \["CNA", "Proposal", "Follow-Up", "Order Placed", "Active Customer"\]/);
  assert.match(appSource, /Recommendation: "Proposal"/);
  assert.match(appSource, /"Decision \/ Follow-Up": "Follow-Up"/);
  assert.match(appSource, /"Customer Onboarding": "Active Customer"/);
  assert.match(appSource, /"Reorder \/ Retention": "Active Customer"/);
  assert.match(appSource, /function stageLabel\(stage\) \{ return stage; \}/);
  assert.doesNotMatch(appSource, /function stageTitle/);
  assert.match(appSource, /showDescription:false/);
  assert.doesNotMatch(appSource, /stageTitle\(stage\)!==stage/);
});

test("legacy multi-stage normalization prefers events, then dates, then role order", () => {
  const stages = ["PQI", "QI/P", "FUP", "LA"];
  const eventWins = baseContact({
    stages: { PQI: true, "QI/P": true, FUP: true },
    stageDates: { PQI: "2026-07-10T12:00:00Z", FUP: "2026-07-12T12:00:00Z" },
    stageEvents: [{ stage: "QI/P", occurredAt: "2026-06-01T12:00:00Z" }]
  });
  const dateWins = baseContact({
    stages: { PQI: true, "QI/P": true, FUP: true },
    stageDates: { PQI: "2026-05-01T12:00:00Z", FUP: "2026-07-01T12:00:00Z" }
  });
  const orderWins = baseContact({ stages: { PQI: true, "QI/P": true, FUP: true } });
  assert.equal(logic.resolveCurrentPipelineStage(eventWins, stages), "QI/P");
  assert.equal(logic.resolveCurrentPipelineStage(dateWins, stages), "FUP");
  assert.equal(logic.resolveCurrentPipelineStage(orderWins, stages), "FUP");
});

test("pipeline normalization preserves historical dates and events", () => {
  const contact = baseContact({
    stages: { PQI: true, FUP: true },
    stageDates: { PQI: "2026-05-01T12:00:00Z", FUP: "2026-06-01T12:00:00Z" },
    stageEvents: [{ id: "event-1", stage: "PQI", occurredAt: "2026-05-01T12:00:00Z" }]
  });
  const history = JSON.stringify({ stageDates: contact.stageDates, stageEvents: contact.stageEvents });
  logic.normalizePipelineStages(contact, ["PQI", "QI/P", "FUP", "LA"]);
  assert.equal(JSON.stringify({ stageDates: contact.stageDates, stageEvents: contact.stageEvents }), history);
});

test("visibility filters separate active, no-go, archived, and all contacts", () => {
  const active = baseContact({ id: "active" });
  const noGo = baseContact({ id: "no-go", isFilteredOut: true, filteredOutAt: "2026-07-01T12:00:00Z" });
  const archived = baseContact({ id: "archived", archivedAt: "2026-07-02T12:00:00Z" });
  const contacts = [active, noGo, archived];
  const ids = filter => contacts.filter(contact => logic.matchesVisibilityFilter(contact, filter)).map(contact => contact.id);
  assert.deepEqual(ids("Active"), ["active"]);
  assert.deepEqual(ids("No-Go"), ["no-go"]);
  assert.deepEqual(ids("Archived"), ["archived"]);
  assert.deepEqual(ids("All"), ["active", "no-go", "archived"]);
});

test("No-Go confirmation and restoration preserve pipeline and follow-ups", () => {
  assert.match(appSource, /Mark \$\{c\.fullName\} as No-Go\?/);
  assert.match(appSource, /id="restoreNoGo"/);
  const contact = baseContact({
    stages: { FUP: true },
    stageDates: { FUP: "2026-07-01T12:00:00Z" },
    followUps: [{ id: "follow", dueDate: "2026-07-20T12:00:00Z", completedAt: null }]
  });
  const preserved = JSON.stringify({ stages: contact.stages, stageDates: contact.stageDates, followUps: contact.followUps });
  logic.setFilteredOut(contact, true, "2026-07-10T12:00:00Z");
  logic.setFilteredOut(contact, false, "2026-07-11T12:00:00Z");
  assert.equal(JSON.stringify({ stages: contact.stages, stageDates: contact.stageDates, followUps: contact.followUps }), preserved);
});

test("pipeline UI excludes no-stage columns and inactive contacts", () => {
  assert.equal(appSource.includes('const stages=["No stage"'), false);
  assert.match(appSource, /function activePipelineContacts\(role\)/);
  assert.match(appSource, /contact\.role===role&&!contact\.archivedAt&&!contact\.isFilteredOut&&PIPELINES\[role\]\.includes\(currentPipelineStage\(contact\)\)/);
  assert.match(appSource, /if\(\["No-Go","Archived"\]\.includes\(ui\.visibilityFilter\)\)ui\.contactMode="list"/);
});

test("pipeline controls are exclusive while historical stage events are retained", () => {
  assert.match(appSource, /function setPipelineStage/);
  assert.match(appSource, /contact\.stageEvents\.push\(\{ id: uid\(\), stage: nextStage \|\| "", fromStage: previous \|\| null, toStage: nextStage \|\| null, occurredAt, source \}\)/);
  assert.match(appSource, /\{type:"radio",checked:Boolean\(contact\?\.stages\?\.\[stage\]\),showDescription:false\}/);
  assert.match(appSource, /Historical stage activity will remain/);
});

test("every exact Prospect stage can transition directly through the canonical transition function", () => {
  const stages = ["PQI", "QI/P", "FUP", "LA"];
  const match = appSource.match(/function setPipelineStage\(contact, nextStage, occurredAt = nowISO\(\), source = "user"\) \{[\s\S]*?\n\}/);
  assert.ok(match, "setPipelineStage source is available");
  let id = 0;
  const setPipelineStage = new Function("PIPELINES", "currentPipelineStage", "nowISO", "uid", `${match[0]}; return setPipelineStage;`)(
    { Prospect: stages },
    contact => stages.find(stage => contact.stages[stage]) || "",
    () => "2026-08-11T18:00:00.000Z",
    () => `event-${++id}`
  );
  for (const fromStage of stages) {
    for (const toStage of stages) {
      const contact = {
        role: "Prospect",
        stages: Object.fromEntries(stages.map(stage => [stage, stage === fromStage])),
        stageDates: { [fromStage]: "2026-08-10T18:00:00.000Z" },
        stageEvents: []
      };
      const changed = setPipelineStage(contact, toStage, "2026-08-11T18:00:00.000Z", "prospect-pipeline");
      assert.equal(changed, fromStage !== toStage, `${fromStage} to ${toStage}`);
      assert.deepEqual(stages.filter(stage => contact.stages[stage]), [toStage]);
      if (fromStage !== toStage) {
        assert.deepEqual(contact.stageEvents.at(-1), {
          id: contact.stageEvents.at(-1).id,
          stage: toStage,
          fromStage,
          toStage,
          occurredAt: "2026-08-11T18:00:00.000Z",
          source: "prospect-pipeline"
        });
      }
    }
  }
  const invalid = { role:"Prospect", stages:{ PQI:true, "QI/P":false, FUP:false, LA:false }, stageDates:{}, stageEvents:[] };
  assert.equal(setPipelineStage(invalid, "Not a stage"), false);
  assert.deepEqual(stages.filter(stage => invalid.stages[stage]), ["PQI"]);
  assert.deepEqual(invalid.stageEvents, []);
});

test("every exact Customer stage can transition directly through the canonical transition function", () => {
  const stages = ["CNA", "Proposal", "Follow-Up", "Order Placed", "Active Customer"];
  const match = appSource.match(/function setPipelineStage\(contact, nextStage, occurredAt = nowISO\(\), source = "user"\) \{[\s\S]*?\n\}/);
  assert.ok(match, "setPipelineStage source is available");
  let id = 0;
  const setPipelineStage = new Function("PIPELINES", "currentPipelineStage", "nowISO", "uid", `${match[0]}; return setPipelineStage;`)(
    { Customer: stages },
    contact => stages.find(stage => contact.stages[stage]) || "",
    () => "2026-08-11T21:00:00.000Z",
    () => `customer-event-${++id}`
  );
  for (const fromStage of stages) {
    for (const toStage of stages) {
      const contact = {
        role: "Customer",
        stages: Object.fromEntries(stages.map(stage => [stage, stage === fromStage])),
        stageDates: { [fromStage]: "2026-08-10T21:00:00.000Z" },
        stageEvents: []
      };
      const changed = setPipelineStage(contact, toStage, "2026-08-11T21:00:00.000Z", "customer-pipeline");
      assert.equal(changed, fromStage !== toStage, `${fromStage} to ${toStage}`);
      assert.deepEqual(stages.filter(stage => contact.stages[stage]), [toStage]);
      if (fromStage !== toStage) {
        assert.deepEqual(contact.stageEvents.at(-1), {
          id: contact.stageEvents.at(-1).id,
          stage: toStage,
          fromStage,
          toStage,
          occurredAt: "2026-08-11T21:00:00.000Z",
          source: "customer-pipeline"
        });
      }
    }
  }
  const invalid = { role:"Customer", stages:{ CNA:true, Proposal:false, "Follow-Up":false, "Order Placed":false, "Active Customer":false }, stageDates:{}, stageEvents:[] };
  assert.equal(setPipelineStage(invalid, "Not a customer stage"), false);
  assert.deepEqual(stages.filter(stage => invalid.stages[stage]), ["CNA"]);
  assert.deepEqual(invalid.stageEvents, []);
});
