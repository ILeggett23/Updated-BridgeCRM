import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

const accountRuntime = await readFile(new URL("../src/server/account-runtime.js", import.meta.url), "utf8");
const accountClient = await readFile(new URL("../src/account-client.js", import.meta.url), "utf8");
const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const page = await readFile(new URL("../src/index.html", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../src/sw.js", import.meta.url), "utf8");
const migration = await readFile(new URL("../drizzle/0004_accounts_cloud_sync.sql", import.meta.url), "utf8");
const analyticsMigration = await readFile(new URL("../drizzle/0005_analytics_cloud_sync.sql", import.meta.url), "utf8");
const wrangler = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const worker = (await import(new URL("../dist/server/index.js", import.meta.url))).default;

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

function accountRequest(path, body) {
  return new Request(`https://bridge-api.example${path}`, {
    method: "POST",
    headers: { origin: "https://ileggett23.github.io", "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

test("cloud accounts expose the configured production dependencies", async () => {
  assert.match(wrangler, /"AUTH_ENABLED": "true"/);
  assert.match(wrangler, /"AUTH_REQUIRE_TURNSTILE": "true"/);
  assert.match(wrangler, /"AUTH_EMAIL_FROM": "no-reply@bridgecrm\.dev"/);
  assert.match(wrangler, /"AUTH_EMAIL_NAME": "Bridge"/);
  assert.match(wrangler, /"send_email"/);
  assert.match(wrangler, /"name": "EMAIL"/);
  assert.match(wrangler, /"allowed_sender_addresses": \["no-reply@bridgecrm\.dev"\]/);
  for (const secret of ["AUTH_HASH_PEPPER", "TURNSTILE_SECRET_KEY", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT", "PUSH_DISPATCH_SECRET"]) {
    assert.match(wrangler, new RegExp(`"${secret}"`));
  }
  assert.match(wrangler, /"secrets"\s*:\s*\{\s*"required"/);
  assert.match(wrangler, /"PUBLIC_APP_URL": "https:\/\/ileggett23\.github\.io\/Updated-BridgeCRM\/"/);
  assert.match(wrangler, /"ALLOWED_ORIGINS": "https:\/\/ileggett23\.github\.io"/);

  const response = await worker.fetch(new Request("https://bridge-api.example/api/v1/config", {
    headers: { origin: "https://ileggett23.github.io" }
  }), {
    AUTH_ENABLED: "true",
    AUTH_REQUIRE_TURNSTILE: "true",
    AUTH_EMAIL_FROM: "no-reply@bridgecrm.dev",
    TURNSTILE_SITE_KEY: "0x4AAAAAAEBFY9H4PCiJInux",
    TURNSTILE_SECRET_KEY: "test-secret",
    BACKEND_ONLY: "true",
    ALLOWED_ORIGINS: "https://ileggett23.github.io",
    EMAIL: { send: async () => ({ ok: true }) },
    USER_BACKUPS: {}
  });
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(result, {
    authEnabled: true,
    turnstileSiteKey: "0x4AAAAAAEBFY9H4PCiJInux",
    emailConfigured: true,
    cloudBackupConfigured: true,
    sessionTransport: "bearer-indexeddb",
    productionReady: true
  });
  assert.equal(response.headers.get("cache-control"), "no-store, private");
  assert.equal(response.headers.get("pragma"), "no-cache");
  assert.equal(response.headers.get("access-control-allow-origin"), "https://ileggett23.github.io");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000; includeSubDomains");
  assert.match(response.headers.get("permissions-policy") || "", /camera=\(\)/);
});

test("account APIs reject unknown browser origins and missing production storage", async () => {
  const rejected = await worker.fetch(new Request("https://bridge-api.example/api/v1/config", {
    headers: { origin: "https://attacker.example" }
  }), {
    AUTH_ENABLED: "false",
    BACKEND_ONLY: "true",
    ALLOWED_ORIGINS: "https://ileggett23.github.io"
  });
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.has("access-control-allow-origin"), false);

  const unavailable = await worker.fetch(new Request("https://bridge-api.example/api/v1/account", {
    headers: {
      origin: "https://ileggett23.github.io",
      authorization: "Bearer unavailable"
    }
  }), {
    AUTH_ENABLED: "true",
    BACKEND_ONLY: "true",
    ALLOWED_ORIGINS: "https://ileggett23.github.io"
  });
  const body = await unavailable.json();
  assert.equal(unavailable.status, 503);
  assert.equal(body.error.code, "service_unavailable");
});

test("authentication uses strengthened password derivation, server-side Turnstile, and rate limits", () => {
  assert.match(accountRuntime, /ACCOUNT_PASSWORD_ITERATIONS = 100000/);
  assert.match(accountRuntime, /name: "PBKDF2"/);
  assert.match(accountRuntime, /hash: "SHA-256"/);
  assert.match(accountRuntime, /crypto\.subtle\.deriveBits/);
  assert.match(accountRuntime, /password\.length >= 12/);
  assert.match(accountRuntime, /https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/siteverify/);
  assert.match(accountRuntime, /secret: env\.TURNSTILE_SECRET_KEY/);
  assert.match(accountRuntime, /idempotency_key: crypto\.randomUUID\(\)/);
  assert.match(accountRuntime, /bridge_auth_rate_limits/);
  assert.match(accountRuntime, /Too many attempts\. Try again later\./);
  assert.match(accountRuntime, /email_verification_required/);
  assert.match(accountRuntime, /UPDATE bridge_sessions SET revoked_at/);
});

test("a repeated unverified signup rotates credentials before invalidating prior verification tokens", () => {
  const signup = accountRuntime.slice(
    accountRuntime.indexOf('if (path === ACCOUNT_API_PREFIX + "/auth/signup"'),
    accountRuntime.indexOf('if (path === ACCOUNT_API_PREFIX + "/auth/verify-email"')
  );
  const credentialUpdate = signup.indexOf("UPDATE bridge_users SET email_display = ?1, password_hash = ?2");
  const tokenIssue = signup.indexOf('accountIssueActionToken(env, user, "verify_email", request)');
  assert.ok(credentialUpdate >= 0, "duplicate signup must replace the unverified credential");
  assert.ok(tokenIssue > credentialUpdate, "credential rotation must complete before a new token is issued");
  assert.match(signup, /WHERE id = \?8 AND verified_at IS NULL AND deleted_at IS NULL/);
  assert.match(signup, /if \(!update\.meta\?\.changes\) return accountJSON\(\{ ok: true, verificationRequired: true \}, 202\)/);

  const issueToken = accountRuntime.slice(
    accountRuntime.indexOf("async function accountIssueActionToken"),
    accountRuntime.indexOf("async function accountSendActionEmail")
  );
  assert.match(issueToken, /UPDATE bridge_account_tokens SET used_at = \?1 WHERE user_id = \?2 AND purpose = \?3 AND used_at IS NULL/);
});

test("an earlier verification link cannot activate credentials replaced by a later signup", async () => {
  const database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE bridge_users (
      id TEXT PRIMARY KEY NOT NULL,
      email_normalized TEXT NOT NULL UNIQUE,
      email_display TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_iterations INTEGER NOT NULL,
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      verified_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      disabled_at TEXT,
      deleted_at TEXT
    );
    CREATE TABLE bridge_account_tokens (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      purpose TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      request_ip_hash TEXT
    );
    CREATE TABLE bridge_auth_rate_limits (
      bucket_key TEXT PRIMARY KEY NOT NULL,
      window_started_at INTEGER NOT NULL,
      request_count INTEGER NOT NULL,
      blocked_until INTEGER
    );
  `);
  const sentEmails = [];
  const env = {
    AUTH_ENABLED: "true",
    AUTH_REQUIRE_TURNSTILE: "false",
    AUTH_EMAIL_FROM: "no-reply@bridgecrm.dev",
    AUTH_HASH_PEPPER: "test-pepper",
    PUBLIC_APP_URL: "https://ileggett23.github.io/Updated-BridgeCRM/",
    BACKEND_ONLY: "true",
    ALLOWED_ORIGINS: "https://ileggett23.github.io",
    DB: sqliteD1(database),
    EMAIL: { send: async message => { sentEmails.push(message); return { ok: true }; } }
  };
  try {
    const first = await worker.fetch(accountRequest("/api/v1/auth/signup", {
      email: "owner@example.com",
      password: "attacker-password-1",
      firstName: "Attacker"
    }), env);
    assert.equal(first.status, 202);
    const initial = database.prepare("SELECT password_hash, password_salt FROM bridge_users WHERE email_normalized = ?").get("owner@example.com");
    const firstLink = new URL(sentEmails[0].text.match(/Verify email: (https:\/\/\S+)/)[1]);
    const firstToken = firstLink.searchParams.get("verifyEmail");

    const second = await worker.fetch(accountRequest("/api/v1/auth/signup", {
      email: "Owner@Example.com",
      password: "owner-password-updated",
      firstName: "Owner"
    }), env);
    assert.equal(second.status, 202);
    const rotated = database.prepare(
      "SELECT password_hash, password_salt, first_name, verified_at FROM bridge_users WHERE email_normalized = ?"
    ).get("owner@example.com");
    assert.notEqual(rotated.password_hash, initial.password_hash);
    assert.notEqual(rotated.password_salt, initial.password_salt);
    assert.equal(rotated.first_name, "Owner");
    assert.equal(rotated.verified_at, null);
    assert.equal(database.prepare("SELECT used_at FROM bridge_account_tokens ORDER BY created_at, rowid LIMIT 1").get().used_at !== null, true);

    const staleVerification = await worker.fetch(accountRequest("/api/v1/auth/verify-email", { token: firstToken }), env);
    assert.equal(staleVerification.status, 400);
    assert.equal((await staleVerification.json()).error.code, "invalid_token");
    assert.equal(database.prepare("SELECT verified_at FROM bridge_users WHERE email_normalized = ?").get("owner@example.com").verified_at, null);

    const currentLink = new URL(sentEmails[1].text.match(/Verify email: (https:\/\/\S+)/)[1]);
    const currentVerification = await worker.fetch(accountRequest("/api/v1/auth/verify-email", {
      token: currentLink.searchParams.get("verifyEmail")
    }), env);
    assert.equal(currentVerification.status, 200);
    assert.notEqual(database.prepare("SELECT verified_at FROM bridge_users WHERE email_normalized = ?").get("owner@example.com").verified_at, null);
  } finally {
    database.close();
  }
});

test("sessions stay out of localStorage and are verified by a server-side token hash", () => {
  assert.match(accountClient, /const DB_NAME = "bridge-account"/);
  assert.match(accountClient, /const STORES = \["secure", "states", "sync", "mutations"\]/);
  assert.match(accountClient, /setStoreValue\("secure", "session", next\)/);
  assert.equal(accountClient.includes("localStorage"), false);
  assert.match(accountClient, /headers\.set\("authorization", `Bearer \$\{session\.token\}`\)/);
  assert.match(accountClient, /cache: "no-store"/);

  assert.match(accountRuntime, /await sha256\(rawToken\)/);
  assert.match(accountRuntime, /WHERE s\.token_hash = \?1 AND s\.revoked_at IS NULL/);
  assert.match(accountRuntime, /s\.expires_at > \?2/);
  assert.match(accountRuntime, /u\.disabled_at IS NULL AND u\.deleted_at IS NULL/);
});

test("GitHub Pages loads the real account client and exposes verification recovery", () => {
  assert.ok(page.indexOf("account-client.js?v=1.3.32") < page.indexOf("app.js?v=1.3.32"));
  assert.match(serviceWorker, /new URL\("account-client\.js", ROOT\)\.href/);
  assert.match(accountClient, /data-auth-mode="resend"/);
  assert.match(accountClient, /await resendVerification\(values\.email, securityToken\)/);
  assert.match(accountClient, /Resend verification email/);
  assert.match(accountClient, /email: values\.email \|\| email/);
  assert.doesNotMatch(styles, /\.hn-auth-brand \.auth-logo \{[^}]*filter:/);
  assert.match(styles, /\.hn-auth-card \.auth-submit \{ min-height: 44px/);
  assert.match(styles, /\.hn-auth-card \.auth-links button \{ min-height: 44px/);
});

test("password documentation matches the compatibility-preserving runtime", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  const accountDocs = await readFile(new URL("../CLOUD_ACCOUNTS.md", import.meta.url), "utf8");
  assert.match(accountRuntime, /ACCOUNT_PASSWORD_ITERATIONS = 100000/);
  assert.match(accountDocs, /currently 100,000/);
  assert.match(accountDocs, /AUTH_HASH_PEPPER[^\n]+request IP and device fingerprints/);
  assert.match(readme, /it is not part of password derivation/);
  assert.doesNotMatch(accountDocs, /210,000/);
});

test("sync storage and mutations are isolated per user, revision-aware, and idempotent", () => {
  assert.match(migration, /PRIMARY KEY \(user_id, record_type, record_id\)/);
  assert.match(migration, /PRIMARY KEY \(user_id, mutation_id\)/);
  assert.match(accountRuntime, /WHERE user_id = \?1 AND mutation_id = \?2/);
  assert.match(accountRuntime, /WHERE user_id = \?1 AND record_type = \?2 AND record_id = \?3/);
  assert.match(accountRuntime, /serverRevision !== record\.expectedRevision/);
  assert.match(accountRuntime, /status: "conflict"/);
  assert.match(accountRuntime, /idempotent: true/);
  assert.match(accountClient, /userStorageId\(session\.user\.id\)/);
  assert.match(accountClient, /`\$\{session\.user\.id\}:\$\{mutation\.mutationId\}`/);
  assert.match(accountClient, /stateQueue = stateQueue\.catch\(\(\) => \{\}\)\.then/);
  assert.match(accountClient, /Offline changes will sync later/);
});

test("analytics record migration preserves existing data and accepts only supported record types", () => {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE bridge_users (id TEXT PRIMARY KEY NOT NULL);
      CREATE TABLE bridge_crm_records (
        user_id TEXT NOT NULL,
        record_type TEXT NOT NULL CHECK (record_type IN ('contact', 'place', 'settings', 'meta')),
        record_id TEXT NOT NULL,
        payload_json TEXT,
        revision INTEGER NOT NULL DEFAULT 1,
        sync_cursor INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        PRIMARY KEY (user_id, record_type, record_id),
        FOREIGN KEY (user_id) REFERENCES bridge_users(id) ON DELETE CASCADE
      );
      CREATE INDEX bridge_crm_records_pull ON bridge_crm_records(user_id, sync_cursor);
      INSERT INTO bridge_users (id) VALUES ('user-1');
      INSERT INTO bridge_crm_records
        (user_id, record_type, record_id, payload_json, revision, sync_cursor, created_at, updated_at, deleted_at)
      VALUES
        ('user-1', 'contact', 'contact-1', '{"name":"Preserved"}', 7, 42, '2026-08-01T00:00:00.000Z', '2026-08-02T00:00:00.000Z', NULL);
    `);
    database.exec(analyticsMigration);

    const preserved = database.prepare(
      "SELECT payload_json, revision, sync_cursor, created_at, updated_at, deleted_at FROM bridge_crm_records WHERE user_id = ? AND record_type = ? AND record_id = ?"
    ).get("user-1", "contact", "contact-1");
    assert.deepEqual({ ...preserved }, {
      payload_json: '{"name":"Preserved"}',
      revision: 7,
      sync_cursor: 42,
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-02T00:00:00.000Z",
      deleted_at: null
    });

    database.prepare(
      "INSERT INTO bridge_crm_records (user_id, record_type, record_id, payload_json, revision, sync_cursor, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run("user-1", "analytics", "analytics", '{"weekly":5}', 1, 43, "2026-08-03T00:00:00.000Z", "2026-08-03T00:00:00.000Z");
    assert.equal(database.prepare("SELECT record_type FROM bridge_crm_records WHERE record_id = ?").get("analytics").record_type, "analytics");
    assert.throws(() => database.prepare(
      "INSERT INTO bridge_crm_records (user_id, record_type, record_id, sync_cursor, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("user-1", "unsupported", "bad", 44, "2026-08-03T00:00:00.000Z", "2026-08-03T00:00:00.000Z"), /constraint failed/i);
  } finally {
    database.close();
  }
});

test("restore atomically drops only the restored user's queued mutations before resetting sync metadata", () => {
  const helper = accountClient.slice(
    accountClient.indexOf("async function commitRestoredState"),
    accountClient.indexOf("async function digest")
  );
  assert.match(helper, /transaction\(\["mutations", "states", "sync"\], "readwrite"\)/);
  assert.match(helper, /const mutationPrefix = `\$\{userId\}:`/);
  assert.match(helper, /String\(cursor\.key\)\.startsWith\(mutationPrefix\)/);
  assert.ok(helper.indexOf('objectStore("mutations").openCursor()') < helper.indexOf('objectStore("sync").put('));

  const restore = accountClient.slice(
    accountClient.indexOf("async function restoreBackup"),
    accountClient.indexOf("async function deleteAccount")
  );
  assert.match(restore, /const restoringUserId = session\?\.user\?\.id \|\| ""/);
  assert.match(restore, /clearTimeout\(syncTimer\)/);
  assert.match(restore, /restoreInProgress = true/);
  assert.match(restore, /await stateQueue\.catch\(\(\) => \{\}\)/);
  assert.match(restore, /await waitForActiveSync\(\)/);
  assert.match(restore, /session\?\.user\?\.id === restoringUserId/);
  assert.match(restore, /await commitRestoredState\(restoringUserId, cleanState\)/);
  assert.match(restore, /stateQueue = Promise\.resolve\(\)/);
  assert.match(restore, /finally \{\s*restoreInProgress = false/);
  assert.doesNotMatch(restore, /setStoreValue\("sync"/);

  const queueState = accountClient.slice(
    accountClient.indexOf("function queueState"),
    accountClient.indexOf("async function queueStateInternal")
  );
  const syncNow = accountClient.slice(
    accountClient.indexOf("async function syncNow"),
    accountClient.indexOf("function scheduleSync")
  );
  assert.match(queueState, /restoreInProgress \? undefined : queueStateInternal/);
  assert.match(syncNow, /if \(restoreInProgress \|\| syncing/);
});

test("signed-in persistence bypasses anonymous CRM caches", () => {
  const queueSave = appSource.slice(appSource.indexOf("function queueSave("), appSource.indexOf("async function requestPersistentStorage"));
  const silentSave = appSource.slice(appSource.indexOf("async function persistStateSilently("), appSource.indexOf("async function sendBridgeNotification"));

  assert.match(queueSave, /accountClient\.queueState\(accountSnapshot\)/);
  assert.match(queueSave, /return;\s*\}\s*localCache\.set\(snapshot\)/);
  assert.match(silentSave, /if \(accountModeActive\(\)\) \{[\s\S]*accountClient\.queueState/);
  assert.match(silentSave, /return;\s*\}\s*localCache\.set\(snapshot\)/);
  assert.match(appSource, /Your original browser-only data is not deleted either way\./);
});

test("sensitive account actions use in-app forms instead of unsupported browser prompts", () => {
  assert.match(appSource, /function accountActionModal\(\)/);
  assert.match(appSource, /data-account-action="change-password"/);
  assert.match(appSource, /data-account-action="restore-backup"/);
  assert.match(appSource, /data-account-action="delete-account"/);
  assert.match(appSource, /autocomplete="current-password"/);
  assert.match(appSource, /autocomplete="new-password"/);
  assert.match(appSource, /Type RESTORE to confirm/);
  assert.match(appSource, /Type DELETE to confirm/);
  assert.doesNotMatch(appSource, /prompt\('Enter your current Bridge password:/);
  assert.doesNotMatch(appSource, /prompt\('Enter your Bridge password/);
});

test("cloud backups enforce ownership, integrity, schema validation, and a pre-restore snapshot", () => {
  assert.match(accountRuntime, /"users\/" \+ userId \+ "\/backups\/"/);
  assert.match(accountRuntime, /customMetadata: \{ userId, createdAt, reason, contentHash \}/);
  assert.match(accountRuntime, /document\.format !== "bridge-cloud-backup"/);
  assert.match(accountRuntime, /Number\(document\.version\) !== 1/);
  assert.match(accountRuntime, /backup_owner_mismatch/);
  assert.match(accountRuntime, /WHERE id = \?1 AND user_id = \?2 AND status = 'complete'/);
  assert.match(accountRuntime, /backup_checksum_failed/);
  assert.match(accountRuntime, /accountWriteBackup\(env, userId, "pre-restore"\)/);
  assert.match(accountRuntime, /safetyBackupId: snapshot\.id/);
  assert.match(accountRuntime, /String\(body\.confirmation \|\| ""\) !== "RESTORE"/);
  assert.match(accountRuntime, /String\(body\.confirmation \|\| ""\) !== "DELETE"/);
});

test("service worker caches only the public shell and clears private caches on logout", () => {
  assert.match(serviceWorker, /requestURL\.origin !== self\.location\.origin \|\| requestURL\.pathname\.includes\("\/api\/"\)/);
  assert.match(serviceWorker, /fetch\(event\.request, \{ cache: "no-store" \}\)/);
  assert.match(serviceWorker, /SHELL_PATHS\.has\(requestURL\.pathname\)/);
  assert.match(serviceWorker, /bridge-account-logout/);
  assert.match(serviceWorker, /key\.startsWith\("bridge-private-"\)/);
  assert.match(serviceWorker, /async function clearReminderSchedule\(\)/);
  assert.match(serviceWorker, /transaction\.objectStore\("settings"\)\.clear\(\)/);
  assert.match(serviceWorker, /clearReminderSchedule\(\)\.catch/);
  assert.match(serviceWorker, /readAccountSessionToken\(\)/);
  assert.equal(serviceWorker.includes("localStorage"), false);
});

test("nested account actions own Escape, trap focus, and restore the opener", () => {
  assert.match(appSource, /let accountActionFocusReturn = null/);
  assert.match(appSource, /function accountActionFocusableElements\(\)/);
  const keyboard = appSource.slice(appSource.indexOf("document.onkeydown=event=>"), appSource.indexOf("function bindPageEvents"));
  assert.ok(keyboard.indexOf("if(ui.accountAction)") < keyboard.indexOf("if(ui.settingsOpen)"));
  assert.match(keyboard, /if\(event\.key==="Escape"\)\{event\.preventDefault\(\);closeAccountAction\(\);return;\}/);
  assert.match(appSource, /if \(accountActionFocusReturn\?\.isConnected\) accountActionFocusReturn\.focus\(\)/);
  assert.match(appSource, /const coveredByAccountAction=Boolean\(ui\.accountAction\)/);
  assert.match(appSource, /coveredByAccountAction\?'aria-hidden="true" inert'/);
  assert.match(appSource, /const restoreOpener=button/);
  assert.match(appSource, /accountActionFocusReturn=restoreOpener/);
  assert.doesNotMatch(appSource, /remain encrypted in this browser/);
});
