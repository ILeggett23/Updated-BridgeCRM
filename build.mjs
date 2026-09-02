import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const htmlTemplate = await readFile(new URL("./src/index.html", import.meta.url), "utf8");
const css = await readFile(new URL("./src/styles.css", import.meta.url), "utf8");
const brandIconSource = await readFile(new URL("./src/brand-icon.js", import.meta.url), "utf8");
const uiFoundation = await readFile(new URL("./src/ui-foundation.js", import.meta.url), "utf8");
const walkthrough = await readFile(new URL("./src/walkthrough.js", import.meta.url), "utf8");
const tutorialFixture = await readFile(new URL("./src/tutorial-fixture.js", import.meta.url), "utf8");
const contactLogic = await readFile(new URL("./src/contact-logic.js", import.meta.url), "utf8");
const engagementLogic = await readFile(new URL("./src/engagement-logic.js", import.meta.url), "utf8");
const communicationLogic = await readFile(new URL("./src/communication-logic.js", import.meta.url), "utf8");
const analyticsLogic = await readFile(new URL("./src/analytics-logic.js", import.meta.url), "utf8");
const relationshipHealthLogic = await readFile(new URL("./src/relationship-health-logic.js", import.meta.url), "utf8");
const networkLogic = await readFile(new URL("./src/network-logic.js", import.meta.url), "utf8");
const scorecardLogic = await readFile(new URL("./src/scorecard-logic.js", import.meta.url), "utf8");
const releaseLogic = await readFile(new URL("./src/release-logic.js", import.meta.url), "utf8");
const accountRuntime = await readFile(new URL("./src/server/account-runtime.js", import.meta.url), "utf8");
const accountClient = await readFile(new URL("./src/account-client.js", import.meta.url), "utf8");
const configSource = await readFile(new URL("./src/config.js", import.meta.url), "utf8");
const configuredAPIBase = String(process.env.BRIDGE_API_BASE || "").trim().replace(/\/+$/, "");
const config = configuredAPIBase
  ? configSource.replace(
      'const injectedAPI = String(globalThis.BRIDGE_API_BASE || "").trim();',
      `const injectedAPI = String(globalThis.BRIDGE_API_BASE || ${JSON.stringify(configuredAPIBase)}).trim();`
    )
  : configSource;
const js = await readFile(new URL("./src/app.js", import.meta.url), "utf8");
const manifest = await readFile(new URL("./src/manifest.webmanifest", import.meta.url), "utf8");
const serviceWorkerSource = await readFile(new URL("./src/sw.js", import.meta.url), "utf8");
const serviceWorker = configuredAPIBase
  ? serviceWorkerSource.replace(
      'const injectedAPI = String(self.BRIDGE_API_BASE || "").trim();',
      `const injectedAPI = String(self.BRIDGE_API_BASE || ${JSON.stringify(configuredAPIBase)}).trim();`
    )
  : serviceWorkerSource;
const appleTouchIcon = await readFile(new URL("./src/apple-touch-icon.png", import.meta.url));
const favicon16 = await readFile(new URL("./src/favicon-16x16.png", import.meta.url));
const favicon32 = await readFile(new URL("./src/favicon-32x32.png", import.meta.url));
const favicon48 = await readFile(new URL("./src/favicon-48x48.png", import.meta.url));
const bridgeUiMarkSvg = await readFile(new URL("./src/bridge-ui-mark.svg", import.meta.url), "utf8");
const bridgeUiMark192 = await readFile(new URL("./src/bridge-ui-mark-192.png", import.meta.url));
const icon192 = await readFile(new URL("./src/bridge-app-icon-192.png", import.meta.url));
const icon512 = await readFile(new URL("./src/bridge-app-icon-512.png", import.meta.url));
const iconMaskable192 = await readFile(new URL("./src/bridge-app-icon-maskable-192.png", import.meta.url));
const iconMaskable512 = await readFile(new URL("./src/bridge-app-icon-maskable-512.png", import.meta.url));
const icon1024 = await readFile(new URL("./src/bridge-app-icon-1024.png", import.meta.url));
const fontFileNames = [
  "inter-tight-latin.woff2",
  "inter-tight-latin-ext.woff2",
  "inter-tight-italic-latin.woff2",
  "inter-tight-italic-latin-ext.woff2",
  "newsreader-latin.woff2",
  "newsreader-latin-ext.woff2",
  "newsreader-italic-latin.woff2",
  "newsreader-italic-latin-ext.woff2"
];
const fontAssets = Object.fromEntries(await Promise.all(fontFileNames.map(async fileName => [
  `/fonts/${fileName}`,
  (await readFile(new URL(`./src/fonts/${fileName}`, import.meta.url))).toString("base64")
])));
const html = htmlTemplate
  // GitHub Pages serves the PWA while the Cloudflare Worker provides the
  // hosted API used by push, scorecards, and guarded cloud-account features.
  .replace('name="bridge-hosted-push" content="disabled"', 'name="bridge-hosted-push" content="enabled"');

