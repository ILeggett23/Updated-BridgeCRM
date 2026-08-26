import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

await import(new URL("../src/engagement-logic.js", import.meta.url));
const logic = globalThis.BridgeEngagement;
const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const engagementSource = await readFile(new URL("../src/engagement-logic.js", import.meta.url), "utf8");
const workerSource = await readFile(new URL("../src/sw.js", import.meta.url), "utf8");

const state = overrides => ({
  contacts: [],
  places: [],
  settings: { dailyGoal: 2, notificationsEnabled: true, followUpNotifications: true, dailyReminderEnabled: true, dailyReminderTime: "09:00" },
  meta: { achievements: {}, dailyReminderSentDate: null },
  ...overrides
});

test("achievements are calculated from durable Bridge activity", () => {
  const sample = state({
    contacts: [{
      conversations: [{ isCountedConversation: true, conversationDate: new Date().toISOString() }],
      followUps: [{ createdAt: "2026-07-01T12:00:00Z", completedAt: "2026-07-02T12:00:00Z" }],
      stageEvents: [{ stage: "LA", occurredAt: "2026-07-03T12:00:00Z" }]
    }],
    places: [{ isFavorite: true }]
  });
  const result = logic.evaluateAchievements(sample, {});
  assert.ok(result.newlyUnlocked.includes("first-contact"));
  assert.ok(result.newlyUnlocked.includes("first-conversation"));
  assert.ok(result.newlyUnlocked.includes("follow-through"));
  assert.ok(result.newlyUnlocked.includes("first-launch"));
  assert.ok(result.newlyUnlocked.includes("favorite-stop"));
});

test("pipeline achievements count every exact Prospect and Customer stage", () => {
  const stages = ["PQI", "QI/P", "FUP", "LA", "CNA", "Proposal", "Follow-Up", "Order Placed", "Active Customer"];
  const stageEvents = stages.map((stage, index) => index % 2 ? { stage: "superseded", toStage: stage } : { stage });
  stageEvents.push({ stage: "MSA" }, { stage: "DTM" }, { stage: "Not a Bridge stage" });
  const metrics = logic.achievementMetrics(state({ contacts: [{ conversations: [], followUps: [], stageEvents }] }));

  assert.equal(metrics.pipelineMoves, stages.length);
  assert.equal(metrics.launches, 1);
});

test("persisted achievements do not unlock repeatedly", () => {
  const sample = state({ contacts: [{ conversations: [], followUps: [], stageEvents: [] }] });
  const result = logic.evaluateAchievements(sample, { "first-contact": "2026-07-01T12:00:00Z" });
  assert.equal(result.newlyUnlocked.includes("first-contact"), false);
  assert.equal(result.progress.find(item => item.id === "first-contact").unlockedAt, "2026-07-01T12:00:00Z");
});

test("follow-up reminders respect settings and deduplication", () => {
  const now = new Date("2026-07-12T15:00:00Z");
  const followUp = { id: "f1", dueDate: "2026-07-12T14:00:00Z", completedAt: null, notificationSentAt: null };
  const sample = state({ contacts: [{ id: "c1", fullName: "Jordan", archivedAt: null, followUps: [followUp], conversations: [], stageEvents: [] }] });
  assert.equal(logic.dueReminderEvents(sample, now).filter(event => event.type === "followup").length, 1);
  followUp.notificationSentAt = "2026-07-12T14:01:00Z";
  assert.equal(logic.dueReminderEvents(sample, now).filter(event => event.type === "followup").length, 0);
  sample.settings.notificationsEnabled = false;
  assert.equal(logic.dueReminderEvents(sample, now).length, 0);
});

test("follow-up reminders exclude archived and No-Go contacts", () => {
  const now = new Date("2026-07-12T15:00:00Z");
  const followUp = { id: "f1", dueDate: "2026-07-12T14:00:00Z", completedAt: null, notificationSentAt: null };
  const sample = state({ contacts: [
    { id: "active", archivedAt: null, isFilteredOut: false, followUps: [followUp], conversations: [], stageEvents: [] },
    { id: "no-go", archivedAt: null, isFilteredOut: true, followUps: [{ ...followUp, id: "f2" }], conversations: [], stageEvents: [] },
    { id: "archived", archivedAt: "2026-07-01T00:00:00Z", isFilteredOut: false, followUps: [{ ...followUp, id: "f3" }], conversations: [], stageEvents: [] }
  ] });
  assert.deepEqual(logic.dueReminderEvents(sample, now).filter(event => event.type === "followup").map(event => event.contact.id), ["active"]);
});

