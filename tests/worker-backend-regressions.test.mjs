import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";

const workerModule = await import(new URL(`../dist/server/index.js?worker-backend-regressions=${Date.now()}`, import.meta.url));
const worker = workerModule.default;
const { remindersForSubscription } = workerModule;
const migrations = [
  "../drizzle/0001_hosted_push_reminders.sql",
  "../drizzle/0002_shared_scorecards.sql",
  "../drizzle/0003_scorecard_previews.sql",
  "../drizzle/0004_accounts_cloud_sync.sql",
  "../drizzle/0005_analytics_cloud_sync.sql"
];

function sqliteD1(database) {
  const prepare = sql => {
    const statement = database.prepare(sql);
    let bindings = [];
    return {
      bind(...values) {
        bindings = values;
        return this;
      },
      async first() {
        return statement.get(...bindings) || null;
      },
      async all() {
        return { results: statement.all(...bindings) };
      },
      async run() {
        const result = statement.run(...bindings);
        return { success: true, meta: { changes: Number(result.changes) } };
      }
    };
  };
  return {
    prepare,
    async batch(statements) {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    }
  };
}

async function migratedDatabase() {
  const database = new DatabaseSync(":memory:");
  for (const migration of migrations) database.exec(await readFile(new URL(migration, import.meta.url), "utf8"));
  return database;
}

function request(path, { method = "GET", body, headers = {} } = {}) {
  return new Request(`https://bridge-api.example${path}`, {
    method,
    headers: { origin: "https://ileggett23.github.io", ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

function scorecardBody(ownerName = "Bridge") {
  return {
    scorecard: {
      ownerName,
      periodLabel: "Today",
      range: { start: "2026-08-28", end: "2026-08-28" },
      metrics: { conversations: 1, contacts: 1, prospects: 1, prospectiveCustomers: 0 },
      includeContacts: false
    }
  };
}

async function createAccount(env, sent, suffix) {
  const email = `worker-regression-${suffix}@example.com`;
  const password = "long-password-123";
  let response = await worker.fetch(request("/api/v1/auth/signup", { method: "POST", body: { email, password } }), env);
  assert.equal(response.status, 202);
  const verificationURL = new URL(sent.at(-1).text.match(/Verify email: (https:\/\/\S+)/)[1]);
  response = await worker.fetch(request("/api/v1/auth/verify-email", { method: "POST", body: { token: verificationURL.searchParams.get("verifyEmail") } }), env);
  assert.equal(response.status, 200);
  response = await worker.fetch(request("/api/v1/auth/login", { method: "POST", body: { email, password } }), env);
  assert.equal(response.status, 200);
  const login = await response.json();
  return { email, token: login.sessionToken };
}

test("scorecard revocation preserves owner sessions and legacy management-token security", async () => {
  const database = await migratedDatabase();
  const sent = [];
  const env = {
    AUTH_ENABLED: "true",
    AUTH_REQUIRE_TURNSTILE: "false",
    AUTH_HASH_PEPPER: "test-pepper",
    AUTH_EMAIL_FROM: "no-reply@bridgecrm.dev",
    PUBLIC_APP_URL: "https://ileggett23.github.io/Updated-BridgeCRM/",
    ALLOWED_ORIGINS: "https://ileggett23.github.io",
    DB: sqliteD1(database),
    EMAIL: { send: async message => { sent.push(message); return { ok: true }; } }
  };
  try {
    const owner = await createAccount(env, sent, "owner");
    const ownerHeaders = { authorization: `Bearer ${owner.token}` };
    let response = await worker.fetch(request("/api/scorecards", { method: "POST", body: scorecardBody("Owner"), headers: ownerHeaders }), env);
    assert.equal(response.status, 200);
    const owned = await response.json();
    response = await worker.fetch(request(`/api/scorecards/${owned.token}`, { method: "DELETE", headers: ownerHeaders }), env);
    assert.equal(response.status, 200);
    response = await worker.fetch(request(`/api/scorecards/${owned.token}`), env);
    assert.equal(response.status, 404);

    env.AUTH_ENABLED = "false";
    response = await worker.fetch(request("/api/scorecards", { method: "POST", body: scorecardBody("Legacy") }), env);
    assert.equal(response.status, 200);
    const legacy = await response.json();
    env.AUTH_ENABLED = "true";

    response = await worker.fetch(request(`/api/scorecards/${legacy.token}`, {
      method: "DELETE",
      headers: { ...ownerHeaders, "x-bridge-management-token": legacy.managementToken }
    }), env);
    assert.equal(response.status, 200);
    response = await worker.fetch(request(`/api/scorecards/${legacy.token}`), env);
    assert.equal(response.status, 404);
    response = await worker.fetch(request(`/api/scorecards/${legacy.token}`, {
      method: "DELETE",
      headers: { ...ownerHeaders, "x-bridge-management-token": legacy.managementToken }
    }), env);
    assert.equal(response.status, 404);

    env.AUTH_ENABLED = "false";
    response = await worker.fetch(request("/api/scorecards", { method: "POST", body: scorecardBody("Protected") }), env);
    const protectedLink = await response.json();
    env.AUTH_ENABLED = "true";
    response = await worker.fetch(request(`/api/scorecards/${protectedLink.token}`, {
      method: "DELETE",
      headers: { ...ownerHeaders, "x-bridge-management-token": "wrong-management-token" }
    }), env);
    assert.equal(response.status, 404);
    response = await worker.fetch(request(`/api/scorecards/${protectedLink.token}`), env);
    assert.equal(response.status, 200);

    env.AUTH_ENABLED = "false";
    response = await worker.fetch(request(`/api/scorecards/${protectedLink.token}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${protectedLink.managementToken}` }
    }), env);
    assert.equal(response.status, 200);
    response = await worker.fetch(request(`/api/scorecards/${protectedLink.token}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${protectedLink.managementToken}` }
    }), env);
    assert.equal(response.status, 404);
  } finally {
    database.close();
  }
});

