import test from "node:test";
import assert from "node:assert/strict";

await import(new URL("../src/relationship-health-logic.js", import.meta.url));
const health = globalThis.BridgeRelationshipHealth;

const localDate = (year, month, day, hour = 12) => new Date(year, month - 1, day, hour, 0, 0, 0);
const conversation = (id, date) => ({ id, isCountedConversation: true, conversationDate: date.toISOString() });
const contact = overrides => ({
  id: "contact-1",
  fullName: "Jordan Reed",
  role: "Prospect",
  stages: { PQI: false, "QI/P": false, FUP: false, LA: false },
  createdAt: localDate(2026, 1, 1).toISOString(),
  conversations: [],
  followUps: [],
  ...overrides
});

test("active health summaries exclude No-Go and archived contacts", () => {
  const active = contact({ id: "active" });
  const noGo = contact({ id: "no-go", isFilteredOut: true });
  const archived = contact({ id: "archived", archivedAt: localDate(2026, 6, 1).toISOString() });
  assert.deepEqual(health.scoreContacts([active, noGo, archived]).map(item => item.contactId), ["active"]);
});

test("cadence resolves override, check-back, stage preset, and fallback in order", () => {
  const now = localDate(2026, 7, 30);
  const settings = {
    healthFallbackCadenceDays: 19,
    healthCadencePresets: { Prospect: { default: 12, FUP: 5 } }
  };
  assert.deepEqual(health.resolveCadence(contact({ healthCadenceDays: 9 }), settings, now), {
    days: 9,
    source: "contact override",
    stage: ""
  });
  const checkBack = health.resolveCadence(contact({
    createdAt: localDate(2026, 7, 1).toISOString(),
    checkBackDate: localDate(2026, 7, 18).toISOString()
  }), settings, now);
  assert.equal(checkBack.days, 17);
  assert.equal(checkBack.source, "check-back deadline");
  const staged = health.resolveCadence(contact({ stages: { FUP: true } }), settings, now);
  assert.equal(staged.days, 5);
  assert.equal(staged.source, "role and stage preset");
  assert.equal(health.resolveCadence(contact({ role: "Unknown" }), { healthFallbackCadenceDays: 19 }, now).days, 19);
});

test("calendar-day comparisons remain stable across local midnight and DST", () => {
  assert.equal(health.calendarDaysBetween(localDate(2026, 3, 9, 0), localDate(2026, 3, 8, 23)), 1);
  assert.equal(health.calendarDaysBetween(localDate(2026, 11, 2, 0), localDate(2026, 11, 1, 23)), 1);
});

test("score exposes deterministic components, records, band, and formula metadata", () => {
  const now = localDate(2026, 7, 30);
  const conversations = [
    conversation("c1", localDate(2026, 6, 5)),
    conversation("c2", localDate(2026, 6, 20)),
    conversation("c3", localDate(2026, 7, 5)),
    conversation("c4", localDate(2026, 7, 20))
  ];
  const result = health.scoreContact(contact({
    conversations,
    stages: { FUP: true },
    followUps: [{ id: "f1", dueDate: localDate(2026, 8, 2).toISOString(), status: "scheduled" }]
  }), { now });
  assert.equal(result.status, "scored");
  assert.equal(result.availableWeight, 100);
  assert.ok(Number.isInteger(result.score));
  assert.ok(["Strong", "Steady", "Needs Attention", "At Risk"].includes(result.band));
  assert.deepEqual(Object.keys(result.components), ["recency", "consistency", "actionHealth", "momentum"]);
  assert.ok(result.contributingRecords.includes("c4"));
  assert.ok(result.contributingRecords.includes("f1"));
  assert.equal(result.formulaVersion, health.FORMULA_VERSION);
  assert.match(result.explanation, /relationship health based on 4 available signals/);
});

test("insufficient native signal weight remains Building Baseline", () => {
  const result = health.scoreContact(contact({ conversations: [] }), { now: localDate(2026, 7, 30) });
  assert.equal(result.score, null);
  assert.equal(result.status, "building-baseline");
  assert.equal(result.band, "Building Baseline");
});

test("bands, confidence thresholds, and seven-day trend thresholds are centralized", () => {
  assert.equal(health.bandFor(80), "Strong");
  assert.equal(health.bandFor(60), "Steady");
  assert.equal(health.bandFor(40), "Needs Attention");
  assert.equal(health.bandFor(39), "At Risk");

  const now = localDate(2026, 7, 30);
  const conversations = [5, 15, 25, 35, 45, 55].map((offset, index) => conversation(`c${index}`, new Date(now.getTime() - offset * 86_400_000)));
  const high = health.scoreContact(contact({
    conversations,
    stages: { FUP: true },
    followUps: [1, 2, 3].map((item, index) => ({
      id: `f${item}`,
      dueDate: new Date(now.getTime() - (index + 2) * 86_400_000).toISOString(),
      completedAt: new Date(now.getTime() - (index + 3) * 86_400_000).toISOString(),
      status: "completed"
    }))
  }), { now });
  assert.equal(high.confidence, "High");

  const historical = {
    contactHealthEvents: [{
      contactId: "contact-1",
      score: Math.max(0, high.score - 8),
      calculatedAt: localDate(2026, 7, 20).toISOString(),
      formulaVersion: health.FORMULA_VERSION
    }]
  };
  const improving = health.scoreContact(contact({
    conversations,
    stages: { FUP: true },
    followUps: [{ id: "future", dueDate: localDate(2026, 8, 2).toISOString(), status: "scheduled" }]
  }), { now, analytics: historical });
  assert.ok(["improving", "steady"].includes(improving.trend.direction));
  assert.equal(improving.trend.comparedAt, historical.contactHealthEvents[0].calculatedAt);
});

test("health event history stores only changed calculated values", () => {
  const score = health.scoreContact(contact({
    conversations: [
      conversation("a", localDate(2026, 7, 2)),
      conversation("b", localDate(2026, 7, 16)),
      conversation("c", localDate(2026, 7, 29))
    ]
  }), { now: localDate(2026, 7, 30) });
  const once = health.recordHealthEvents({}, [score]);
  const twice = health.recordHealthEvents(once, [score]);
  assert.equal(once.contactHealthEvents.length, 1);
  assert.equal(twice.contactHealthEvents.length, 1);
  const changed = health.recordHealthEvents(twice, [{ ...score, score: score.score - 6, band: "Needs Attention", calculatedAt: localDate(2026, 8, 7).toISOString() }]);
  assert.equal(changed.contactHealthEvents.length, 2);
});

test("health scoring ignores malformed and future signals without mutating analytics input", () => {
  const now = localDate(2026, 7, 30);
  const contactData = contact({
    conversations: [null, { id: "invalid", isCountedConversation: true, conversationDate: "2026-02-30" }, conversation("past", localDate(2026, 7, 20))],
    followUps: [null, { id: "future", status: "completed", dueDate: localDate(2026, 7, 20).toISOString(), completedAt: localDate(2026, 8, 1).toISOString() }]
  });
  const analytics = { customField: "preserved", contactHealthEvents: [] };
  const score = health.scoreContact(contactData, { now, analytics });
  assert.equal(Number.isFinite(score.score), score.score !== null);
  assert.equal(analytics.contactHealthEvents.length, 0);
  const recorded = health.recordHealthEvents(analytics, [{ ...score, score: 72, calculatedAt: now.toISOString(), formulaVersion: health.FORMULA_VERSION }]);
  assert.equal(analytics.contactHealthEvents.length, 0);
  assert.equal(recorded.customField, "preserved");
  assert.equal(recorded.contactHealthEvents.length, 1);
});