test("daily reminders stop after the goal or after being sent", () => {
  const now = new Date("2026-07-12T15:00:00");
  const key = logic.dayKey(now);
  const sample = state({ contacts: [], meta: { achievements: {}, dailyReminderSentDate: null } });
  assert.equal(logic.dueReminderEvents(sample, now).some(event => event.type === "daily"), true);
  sample.contacts = [{ conversations: [{ isCountedConversation: true, conversationDate: `${key}T12:00:00` }, { isCountedConversation: true, conversationDate: `${key}T13:00:00` }], followUps: [], stageEvents: [] }];
  assert.equal(logic.dueReminderEvents(sample, now).some(event => event.type === "daily"), false);
  sample.contacts = [];
  sample.meta.dailyReminderSentDate = key;
  assert.equal(logic.dueReminderEvents(sample, now).some(event => event.type === "daily"), false);
});

test("daily goal streak requires completing the saved goal today and on consecutive days", () => {
  const now = new Date("2026-07-12T18:00:00");
  const today = logic.dayKey(now);
  const yesterday = logic.dayKey(new Date("2026-07-11T12:00:00"));
  const sample = state({ contacts: [{ conversations: [
    { isCountedConversation: true, conversationDate: `${today}T09:00:00` },
    { isCountedConversation: true, conversationDate: `${today}T10:00:00` },
    { isCountedConversation: true, conversationDate: `${yesterday}T09:00:00` },
    { isCountedConversation: true, conversationDate: `${yesterday}T10:00:00` }
  ], followUps: [], stageEvents: [] }] });
  const metrics = logic.dailyGoalMetrics(sample, now);
  assert.equal(metrics.todayComplete, true);
  assert.equal(metrics.yesterdayComplete, true);
  assert.equal(metrics.goalStreak, 2);
  assert.equal(logic.achievementMetrics(sample).goalStreak >= 0, true);
});

test("a completed day starts fresh when the prior day did not meet the goal", () => {
  const now = new Date("2026-07-12T18:00:00");
  const today = logic.dayKey(now);
  const yesterday = logic.dayKey(new Date("2026-07-11T12:00:00"));
  const sample = state({ contacts: [{ conversations: [
    { isCountedConversation: true, conversationDate: `${today}T09:00:00` },
    { isCountedConversation: true, conversationDate: `${today}T10:00:00` },
    { isCountedConversation: true, conversationDate: `${yesterday}T09:00:00` }
  ], followUps: [], stageEvents: [] }] });
  const metrics = logic.dailyGoalMetrics(sample, now);
  assert.equal(metrics.todayComplete, true);
  assert.equal(metrics.yesterdayComplete, false);
  assert.equal(metrics.goalStreak, 1);
});

test("a partial day ignores future dates and regular activity while preserving yesterday's earned streak", () => {
  const now = new Date("2026-07-12T18:00:00");
  const today = logic.dayKey(now);
  const yesterday = logic.dayKey(new Date("2026-07-11T12:00:00"));
  const sample = state({ contacts: [{ conversations: [
    { isCountedConversation: true, conversationDate: `${today}T09:00:00` },
    { isCountedConversation: true, conversationDate: `${yesterday}T09:00:00` },
    { isCountedConversation: true, conversationDate: `${yesterday}T10:00:00` },
    { isCountedConversation: true, conversationDate: "2026-07-13T09:00:00" },
    { isCountedConversation: false, conversationDate: `${today}T10:00:00`, communicationType: "Text" }
  ], followUps: [{ dueDate: `${today}T10:00:00` }], stageEvents: [{ stage: "PQI", occurredAt: `${today}T10:00:00` }] }] });
  const metrics = logic.dailyGoalMetrics(sample, now);
  assert.equal(metrics.todayCount, 1);
  assert.equal(metrics.todayComplete, false);
  assert.equal(metrics.goalStreak, 1);
});

test("an unfinished current day keeps yesterday's earned streak visible", () => {
  const now = new Date("2026-07-12T18:00:00");
  const yesterday = logic.dayKey(new Date("2026-07-11T18:00:00"));
  const sample = state({ contacts: [{ conversations: [
    { isCountedConversation: true, conversationDate: `${yesterday}T09:00:00` },
    { isCountedConversation: true, conversationDate: `${yesterday}T10:00:00` }
  ], followUps: [], stageEvents: [] }] });
  const metrics = logic.dailyGoalMetrics(sample, now);
  assert.equal(metrics.todayComplete, false);
  assert.equal(metrics.yesterdayComplete, true);
  assert.equal(metrics.goalStreak, 1);
});

