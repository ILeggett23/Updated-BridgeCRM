import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";

const worker = (await import(new URL(`../dist/server/index.js?account-regressions=${Date.now()}`, import.meta.url))).default;
const migrationFiles = [
  "../drizzle/0001_hosted_push_reminders.sql",
  "../drizzle/0002_shared_scorecards.sql",
  "../drizzle/0003_scorecard_previews.sql",
  "../drizzle/0004_accounts_cloud_sync.sql",
  "../drizzle/0005_analytics_cloud_sync.sql"
];

function createDatabase() {
  const database = new DatabaseSync(":memory:");
  return { database, ready: Promise.all(migrationFiles.map(file => readFile(new URL(file, import.meta.url), "utf8"))).then(files => files.forEach(sql => database.exec(sql))) };
}

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

function memoryBucket() {
  const objects = new Map();
  return {
    objects,
    async put(key, value) {
      objects.set(key, String(value));
      return {};
    },
    async get(key) {
      const value = objects.get(key);
      if (value === undefined) return null;
      return { size: new TextEncoder().encode(value).byteLength, async text() { return value; } };
    },
    async delete(key) {
      objects.delete(key);
    }
  };
}

function request(path, body, method = "POST", headers = {}) {
  return new Request(`https://bridge-api.example${path}`, {
    method,
    headers: { origin: "https://ileggett23.github.io", "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

async function makeAccount() {
  const { database, ready } = createDatabase();
  await ready;
  const sent = [];
  const bucket = memoryBucket();
  const env = {
    AUTH_ENABLED: "true",
    AUTH_REQUIRE_TURNSTILE: "false",
    AUTH_EMAIL_FROM: "no-reply@bridgecrm.dev",
    AUTH_HASH_PEPPER: "test-pepper",
    PUBLIC_APP_URL: "https://ileggett23.github.io/Updated-BridgeCRM/",
    ALLOWED_ORIGINS: "https://ileggett23.github.io",
    DB: sqliteD1(database),
    EMAIL: { send: async message => { sent.push(message); return { ok: true }; } },
    USER_BACKUPS: bucket
  };
  const email = `account-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const password = "long-password-123";
  let response = await worker.fetch(request("/api/v1/auth/signup", { email, password }), env);
  assert.equal(response.status, 202);
  const verifyURL = new URL(sent.at(-1).text.match(/Verify email: (https:\/\/\S+)/)[1]);
  response = await worker.fetch(request("/api/v1/auth/verify-email", { token: verifyURL.searchParams.get("verifyEmail") }), env);
  assert.equal(response.status, 200);
  response = await worker.fetch(request("/api/v1/auth/login", { email, password }), env);
  assert.equal(response.status, 200);
  const login = await response.json();
  return { database, env, bucket, auth: { authorization: `Bearer ${login.sessionToken}` }, email, password, sent };
}

test("account endpoints reject non-object JSON and boolean-shaped deletes", async () => {
  const account = await makeAccount();
  try {
    let response = await worker.fetch(request("/api/v1/auth/login", null), account.env);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "invalid_body");

    response = await worker.fetch(request("/api/v1/sync/push", {
      clientId: "regression-client",
      cursor: 0,
      mutations: [{
        mutationId: "delete-shaped-string",
        record: { type: "contact", id: "contact-1", payload: { id: "contact-1", name: "Keep" }, expectedRevision: 0, deleted: "false" }
      }]
    }, "POST", account.auth), account.env);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).results[0].status, "invalid");
  } finally {
    account.database.close();
  }
});

test("sync pull returns the last page cursor instead of skipping records", async () => {
  const account = await makeAccount();
  try {
    const userId = account.database.prepare("SELECT id FROM bridge_users LIMIT 1").get().id;
    account.database.prepare("INSERT INTO bridge_user_sync (user_id, next_cursor, updated_at) VALUES (?1, ?2, ?3)").run(userId, 2001, new Date().toISOString());
    const insert = account.database.prepare("INSERT INTO bridge_crm_records (user_id, record_type, record_id, payload_json, revision, sync_cursor, created_at, updated_at) VALUES (?1, 'contact', ?2, ?3, 1, ?4, ?5, ?5)");
    const now = new Date().toISOString();
    for (let index = 1; index <= 2001; index += 1) insert.run(userId, `contact-${index}`, JSON.stringify({ id: `contact-${index}` }), index, now);

    let response = await worker.fetch(request("/api/v1/sync/pull?cursor=0", undefined, "GET", account.auth), account.env);
    const firstPage = await response.json();
    assert.equal(response.status, 200);
    assert.equal(firstPage.records.length, 2000);
    assert.equal(firstPage.cursor, 2000);
    assert.equal(firstPage.hasMore, true);

    response = await worker.fetch(request(`/api/v1/sync/pull?cursor=${firstPage.cursor}`, undefined, "GET", account.auth), account.env);
    const secondPage = await response.json();
    assert.equal(secondPage.records.length, 1);
    assert.equal(secondPage.records[0].id, "contact-2001");
    assert.equal(secondPage.cursor, 2001);
    assert.equal(secondPage.hasMore, false);
  } finally {
    account.database.close();
  }
});

test("password action tokens are single-use and backup objects are size/checksum checked", async () => {
  const account = await makeAccount();
  try {
    let response = await worker.fetch(request("/api/v1/backups", {}, "POST", account.auth), account.env);
    assert.equal(response.status, 201);
    const backup = await response.json();
    const backupRow = account.database.prepare("SELECT object_key FROM bridge_backup_runs WHERE id = ?").get(backup.id);
    const original = account.bucket.objects.get(backupRow.object_key);
    response = await worker.fetch(request(`/api/v1/backups/${backup.id}`, undefined, "GET", account.auth), account.env);
    assert.equal(response.status, 200);
    account.bucket.objects.set(backupRow.object_key, `${original.slice(0, -1)} `);
    response = await worker.fetch(request(`/api/v1/backups/${backup.id}`, undefined, "GET", account.auth), account.env);
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error.code, "backup_checksum_failed");

    response = await worker.fetch(request("/api/v1/auth/forgot-password", { email: account.email }), account.env);
    assert.equal(response.status, 202);
    const resetURL = new URL(account.sent.at(-1).text.match(/Reset password: (https:\/\/\S+)/)[1]);
    const resetToken = resetURL.searchParams.get("resetPassword");
    response = await worker.fetch(request("/api/v1/auth/reset-password", { token: resetToken, password: "new-long-password-123" }), account.env);
    assert.equal(response.status, 200);
    response = await worker.fetch(request("/api/v1/auth/reset-password", { token: resetToken, password: "another-long-password" }), account.env);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "invalid_token");

  } finally {
    account.database.close();
  }
});
