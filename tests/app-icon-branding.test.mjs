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
  for (const [name, size] of [["bridge-icon-1024.png", 1024], ["bridge-icon-512.png", 512], ["bridge-icon-maskable-512.png", 512], ["bridge-icon-192.png", 192], ["apple-touch-icon.png", 180], ["favicon-48.png", 48], ["favicon-32.png", 32]]) {
    const buffer = await readFile(new URL(`src/${name}`, root));
    assert.deepEqual(pngDimensions(buffer), [size, size]);
    assert.equal(buffer[25], 2, `${name} must be an opaque RGB PNG without an alpha channel`);
  }
  assert.ok(manifest.icons.some(icon => icon.src.includes("bridge-icon-1024.png") && icon.sizes === "1024x1024"));
  assert.ok(manifest.icons.some(icon => icon.src.includes("bridge-icon-maskable-512.png") && icon.purpose === "maskable"));
  assert.ok(manifest.icons.some(icon => icon.src.includes("bridge-icon-monochrome.svg") && icon.purpose === "monochrome"));
});

test("Open Span preserves one structural idea across color and monochrome masters", async () => {
  const master = await readFile(new URL("assets/branding/app-icon/final/icon-master.svg", root), "utf8");
  const monochrome = await readFile(new URL("assets/branding/app-icon/final/icon-monochrome.svg", root), "utf8");
  const systemMonochrome = await readFile(new URL("src/bridge-icon-monochrome.svg", root), "utf8");
  for (const source of [master, monochrome, systemMonochrome]) {
    assert.match(source, /id="open-span"/);
    assert.match(source, /id="span"/);
    assert.match(source, /id="forward-step"/);
    assert.doesNotMatch(source, /gradient|filter=|font-family|<image|href=/i);
  }
  assert.match(master, /#073E36/);
  assert.match(master, /#F7F1E6/);
  assert.match(master, /#E1A64A/);
  assert.doesNotMatch(monochrome, /#E1A64A/);
});

test("the concept, refinement, preview, and rollback evidence is committed", async () => {
  for (const file of [
    "assets/branding/app-icon/icon-concept-board.svg",
    "assets/branding/app-icon/previews/icon-concept-board.png",
    "assets/branding/app-icon/previews/icon-home-screen-test.png",
    "assets/branding/app-icon/previews/icon-small-size-test.png",
    "assets/branding/app-icon/previews/icon-mask-test.png",
    "assets/branding/app-icon/previews/icon-validation-board.png",
    "assets/branding/app-icon/archive/pre-1.3.44/checksums.sha256"
  ]) assert.ok((await readFile(new URL(file, root))).length > 100, file);
  const archive = await readFile(new URL("assets/branding/app-icon/archive/pre-1.3.44/checksums.sha256", root), "utf8");
  for (const name of ["bridge-icon-1024.png", "bridge-icon-512.png", "bridge-icon-192.png", "apple-touch-icon.png", "bridge-mark-transparent.png"]) assert.match(archive, new RegExp(`^[a-f0-9]{64}  ${name.replaceAll(".", "\\.")}$`, "m"));
});

test("the Today mark is derived from the canonical icon with real transparency", async () => {
  const mark = await readFile(new URL("src/bridge-mark-transparent.png", root));
  assert.deepEqual(pngDimensions(mark), [192, 192]);
  assert.equal(mark[25], 6, "transparent mark must use PNG RGBA color type");
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

test("Today uses the compact canonical Bridge app icon aligned with the greeting", () => {
  assert.match(app, /class="today-home__brand-mark" src="\.\/bridge-mark-transparent\.png\?v=\$\{escapeHTML\(APP_RELEASE\.version\)\}" alt="">/);
  assert.doesNotMatch(app, /class="today-home__brand-mark"[^>]*>@<\/span>/);
  assert.match(styles, /\.today-home__identity \{[^}]*grid-template-columns: 36px minmax\(0, 1fr\)/);
  const baseMark = styles.slice(styles.indexOf(".today-home__brand-mark {"), styles.indexOf("}", styles.indexOf(".today-home__brand-mark {")) + 1);
  assert.match(baseMark, /width: 36px; height: 36px/);
  assert.match(baseMark, /border-radius: 0/);
  assert.match(baseMark, /background: transparent/);
  assert.match(baseMark, /box-shadow: none/);
  assert.match(baseMark, /object-fit: contain/);
  assert.match(styles, /\.today-home__identity \{ grid-template-columns: 28px minmax\(0, 1fr\); gap: 9px; \}/);
  assert.match(styles, /\.today-home__brand-mark \{ width: 28px; height: 28px; \}/);
});

test("all build and preview paths serve the complete platform icon set", () => {
  assert.match(build, /ICON_1024_BASE64/);
  assert.match(build, /BRIDGE_MARK_TRANSPARENT_BASE64/);
  assert.match(build, /url\.pathname === "\/bridge-mark-transparent\.png"/);
  assert.match(build, /dist\/bridge-mark-transparent\.png/);
  assert.match(build, /url\.pathname === "\/bridge-icon-1024\.png"/);
  assert.match(build, /dist\/bridge-icon-1024\.png/);
  assert.match(build, /ICON_MASKABLE_512_BASE64/);
  assert.match(build, /dist\/bridge-icon-maskable-512\.png/);
  assert.match(build, /ICON_MONOCHROME_SVG/);
  assert.match(build, /dist\/bridge-icon-monochrome\.svg/);
  assert.match(build, /FAVICON_32_BASE64/);
  assert.match(build, /dist\/favicon-32\.png/);
  assert.match(dev, /"\/bridge-icon-1024\.png"/);
  assert.match(dev, /"\/bridge-mark-transparent\.png"/);
  assert.match(dev, /"\/bridge-icon-maskable-512\.png"/);
  assert.match(dev, /"\/bridge-icon-monochrome\.svg"/);
  assert.match(dev, /"\/favicon-32\.png"/);
});