test("streaks respect the saved goal and recalculate after backdated activity changes", () => {
  const now = new Date("2026-07-12T18:00:00");
  const today = logic.dayKey(now);
  const yesterday = logic.dayKey(new Date("2026-07-11T12:00:00"));
  const contact = { conversations: [
    { isCountedConversation: true, conversationDate: `${today}T09:00:00` },
    { isCountedConversation: true, conversationDate: `${today}T10:00:00` },
    { isCountedConversation: true, conversationDate: `${today}T11:00:00` },
    { isCountedConversation: true, conversationDate: `${yesterday}T10:00:00` },
    { isCountedConversation: true, conversationDate: `${yesterday}T11:00:00` },
    { isCountedConversation: true, conversationDate: `${yesterday}T12:00:00` }
  ] };
  const sample = state({ contacts: [contact], settings: { ...state().settings, dailyGoal: 3 } });
  assert.equal(logic.dailyGoalMetrics(sample, now).goalStreak, 2);
  contact.conversations.pop();
  assert.equal(logic.dailyGoalMetrics(sample, now).goalStreak, 1);
  contact.conversations.push({ isCountedConversation: true, conversationDate: `${yesterday}T12:00:00` });
  assert.equal(logic.dailyGoalMetrics(sample, now).goalStreak, 2);
});

function countedOn(...dates) {
  return [{ conversations: dates.map(date => ({ isCountedConversation: true, conversationDate: `${date}T12:00:00` })), followUps: [], stageEvents: [] }];
}

test("a missed excluded date preserves continuity without incrementing the streak", () => {
  const now = new Date(2026, 6, 12, 18);
  const sample = state({
    contacts: countedOn("2026-07-10", "2026-07-12"),
    settings: { ...state().settings, dailyGoal: 1, streakExcludedDates: ["2026-07-11"] }
  });
  const metrics = logic.dailyGoalMetrics(sample, now);
  assert.equal(metrics.goalStreak, 2);
  assert.equal(metrics.completedDayCount, 2);
  assert.deepEqual(metrics.excludedDates, ["2026-07-11"]);
});

test("consecutive excluded dates are neutral while an ordinary missed day still breaks continuity", () => {
  const now = new Date(2026, 6, 12, 18);
  const sample = state({
    contacts: countedOn("2026-07-09", "2026-07-12"),
    settings: { ...state().settings, dailyGoal: 1, streakExcludedDates: ["2026-07-10", "2026-07-11"] }
  });
  assert.equal(logic.dailyGoalMetrics(sample, now).goalStreak, 2);
  sample.settings.streakExcludedDates = ["2026-07-11"];
  assert.equal(logic.dailyGoalMetrics(sample, now).goalStreak, 1);
});

test("an excluded today preserves the previously earned streak and future exclusions have no effect", () => {
  const now = new Date(2026, 6, 12, 18);
  const sample = state({
    contacts: countedOn("2026-07-11"),
    settings: { ...state().settings, dailyGoal: 1, streakExcludedDates: ["2026-07-12", "2026-08-01"] }
  });
  const metrics = logic.dailyGoalMetrics(sample, now);
  assert.equal(metrics.todayExcluded, true);
  assert.equal(metrics.goalStreak, 1);
  sample.settings.streakExcludedDates = ["2026-08-01"];
  assert.equal(logic.dailyGoalMetrics(sample, now).goalStreak, 1);
});

test("a completed excluded date remains a completed goal day but stays neutral in the consecutive streak", () => {
  const now = new Date(2026, 6, 12, 18);
  const sample = state({
    contacts: countedOn("2026-07-10", "2026-07-11", "2026-07-12"),
    settings: { ...state().settings, dailyGoal: 1, streakExcludedDates: ["2026-07-11"] }
  });
  const metrics = logic.dailyGoalMetrics(sample, now);
  assert.equal(metrics.completedDayCount, 3);
  assert.equal(metrics.goalStreak, 2);
  assert.equal(metrics.todayCount, 1);
});

test("removing an exclusion immediately lets the same missed date break the recalculated streak", () => {
  const now = new Date(2026, 6, 12, 18);
  const sample = state({
    contacts: countedOn("2026-07-10", "2026-07-12"),
    settings: { ...state().settings, dailyGoal: 1, streakExcludedDates: ["2026-07-11"] }
  });
  assert.equal(logic.dailyGoalMetrics(sample, now).goalStreak, 2);
  sample.settings.streakExcludedDates = [];
  assert.equal(logic.dailyGoalMetrics(sample, now).goalStreak, 1);
});

test("rest days use local calendar arithmetic across a daylight-saving transition", () => {
  const now = new Date(2026, 2, 10, 18);
  const sample = state({
    contacts: countedOn("2026-03-07", "2026-03-09", "2026-03-10"),
    settings: { ...state().settings, dailyGoal: 1, streakExcludedDates: ["2026-03-08"] }
  });
  assert.equal(logic.dailyGoalMetrics(sample, now).goalStreak, 3);
});