const worker = `const PAGE = ${JSON.stringify(html)};
const STYLES = ${JSON.stringify(css)};
const BRAND_ICON_JS = ${JSON.stringify(brandIconSource)};
const UI_FOUNDATION = ${JSON.stringify(uiFoundation)};
const WALKTHROUGH = ${JSON.stringify(walkthrough)};
const TUTORIAL_FIXTURE = ${JSON.stringify(tutorialFixture)};
const CONTACT_LOGIC = ${JSON.stringify(contactLogic)};
const ENGAGEMENT_LOGIC = ${JSON.stringify(engagementLogic)};
const COMMUNICATION_LOGIC = ${JSON.stringify(communicationLogic)};
const ANALYTICS_LOGIC = ${JSON.stringify(analyticsLogic)};
const RELATIONSHIP_HEALTH_LOGIC = ${JSON.stringify(relationshipHealthLogic)};
const NETWORK_LOGIC = ${JSON.stringify(networkLogic)};
const SCORECARD_LOGIC = ${JSON.stringify(scorecardLogic)};
const RELEASE_LOGIC = ${JSON.stringify(releaseLogic)};
const ACCOUNT_CLIENT = ${JSON.stringify(accountClient)};
const CONFIG_JS = ${JSON.stringify(config)};
const APP_JS = ${JSON.stringify(js)};
const MANIFEST = ${JSON.stringify(manifest)};
const SERVICE_WORKER = ${JSON.stringify(serviceWorker)};
const APPLE_TOUCH_ICON_BASE64 = ${JSON.stringify(appleTouchIcon.toString("base64"))};
const FAVICON_16_BASE64 = ${JSON.stringify(favicon16.toString("base64"))};
const FAVICON_32_BASE64 = ${JSON.stringify(favicon32.toString("base64"))};
const FAVICON_48_BASE64 = ${JSON.stringify(favicon48.toString("base64"))};
const BRIDGE_UI_MARK_SVG = ${JSON.stringify(bridgeUiMarkSvg)};
const BRIDGE_UI_MARK_192_BASE64 = ${JSON.stringify(bridgeUiMark192.toString("base64"))};
const ICON_192_BASE64 = ${JSON.stringify(icon192.toString("base64"))};
const ICON_512_BASE64 = ${JSON.stringify(icon512.toString("base64"))};
const ICON_MASKABLE_192_BASE64 = ${JSON.stringify(iconMaskable192.toString("base64"))};
const ICON_MASKABLE_512_BASE64 = ${JSON.stringify(iconMaskable512.toString("base64"))};
const ICON_1024_BASE64 = ${JSON.stringify(icon1024.toString("base64"))};
const FONT_ASSETS = ${JSON.stringify(fontAssets)};
const EMPTY_STATE = ${JSON.stringify({ contacts: [], places: [], settings: {}, meta: { version: 1 } })};
const json = (value, status = 200, extraHeaders = {}) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extraHeaders } });
const noIndexJSON = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow, noarchive" } });
const noIndexHTML = (value, status = 200) => new Response(value, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow, noarchive", "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" } });
const defaultAllowedOrigins = ["https://ileggett23.github.io"];
const allowedOrigins = env => new Set(String(env.ALLOWED_ORIGINS || defaultAllowedOrigins.join(",")).split(",").map(value => value.trim()).filter(Boolean));
const requestOriginAllowed = (request, env) => {
  const origin = request.headers.get("origin");
  return !origin || allowedOrigins(env).has(origin);
};
const withSecurityHeaders = response => {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()");
  headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};
const withCORS = (response, request, env) => {
  const secured = withSecurityHeaders(response);
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins(env).has(origin)) return secured;
  const headers = new Headers(secured.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS");
  headers.set("access-control-allow-headers", "Authorization, Content-Type, X-Bridge-Management-Token");
  headers.set("access-control-max-age", "86400");
  headers.append("vary", "Origin");
  return new Response(secured.body, { status: secured.status, statusText: secured.statusText, headers });
};
const binaryFromBase64 = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));
const textEncoder = new TextEncoder();
const base64URL = value => {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary).replace(/=/g, "").replace(/\\+/g, "-").replace(/\\\//g, "_");
};
const fromBase64URL = value => {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob((value + padding).replace(/-/g, "+").replace(/_/g, "/")), character => character.charCodeAt(0));
};
const concatBytes = (...values) => {
  const arrays = values.map(value => value instanceof Uint8Array ? value : new Uint8Array(value));
  const result = new Uint8Array(arrays.reduce((sum, value) => sum + value.length, 0));
  let offset = 0;
  arrays.forEach(value => { result.set(value, offset); offset += value.length; });
  return result;
};
const uint32 = value => { const bytes = new Uint8Array(4); new DataView(bytes.buffer).setUint32(0, value); return bytes; };

async function hkdf(input, salt, info, length) {
  const key = await crypto.subtle.importKey("raw", input, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}

async function vapidAuthorization(endpoint, env) {
  const publicKey = fromBase64URL(env.VAPID_PUBLIC_KEY);
  const x = publicKey.slice(1, 33);
  const y = publicKey.slice(33, 65);
  const privateKey = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: base64URL(x), y: base64URL(y), d: env.VAPID_PRIVATE_KEY, ext: true }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = base64URL(textEncoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = base64URL(textEncoder.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 43_200, sub: env.VAPID_SUBJECT || "mailto:fountainofyouthxs@gmail.com" })));
  const input = header + "." + claims;
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, textEncoder.encode(input));
  return "vapid t=" + input + "." + base64URL(signature) + ", k=" + env.VAPID_PUBLIC_KEY;
}

async function encryptPushPayload(subscription, payload) {
  const clientPublicKey = fromBase64URL(subscription.keys.p256dh);
  const authSecret = fromBase64URL(subscription.keys.auth);
  const clientKey = await crypto.subtle.importKey("raw", clientPublicKey, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const serverKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const serverPublicKey = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeys.publicKey));
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: clientKey }, serverKeys.privateKey, 256));
  const keyInfo = concatBytes(textEncoder.encode("WebPush: info\0"), clientPublicKey, serverPublicKey);
  const inputKeyMaterial = await hkdf(sharedSecret, authSecret, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const contentKey = await hkdf(inputKeyMaterial, salt, textEncoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(inputKeyMaterial, salt, textEncoder.encode("Content-Encoding: nonce\0"), 12);
  const plaintext = concatBytes(textEncoder.encode(JSON.stringify(payload)), new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey("raw", contentKey, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, plaintext));
  return concatBytes(salt, uint32(4096), new Uint8Array([serverPublicKey.length]), serverPublicKey, ciphertext);
}

async function sendWebPush(subscription, payload, env) {
  const body = await encryptPushPayload(subscription, payload);
  return fetch(subscription.endpoint, {
    method: "POST",
    headers: { Authorization: await vapidAuthorization(subscription.endpoint, env), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "86400", Urgency: "high" },
    body
  });
}

async function ensureDatabase(db) {
  await db.batch([
    db.prepare(\`CREATE TABLE IF NOT EXISTS bridge_push_subscriptions (
      endpoint TEXT PRIMARY KEY NOT NULL,
      subscription_json TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      time_zone TEXT,
      schedule_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      disabled_at TEXT
    )\`),
    db.prepare(\`CREATE TABLE IF NOT EXISTS bridge_push_deliveries (
      reminder_key TEXT PRIMARY KEY NOT NULL,
      sent_at TEXT NOT NULL
    )\`),
    db.prepare(\`CREATE TABLE IF NOT EXISTS bridge_shared_scorecards (
      token TEXT PRIMARY KEY NOT NULL,
      management_hash TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      preview_png_base64 TEXT,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL
    )\`),
    db.prepare(\`CREATE INDEX IF NOT EXISTS bridge_shared_scorecards_expires
      ON bridge_shared_scorecards(expires_at)\`)
  ]);
}

async function sha256(value) {
  return base64URL(await crypto.subtle.digest("SHA-256", textEncoder.encode(value)));
}

function bearerToken(request) {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

async function authorizedSubscription(request, env, endpoint) {
  const token = bearerToken(request);
  if (!token || !endpoint) return null;
  const tokenHash = await sha256(token);
  return env.DB.prepare("SELECT endpoint, subscription_json, schedule_json, time_zone FROM bridge_push_subscriptions WHERE endpoint = ?1 AND token_hash = ?2 AND disabled_at IS NULL").bind(endpoint, tokenHash).first();
}

function cleanShareText(value, max = 160) {
  return String(value || "").trim().slice(0, max);
}

function shareMetric(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.min(Math.floor(number), 1000000000) : 0;
}

function sanitizeScorecard(input) {
  const source = input && typeof input === "object" ? input : {};
  const rawMetrics = source.metrics && typeof source.metrics === "object" ? source.metrics : {};
  const includeContacts = Boolean(source.includeContacts);
  const contacts = includeContacts && Array.isArray(source.contacts) ? source.contacts.slice(0, 100).map(contact => {
    const name = cleanShareText(contact?.name, 120) || "Unnamed contact";
    const initials = cleanShareText(contact?.initials, 4) || name.split(/\\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "?";
    return {
      initials,
      name,
      role: ["Prospect", "Customer", "Team"].includes(contact?.role) ? contact.role : "Prospect",
      pipelineStage: cleanShareText(contact?.pipelineStage, 80),
      placeName: cleanShareText(contact?.placeName, 120)
    };
  }) : [];
  return {
    version: 1,
    ownerName: cleanShareText(source.ownerName, 80).split(/\\s+/)[0] || "Bridge",
    periodLabel: cleanShareText(source.periodLabel, 160) || "Today",
    range: { start: cleanShareText(source.range?.start, 40), end: cleanShareText(source.range?.end, 40) },
    metrics: {
      conversations: shareMetric(rawMetrics.conversations),
      contacts: shareMetric(rawMetrics.contacts),
      prospects: shareMetric(rawMetrics.prospects),
      prospectiveCustomers: shareMetric(rawMetrics.prospectiveCustomers)
    },
    includeContacts,
    contacts
  };
}

function escapeHTML(value) {
  return String(value || "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function scorecardDescription(scorecard) {
  const metrics = scorecard.metrics;
  return metrics.conversations + " conversations, " + metrics.contacts + " contacts, " + metrics.prospects + " prospects, and " + metrics.prospectiveCustomers + " prospective customers.";
}

function scorecardSharePage(scorecard, token, request, env) {
  const publicApp = new URL(env.PUBLIC_APP_URL || "https://ileggett23.github.io/Updated-BridgeCRM/");
  publicApp.searchParams.set("shared", token);
  const shareURL = new URL("/s/" + token, request.url);
  const previewURL = new URL("/s/" + token + "/preview.png", request.url);
  const title = scorecard.ownerName + "'s Bridge Scorecard";
  const description = scorecardDescription(scorecard);
  return "<!doctype html><html lang=\\"en\\"><head><meta charset=\\"utf-8\\"><meta name=\\"viewport\\" content=\\"width=device-width,initial-scale=1\\"><meta name=\\"robots\\" content=\\"noindex,nofollow,noarchive\\"><title>" + escapeHTML(title) + "</title><meta name=\\"description\\" content=\\"" + escapeHTML(description) + "\\"><meta property=\\"og:type\\" content=\\"website\\"><meta property=\\"og:site_name\\" content=\\"Bridge CRM\\"><meta property=\\"og:title\\" content=\\"" + escapeHTML(title) + "\\"><meta property=\\"og:description\\" content=\\"" + escapeHTML(description) + "\\"><meta property=\\"og:url\\" content=\\"" + escapeHTML(shareURL.href) + "\\"><meta property=\\"og:image\\" content=\\"" + escapeHTML(previewURL.href) + "\\"><meta property=\\"og:image:secure_url\\" content=\\"" + escapeHTML(previewURL.href) + "\\"><meta property=\\"og:image:type\\" content=\\"image/png\\"><meta property=\\"og:image:width\\" content=\\"1200\\"><meta property=\\"og:image:height\\" content=\\"630\\"><meta name=\\"twitter:card\\" content=\\"summary_large_image\\"><meta http-equiv=\\"refresh\\" content=\\"0;url=" + escapeHTML(publicApp.href) + "\\"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3f5f7;color:#101318;font:16px -apple-system,BlinkMacSystemFont,sans-serif}a{color:#1478dc;font-weight:700}</style></head><body><a href=\\"" + escapeHTML(publicApp.href) + "\\">Open this Bridge scorecard</a></body></html>";
}

function randomToken() {
  return base64URL(crypto.getRandomValues(new Uint8Array(32)));
}

function timeZoneParts(value, timeZone) {
  const normalizedTimeZone = normalizeTimeZone(timeZone) || "UTC";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: normalizedTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(value);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function normalizeTimeZone(value) {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (!candidate || candidate.length > 128) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format();
    return candidate;
  } catch {
    return null;
  }
}

function localDayKey(value, timeZone) {
  const parts = timeZoneParts(value, timeZone);
  return parts.year + "-" + parts.month + "-" + parts.day;
}

function endpointKey(endpoint) {
  return endpoint.slice(-48).replace(/[^a-zA-Z0-9]/g, "");
}

function bridgeAppURL(env, params = {}) {
  let target;
  try { target = new URL(env.PUBLIC_APP_URL || "https://ileggett23.github.io/Updated-BridgeCRM/"); }
  catch { target = new URL("https://ileggett23.github.io/Updated-BridgeCRM/"); }
  if (!target.pathname.endsWith("/")) target.pathname += "/";
  target.search = "";
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value)) target.searchParams.set(key, String(value));
  }
  target.searchParams.set("notification", "1");
  return target.href;
}

function remindersForSubscription(row, env, now = new Date()) {
  let schedule;
  try { schedule = JSON.parse(row.schedule_json || "{}"); }
  catch { return []; }
  if (!schedule.notificationsEnabled) return [];
  const reminders = [];
  const endpointId = endpointKey(row.endpoint);
  if (schedule.followUpNotifications) {
    for (const followUp of Array.isArray(schedule.followUps) ? schedule.followUps : []) {
      const due = new Date(followUp.dueDate).getTime();
      if (!followUp.id || !Number.isFinite(due) || due > now.getTime()) continue;
      reminders.push({
        key: "followup:" + endpointId + ":" + followUp.id + ":" + followUp.dueDate,
        title: "Follow up with " + (followUp.contactName || "your contact"),
        body: followUp.note || "Your scheduled follow-up is ready now.",
        url: bridgeAppURL(env, { page: "followups", contact: followUp.contactId, followUp: followUp.id }),
        tag: "bridge-followup-" + followUp.id
      });
    }
  }
  if (schedule.dailyReminderEnabled) {
    const timeZone = normalizeTimeZone(row.time_zone) || normalizeTimeZone(schedule.timeZone) || "UTC";
    const local = timeZoneParts(now, timeZone);
    const currentMinutes = Number(local.hour) * 60 + Number(local.minute);
    const [hour, minute] = String(schedule.dailyReminderTime || "09:00").split(":").map(Number);
    const reminderMinutes = (Number.isFinite(hour) ? hour : 9) * 60 + (Number.isFinite(minute) ? minute : 0);
    const today = local.year + "-" + local.month + "-" + local.day;
    const todayCount = (Array.isArray(schedule.conversationDates) ? schedule.conversationDates : []).filter(value => {
      const date = new Date(value);
      return Number.isFinite(date.getTime()) && localDayKey(date, timeZone) === today;
    }).length;
    const goal = Math.max(1, Number(schedule.dailyGoal) || 5);
    if (currentMinutes >= reminderMinutes && todayCount < goal) {
      const remaining = goal - todayCount;
      reminders.push({
        key: "daily:" + endpointId + ":" + today,
        title: "Ready to build your pipeline?",
        body: remaining + " conversation" + (remaining === 1 ? "" : "s") + " left to reach today's goal.",
        url: bridgeAppURL(env, { page: "add" }),
        tag: "bridge-daily-" + today
      });
    }
  }
  return reminders;
}

async function dispatchPushReminders(env, { testEndpoint = "" } = {}) {
  if (!env.DB || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return { ok: false, error: "Push service is not configured", sent: 0 };
  await ensureDatabase(env.DB);
  const subscriptions = testEndpoint
    ? (await env.DB.prepare("SELECT endpoint, subscription_json, schedule_json, time_zone FROM bridge_push_subscriptions WHERE endpoint = ?1 AND disabled_at IS NULL").bind(testEndpoint).all()).results || []
    : (await env.DB.prepare("SELECT endpoint, subscription_json, schedule_json, time_zone FROM bridge_push_subscriptions WHERE disabled_at IS NULL").all()).results || [];
  if (!subscriptions.length) return { ok: true, sent: 0, subscriptions: 0 };
  let sent = 0;
  for (const row of subscriptions) {
    const reminders = testEndpoint
      ? [{ key: "test:" + Date.now(), title: "Bridge reminders are ready", body: "This device can receive reminders while Bridge is closed.", url: bridgeAppURL(env, { page: "followups" }), tag: "bridge-test" }]
      : remindersForSubscription(row, env);
    for (const reminder of reminders) {
      if (!testEndpoint) {
      const claim = await env.DB.prepare("INSERT OR IGNORE INTO bridge_push_deliveries (reminder_key, sent_at) VALUES (?1, ?2)").bind(reminder.key, "pending:" + new Date().toISOString()).run();
      if (!claim.meta?.changes) continue;
      }
      let delivered = false;
      try {
        const subscription = JSON.parse(row.subscription_json);
        const response = await sendWebPush(subscription, reminder, env);
        if (response.ok) delivered = true;
        else if (response.status === 404 || response.status === 410) await env.DB.prepare("UPDATE bridge_push_subscriptions SET disabled_at = ?1 WHERE endpoint = ?2").bind(new Date().toISOString(), row.endpoint).run();
      } catch {}
      if (delivered) {
        sent += 1;
        if (!testEndpoint) {
          await env.DB.prepare("UPDATE bridge_push_deliveries SET sent_at = ?1 WHERE reminder_key = ?2").bind(new Date().toISOString(), reminder.key).run();
        }
      } else if (!testEndpoint) {
        await env.DB.prepare("DELETE FROM bridge_push_deliveries WHERE reminder_key = ?1").bind(reminder.key).run();
      }
    }
  }
  return { ok: true, sent, subscriptions: subscriptions.length };
}

${accountRuntime}

async function handleRequest(request, env) {
    const url = new URL(request.url);
    const apiRequest = url.pathname.startsWith("/api/");
    if (apiRequest && request.method === "OPTIONS") {
      return requestOriginAllowed(request, env) ? new Response(null, { status: 204 }) : json({ error: "Origin not allowed" }, 403);
    }
    if (apiRequest && !requestOriginAllowed(request, env)) return json({ error: "Origin not allowed" }, 403);
    const accountResponse = await handleAccountRequest(request, env, url);
    if (accountResponse) return accountResponse;
    if (url.pathname === "/api/health") return json({ ok: true });
    if (url.pathname === "/styles.css") return new Response(STYLES, { headers: { "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=31536000, immutable" } });
    if (url.pathname === "/brand-icon.js") return new Response(BRAND_ICON_JS, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=31536000, immutable" } });
    if (url.pathname === "/ui-foundation.js") return new Response(UI_FOUNDATION, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=31536000, immutable" } });
    if (url.pathname === "/walkthrough.js") return new Response(WALKTHROUGH, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=31536000, immutable" } });
    if (url.pathname === "/tutorial-fixture.js") return new Response(TUTORIAL_FIXTURE, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=31536000, immutable" } });
    if (FONT_ASSETS[url.pathname]) return new Response(binaryFromBase64(FONT_ASSETS[url.pathname]), { headers: { "content-type": "font/woff2", "cache-control": "public, max-age=31536000, immutable", "cross-origin-resource-policy": "same-origin" } });
    if (url.pathname === "/contact-logic.js") return new Response(CONTACT_LOGIC, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=31536000, immutable" } });
    if (url.pathname === "/engagement-logic.js") return new Response(ENGAGEMENT_LOGIC, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=31536000, immutable" } });
    if (url.pathname === "/communication-logic.js") return new Response(COMMUNICATION_LOGIC, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=31536000, immutable" } });
    if (url.pathname === "/analytics-logic.js") return new Response(ANALYTICS_LOGIC, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=31536000, immutable" } });
    if (url.pathname === "/relationship-health-logic.js") return new Response(RELATIONSHIP_HEALTH_LOGIC, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=31536000, immutable" } });
    if (url.pathname === "/network-logic.js") return new Response(NETWORK_LOGIC, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=31536000, immutable" } });
    if (url.pathname === "/scorecard-logic.js") return new Response(SCORECARD_LOGIC, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=31536000, immutable" } });
    if (url.pathname === "/release-logic.js") return new Response(RELEASE_LOGIC, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=31536000, immutable" } });
    if (url.pathname === "/account-client.js") return new Response(ACCOUNT_CLIENT, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=31536000, immutable" } });
    if (url.pathname === "/config.js") return new Response(CONFIG_JS, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=31536000, immutable" } });
    if (url.pathname === "/app.js") return new Response(APP_JS, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=31536000, immutable" } });
    if (url.pathname === "/manifest.webmanifest") return new Response(MANIFEST, { headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "public, max-age=3600" } });
    if (url.pathname === "/sw.js") return new Response(SERVICE_WORKER, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache", "service-worker-allowed": "/" } });
    if (url.pathname === "/favicon-16x16.png") return new Response(binaryFromBase64(FAVICON_16_BASE64), { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
    if (url.pathname === "/favicon-32x32.png") return new Response(binaryFromBase64(FAVICON_32_BASE64), { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
    if (url.pathname === "/favicon-48x48.png") return new Response(binaryFromBase64(FAVICON_48_BASE64), { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
    if (url.pathname === "/apple-touch-icon.png") return new Response(binaryFromBase64(APPLE_TOUCH_ICON_BASE64), { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
    if (url.pathname === "/bridge-ui-mark.svg") return new Response(BRIDGE_UI_MARK_SVG, { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=86400" } });
    if (url.pathname === "/bridge-ui-mark-192.png") return new Response(binaryFromBase64(BRIDGE_UI_MARK_192_BASE64), { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
    if (url.pathname === "/bridge-app-icon-192.png") return new Response(binaryFromBase64(ICON_192_BASE64), { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
    if (url.pathname === "/bridge-app-icon-512.png") return new Response(binaryFromBase64(ICON_512_BASE64), { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
    if (url.pathname === "/bridge-app-icon-maskable-192.png") return new Response(binaryFromBase64(ICON_MASKABLE_192_BASE64), { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
    if (url.pathname === "/bridge-app-icon-maskable-512.png") return new Response(binaryFromBase64(ICON_MASKABLE_512_BASE64), { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
    if (url.pathname === "/bridge-app-icon-1024.png") return new Response(binaryFromBase64(ICON_1024_BASE64), { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
    const publicScorecardMatch = url.pathname.match(/^\\/s\\/([A-Za-z0-9_-]{24,128})(?:\\/(preview\\.png))?$/);
    if (publicScorecardMatch && request.method === "GET") {
      if (!env.DB) return noIndexHTML("<!doctype html><title>Scorecard unavailable</title><p>This scorecard is unavailable.</p>", 404);
      await ensureDatabase(env.DB);
      const token = publicScorecardMatch[1];
      const record = await env.DB.prepare("SELECT payload_json, preview_png_base64 FROM bridge_shared_scorecards WHERE token = ?1 AND revoked_at IS NULL AND expires_at > ?2").bind(token, new Date().toISOString()).first();
      if (!record?.payload_json) return noIndexHTML("<!doctype html><title>Scorecard unavailable</title><p>This scorecard has expired or is no longer available.</p>", 404);
      if (publicScorecardMatch[2]) {
        if (!record.preview_png_base64) return new Response(binaryFromBase64(ICON_512_BASE64), { headers: { "content-type": "image/png", "cache-control": "private, max-age=300", "x-robots-tag": "noindex, nofollow, noarchive" } });
        return new Response(binaryFromBase64(record.preview_png_base64), { headers: { "content-type": "image/png", "cache-control": "private, max-age=300", "x-robots-tag": "noindex, nofollow, noarchive" } });
      }
      try { return noIndexHTML(scorecardSharePage(JSON.parse(record.payload_json), token, request, env)); }
      catch { return noIndexHTML("<!doctype html><title>Scorecard unavailable</title><p>This scorecard is unavailable.</p>", 404); }
    }
    const scorecardMatch = url.pathname.match(/^\\/api\\/scorecards(?:\\/([A-Za-z0-9_-]{24,128}))?$/);
    if (scorecardMatch) {
      if (!env.DB) return json({ error: "Secure scorecards require the hosted Bridge app" }, 503);
      await ensureDatabase(env.DB);
      const token = scorecardMatch[1] || "";
      if (request.method === "POST" && !token) {
        let scorecardUserId = null;
        if (accountEnabled(env)) {
          const session = await accountSession(request, env);
          if (session.error) return session.error;
          scorecardUserId = session.user.id;
        }
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== "object") return json({ error: "Invalid scorecard" }, 400);
        const scorecard = sanitizeScorecard(body.scorecard);
        const payload = JSON.stringify(scorecard);
        if (payload.length > 100000) return json({ error: "Scorecard is too large" }, 413);
        const previewPNG = typeof body.previewPNG === "string" && /^[A-Za-z0-9+/=]+$/.test(body.previewPNG) && body.previewPNG.length <= 1000000 ? body.previewPNG : "";
        const managementToken = randomToken();
        const managementHash = await sha256(managementToken);
        const createdAt = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
        let createdToken = "";
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const candidate = randomToken();
          const result = scorecardUserId
            ? await env.DB.prepare("INSERT OR IGNORE INTO bridge_shared_scorecards (token, management_hash, payload_json, preview_png_base64, expires_at, revoked_at, created_at, user_id) VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6, ?7)").bind(candidate, managementHash, payload, previewPNG, expiresAt, createdAt, scorecardUserId).run()
            : await env.DB.prepare("INSERT OR IGNORE INTO bridge_shared_scorecards (token, management_hash, payload_json, preview_png_base64, expires_at, revoked_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, NULL, ?6)").bind(candidate, managementHash, payload, previewPNG, expiresAt, createdAt).run();
          if (result.meta?.changes) { createdToken = candidate; break; }
        }
        if (!createdToken) return json({ error: "Bridge could not create a secure link" }, 500);
        const shareURL = new URL("/s/" + createdToken, request.url);
        return noIndexJSON({ token: createdToken, managementToken, url: shareURL.href, expiresAt });
      }
      if (request.method === "GET" && token) {
        const record = await env.DB.prepare("SELECT payload_json FROM bridge_shared_scorecards WHERE token = ?1 AND revoked_at IS NULL AND expires_at > ?2").bind(token, new Date().toISOString()).first();
        if (!record?.payload_json) return noIndexJSON({ error: "This scorecard link has expired or is no longer available" }, 404);
        try { return noIndexJSON({ scorecard: JSON.parse(record.payload_json) }); }
        catch { return noIndexJSON({ error: "This scorecard link is unavailable" }, 404); }
      }
      if (request.method === "DELETE" && token) {
        const managementToken = bearerToken(request);
        const alternateManagementToken = request.headers.get("x-bridge-management-token") || "";
        if (!managementToken && !alternateManagementToken) return json({ error: "Unauthorized" }, 401);
        if (accountEnabled(env)) {
          const session = await accountSession(request, env, { required: false });
          if (!session.error && session.user) {
            const result = await env.DB.prepare("UPDATE bridge_shared_scorecards SET revoked_at = ?1 WHERE token = ?2 AND user_id = ?3 AND revoked_at IS NULL").bind(new Date().toISOString(), token, session.user.id).run();
            if (result.meta?.changes) return json({ ok: true });
          }
        }
        const managementHash = await sha256(alternateManagementToken || managementToken);
        const result = await env.DB.prepare("UPDATE bridge_shared_scorecards SET revoked_at = ?1 WHERE token = ?2 AND management_hash = ?3 AND revoked_at IS NULL").bind(new Date().toISOString(), token, managementHash).run();
        if (!result.meta?.changes) return json({ error: "Scorecard link was not found" }, 404);
        return json({ ok: true });
      }
      return json({ error: "Method not allowed" }, 405);
    }
    if (url.pathname === "/api/push/config" && request.method === "GET") {
      return env.VAPID_PUBLIC_KEY ? json({ publicKey: env.VAPID_PUBLIC_KEY }) : json({ error: "Bridge push service is not configured" }, 503);
    }
    if (url.pathname === "/api/push/subscribe") {
      if (!env.DB) return json({ error: "Cloud storage is unavailable" }, 503);
      await ensureDatabase(env.DB);
      const body = await request.json().catch(() => ({}));
      if (request.method === "POST") {
        const subscription = body.subscription;
        if (!subscription?.endpoint?.startsWith("https://") || !subscription.keys?.p256dh || !subscription.keys?.auth) return json({ error: "Invalid push subscription" }, 400);
        const requestedTimeZone = body.timeZone == null || body.timeZone === "" ? "UTC" : body.timeZone;
        const timeZone = normalizeTimeZone(requestedTimeZone);
        if (!timeZone) return json({ error: "Invalid time zone" }, 400);
        let subscriptionUserId = null;
        if (accountEnabled(env)) {
          const session = await accountSession(request, env);
          if (session.error) return session.error;
          subscriptionUserId = session.user.id;
        }
        const now = new Date().toISOString();
        const deviceToken = crypto.randomUUID() + crypto.randomUUID();
        const tokenHash = await sha256(deviceToken);
        if (subscriptionUserId) {
          await env.DB.prepare("INSERT INTO bridge_push_subscriptions (endpoint, subscription_json, token_hash, time_zone, schedule_json, created_at, updated_at, disabled_at, user_id) VALUES (?1, ?2, ?3, ?4, '{}', ?5, ?5, NULL, ?6) ON CONFLICT(endpoint) DO UPDATE SET subscription_json = excluded.subscription_json, token_hash = excluded.token_hash, time_zone = excluded.time_zone, updated_at = excluded.updated_at, disabled_at = NULL, user_id = excluded.user_id").bind(subscription.endpoint, JSON.stringify(subscription), tokenHash, timeZone, now, subscriptionUserId).run();
        } else {
          await env.DB.prepare("INSERT INTO bridge_push_subscriptions (endpoint, subscription_json, token_hash, time_zone, schedule_json, created_at, updated_at, disabled_at) VALUES (?1, ?2, ?3, ?4, '{}', ?5, ?5, NULL) ON CONFLICT(endpoint) DO UPDATE SET subscription_json = excluded.subscription_json, token_hash = excluded.token_hash, time_zone = excluded.time_zone, updated_at = excluded.updated_at, disabled_at = NULL").bind(subscription.endpoint, JSON.stringify(subscription), tokenHash, timeZone, now).run();
        }
        return json({ ok: true, deviceToken });
      }
      if (request.method === "DELETE") {
        if (!body.endpoint) return json({ error: "Missing subscription endpoint" }, 400);
        if (accountEnabled(env)) {
          const session = await accountSession(request, env, { required: false });
          if (!session.error && session.user) {
            const result = await env.DB.prepare("UPDATE bridge_push_subscriptions SET disabled_at = ?1 WHERE endpoint = ?2 AND user_id = ?3").bind(new Date().toISOString(), String(body.endpoint), session.user.id).run();
            if (result.meta?.changes) return json({ ok: true });
          }
        }
        if (!await authorizedSubscription(request, env, String(body.endpoint))) return json({ error: "Unauthorized" }, 401);
        await env.DB.prepare("UPDATE bridge_push_subscriptions SET disabled_at = ?1 WHERE endpoint = ?2").bind(new Date().toISOString(), String(body.endpoint)).run();
        return json({ ok: true });
      }
      return json({ error: "Method not allowed" }, 405);
    }
    if (url.pathname === "/api/push/schedule" && request.method === "PUT") {
      if (!env.DB) return json({ error: "Cloud storage is unavailable" }, 503);
      await ensureDatabase(env.DB);
      const body = await request.json().catch(() => ({}));
      const endpoint = String(body.endpoint || "");
      const authorized = await authorizedSubscription(request, env, endpoint);
      if (!authorized) return json({ error: "Unauthorized" }, 401);
      const schedule = body.schedule && typeof body.schedule === "object" ? body.schedule : null;
      if (!schedule) return json({ error: "Invalid reminder schedule" }, 400);
      const requestedTimeZone = schedule.timeZone == null || schedule.timeZone === "" ? authorized.time_zone || "UTC" : schedule.timeZone;
      const timeZone = normalizeTimeZone(requestedTimeZone);
      if (!timeZone) return json({ error: "Invalid time zone" }, 400);
      const normalizedSchedule = { ...schedule, timeZone };
      const scheduleJSON = JSON.stringify(normalizedSchedule);
      if (scheduleJSON.length > 250_000) return json({ error: "Reminder schedule is too large" }, 413);
      await env.DB.prepare("UPDATE bridge_push_subscriptions SET schedule_json = ?1, time_zone = ?2, updated_at = ?3 WHERE endpoint = ?4").bind(scheduleJSON, timeZone, new Date().toISOString(), endpoint).run();
      return json({ ok: true });
    }
    if (url.pathname === "/api/push/test-device" && request.method === "POST") {
      if (!env.DB) return json({ error: "Cloud storage is unavailable" }, 503);
      await ensureDatabase(env.DB);
      const body = await request.json().catch(() => ({}));
      const endpoint = String(body.endpoint || "");
      if (!await authorizedSubscription(request, env, endpoint)) return json({ error: "Unauthorized" }, 401);
      const result = await dispatchPushReminders(env, { testEndpoint: endpoint });
      return json(result, result.ok ? 200 : 503);
    }
    if (url.pathname === "/api/push/test" && request.method === "POST") {
      if (!env.PUSH_DISPATCH_SECRET || request.headers.get("authorization") !== "Bearer " + env.PUSH_DISPATCH_SECRET) return json({ error: "Unauthorized" }, 401);
      const result = await dispatchPushReminders(env);
      return json(result, result.ok ? 200 : 503);
    }
    if (url.pathname === "/api/push/dispatch" && request.method === "POST") {
      if (!env.PUSH_DISPATCH_SECRET || request.headers.get("authorization") !== "Bearer " + env.PUSH_DISPATCH_SECRET) return json({ error: "Unauthorized" }, 401);
      const result = await dispatchPushReminders(env);
      return json(result, result.ok ? 200 : 503);
    }
    if (url.pathname === "/api/state") {
      if (!env.DB || env.BRIDGE_CLOUD_STATE_ENABLED !== "true") return json({ error: "Cloud state is disabled" }, 503);
      try {
        await ensureDatabase(env.DB);
        if (request.method === "GET") {
          const record = await env.DB.prepare("SELECT payload FROM bridge_state WHERE id = ?1").bind("primary").first();
          return json(record?.payload ? JSON.parse(record.payload) : EMPTY_STATE);
        }
        if (request.method === "PUT") {
          const contentLength = Number(request.headers.get("content-length") || 0);
          if (contentLength > 4_000_000) return json({ error: "Backup is too large" }, 413);
          const body = await request.json();
          if (!body || !Array.isArray(body.contacts) || !Array.isArray(body.places)) return json({ error: "Invalid Bridge data" }, 400);
          const payload = JSON.stringify(body);
          if (payload.length > 4_000_000) return json({ error: "Backup is too large" }, 413);
          await env.DB.prepare("INSERT INTO bridge_state (id, payload, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at").bind("primary", payload, new Date().toISOString()).run();
          return json({ ok: true });
        }
        return json({ error: "Method not allowed" }, 405);
      } catch (error) {
        return json({ error: "Bridge could not access saved data", detail: String(error?.message || error) }, 500);
      }
    }
    if (env.BACKEND_ONLY === "true") return noIndexJSON({ error: "Not found" }, 404);
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    const pageHeaders = { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache", "content-security-policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; connect-src 'self' https://bridge-crm-api.bridgecrm-zayway.workers.dev https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'" };
    if (url.searchParams.has("shared")) pageHeaders["x-robots-tag"] = "noindex, nofollow, noarchive";
    return new Response(request.method === "HEAD" ? null : PAGE, { headers: pageHeaders });
}

export default {
  async fetch(request, env) {
    return withCORS(await handleRequest(request, env), request, env);
  },
  async scheduled(_controller, env, context) {
    context.waitUntil(Promise.allSettled([
      dispatchPushReminders(env),
      runScheduledAccountBackups(env)
    ]));
  }
};

export { bridgeAppURL, remindersForSubscription };
`;

