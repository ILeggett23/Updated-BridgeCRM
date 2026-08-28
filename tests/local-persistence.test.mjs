import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

function normalizeHarness() {
  const start = app.indexOf("function normalizeState");
  const end = app.indexOf("function syncAchievements", start);
  assert.ok(start >= 0 && end > start, "normalizeState implementation must remain available");
  let generatedId = 0;
  const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const defaultState = () => ({
    contacts: [],
    places: [],
    settings: {
      name: "",
      firstName: "",
      lastName: "",
      dailyGoal: 5,
      weeklyGoal: 25,
      monthlyGoal: 100,
      autoArchiveInactive: false,
      streakExcludedDates: [],
      streakRestRules: [],
      healthScoresVisible: true,
      healthNotificationsEnabled: false,
      healthFallbackCadenceDays: 14,
      healthCadencePresets: {}
    },
    analytics: { dailySnapshots: [], contactHealthEvents: [] },
    meta: { version: 6, achievements: {} }
  });
  const context = {
    isRecord,
    defaultState,
    uid: () => `generated-${++generatedId}`,
    nowISO: () => "2026-08-28T12:00:00.000Z",
    dateOnly: value => new Date(String(value).length === 10 ? `${value}T12:00:00` : value),
    ALL_STAGES: ["MSA", "DTM", "PQI", "QI/P", "FUP", "LA", "CNA", "Proposal", "Follow-Up", "Order Placed", "Active Customer", "Recommendation"],
    PIPELINES: { Prospect: ["PQI", "QI/P", "FUP", "LA"], Customer: ["CNA", "Proposal", "Follow-Up", "Order Placed", "Active Customer"], Team: [] },
    LEGACY_PIPELINE_ALIASES: { Customer: { Recommendation: "Proposal" } },
    INTERESTS: ["Unsure", "Low", "Medium", "High"],
    CONVERSATION_TYPES: ["Prospecting", "Product Discussion", "Sampling", "Team-Check In", "Follow-Up", "Other"],
    normalizeExcludedDates: value => Array.isArray(value) ? value : [],
    normalizeRestRules: value => Array.isArray(value) ? value : [],
    normalizeCadencePresets: value => isRecord(value) ? value : {},
    DEFAULT_CADENCE_PRESETS: {},
    normalizePipelineStages: () => {},
    archiveInactiveContacts: () => 0,
    normalizeAnalyticsState: value => ({ ...(isRecord(value) ? value : {}), dailySnapshots: Array.isArray(value?.dailySnapshots) ? [...value.dailySnapshots] : [], contactHealthEvents: Array.isArray(value?.contactHealthEvents) ? [...value.contactHealthEvents] : [] }),
    result: null
  };
  vm.runInNewContext(app.slice(start, end), context);
  return { context, normalizeStateSource: app.slice(start, end) };
}

test("anonymous state falls back to durable data when localStorage contains corrupt JSON", async () => {
  const start = app.indexOf("function parsePersistedState");
  const end = app.indexOf("function finishStateHydration", start);
  assert.ok(start >= 0 && end > start, "persisted state helpers must remain available");
  const context = {
    localCache: { get: () => "{not-json" },
    durableCache: { get: async () => JSON.stringify({ contacts: [{ id: "durable-contact" }], places: [] }) },
    normalizeState: value => value,
    defaultState: () => ({ contacts: [], places: [] }),
    isRecord: value => value !== null && typeof value === "object" && !Array.isArray(value),
    result: null
  };
  await vm.runInNewContext(`${app.slice(start, end)}\n(async () => { result = await readBestPersistedState(); })()`, context);
  assert.equal((await context.result).contacts[0].id, "durable-contact");
});

test("anonymous state treats a malformed persisted shape as corrupt instead of masking durable data", async () => {
  const start = app.indexOf("function parsePersistedState");
  const end = app.indexOf("function finishStateHydration", start);
  const context = {
    localCache: { get: () => JSON.stringify({ contacts: "not-an-array", places: [] }) },
    durableCache: { get: async () => JSON.stringify({ contacts: [{ id: "durable-shape-contact" }], places: [] }) },
    normalizeState: value => value,
    defaultState: () => ({ contacts: [], places: [] }),
    isRecord: value => value !== null && typeof value === "object" && !Array.isArray(value),
    result: null
  };
  await vm.runInNewContext(`${app.slice(start, end)}\n(async () => { result = await readBestPersistedState(); })()`, context);
  assert.equal((await context.result).contacts[0].id, "durable-shape-contact");
});