test("multiple weekly rest days preserve streak continuity without adding streak days", () => {
  const now = new Date(2026, 6, 13, 18);
  const sample = state({
    contacts: countedOn("2026-07-10", "2026-07-13"),
    settings: { ...state().settings, dailyGoal: 1, streakRestRules: [{ frequency: "weekly", weekdays: [0, 6] }] }
  });
  const metrics = logic.dailyGoalMetrics(sample, now);
  assert.equal(metrics.goalStreak, 2);
  assert.equal(metrics.todayExcluded, false);
  assert.deepEqual(metrics.restRules, [{ frequency: "weekly", weekdays: [0, 6] }]);
});

test("monthly and yearly rest schedules apply on their recurring calendar dates", () => {
  const monthly = state({
    contacts: countedOn("2026-07-14", "2026-07-16"),
    settings: { ...state().settings, dailyGoal: 1, streakRestRules: [{ frequency: "monthly", day: 15 }] }
  });
  assert.equal(logic.dailyGoalMetrics(monthly, new Date(2026, 6, 16, 18)).goalStreak, 2);

  const yearly = state({
    contacts: countedOn("2026-07-02", "2026-07-04"),
    settings: { ...state().settings, dailyGoal: 1, streakRestRules: [{ frequency: "yearly", date: "07-03" }] }
  });
  assert.equal(logic.dailyGoalMetrics(yearly, new Date(2026, 6, 4, 18)).goalStreak, 2);
});

test("recurring rest rules are normalized, deduplicated, and reject invalid values", () => {
  assert.deepEqual(logic.normalizeRestRules([
    { frequency: "weekly", weekdays: [6, 0, 6, 9, "1"] },
    { frequency: "weekly", weekdays: [0, 1, 6] },
    { frequency: "monthly", day: 31 },
    { frequency: "monthly", day: 0 },
    { frequency: "yearly", date: "02-29" },
    { frequency: "yearly", date: "02-30" }
  ]), [
    { frequency: "weekly", weekdays: [0, 1, 6] },
    { frequency: "monthly", day: 31 },
    { frequency: "yearly", date: "02-29" }
  ]);
});

test("persisted rest dates are canonical, deduplicated, sorted, and backward compatible", () => {
  assert.deepEqual(logic.normalizeExcludedDates(undefined), []);
  assert.deepEqual(logic.normalizeExcludedDates("2026-07-11"), []);
  assert.deepEqual(logic.normalizeExcludedDates([
    "2026-07-12",
    "2026-02-30",
    "07/11/2026",
    "2026-07-11",
    "2026-07-12",
    "2026-7-10",
    20260710
  ]), ["2026-07-11", "2026-07-12"]);
});

test("JSON backup round trips valid excluded dates without changing conversation totals", () => {
  const before = state({
    contacts: countedOn("2026-07-11", "2026-07-12"),
    settings: { ...state().settings, dailyGoal: 1, streakExcludedDates: ["2026-07-11"] }
  });
  const restored = JSON.parse(JSON.stringify(before));
  restored.settings.streakExcludedDates = logic.normalizeExcludedDates(restored.settings.streakExcludedDates);
  assert.deepEqual(restored.settings.streakExcludedDates, ["2026-07-11"]);
  assert.equal(restored.contacts.flatMap(contact => contact.conversations).length, 2);
  assert.equal(logic.dailyGoalMetrics(restored, new Date(2026, 6, 12, 18)).completedDayCount, 2);
});

test("JSON backup round trips recurring schedules alongside legacy one-time dates", () => {
  const before = state({
    contacts: countedOn("2026-07-10", "2026-07-13"),
    settings: {
      ...state().settings,
      dailyGoal: 1,
      streakExcludedDates: ["2026-12-25"],
      streakRestRules: [{ frequency: "weekly", weekdays: [0, 6] }]
    }
  });
  const restored = JSON.parse(JSON.stringify(before));
  restored.settings.streakExcludedDates = logic.normalizeExcludedDates(restored.settings.streakExcludedDates);
  restored.settings.streakRestRules = logic.normalizeRestRules(restored.settings.streakRestRules);
  assert.deepEqual(restored.settings.streakRestRules, [{ frequency: "weekly", weekdays: [0, 6] }]);
  assert.deepEqual(restored.settings.streakExcludedDates, ["2026-12-25"]);
  assert.equal(logic.dailyGoalMetrics(restored, new Date(2026, 6, 13, 18)).goalStreak, 2);
});

test("PWA notifications and favorite stars are wired accessibly", () => {
  assert.match(workerSource, /notificationclick/);
  assert.match(workerSource, /bridge-app-v1\.3\.35/);
  assert.match(workerSource, /addEventListener\("push"/);
  assert.match(workerSource, /setAppBadge/);
  assert.match(appSource, /aria-label="Favorite place"/);
  assert.match(appSource, /Notification\.requestPermission/);
  assert.match(appSource, /pushManager\.subscribe/);
  assert.match(workerSource, /bridge-reminder-schedule/);
  assert.match(workerSource, /readReminderSchedule/);
  assert.match(engagementSource, /Complete your first scheduled follow-up/);
});
