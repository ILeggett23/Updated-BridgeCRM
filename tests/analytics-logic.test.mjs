import test from "node:test";
import assert from "node:assert/strict";

await import(new URL("../src/communication-logic.js", import.meta.url));
await import(new URL("../src/analytics-logic.js", import.meta.url));
const { analyticsRange, buildInsightsModel, inAnalyticsRange, normalizePhone, uniquePhoneCaptures } = globalThis.BridgeAnalytics;

const parts = date => [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours()];

test("day analytics uses one complete local calendar day", () => {
  const range = analyticsRange({ mode: "day", anchor: "2026-07-13" });
  assert.deepEqual(parts(range.start), [2026, 7, 13, 0]);
  assert.deepEqual(parts(range.end), [2026, 7, 13, 23]);
  assert.equal(inAnalyticsRange("2026-07-13T12:00:00", range), true);
  assert.equal(inAnalyticsRange("2026-07-14T00:00:00", range), false);
  assert.match(range.label, /July 13, 2026/);
});

test("week analytics follows the configured local week start", () => {
  const sundayWeek = analyticsRange({ mode: "week", anchor: "2026-07-15", weekStart: 0 });
  assert.deepEqual(parts(sundayWeek.start).slice(0, 3), [2026, 7, 12]);
  assert.deepEqual(parts(sundayWeek.end).slice(0, 3), [2026, 7, 18]);
  assert.match(sundayWeek.label, /July 12.*18, 2026/);

  const mondayWeek = analyticsRange({ mode: "week", anchor: "2026-07-15", weekStart: 1 });
  assert.deepEqual(parts(mondayWeek.start).slice(0, 3), [2026, 7, 13]);
  assert.deepEqual(parts(mondayWeek.end).slice(0, 3), [2026, 7, 19]);
});

test("month analytics uses the selected calendar month", () => {
  const range = analyticsRange({ mode: "month", anchor: "2026-02-18" });
  assert.deepEqual(parts(range.start).slice(0, 3), [2026, 2, 1]);
  assert.deepEqual(parts(range.end).slice(0, 3), [2026, 2, 28]);
  assert.match(range.label, /February 2026/);
});

test("custom analytics includes both selected dates and normalizes reverse input", () => {
  const range = analyticsRange({ mode: "custom", anchor: "2026-07-13", customStart: "2026-07-20", customEnd: "2026-07-10" });
  assert.deepEqual(parts(range.start).slice(0, 3), [2026, 7, 10]);
  assert.deepEqual(parts(range.end).slice(0, 3), [2026, 7, 20]);
  assert.equal(inAnalyticsRange("2026-07-10T00:00:00", range), true);
  assert.equal(inAnalyticsRange("2026-07-20T23:59:59", range), true);
  assert.match(range.label, /July 10.*20, 2026/);
});

test("phone capture analytics count each number once on its first capture date", () => {
  const contacts = [
    { id: "first", capturedPhoneNumber: "(479) 555-0101", phoneCapturedAt: "2026-07-10T12:00:00" },
    { id: "duplicate", capturedPhoneNumber: "+1 479-555-0101", phoneCapturedAt: "2026-07-12T12:00:00" },
    { id: "second", capturedPhoneNumber: "479-555-0102", phoneCapturedAt: "2026-07-13T12:00:00" },
    { id: "missing", capturedPhoneNumber: "", phoneCapturedAt: null }
  ];
  assert.equal(normalizePhone("+1 (479) 555-0101"), "4795550101");
  assert.equal(uniquePhoneCaptures(contacts).length, 2);
  assert.equal(uniquePhoneCaptures(contacts, analyticsRange({ mode: "day", anchor: "2026-07-12" })).length, 0);
  assert.equal(uniquePhoneCaptures(contacts, analyticsRange({ mode: "day", anchor: "2026-07-13" })).length, 1);
});

