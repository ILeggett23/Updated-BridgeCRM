import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const serviceWorker = await read("src/sw.js");
const page = await read("src/index.html");
const build = await read("build.mjs");
const dev = await read("dev.mjs");
const worker = await read("dist/server/index.js");

test("offline install includes every local font and refreshes source assets", () => {
  for (const font of [
    "inter-tight-latin.woff2",
    "inter-tight-latin-ext.woff2",
    "inter-tight-italic-latin.woff2",
    "inter-tight-italic-latin-ext.woff2",
    "newsreader-latin.woff2",
    "newsreader-latin-ext.woff2",
    "newsreader-italic-latin.woff2",
    "newsreader-italic-latin-ext.woff2"
  ]) {
    assert.match(serviceWorker, new RegExp(`fonts/${font.replaceAll(".", "\\.")}\\", ROOT`));
  }
  assert.match(serviceWorker, /Promise\.all\(SHELL\.map\(async url => \{/);
  assert.match(serviceWorker, /fetch\(request\)/);
  assert.match(serviceWorker, /if \(!publicShellResponse\(response, new URL\(url\)\)\) throw/);
  assert.match(serviceWorker, /await self\.skipWaiting\(\)/);
});

test("the static build emits every document and service-worker dependency", async () => {
  for (const file of [
    "app.js",
    "styles.css",
    "config.js",
    "contact-logic.js",
    "engagement-logic.js",
    "communication-logic.js",
    "analytics-logic.js",
    "relationship-health-logic.js",
    "network-logic.js",
    "scorecard-logic.js",
    "release-logic.js",
    "account-client.js",
    "ui-foundation.js",
    "walkthrough.js",
    "tutorial-fixture.js",
    "manifest.webmanifest",
    "sw.js"
  ]) {
    await assert.doesNotReject(access(new URL(`dist/${file}`, root)), file);
  }
  assert.match(build, /\["sw\.js", serviceWorker\]/);
  assert.match(build, /\["manifest\.webmanifest", manifest\]/);
  assert.match(build, /const serviceWorkerSource = await readFile/);
  assert.match(dev, /pathname === "\/sw\.js" && configuredAPIBase/);
  assert.match(worker, /fonts\/inter-tight-latin\.woff2/);
});

test("local preview supports both root and GitHub Pages project-path launches", () => {
  assert.match(page, /const localHost = location\.hostname === "localhost"/);
  assert.match(page, /location\.protocol !== "https:" && !localHost/);
  assert.match(dev, /const PROJECT_PATH = "\/Updated-BridgeCRM"/);
  assert.match(dev, /function sourcePath\(pathname\)/);
  assert.match(dev, /pathname\.startsWith\(`\$\{PROJECT_PATH\}\/`\)/);
});

test("service-worker cache writes reject API or redirected private responses", () => {
  assert.match(serviceWorker, /function publicShellResponse\(response, requestURL\)/);
  assert.match(serviceWorker, /responseURL\.origin === self\.location\.origin/);
  assert.match(serviceWorker, /!responseURL\.pathname\.includes\("\/api\/"\)/);
  assert.match(serviceWorker, /!isPrivateAPIURL\(responseURL\.href\)/);
  assert.match(serviceWorker, /if \(!publicShellResponse\(response, requestURL\)\) return response/);
  assert.match(serviceWorker, /fetch\(apiURL\("\/api\/push\/config"\), \{ cache: "no-store" \}\)/);
  assert.match(serviceWorker, /method: "POST",\n        headers,\n        cache: "no-store"/);
});

test("a cold offline worker can start without the versioned config HTTP cache", () => {
  assert.match(serviceWorker, /try \{\s*importScripts\(new URL\("config\.js\?v=1\.3\.40", ROOT\)\.href\);\s*\} catch/);
  assert.match(serviceWorker, /const productionAPI = "https:\/\/bridge-crm-api\.bridgecrm-zayway\.workers\.dev"/);
  assert.match(serviceWorker, /localHost = hostname === "localhost"/);
  assert.match(serviceWorker, /self\.BridgeConfig\?\.apiBase \|\| injectedAPI/);
});

test("cache upgrades do not evict a sibling app hosted on the same origin", () => {
  assert.match(serviceWorker, /function belongsToThisApp\(value\)/);
  assert.match(serviceWorker, /requests\.filter\(request => belongsToThisApp\(request\.url\)\)/);
  assert.match(serviceWorker, /if \(\!\(await cache\.keys\(\)\)\.length\) await caches\.delete\(key\)/);
});

test("notification targets cannot deep-link into same-origin API paths", () => {
  assert.match(serviceWorker, /const appAPIPath = `\$\{rootPath\.slice\(0, -1\)\}\/api`/);
  assert.match(serviceWorker, /const apiPath = candidate\.pathname === "\/api" \|\| candidate\.pathname\.startsWith\("\/api\/"\) \|\| candidate\.pathname === appAPIPath/);
  assert.match(serviceWorker, /!appPath \|\| apiPath/);
});

test("logout clears private cache names and any accidental same-origin API entries", () => {
  assert.match(serviceWorker, /async function clearPrivateCaches\(\)/);
  assert.match(serviceWorker, /key\.startsWith\("bridge-private-"\)/);
  assert.match(serviceWorker, /requests\.filter\(request => belongsToThisApp\(request\.url\)\)\.map\(request => cache\.delete\(request\)\)/);
  assert.match(serviceWorker, /requests\.filter\(request => belongsToThisApp\(request\.url\) && isPrivateAPIURL\(request\.url\)\)/);
  assert.match(serviceWorker, /clearPrivateCaches\(\),\n      clearReminderSchedule\(\)\.catch/);
});

test("notification badges degrade safely when browser badge APIs are unavailable", () => {
  assert.match(serviceWorker, /typeof navigator\.setAppBadge === "function"/);
  assert.match(serviceWorker, /typeof navigator\.clearAppBadge === "function"/);
  assert.match(serviceWorker, /Promise\.resolve\(navigator\.setAppBadge/);
  assert.match(serviceWorker, /Promise\.resolve\(navigator\.clearAppBadge/);
});
