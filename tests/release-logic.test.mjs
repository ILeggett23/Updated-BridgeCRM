import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

await import(new URL("../src/release-logic.js", import.meta.url));
const release = globalThis.BridgeRelease;
const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../src/sw.js", import.meta.url), "utf8");
const devServer = await readFile(new URL("../dev.mjs", import.meta.url), "utf8");

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
}

test("new and legacy users see release 1.3.12", () => {
  assert.equal(release.APP_RELEASE.version, "1.3.12");
  assert.equal(release.shouldShowRelease(""), true);
  assert.equal(release.shouldShowRelease("v64"), true);
  assert.equal(release.shouldShowRelease("1.1.63"), true);
});

test("continuing records the exact release and suppresses the same version", () => {
  const storage = memoryStorage();
  assert.equal(release.markReleaseSeen(storage), true);
  assert.equal(storage.getItem(release.RELEASE_STORAGE_KEY), "1.3.12");
  assert.equal(release.shouldShowRelease(release.readLastSeenVersion(storage)), false);
});

test("a future version is not suppressed by the current viewed value", () => {
  const storage = memoryStorage({ bridgeLastSeenVersion: "1.3.12" });
  const future = { ...release.APP_RELEASE, version: "1.4.0" };
  assert.equal(release.shouldShowRelease(release.readLastSeenVersion(storage), future), true);
});

test("release notes are reusable, accessible, and manually available", () => {
  assert.match(appSource, /function releaseNotesModal\(\)/);
  assert.match(appSource, /role="dialog" aria-modal="true"/);
  assert.match(appSource, /id="continueReleaseNotes"/);
  assert.match(appSource, /id="openReleaseNotes"/);
  assert.match(appSource, /releaseFocusableElements/);
  assert.match(appSource, /queueAutomaticReleaseNotes/);
  assert.match(styles, /\.release-notes-modal/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
});

test("service worker uses the semantic release cache", () => {
  assert.match(serviceWorker, /bridge-app-v1\.3\.12/);
  assert.match(serviceWorker, /config\.js\?v=1\.3\.12/);
});

test("local preview serves release dependencies as JavaScript", () => {
  assert.match(devServer, /\["\/release-logic\.js", \["\.\/src\/release-logic\.js", "text\/javascript/);
  assert.match(devServer, /\["\/config\.js", \["\.\/src\/config\.js", "text\/javascript/);
});
