import test from "node:test";
import assert from "node:assert/strict";

await import(new URL("../src/scorecard-logic.js", import.meta.url));
const { createSnapshot, scorecardSummary } = globalThis.BridgeScorecard;

test("scorecard snapshots preserve only the approved metrics and contact fields", () => {
  const snapshot = createSnapshot({
    ownerName: "Isaiah Leggett",
    range: { label: "July 25, 2026", start: "2026-07-25", end: "2026-07-25" },
    metrics: { conversations: 7, contacts: 4, prospects: 5, prospectiveCustomers: 2 },
    includeContacts: true,
    contacts: [{ fullName: "Lance Rodriguez", role: "Prospect", pipelineStage: "QI/P", placeName: "Coffee shop", phoneNumber: "+14795550101", notes: "Private" }]
  });
  assert.equal(snapshot.ownerName, "Isaiah");
  assert.deepEqual(snapshot.metrics, { conversations: 7, contacts: 4, prospects: 5, prospectiveCustomers: 2 });
  assert.deepEqual(snapshot.contacts[0], { initials: "LR", name: "Lance Rodriguez", role: "Prospect", pipelineStage: "QI/P", placeName: "Coffee shop" });
  assert.equal("phoneNumber" in snapshot.contacts[0], false);
  assert.equal("notes" in snapshot.contacts[0], false);
});

test("scorecard-only snapshots never include contacts", () => {
  const snapshot = createSnapshot({ metrics: {}, includeContacts: false, contacts: [{ fullName: "Private Person" }] });
  assert.equal(snapshot.includeContacts, false);
  assert.deepEqual(snapshot.contacts, []);
  assert.equal(scorecardSummary(snapshot), "0 conversations, 0 contacts, 0 prospects, and 0 prospective customers");
});

test("snapshot creation fails closed for malformed input and truthy non-boolean sharing flags", () => {
  const snapshot = createSnapshot({ includeContacts: "yes", contacts: [{ fullName: "Private Person" }] });
  assert.equal(snapshot.includeContacts, false);
  assert.deepEqual(snapshot.contacts, []);
  assert.equal(createSnapshot(null).includeContacts, false);
});