test("Insights derives activity without remapping pipeline stages or inventing place events", () => {
  const range = analyticsRange({ mode: "week", anchor: "2026-08-12", weekStart: 0 });
  const pipelines = {
    Prospect: ["PQI", "QI/P", "FUP", "LA"],
    Customer: ["CNA", "Proposal", "Follow-Up", "Order Placed", "Active Customer"]
  };
  const contacts = [
    {
      id: "prospect",
      fullName: "Prospect Person",
      role: "Prospect",
      placeId: "coffee",
      dateFirstMet: "2026-08-10T12:00:00",
      stages: { "QI/P": true },
      stageDates: { "QI/P": "2026-08-11T12:00:00" },
      stageEvents: [
        { stage: "PQI", toStage: "PQI", occurredAt: "2026-07-01T12:00:00" },
        { stage: "QI/P", fromStage: "PQI", toStage: "QI/P", occurredAt: "2026-08-11T12:00:00" }
      ],
      conversations: [
        { id: "conversation", type: "Prospecting", isCountedConversation: true, conversationDate: "2026-08-10T12:00:00" },
        { id: "call", communicationType: "Call", outcome: "Connected", isCountedConversation: false, conversationDate: "2026-08-10T14:00:00" }
      ],
      followUps: [{ id: "follow", createdAt: "2026-08-10T14:00:00", dueDate: "2026-08-11T14:00:00", completedAt: "2026-08-11T15:00:00", status: "completed" }]
    },
    {
      id: "customer",
      fullName: "Customer Person",
      role: "Customer",
      placeName: "Coffee Lab",
      dateFirstMet: "2026-05-01T12:00:00",
      stages: { "Active Customer": true },
      stageDates: { "Active Customer": "2026-05-01T12:00:00" },
      stageEvents: [{ stage: "Active Customer", toStage: "Active Customer", occurredAt: "2026-05-01T12:00:00" }],
      conversations: [{ id: "conversation-2", type: "Product Discussion", isCountedConversation: true, conversationDate: "2026-08-09T12:00:00" }],
      followUps: []
    }
  ];
  const model = buildInsightsModel({
    contacts,
    places: [{ id: "coffee", name: "Coffee Lab" }],
    range,
    pipelines,
    dailyGoal: 1,
    now: new Date("2026-08-12T12:00:00"),
    resolveCurrentStage: contact => contact.role === "Prospect" ? "QI/P" : "Active Customer"
  });

  assert.equal(model.conversations.length, 2);
  assert.equal(model.newPeople.length, 1);
  assert.deepEqual(model.pipelineEvents.map(item => item.stage), ["QI/P"]);
  assert.equal(model.currentStageCounts.Prospect["QI/P"], 1);
  assert.equal(model.currentStageCounts.Customer["Active Customer"], 1);
  assert.equal(model.currentStageCounts.Customer["Follow-Up"], 0);
  assert.equal(model.followUpCompletion, 100);
  assert.equal(model.completedFollowUps.length, 1);
  assert.equal(model.communicationOutcomes.Connected, 1);
  assert.equal(model.stalledRelationships[0].stage, "Active Customer");
  assert.deepEqual(model.placeActivity.map(item => ({ name: item.place.name, conversations: item.recordedConversations, movements: item.movements })), [
    { name: "Coffee Lab", conversations: 2, movements: 1 }
  ]);
});

test("Insights preserves canonical historical movements after a Prospect becomes a Customer", () => {
  const pipelines = {
    Prospect: ["PQI", "QI/P", "FUP", "LA"],
    Customer: ["CNA", "Proposal", "Follow-Up", "Order Placed", "Active Customer"]
  };
  const contact = {
    id: "converted",
    role: "Customer",
    placeId: "office",
    stages: { "Active Customer": true },
    stageDates: { "Active Customer": "2026-08-12T11:00:00" },
    stageEvents: [
      { stage: "QI/P", toStage: "QI/P", occurredAt: "2026-08-12T08:00:00" },
      { stage: "CNA", toStage: "Active Customer", occurredAt: "2026-08-12T09:00:00" },
      { stage: "MSA", occurredAt: "2026-08-12T10:00:00" },
      { stage: "DTM", toStage: "DTM", occurredAt: "2026-08-12T10:30:00" },
      { stage: "Not a Bridge stage", occurredAt: "2026-08-12T11:30:00" }
    ],
    conversations: [],
    followUps: []
  };
  const model = buildInsightsModel({
    contacts: [contact],
    places: [{ id: "office", name: "Office" }],
    range: analyticsRange({ mode: "day", anchor: "2026-08-12" }),
    pipelines,
    resolveCurrentStage: () => "Active Customer"
  });

  assert.deepEqual(model.pipelineEvents.map(item => item.stage), ["QI/P", "Active Customer"]);
  assert.deepEqual(model.standaloneEvents.map(item => item.stage), ["MSA", "DTM"]);
  assert.equal(model.currentStageCounts.Prospect["QI/P"], 0);
  assert.equal(model.currentStageCounts.Customer["Active Customer"], 1);
  assert.equal(model.placeActivity[0].movements, 2);
});

test("Insights returns unavailable percentages when a period has insufficient activity", () => {
  const model = buildInsightsModel({
    contacts: [],
    places: [],
    range: analyticsRange({ mode: "day", anchor: "2026-08-12" }),
    pipelines: { Prospect: ["PQI"], Customer: ["CNA"] }
  });
  assert.equal(model.followUpCompletion, null);
  assert.equal(model.goalConsistency, null);
  assert.deepEqual(model.placeActivity, []);
  assert.deepEqual(model.standaloneEvents, []);
  assert.equal(model.daySeries[0].value, 0);
});