test("cloud-error fallback uses the durable snapshot when localStorage is corrupt", async () => {
  const start = app.indexOf("async function loadState");
  const end = app.indexOf("async function loadSharedScorecard", start);
  assert.ok(start >= 0 && end > start, "loadState implementation must remain available");
  const durableState = { contacts: [{ id: "durable-cloud-fallback" }], places: [] };
  const context = {
    cloudStateAvailable: true,
    fetch: async () => { throw new Error("offline"); },
    readBestPersistedState: async () => durableState,
    finishStateHydration: () => {},
    $: () => ({ replaceChildren: () => {} }),
    document: { createTextNode: value => value },
    state: null,
    result: null
  };
  await vm.runInNewContext(`${app.slice(start, end)}\n(async () => { await loadState(); result = state; })()`, context);
  assert.equal(context.result.contacts[0].id, "durable-cloud-fallback");
});

test("normalized contacts and places preserve unknown fields and tolerate malformed records", () => {
  const { context } = normalizeHarness();
  context.input = {
    workspaceExtension: { enabled: true },
    settings: { customSetting: "kept", theme: "retired", firstName: "Taylor" },
    contacts: [
      null,
      "not-a-contact",
      {
        id: "contact-1",
        fullName: "Taylor Brooks",
        role: "Prospect",
        customField: { source: "imported" },
        stageDates: { PQI: "2026-08-01T12:00:00.000Z", customStage: "2026-08-02T12:00:00.000Z" },
        stages: { PQI: true },
        stageEvents: [null, { id: "event-1", stage: "PQI", customEventField: "kept" }],
        conversations: [null, { id: "log-1", isCountedConversation: true, customLogField: 42, conversationDate: "2026-08-01T12:00:00.000Z" }],
        followUps: [null, { id: "follow-1", dueDate: "2026-08-05T12:00:00.000Z", customFollowUpField: true }],
        notes: ["keep this note"]
      }
    ],
    places: [null, "not-a-place", { id: "place-1", name: "Cafe", customPlaceField: ["kept"] }],
    analytics: { customAnalyticsField: { preserved: true }, dailySnapshots: [], contactHealthEvents: [] },
    meta: { customMetaField: "kept", achievements: {} }
  };
  vm.runInNewContext("result = normalizeState(input);", context);
  const normalized = context.result;
  assert.deepEqual(normalized.workspaceExtension, { enabled: true });
  assert.equal(normalized.settings.customSetting, "kept");
  assert.equal("theme" in normalized.settings, false);
  assert.equal(normalized.contacts.length, 1);
  assert.deepEqual(normalized.contacts[0].customField, { source: "imported" });
  assert.equal(normalized.contacts[0].stageDates.customStage, "2026-08-02T12:00:00.000Z");
  assert.equal(normalized.contacts[0].stageEvents[0].customEventField, "kept");
  assert.equal(normalized.contacts[0].conversations[0].customLogField, 42);
  assert.equal(normalized.contacts[0].followUps[0].customFollowUpField, true);
  assert.equal(normalized.places.length, 1);
  assert.deepEqual(normalized.places[0].customPlaceField, ["kept"]);
  assert.deepEqual(normalized.analytics.customAnalyticsField, { preserved: true });
  assert.equal(normalized.meta.customMetaField, "kept");
});

test("durable cache closes read and write connections and handles transaction aborts", async () => {
  const start = app.indexOf("const durableCache = {");
  const end = app.indexOf("const PIPELINES", start);
  assert.ok(start >= 0 && end > start, "durable cache implementation must remain available");
  let closeCount = 0;
  let stored = null;
  const database = {
    objectStoreNames: { contains: () => true },
    transaction() {
      const transaction = {
        objectStore: () => ({
          get: () => {
            const request = { transaction };
            queueMicrotask(() => { request.result = stored; request.onsuccess?.(); });
            return request;
          },
          put: value => { stored = value; queueMicrotask(() => transaction.oncomplete?.()); }
        }),
        addEventListener: (name, handler) => { transaction[`on${name}`] = handler; }
      };
      return transaction;
    },
    close: () => { closeCount += 1; }
  };
  const request = {};
  const context = { window: { indexedDB: { open: () => { queueMicrotask(() => request.onsuccess?.()); request.result = database; return request; } } }, indexedDB: { open: () => { queueMicrotask(() => request.onsuccess?.()); request.result = database; return request; } }, queueMicrotask, Error, result: null };
  vm.runInNewContext(`${app.slice(start, end)}\nresult = durableCache;`, context);
  const cache = context.result;
  await cache.set("snapshot");
  assert.equal(closeCount, 1);
  assert.equal(await cache.get(), "snapshot");
  assert.equal(closeCount, 2);
});

