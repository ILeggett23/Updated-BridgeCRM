import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const app = await read("src/app.js");
const account = await read("src/account-client.js");
const brandComponent = await read("src/brand-icon.js");
const page = await read("src/index.html");
const styles = await read("src/styles.css");
const serviceWorker = await read("src/sw.js");
const manifest = JSON.parse(await read("src/manifest.webmanifest"));
const build = await read("build.mjs");
const dev = await read("dev.mjs");

function pngDimensions(buffer) {
  assert.deepEqual([...buffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

test("the supplied PNG is the exact permanent canonical source", async () => {
  const master = await readFile(new URL("assets/branding/app-icon/final/bridge-app-icon-master.png", root));
  const runtime1024 = await readFile(new URL("src/bridge-app-icon-1024.png", root));
  assert.equal(createHash("sha256").update(master).digest("hex"), "baffea4921ad2709f33955dc4d823d8cbd8248f7499c1ba7d48be254bf75d46a");
  assert.deepEqual(runtime1024, master, "the 1024 runtime icon must retain the supplied binary exactly");
  assert.deepEqual(pngDimensions(master), [1024, 1024]);
  assert.equal(master[25], 2, "canonical icon must be opaque RGB");
});

test("every standard and maskable raster has its required size and color mode", async () => {
  const expected = [
    ["bridge-app-icon-1024.png", 1024],
    ["bridge-app-icon-512.png", 512],
    ["bridge-app-icon-192.png", 192],
    ["bridge-app-icon-maskable-512.png", 512],
    ["bridge-app-icon-maskable-192.png", 192],
    ["apple-touch-icon.png", 180],
    ["favicon-48x48.png", 48],
    ["favicon-32x32.png", 32],
    ["favicon-16x16.png", 16]
  ];
  for (const [name, size] of expected) {
    const buffer = await readFile(new URL(`src/${name}`, root));
    assert.deepEqual(pngDimensions(buffer), [size, size]);
    assert.equal(buffer[25], 2, `${name} must be opaque RGB without an alpha channel`);
  }
  const generated = JSON.parse(await read("assets/branding/app-icon/platform/web/generated-assets.json"));
  assert.equal(generated.canonicalSha256, "baffea4921ad2709f33955dc4d823d8cbd8248f7499c1ba7d48be254bf75d46a");
  assert.equal(generated.maskableScale, 0.84);
  assert.ok(generated.maximumTraceDifference <= 2);
  assert.ok(generated.maskableForegroundMaximumRadius < 256, "maskable foreground must fit completely inside a circular mask");
});

test("the transparent Today mark preserves exact traced geometry without a tile", async () => {
  const svg = await read("src/bridge-ui-mark.svg");
  const png = await readFile(new URL("src/bridge-ui-mark-192.png", root));
  assert.match(svg, /id="bridge-shape" fill="#073E36"/);
  assert.match(svg, /id="gold-capsule" fill="#E1A64A"/);
  assert.doesNotMatch(svg, /<rect|#F7F1E6|filter=|stroke=|<image/i);
  assert.deepEqual(pngDimensions(png), [192, 192]);
  assert.equal(png[25], 6, "transparent fallback must use PNG RGBA color type");
  assert.match(app, /brandIcon\(\{ variant:"mark", size:36, className:"today-home__brand-mark" \}\)/);
  assert.match(styles, /\.today-home__brand-mark \{[^}]*border-radius: 0;[^}]*background: transparent;[^}]*box-shadow: none;/);
});

test("one reusable brand component owns app and mark variants accessibly", () => {
  assert.match(brandComponent, /app: `\.\/bridge-app-icon-192\.png\?v=\$\{VERSION\}`/);
  assert.match(brandComponent, /mark: `\.\/bridge-ui-mark\.svg\?v=\$\{VERSION\}`/);
  assert.match(brandComponent, /function render\(\{ variant = "app", size = 48, className = "", label = "" \} = \{\}\)/);
  assert.match(brandComponent, /alt="" aria-hidden="true"/);
  assert.match(brandComponent, /--bridge-brand-icon-size:/);
  assert.match(page, /brand-icon\.js\?v=1\.3\.46/);
  assert.match(account, /variant: "app", size: 46, className: "auth-logo"/);
  assert.match(app, /variant:"app", size:72, className:"session-brand-icon"/);
});

test("login, boot, loading, migration, release notes, and Today use approved variants", () => {
  assert.match(page, /class="brand-mark boot__icon" src="\.\/bridge-app-icon-192\.png\?v=1\.3\.46"/);
  assert.match(account, /<div class="hn-auth-brand">\$\{brandIcon\(\{ variant: "app", size: 46, className: "auth-logo" \}\)\}<span>Bridge CRM<\/span><\/div>/);
  assert.match(app, /account-migration-brand-icon/);
  assert.match(app, /release-notes-brand-icon/);
  assert.match(app, /variant:"mark", size:36, className:"today-home__brand-mark"/);
  assert.match(styles, /\.hn-auth-brand \.auth-logo \{ width: 46px; height: 46px;[^}]*box-shadow: none;/);
  assert.match(styles, /\.session-brand-icon \{[^}]*object-fit: contain;[^}]*box-shadow: none;/);
});

test("the manifest uses only current any and maskable icon paths", () => {
  assert.equal(manifest.name, "Bridge CRM");
  assert.equal(manifest.short_name, "Bridge");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.some(icon => icon.src.includes("bridge-app-icon-192.png") && icon.purpose === "any"));
  assert.ok(manifest.icons.some(icon => icon.src.includes("bridge-app-icon-512.png") && icon.purpose === "any"));
  assert.ok(manifest.icons.some(icon => icon.src.includes("bridge-app-icon-maskable-192.png") && icon.purpose === "maskable"));
  assert.ok(manifest.icons.some(icon => icon.src.includes("bridge-app-icon-maskable-512.png") && icon.purpose === "maskable"));
  assert.equal(manifest.icons.some(icon => /bridge-icon-|monochrome/.test(icon.src)), false);
});