await mkdir(new URL("./dist/server/", import.meta.url), { recursive: true });
await mkdir(new URL("./dist/fonts/", import.meta.url), { recursive: true });
await Promise.all([
  "favicon.svg",
  "favicon-32.png",
  "favicon-48.png",
  "bridge-mark-transparent.png",
  "bridge-icon-monochrome.svg",
  "bridge-icon-192.png",
  "bridge-icon-512.png",
  "bridge-icon-maskable-512.png",
  "bridge-icon-1024.png"
].map(fileName => rm(new URL(`./dist/${fileName}`, import.meta.url), { force: true })));
await writeFile(new URL("./dist/server/index.js", import.meta.url), worker);
await writeFile(new URL("./dist/index.html", import.meta.url), html);
await writeFile(new URL("./dist/brand-icon.js", import.meta.url), brandIconSource);
await writeFile(new URL("./dist/ui-foundation.js", import.meta.url), uiFoundation);
await writeFile(new URL("./dist/walkthrough.js", import.meta.url), walkthrough);
await writeFile(new URL("./dist/tutorial-fixture.js", import.meta.url), tutorialFixture);
await writeFile(new URL("./dist/config.js", import.meta.url), config);
await writeFile(new URL("./dist/account-client.js", import.meta.url), accountClient);
await Promise.all([
  ["app.js", js],
  ["styles.css", css],
  ["contact-logic.js", contactLogic],
  ["engagement-logic.js", engagementLogic],
  ["communication-logic.js", communicationLogic],
  ["analytics-logic.js", analyticsLogic],
  ["relationship-health-logic.js", relationshipHealthLogic],
  ["network-logic.js", networkLogic],
  ["scorecard-logic.js", scorecardLogic],
  ["release-logic.js", releaseLogic],
  ["sw.js", serviceWorker],
  ["manifest.webmanifest", manifest]
].map(([fileName, contents]) => writeFile(new URL(`./dist/${fileName}`, import.meta.url), contents)));
await Promise.all([
  copyFile(new URL("./src/favicon-16x16.png", import.meta.url), new URL("./dist/favicon-16x16.png", import.meta.url)),
  copyFile(new URL("./src/favicon-32x32.png", import.meta.url), new URL("./dist/favicon-32x32.png", import.meta.url)),
  copyFile(new URL("./src/favicon-48x48.png", import.meta.url), new URL("./dist/favicon-48x48.png", import.meta.url)),
  copyFile(new URL("./src/apple-touch-icon.png", import.meta.url), new URL("./dist/apple-touch-icon.png", import.meta.url)),
  copyFile(new URL("./src/bridge-ui-mark.svg", import.meta.url), new URL("./dist/bridge-ui-mark.svg", import.meta.url)),
  copyFile(new URL("./src/bridge-ui-mark-192.png", import.meta.url), new URL("./dist/bridge-ui-mark-192.png", import.meta.url)),
  copyFile(new URL("./src/bridge-app-icon-192.png", import.meta.url), new URL("./dist/bridge-app-icon-192.png", import.meta.url)),
  copyFile(new URL("./src/bridge-app-icon-512.png", import.meta.url), new URL("./dist/bridge-app-icon-512.png", import.meta.url)),
  copyFile(new URL("./src/bridge-app-icon-maskable-192.png", import.meta.url), new URL("./dist/bridge-app-icon-maskable-192.png", import.meta.url)),
  copyFile(new URL("./src/bridge-app-icon-maskable-512.png", import.meta.url), new URL("./dist/bridge-app-icon-maskable-512.png", import.meta.url)),
  copyFile(new URL("./src/bridge-app-icon-1024.png", import.meta.url), new URL("./dist/bridge-app-icon-1024.png", import.meta.url)),
  ...fontFileNames.map(fileName => copyFile(new URL(`./src/fonts/${fileName}`, import.meta.url), new URL(`./dist/fonts/${fileName}`, import.meta.url))),
  copyFile(new URL("./src/fonts/inter-tight-OFL.txt", import.meta.url), new URL("./dist/fonts/inter-tight-OFL.txt", import.meta.url)),
  copyFile(new URL("./src/fonts/newsreader-OFL.txt", import.meta.url), new URL("./dist/fonts/newsreader-OFL.txt", import.meta.url))
]);
console.log("Bridge CRM web build completed.");