test("backup parsing requires the minimum state shape before normalization", async () => {
  const start = app.indexOf("function validateBackupDocument");
  const end = app.indexOf("async function readAnonymousState", start);
  assert.ok(start >= 0 && end > start, "backup parser must remain available");
  const context = {
    isRecord: value => value !== null && typeof value === "object" && !Array.isArray(value),
    normalizeState: value => ({ normalized: value }),
    result: null
  };
  const source = app.slice(start, end);
  const parse = async value => {
    const isolated = { ...context, input: value };
    vm.runInNewContext(`${source}\nresult = parseBackupDocument(input);`, isolated);
    return isolated.result;
  };
  assert.equal(JSON.stringify(await parse(JSON.stringify({ contacts: [], places: [], custom: "kept" }))), JSON.stringify({ normalized: { contacts: [], places: [], custom: "kept" } }));
  await assert.rejects(parse("{broken"), /valid JSON/);
  await assert.rejects(parse(JSON.stringify({ contacts: [] })), /missing contacts or places/);
  await assert.rejects(parse(JSON.stringify({ contacts: [null], places: [] })), /invalid contact/);
  await assert.rejects(parse(JSON.stringify({ contacts: [], places: [], settings: [] })), /invalid settings/);
});

test("import validates before opening the destructive replacement confirmation", () => {
  const handler = app.slice(app.indexOf("$('#importBackup')"), app.indexOf("function csvCell", app.indexOf("$('#importBackup')")));
  assert.match(handler, /const imported=parseBackupDocument\(await file\.text\(\)\)/);
  assert.ok(handler.indexOf("parseBackupDocument") < handler.indexOf("requestConfirmation"));
  assert.match(handler, /catch\(error\)\{input\.value='';showToast\(error\?\.message/);
});

test("export/import round trips analytics, historical records, schedules, and extension fields", () => {
  const { context } = normalizeHarness();
  const backup = {
    contacts: [{ id: "contact-1", fullName: "Taylor", role: "Prospect", customField: "contact-extension", stages: { PQI: true }, stageDates: { PQI: "2026-08-01T12:00:00.000Z" }, stageEvents: [{ id: "event-1", stage: "PQI", occurredAt: "2026-08-01T12:00:00.000Z", historicalExtension: "kept" }], conversations: [{ id: "log-1", isCountedConversation: true, conversationDate: "2026-08-01T12:00:00.000Z", historicalExtension: { source: "legacy" } }], followUps: [{ id: "follow-1", dueDate: "2026-08-05T12:00:00.000Z", status: "completed", completedAt: "2026-08-06T12:00:00.000Z", scheduleExtension: 7 }] }],
    places: [{ id: "place-1", name: "Cafe", placeExtension: true }],
    settings: { streakExcludedDates: ["2026-12-25"], streakRestRules: [{ frequency: "weekly", weekdays: [0, 6] }], settingExtension: "kept" },
    analytics: { dailySnapshots: [{ date: "2026-08-01", value: 1 }], contactHealthEvents: [], analyticsExtension: { preserved: true } },
    meta: { version: 6, achievements: { first: "2026-08-01T12:00:00.000Z" }, metaExtension: "kept" }
  };
  context.input = JSON.parse(JSON.stringify(backup));
  vm.runInNewContext("result = normalizeState(input);", context);
  const restored = context.result;
  assert.equal(restored.contacts[0].customField, "contact-extension");
  assert.equal(restored.contacts[0].stageEvents[0].historicalExtension, "kept");
  assert.deepEqual(restored.contacts[0].conversations[0].historicalExtension, { source: "legacy" });
  assert.equal(restored.contacts[0].followUps[0].scheduleExtension, 7);
  assert.equal(restored.places[0].placeExtension, true);
  assert.equal(restored.settings.settingExtension, "kept");
  assert.deepEqual(restored.analytics.analyticsExtension, { preserved: true });
  assert.equal(restored.meta.metaExtension, "kept");
});
