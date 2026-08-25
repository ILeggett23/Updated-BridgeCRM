import test from "node:test";
import assert from "node:assert/strict";

class ScorecardDatabase {
  constructor() {
    this.scorecards = new Map();
  }

  prepare(sql) {
    const database = this;
    let values = [];
    return {
      bind(...args) {
        values = args;
        return this;
      },
      async run() {
        if (sql.startsWith("INSERT OR IGNORE INTO bridge_shared_scorecards")) {
          const [token, managementHash, payloadJSON, previewPNG, expiresAt, createdAt] = values;
          if (database.scorecards.has(token)) return { meta: { changes: 0 } };
          database.scorecards.set(token, { token, management_hash: managementHash, payload_json: payloadJSON, preview_png_base64: previewPNG, expires_at: expiresAt, revoked_at: null, created_at: createdAt });
          return { meta: { changes: 1 } };
        }
        if (sql.startsWith("UPDATE bridge_shared_scorecards SET revoked_at")) {
          const [revokedAt, token, managementHash] = values;
          const record = database.scorecards.get(token);
          if (!record || record.management_hash !== managementHash || record.revoked_at) return { meta: { changes: 0 } };
          record.revoked_at = revokedAt;
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 0 } };
      },
      async first() {
        if (!sql.startsWith("SELECT payload_json")) return null;
        const [token, now] = values;
        const record = database.scorecards.get(token);
        if (!record || record.revoked_at || record.expires_at <= now) return null;
        return sql.includes("preview_png_base64")
          ? { payload_json: record.payload_json, preview_png_base64: record.preview_png_base64 }
          : { payload_json: record.payload_json };
      }
    };
  }

  async batch(statements) {
    return Promise.all(statements.map((statement) => statement.run()));
  }
}

test("hosted scorecards are private, revocable, and not indexable", async () => {
  const workerURL = new URL("../dist/server/index.js", import.meta.url);
  workerURL.searchParams.set("test", String(Date.now()));
  const worker = (await import(workerURL.href)).default;
  const env = { DB: new ScorecardDatabase() };
  const source = "https://bridge.example";
  const payload = {
    expiresInDays: 30,
    previewPNG: "iVBORw0KGgo=",
    scorecard: {
      ownerName: "Isaiah Leggett",
      range: { label: "July 25, 2026", start: "2026-07-25", end: "2026-07-25" },
      metrics: { conversations: 7, contacts: 4, prospects: 5, prospectiveCustomers: 2 },
      includeContacts: true,
      contacts: [{ initials: "LR", name: "Lance Rodriguez", role: "Prospect", pipelineStage: "QI/P", placeName: "Coffee shop", phoneNumber: "+14795550101", notes: "Private" }]
    }
  };

  const createdResponse = await worker.fetch(new Request(source + "/api/scorecards", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }), env);
  assert.equal(createdResponse.status, 200);
  assert.equal(createdResponse.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  const created = await createdResponse.json();
  assert.match(created.token, /^[A-Za-z0-9_-]{24,}$/);
  assert.match(created.managementToken, /^[A-Za-z0-9_-]{24,}$/);
  const expiresIn = new Date(created.expiresAt).getTime() - Date.now();
  assert.ok(expiresIn > 6.99 * 86400000 && expiresIn <= 7.01 * 86400000);

  const sharedResponse = await worker.fetch(new Request(source + "/api/scorecards/" + created.token), env);
  assert.equal(sharedResponse.status, 200);
  const shared = await sharedResponse.json();
  assert.deepEqual(shared.scorecard.contacts, [{ initials: "LR", name: "Lance Rodriguez", role: "Prospect", pipelineStage: "QI/P", placeName: "Coffee shop" }]);
  assert.equal("phoneNumber" in shared.scorecard.contacts[0], false);
  assert.equal("notes" in shared.scorecard.contacts[0], false);

  const pageResponse = await worker.fetch(new Request(created.url), env);
  const page = await pageResponse.text();
  assert.equal(pageResponse.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
  assert.match(page, /property="og:image"/);
  assert.match(page, /7 conversations, 4 contacts, 5 prospects/);
  assert.match(page, /https:\/\/ileggett23\.github\.io\/Updated-BridgeCRM\/\?shared=/);

  const previewResponse = await worker.fetch(new Request(created.url + "/preview.png"), env);
  assert.equal(previewResponse.status, 200);
  assert.equal(previewResponse.headers.get("content-type"), "image/png");
  assert.ok((await previewResponse.arrayBuffer()).byteLength > 0);

  const revokedResponse = await worker.fetch(new Request(source + "/api/scorecards/" + created.token, { method: "DELETE", headers: { authorization: "Bearer " + created.managementToken } }), env);
  assert.equal(revokedResponse.status, 200);
  const afterRevoke = await worker.fetch(new Request(source + "/api/scorecards/" + created.token), env);
  assert.equal(afterRevoke.status, 404);
});

test("configured hosted browser origins can use the backend", async () => {
  const workerURL = new URL("../dist/server/index.js", import.meta.url);
  workerURL.searchParams.set("cors-test", String(Date.now()));
  const worker = (await import(workerURL.href)).default;
  const env = {
    BACKEND_ONLY: "true",
    ALLOWED_ORIGINS: "https://ileggett23.github.io",
    PUBLIC_APP_URL: "https://ileggett23.github.io/Updated-BridgeCRM/",
    DB: new ScorecardDatabase()
  };

  const preflight = await worker.fetch(new Request("https://bridge-api.example/api/scorecards", {
    method: "OPTIONS",
    headers: { Origin: "https://ileggett23.github.io" }
  }), env);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "https://ileggett23.github.io");
  assert.match(preflight.headers.get("access-control-allow-methods"), /POST/);

  const rejected = await worker.fetch(new Request("https://bridge-api.example/api/health", {
    headers: { Origin: "https://untrusted.example" }
  }), env);
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get("access-control-allow-origin"), null);

  const root = await worker.fetch(new Request("https://bridge-api.example/"), env);
  assert.equal(root.status, 404);
  assert.equal(root.headers.get("x-robots-tag"), "noindex, nofollow, noarchive");
});