test("push schedules normalize valid zones, reject invalid zones, and dispatch safely", async () => {
  const database = await migratedDatabase();
  const env = { AUTH_ENABLED: "false", ALLOWED_ORIGINS: "https://ileggett23.github.io", DB: sqliteD1(database) };
  const subscription = { endpoint: "https://push.example/subscription-regression", keys: { p256dh: "public-key", auth: "auth-secret" } };
  try {
    let response = await worker.fetch(request("/api/push/subscribe", {
      method: "POST",
      body: { subscription, timeZone: " America/Chicago " }
    }), env);
    assert.equal(response.status, 200);
    const registration = await response.json();
    assert.equal(database.prepare("SELECT time_zone FROM bridge_push_subscriptions WHERE endpoint = ?").get(subscription.endpoint).time_zone, "America/Chicago");

    const invalidEndpoint = "https://push.example/invalid-time-zone";
    response = await worker.fetch(request("/api/push/subscribe", {
      method: "POST",
      body: { subscription: { ...subscription, endpoint: invalidEndpoint }, timeZone: "Not/AZone" }
    }), env);
    assert.equal(response.status, 400);
    assert.equal(database.prepare("SELECT endpoint FROM bridge_push_subscriptions WHERE endpoint = ?").get(invalidEndpoint), undefined);

    const deviceHeaders = { authorization: `Bearer ${registration.deviceToken}` };
    response = await worker.fetch(request("/api/push/schedule", {
      method: "PUT",
      headers: deviceHeaders,
      body: { endpoint: subscription.endpoint, schedule: { notificationsEnabled: true, dailyReminderEnabled: true, dailyReminderTime: "09:00", dailyGoal: 5, timeZone: "America/Los_Angeles" } }
    }), env);
    assert.equal(response.status, 200);
    let stored = database.prepare("SELECT schedule_json, time_zone FROM bridge_push_subscriptions WHERE endpoint = ?").get(subscription.endpoint);
    assert.equal(stored.time_zone, "America/Los_Angeles");
    assert.equal(JSON.parse(stored.schedule_json).timeZone, "America/Los_Angeles");

    response = await worker.fetch(request("/api/push/schedule", {
      method: "PUT",
      headers: deviceHeaders,
      body: { endpoint: subscription.endpoint, schedule: { notificationsEnabled: true, timeZone: "Mars/Phobos" } }
    }), env);
    assert.equal(response.status, 400);
    stored = database.prepare("SELECT schedule_json, time_zone FROM bridge_push_subscriptions WHERE endpoint = ?").get(subscription.endpoint);
    assert.equal(stored.time_zone, "America/Los_Angeles");

    const reminders = remindersForSubscription({
      endpoint: subscription.endpoint,
      time_zone: "Not/AZone",
      schedule_json: JSON.stringify({ notificationsEnabled: true, dailyReminderEnabled: true, dailyReminderTime: "09:00", dailyGoal: 5 })
    }, { PUBLIC_APP_URL: "https://ileggett23.github.io/Updated-BridgeCRM/" }, new Date("2026-08-28T12:00:00.000Z"));
    assert.equal(reminders.length, 1);
  } finally {
    database.close();
  }
});
