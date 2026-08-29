const CACHE = "bridge-app-v1.3.43";
const ROOT = new URL("./", self.location.href).href;
const APP_ROOT = new URL(ROOT);
const FOLLOW_UP_FALLBACK = new URL("?page=followups&notification=1", APP_ROOT).href;
try {
  importScripts(new URL("config.js?v=1.3.43", ROOT).href);
} catch {
  // A restarted worker must still install and serve the offline shell when
  // the versioned config script is not in the browser HTTP cache yet.
}
const productionAPI = "https://bridge-crm-api.bridgecrm-zayway.workers.dev";
const hostname = String(self.location?.hostname || "").toLowerCase();
const localHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
const injectedAPI = String(self.BRIDGE_API_BASE || "").trim();
const API_BASE = String(self.BridgeConfig?.apiBase || injectedAPI || (localHost ? self.location.origin : productionAPI)).replace(/\/+$/, "");
const apiURL = path => `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
const SHELL = [ROOT, new URL("index.html", ROOT).href, new URL("config.js", ROOT).href, new URL("contact-logic.js", ROOT).href, new URL("engagement-logic.js", ROOT).href, new URL("communication-logic.js", ROOT).href, new URL("analytics-logic.js", ROOT).href, new URL("relationship-health-logic.js", ROOT).href, new URL("network-logic.js", ROOT).href, new URL("scorecard-logic.js", ROOT).href, new URL("release-logic.js", ROOT).href, new URL("account-client.js", ROOT).href, new URL("ui-foundation.js", ROOT).href, new URL("walkthrough.js", ROOT).href, new URL("tutorial-fixture.js", ROOT).href, new URL("app.js", ROOT).href, new URL("styles.css", ROOT).href, new URL("manifest.webmanifest", ROOT).href, new URL("bridge-mark-transparent.png", ROOT).href, new URL("bridge-icon-192.png", ROOT).href, new URL("bridge-icon-512.png", ROOT).href, new URL("bridge-icon-1024.png", ROOT).href, new URL("apple-touch-icon.png", ROOT).href, new URL("fonts/inter-tight-latin.woff2", ROOT).href, new URL("fonts/inter-tight-latin-ext.woff2", ROOT).href, new URL("fonts/inter-tight-italic-latin.woff2", ROOT).href, new URL("fonts/inter-tight-italic-latin-ext.woff2", ROOT).href, new URL("fonts/newsreader-latin.woff2", ROOT).href, new URL("fonts/newsreader-latin-ext.woff2", ROOT).href, new URL("fonts/newsreader-italic-latin.woff2", ROOT).href, new URL("fonts/newsreader-italic-latin-ext.woff2", ROOT).href];
const SHELL_PATHS = new Set(SHELL.map(value => new URL(value).pathname));

function publicShellResponse(response, requestURL) {
  if (!response?.ok || response.type !== "basic") return false;
  try {
    const responseURL = new URL(response.url || requestURL.href, self.location.href);
    return responseURL.origin === self.location.origin && !responseURL.pathname.includes("/api/") && !isPrivateAPIURL(responseURL.href);
  } catch {
    return false;
  }
}

async function cacheShell() {
  const cache = await caches.open(CACHE);
  // The shell URLs intentionally stay query-free so ignoreSearch can serve
  // them to versioned document requests. Reload each source during install so
  // a new worker cannot combine with an older browser HTTP-cache entry.
  const entries = await Promise.all(SHELL.map(async url => {
    const request = new Request(url, { cache: "reload" });
    const response = await fetch(request);
    if (!publicShellResponse(response, new URL(url))) throw new Error(`Bridge shell asset unavailable: ${url}`);
    return [request, response];
  }));
  await Promise.all(entries.map(([request, response]) => cache.put(request, response)));
  await self.skipWaiting();
}

const PUSH_STORE = "bridge-push-settings";
const PUSH_KEY = "reminder-schedule";
const ACCOUNT_STORE = "bridge-account";
const ACCOUNT_SESSION_KEY = "session";

function notificationTarget(value) {
  try {
    const candidate = new URL(value || FOLLOW_UP_FALLBACK, APP_ROOT);
    const rootPath = APP_ROOT.pathname.endsWith("/") ? APP_ROOT.pathname : `${APP_ROOT.pathname}/`;
    const appPath = candidate.pathname === rootPath.slice(0, -1) || candidate.pathname.startsWith(rootPath);
    const appAPIPath = `${rootPath.slice(0, -1)}/api`;
    const apiPath = candidate.pathname === "/api" || candidate.pathname.startsWith("/api/") || candidate.pathname === appAPIPath || candidate.pathname.startsWith(`${appAPIPath}/`);
    if (candidate.origin !== APP_ROOT.origin || !appPath || apiPath) return FOLLOW_UP_FALLBACK;
    candidate.searchParams.set("notification", "1");
    return candidate.href;
  } catch {
    return FOLLOW_UP_FALLBACK;
  }
}

function isBridgeClient(client) {
  try {
    const candidate = new URL(client.url);
    const rootPath = APP_ROOT.pathname.endsWith("/") ? APP_ROOT.pathname : `${APP_ROOT.pathname}/`;
    return candidate.origin === APP_ROOT.origin && (candidate.pathname === rootPath.slice(0, -1) || candidate.pathname.startsWith(rootPath));
  } catch {
    return false;
  }
}

function belongsToThisApp(value) {
  try {
    const candidate = new URL(value);
    const rootPath = APP_ROOT.pathname.endsWith("/") ? APP_ROOT.pathname : `${APP_ROOT.pathname}/`;
    return candidate.origin === APP_ROOT.origin && (candidate.pathname === rootPath.slice(0, -1) || candidate.pathname.startsWith(rootPath));
  } catch {
    return false;
  }
}

async function removeOldShellEntries() {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith("bridge-app-") && key !== CACHE).map(async key => {
    try {
      const cache = await caches.open(key);
      const requests = await cache.keys();
      await Promise.all(requests.filter(request => belongsToThisApp(request.url)).map(request => cache.delete(request)));
      if (!(await cache.keys()).length) await caches.delete(key);
    } catch {}
  }));
}

function isPrivateAPIURL(value) {
  try {
    const candidate = new URL(value);
    const rootPath = APP_ROOT.pathname.endsWith("/") ? APP_ROOT.pathname : `${APP_ROOT.pathname}/`;
    const appAPIPath = `${rootPath.slice(0, -1)}/api`;
    return candidate.origin === self.location.origin && (candidate.pathname === "/api" || candidate.pathname.startsWith("/api/") || candidate.pathname === appAPIPath || candidate.pathname.startsWith(`${appAPIPath}/`));
  } catch {
    return false;
  }
}

async function clearPrivateCaches() {
  const keys = await caches.keys();
  await Promise.all(keys.map(async key => {
    try {
      if (key.startsWith("bridge-private-")) {
        const cache = await caches.open(key);
        const requests = await cache.keys();
        await Promise.all(requests.filter(request => belongsToThisApp(request.url)).map(request => cache.delete(request)));
        if (!(await cache.keys()).length) await caches.delete(key);
        return;
      }
      if (!key.startsWith("bridge-app-")) return;
      const cache = await caches.open(key);
      const requests = await cache.keys();
      await Promise.all(requests.filter(request => belongsToThisApp(request.url) && isPrivateAPIURL(request.url)).map(request => cache.delete(request)));
    } catch {}
  }));
}

function pushDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PUSH_STORE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("settings");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function saveReminderSchedule(schedule) {
  const database = await pushDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction("settings", "readwrite");
      transaction.objectStore("settings").put(schedule, PUSH_KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Reminder schedule transaction aborted"));
    });
  } finally {
    database.close();
  }
}
async function readReminderSchedule() {
  const database = await pushDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction("settings", "readonly").objectStore("settings").get(PUSH_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

async function clearReminderSchedule() {
  const database = await pushDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction("settings", "readwrite");
      transaction.objectStore("settings").clear();
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Reminder schedule transaction aborted"));
    });
  } finally {
    database.close();
  }
}

async function readAccountSessionToken() {
  try {
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open(ACCOUNT_STORE, 1);
      request.onupgradeneeded = () => {
        for (const store of ["secure", "states", "sync", "mutations"]) {
          if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Account storage is blocked"));
    });
    try {
      if (!database.objectStoreNames.contains("secure")) return "";
      const record = await new Promise((resolve, reject) => {
        const request = database.transaction("secure", "readonly").objectStore("secure").get(ACCOUNT_SESSION_KEY);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      const value = record?.value;
      if (!value?.token || !value?.user?.id) return "";
      if (value.expiresAt && new Date(value.expiresAt).getTime() <= Date.now()) return "";
      return String(value.token);
    } finally {
      database.close();
    }
  } catch {
    return "";
  }
}

self.addEventListener("install", event => {
  event.waitUntil(cacheShell());
});

self.addEventListener("activate", event => {
  event.waitUntil(removeOldShellEntries().then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const requestURL = new URL(event.request.url);
  if (event.request.method !== "GET") return;

  // Account, backup, scorecard, and push responses belong to the API origin and
  // may contain private data. Let the browser fetch them directly and never put
  // them in Cache Storage.
  if (requestURL.origin !== self.location.origin || requestURL.pathname.includes("/api/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request, { cache: "no-store" }).then(response => {
      if (publicShellResponse(response, requestURL)) return response;
      return caches.match(ROOT).then(cached => cached || response);
    }).catch(() => caches.match(ROOT)));
    return;
  }

  if (!SHELL_PATHS.has(requestURL.pathname)) return;
  event.respondWith(fetch(event.request, { cache: "no-store" }).then(response => {
      if (!publicShellResponse(response, requestURL)) return response;
      const copy = response.clone();
      return caches.open(CACHE).then(cache => cache.put(event.request, copy)).then(() => response);
    }).catch(() => caches.match(event.request, { ignoreSearch: true })));
});

self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data?.json() || {}; }
  catch { payload = { body: event.data?.text() || "You have a Bridge follow-up." }; }
  const title = payload.title || "Bridge follow-up";
  const options = {
    body: payload.body || "A scheduled follow-up is ready.",
    icon: new URL("bridge-icon-192.png?v=1.3.43", ROOT).href,
    badge: new URL("bridge-icon-192.png?v=1.3.43", ROOT).href,
    tag: payload.tag || "bridge-followup",
    renotify: false,
    data: { url: notificationTarget(payload.url) }
  };
  const setBadge = typeof navigator.setAppBadge === "function"
    ? Promise.resolve(navigator.setAppBadge(Number(payload.badgeCount) || 1)).catch(() => {})
    : Promise.resolve();
  event.waitUntil(Promise.all([
    self.registration.showNotification(title, options),
    setBadge
  ]));
});

self.addEventListener("message", event => {
  if (event.data?.type === "bridge-reminder-schedule" && event.data.schedule) {
    event.waitUntil(saveReminderSchedule(event.data.schedule).catch(() => {}));
    return;
  }
  if (event.data?.type === "bridge-account-logout") {
    event.waitUntil(Promise.all([
      clearPrivateCaches(),
      clearReminderSchedule().catch(() => {})
    ]));
  }
});

self.addEventListener("pushsubscriptionchange", event => {
  event.waitUntil((async () => {
    try {
      const configResponse = await fetch(apiURL("/api/push/config"), { cache: "no-store" });
      if (!configResponse.ok) return;
      const config = await configResponse.json();
      if (!config.publicKey) return;
      const padding = "=".repeat((4 - config.publicKey.length % 4) % 4);
      const key = Uint8Array.from(atob((config.publicKey + padding).replace(/-/g, "+").replace(/_/g, "/")), character => character.charCodeAt(0));
      const subscription = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const accountToken = await readAccountSessionToken();
      const headers = { "Content-Type": "application/json" };
      if (accountToken) headers.Authorization = `Bearer ${accountToken}`;
      const response = await fetch(apiURL("/api/push/subscribe"), {
        method: "POST",
        headers,
        cache: "no-store",
        body: JSON.stringify({ subscription, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })
      });
      const result = await response.json().catch(() => ({}));
      const schedule = await readReminderSchedule();
      if (response.ok && result.deviceToken && schedule) {
        await fetch(apiURL("/api/push/schedule"), {
          method: "PUT",
          headers: { "Authorization": `Bearer ${result.deviceToken}`, "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ endpoint: subscription.endpoint, schedule })
        });
      }
    } catch {}
  })());
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = notificationTarget(event.notification.data?.url);
  const clearBadge = typeof navigator.clearAppBadge === "function" ? Promise.resolve(navigator.clearAppBadge()).catch(() => {}) : Promise.resolve();
  const navigate = self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async windows => {
    const existing = windows.filter(isBridgeClient).sort((left, right) => Number(right.focused) - Number(left.focused))[0];
    if (existing) {
      await existing.focus();
      existing.postMessage({ type: "bridge-notification-navigation", url: target });
      return existing;
    }
    return self.clients.openWindow(target);
  });
  event.waitUntil(Promise.all([clearBadge, navigate]));
});