test("the GitHub Pages origin is allowed by the production defaults", async () => {
  const workerURL = new URL("../dist/server/index.js", import.meta.url);
  workerURL.searchParams.set("github-pages-cors-test", String(Date.now()));
  const worker = (await import(workerURL.href)).default;
  const origin = "https://ileggett23.github.io";
  const response = await worker.fetch(new Request("https://bridge-api.example/api/health", {
    headers: { Origin: origin }
  }), { BACKEND_ONLY: "true" });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), origin);
});

test("scorecard links provide a rich preview before opening the public GitHub Pages app", async () => {
  const workerURL = new URL("../dist/server/index.js", import.meta.url);
  workerURL.searchParams.set("public-url-test", String(Date.now()));
  const worker = (await import(workerURL.href)).default;
  const env = {
    BACKEND_ONLY: "true",
    ALLOWED_ORIGINS: "https://ileggett23.github.io",
    PUBLIC_APP_URL: "https://ileggett23.github.io/Updated-BridgeCRM/",
    DB: new ScorecardDatabase()
  };
  const response = await worker.fetch(new Request("https://bridge-api.example/api/scorecards", {
    method: "POST",
    headers: {
      Origin: "https://ileggett23.github.io",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      expiresInDays: 1,
      previewPNG: "iVBORw0KGgo=",
      scorecard: {
        ownerName: "Isaiah",
        range: { label: "July 28, 2026", start: "2026-07-28", end: "2026-07-28" },
        metrics: { conversations: 5, contacts: 2, prospects: 2, prospectiveCustomers: 1 }
      }
    })
  }), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://ileggett23.github.io");
  const result = await response.json();
  const sharedURL = new URL(result.url);
  assert.equal(sharedURL.origin, "https://bridge-api.example");
  assert.equal(sharedURL.pathname, "/s/" + result.token);

  const richPage = await worker.fetch(new Request(result.url), env);
  const html = await richPage.text();
  assert.match(html, /property="og:title"/);
  assert.match(html, /property="og:image:width" content="1200"/);
  assert.match(html, new RegExp("shared=" + result.token));
});