test("build, preview, worker, and offline shell serve every current brand asset", async () => {
  for (const name of [
    "brand-icon.js",
    "bridge-app-icon-1024.png",
    "bridge-app-icon-512.png",
    "bridge-app-icon-192.png",
    "bridge-app-icon-maskable-512.png",
    "bridge-app-icon-maskable-192.png",
    "bridge-ui-mark.svg",
    "bridge-ui-mark-192.png",
    "apple-touch-icon.png",
    "favicon-16x16.png",
    "favicon-32x32.png",
    "favicon-48x48.png"
  ]) {
    assert.match(build, new RegExp(name.replaceAll(".", "\\.")), `build missing ${name}`);
    assert.match(dev, new RegExp(name.replaceAll(".", "\\.")), `preview missing ${name}`);
    assert.match(serviceWorker, new RegExp(name.replaceAll(".", "\\.")), `offline shell missing ${name}`);
    await assert.doesNotReject(access(new URL(`dist/${name}`, root)), `dist missing ${name}`);
  }
});

test("legacy brand asset names are absent while functional email syntax remains", () => {
  const active = [page, app, account, serviceWorker, dev, JSON.stringify(manifest), brandComponent].join("\n");
  for (const legacy of ["bridge-icon-", "bridge-mark-transparent", "favicon.svg", "favicon-32.png", "favicon-48.png"]) assert.equal(active.includes(legacy), false, legacy);
  assert.doesNotMatch(build, /url\.pathname === "\/(?:bridge-icon-|bridge-mark-transparent|favicon\.svg|favicon-32\.png|favicon-48\.png)/);
  assert.doesNotMatch(build, /copyFile\(new URL\("\.\/src\/(?:bridge-icon-|bridge-mark-transparent|favicon\.svg|favicon-32\.png|favicon-48\.png)/);
  assert.match(app, /\[\^\\s@\]\+@\[\^\\s@\]\+/);
  assert.match(account, /type="email"/);
});

test("the production build removes obsolete cached-brand filenames", async () => {
  for (const legacy of ["favicon.svg", "favicon-32.png", "favicon-48.png", "bridge-mark-transparent.png", "bridge-icon-monochrome.svg", "bridge-icon-192.png", "bridge-icon-512.png", "bridge-icon-maskable-512.png", "bridge-icon-1024.png"]) {
    await assert.rejects(access(new URL(`dist/${legacy}`, root)), error => error?.code === "ENOENT", legacy);
  }
});

test("previous production artwork remains available for rollback", async () => {
  const archive = await read("assets/branding/app-icon/archive/pre-1.3.44/checksums.sha256");
  for (const name of ["bridge-icon-1024.png", "bridge-icon-512.png", "bridge-icon-192.png", "apple-touch-icon.png", "bridge-mark-transparent.png"]) assert.match(archive, new RegExp(`^[a-f0-9]{64}  ${name.replaceAll(".", "\\.")}$`, "m"));
});
