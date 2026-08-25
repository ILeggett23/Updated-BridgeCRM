import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const app = await readFile(new URL("src/app.js", root), "utf8");
const page = await readFile(new URL("src/index.html", root), "utf8");
const styles = await readFile(new URL("src/styles.css", root), "utf8");
const manifest = JSON.parse(await readFile(new URL("src/manifest.webmanifest", root), "utf8"));
const build = await readFile(new URL("build.mjs", root), "utf8");
const dev = await readFile(new URL("dev.mjs", root), "utf8");

function pngDimensions(buffer) {
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

test("the supplied app artwork owns every required icon size", async () => {
  for (const [name, size] of [["bridge-icon-1024.png", 1024], ["bridge-icon-512.png", 512], ["bridge-icon-192.png", 192], ["apple-touch-icon.png", 180]]) {
    const buffer = await readFile(new URL(`src/${name}`, root));
    assert.deepEqual(pngDimensions(buffer), [size, size]);
  }
  assert.ok(manifest.icons.some(icon => icon.src.includes("bridge-icon-1024.png") && icon.sizes === "1024x1024"));
});

test("boot and authenticated session loading render the canonical app icon", () => {
  assert.match(page, /class="brand-mark boot__icon" src="\.\/bridge-icon-192\.png/);
  assert.match(page, /Relationships that move forward/);
  assert.match(app, /class="session-brand-icon" src="\.\/bridge-icon-192\.png\?v=\$\{escapeHTML\(APP_RELEASE\.version\)\}"/);
  const loading = app.slice(app.indexOf("function renderSessionLoading"), app.indexOf("function cleanAccountURLParameter"));
  assert.doesNotMatch(loading, /icons\.bridge|session-brand-symbol|<svg/);
  assert.match(styles, /\.boot__icon \{ width: 92px; height: 92px/);
  assert.match(styles, /\.session-brand-icon \{ width: 72px; height: 72px/);
  assert.doesNotMatch(styles, /\.hn-auth-brand \.auth-logo \{[^}]*filter:/);
  assert.match(page, /class="auth-logo"|account-client\.js/);
});

test("Today keeps a compact transparent Bridge at-mark aligned with the greeting", () => {
  assert.match(app, /class="today-home__brand-mark" aria-hidden="true">@<\/span>/);
  assert.doesNotMatch(app, /class="today-home__app-icon"/);
  assert.match(styles, /\.today-home__identity \{[^}]*grid-template-columns: 36px minmax\(0, 1fr\)/);
  const baseMark = styles.slice(styles.indexOf(".today-home__brand-mark {"), styles.indexOf("}", styles.indexOf(".today-home__brand-mark {")) + 1);
  assert.match(baseMark, /width: 36px; height: 36px/);
  assert.match(baseMark, /font-size: 44px/);
  assert.match(baseMark, /background: transparent/);
  assert.match(baseMark, /box-shadow: none/);
  assert.match(styles, /\.today-home__identity \{ grid-template-columns: 28px minmax\(0, 1fr\); gap: 9px; \}/);
  assert.match(styles, /\.today-home__brand-mark \{ width: 28px; height: 28px; font-size: 34px; \}/);
});

test("all build and preview paths serve the 1024px icon", () => {
  assert.match(build, /ICON_1024_BASE64/);
  assert.match(build, /url\.pathname === "\/bridge-icon-1024\.png"/);
  assert.match(build, /dist\/bridge-icon-1024\.png/);
  assert.match(dev, /"\/bridge-icon-1024\.png"/);
});
