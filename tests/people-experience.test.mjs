import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

function oneLineFunction(name, scope = {}) {
  const match = source.match(new RegExp(`function ${name}\\([^\\n]+`));
  assert.ok(match, `Expected ${name} to exist.`);
  return new Function(...Object.keys(scope), `${match[0]}; return ${name};`)(...Object.values(scope));
}

function boundedFunction(name, after, scope = {}) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`\nfunction ${after}(`, start);
  assert.ok(start >= 0 && end > start, `Expected ${name} to exist.`);
  return new Function(...Object.keys(scope), `${source.slice(start, end)}; return ${name};`)(...Object.values(scope));
}

test("People search escapes content while highlighting literal query matches", () => {
  const escapeHTML = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  const highlight = oneLineFunction("highlightPeopleMatch", { escapeHTML });
  assert.equal(highlight("Ava <Bridge>", "ava"), '<mark class="people-match">Ava</mark> &lt;Bridge&gt;');
  assert.equal(highlight("Ava <Bridge>", "[none]"), "Ava &lt;Bridge&gt;");
  assert.equal(highlight("Ava (Bridge)", "("), "Ava <mark class=\"people-match\">(</mark>Bridge)");
});

test("People follow-up filtering distinguishes overdue, today, scheduled, and absent records", () => {
  const isScheduledFollowUp = item => !item.completedAt && !item.cancelledAt && !item.deletedAt;
  const startOfDay = value => { const date = new Date(value); return new Date(date.getFullYear(), date.getMonth(), date.getDate()); };
  const stateFor = oneLineFunction("followUpFilterState", { isScheduledFollowUp, startOfDay });
  const now = new Date("2026-08-13T12:00:00");
  assert.equal(stateFor({ followUps: [] }, now), "No follow-up");
  assert.equal(stateFor({ followUps: [{ dueDate:"2026-08-12T12:00:00" }] }, now), "Overdue");
  assert.equal(stateFor({ followUps: [{ dueDate:"2026-08-13T20:00:00" }] }, now), "Due today");
  assert.equal(stateFor({ followUps: [{ dueDate:"2026-08-14T09:00:00" }] }, now), "Scheduled");
  assert.equal(stateFor({ followUps: [{ dueDate:"2026-08-12T12:00:00", cancelledAt:"2026-08-12T13:00:00" }] }, now), "No follow-up");
});

test("People combined filters use stored roles, exact stages, metadata, places, actions, and written context", () => {
  const contacts = [
    { id:"a", fullName:"Alexis A.", role:"Prospect", stage:"PQI", interestLevel:"High", judgement:"Good Fit", placeId:"p1", placeName:"Onyx", personalInfo:"Balcony garden", conversations:[{notes:"Promotion timing"}], notes:[], followUps:[{dueDate:"2026-08-12T12:00:00"}] },
    { id:"b", fullName:"Blair B.", role:"Customer", stage:"Active Customer", interestLevel:"Low", judgement:"Not Good Fit", placeId:"p2", placeName:"Planet", personalInfo:"", conversations:[], notes:[], followUps:[{dueDate:"2026-08-14T12:00:00"}] },
    { id:"c", fullName:"Casey C.", role:"Prospect", stage:"FUP", interestLevel:"High", judgement:"Good Fit", placeId:null, placeName:"", personalInfo:"", conversations:[], notes:[], followUps:[] }
  ];
  const ui = { search:"", sort:"recentContact", visibilityFilter:"Active", roleFilter:"All Roles", healthBandFilter:"All", healthTrendFilter:"All", actionCoverageFilter:"All", recencyFilter:"All", pipelineStageFilter:"All", interestFilter:"All", judgementFilter:"All", placeFilter:"All", followUpFilter:"All", conversationFrom:"", conversationTo:"" };
  const state = { contacts, places:[{id:"p1",name:"Onyx"},{id:"p2",name:"Planet"}] };
  const filter = boundedFunction("getFilteredContacts", "nextFollowUpDate", {
    ui, state,
    relationshipScoreMap: () => new Map(), contactRecencyDays: () => 0, relationshipTrendDirection: () => "steady", relationshipActionState: () => "Covered",
    stageFor: contact => contact.stage || "No stage", placeMatchesContact: (place, contact) => place.id === contact.placeId || (!contact.placeId && place.name === contact.placeName),
    followUpFilterState: contact => !contact.followUps.length ? "No follow-up" : new Date(contact.followUps[0].dueDate) < new Date("2026-08-13T12:00:00") ? "Overdue" : "Scheduled",
    matchesVisibilityFilter: () => true, hasConversationInRange: () => true,
    peopleSearchText: contact => [contact.fullName, contact.placeName, contact.personalInfo, ...contact.conversations.map(item => item.notes)].join(" "),
    sortContacts: list => list, nextFollowUpDate: () => 0
  });
  Object.assign(ui, { pipelineStageFilter:"Prospect:PQI", interestFilter:"High", judgementFilter:"Good Fit", placeFilter:"id:p1", followUpFilter:"Overdue" });
  assert.deepEqual(filter().map(contact => contact.id), ["a"]);
  Object.assign(ui, { pipelineStageFilter:"All", interestFilter:"All", judgementFilter:"All", placeFilter:"All", followUpFilter:"All", search:"balcony" });
  assert.deepEqual(filter().map(contact => contact.id), ["a"]);
});

test("People presentation retains production search filters and uses exact canonical pipeline stages", () => {
  for (const id of ["peoplePipelineStage", "peopleInterest", "peopleJudgement", "peoplePlace", "peopleFollowUp", "healthBandFilter", "healthTrendFilter", "actionCoverageFilter", "recencyFilter", "peopleVisibility", "conversationFrom", "conversationTo", "peopleSort"]) assert.ok(source.includes(`id:\"${id}\"`) || source.includes(`id="${id}"`) || source.includes(`\"${id}\"`), `Missing People control ${id}`);
  assert.match(source, /Prospect: \["PQI", "QI\/P", "FUP", "LA"\]/);
  assert.match(source, /Customer: \["CNA", "Proposal", "Follow-Up", "Order Placed", "Active Customer"\]/);
  assert.ok(source.includes('data-clear-people-search'));
  assert.ok(source.includes('renderPeopleSearchSuggestions'));
  assert.ok(source.includes('class="people-search-screen__header"'));
  assert.ok(source.includes('<h2>Most recent</h2>'));
  assert.ok(source.includes('<h2>Places</h2>'));
  assert.equal(source.includes('people-search-screen__filters'), false);
  assert.ok(source.includes('const meta=matchContext||'));
  assert.equal(source.includes('people-row__match-context'), false);
  assert.ok(source.includes('navigatePresentation("person"'));
  assert.ok(source.includes('getFilteredContacts({ignoreSearch:true})'));
});
