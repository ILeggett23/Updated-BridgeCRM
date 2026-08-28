import test from "node:test";
import assert from "node:assert/strict";

await import(new URL("../src/network-logic.js", import.meta.url));
const { buildNetworkModel, strengthClass } = globalThis.BridgeNetwork;

const contacts = [{
  id: "ada", fullName: "Ada Lovelace", role: "Prospect", interestLevel: "High", judgement: "Good Fit", currentStage: "FUP",
  phoneNumber: "5551234567", placeId: "salon", placeName: "The Salon", companyId: "engine",
  conversations: [{ id: "talk", conversationDate: "2026-08-01T12:00:00.000Z" }],
  followUps: [{ id: "next", note: "Share the proposal", dueDate: "2026-08-12T15:00:00.000Z" }]
}, {
  id: "grace", fullName: "Grace Hopper", role: "Customer", currentStage: "Active Customer", placeName: "Unstored Cafe",
  conversations: [], followUps: []
}];
const scores = [{ contactId: "ada", score: 82, band: "Strong", trend: { direction: "improving" } }];

test("network model is deterministic and connects only saved relationship context", () => {
  const input = { contacts, places: [{ id: "salon", name: "The Salon", isFavorite: true }], companies: [], scores, now: "2026-08-09T12:00:00.000Z" };
  const first = buildNetworkModel(input);
  const second = buildNetworkModel(input);
  assert.deepEqual(first, second);
  assert.equal(first.personCount, 2);
  assert.equal(first.placeCount, 1);
  assert.equal(first.companyCount, 0);
  assert.ok(first.nodes.some(node => node.id === "place:salon"));
  assert.equal(first.nodes.some(node => node.label === "Unstored Cafe"), false);
  assert.ok(first.edges.some(edge => edge.source === "person:ada" && edge.target === "place:salon"));
});

test("person nodes retain real health, stage, recency, and next-action context", () => {
  const model = buildNetworkModel({ contacts: contacts.slice(0, 1), places: [{ id: "salon", name: "The Salon" }], scores, now: "2026-08-09T12:00:00.000Z" });
  const ada = model.nodes.find(node => node.id === "person:ada");
  assert.equal(ada.score, 82);
  assert.equal(ada.strength, "strong");
  assert.equal(ada.stage, "FUP");
  assert.equal(ada.lastConversationAt, Date.parse("2026-08-01T12:00:00.000Z"));
  assert.deepEqual(ada.nextAction, { id: "next", note: "Share the proposal", dueDate: "2026-08-12T15:00:00.000Z", overdue: false });
});

test("network strength cues reuse the existing relationship-health bands", () => {
  assert.equal(strengthClass("Strong", 80), "strong");
  assert.equal(strengthClass("Steady", 60), "steady");
  assert.equal(strengthClass("Needs Attention", 59), "attention");
  assert.equal(strengthClass("At Risk", 39), "attention");
  assert.equal(strengthClass("Building Baseline", null), "baseline");
});

test("company nodes require a genuine stored association", () => {
  const absent = buildNetworkModel({ contacts, companies: [], scores });
  assert.equal(absent.companyCount, 0);
  const supported = buildNetworkModel({ contacts, companies: [{ id: "engine", name: "Analytical Engines" }], scores });
  assert.equal(supported.companyCount, 1);
  assert.ok(supported.edges.some(edge => edge.source === "person:ada" && edge.target === "company:engine"));
});

test("entity filters retain the people that explain saved context", () => {
  const model = buildNetworkModel({ contacts, places: [{ id: "salon", name: "The Salon" }], scores, entityFilter: "places" });
  assert.deepEqual(model.nodes.map(node => node.id).sort(), ["person:ada", "place:salon", "you"]);
  assert.equal(model.edges.some(edge => edge.source === "you" && edge.target === "person:ada"), true);
  assert.equal(model.edges.some(edge => edge.source === "person:grace"), false);
});

test("large networks are capped after stable strength and recency ordering", () => {
  const many = Array.from({ length: 45 }, (_, index) => ({ id: `person-${index}`, fullName: `Person ${index}`, conversations: [], followUps: [] }));
  const model = buildNetworkModel({ contacts: many, maxPeople: 12 });
  assert.equal(model.personCount, 12);
  assert.equal(model.totalPeople, 45);
  assert.equal(model.truncated, true);
  assert.equal(model.nodes.length, 13);
});

test("network model ignores malformed records and keeps output finite", () => {
  const model = buildNetworkModel({
    contacts: [null, { id: "bad", conversations: [null, { conversationDate: "2026-02-30" }], followUps: { invalid: true } }],
    places: [null, { id: "place", name: "Place" }],
    companies: null,
    scores: [null, { contactId: "bad", score: Infinity }],
    now: "not-a-date",
    maxPeople: Infinity
  });
  assert.equal(model.personCount, 1);
  assert.equal(model.nodes.every(node => Number.isFinite(node.x) && Number.isFinite(node.y)), true);
  assert.equal(model.nodes.find(node => node.id === "person:bad").conversationCount, 0);
});
