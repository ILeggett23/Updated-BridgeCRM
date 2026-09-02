import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);
const sharp = require(process.env.BRIDGE_SHARP_PATH || "sharp");
const root = path.resolve(import.meta.dirname, "..");
const sourcePath = path.join(root, "assets", "branding", "app-icon", "final", "bridge-app-icon-master.png");
const markSvgPath = path.join(root, "assets", "branding", "app-icon", "final", "bridge-ui-mark.svg");
const srcPath = path.join(root, "src");
const platformPath = path.join(root, "assets", "branding", "app-icon", "platform", "web");
const expected = {
  size: 1024,
  sha256: "baffea4921ad2709f33955dc4d823d8cbd8248f7499c1ba7d48be254bf75d46a",
  background: [7, 62, 54],
  cream: [247, 241, 230],
  gold: [225, 166, 74]
};
const markGreen = [7, 62, 54];
const maskableScale = 0.84;

await mkdir(srcPath, { recursive: true });
await mkdir(platformPath, { recursive: true });

const canonical = await readFile(sourcePath);
const canonicalHash = createHash("sha256").update(canonical).digest("hex");
const metadata = await sharp(canonical).metadata();
if (canonicalHash !== expected.sha256) throw new Error(`Unexpected canonical icon SHA-256: ${canonicalHash}`);
if (metadata.width !== expected.size || metadata.height !== expected.size) throw new Error("Canonical icon must be exactly 1024 × 1024");
if (metadata.hasAlpha) throw new Error("Canonical app icon must be opaque RGB without an alpha channel");

function squaredDistance(left, right) {
  return left.reduce((sum, value, index) => sum + (value - right[index]) ** 2, 0);
}

function fitComposite(pixel, foreground) {
  const delta = foreground.map((value, index) => value - expected.background[index]);
  const source = pixel.map((value, index) => value - expected.background[index]);
  const denominator = delta.reduce((sum, value) => sum + value * value, 0);
  const alpha = Math.max(0, Math.min(1, source.reduce((sum, value, index) => sum + value * delta[index], 0) / denominator));
  const reconstructed = expected.background.map((value, index) => value + alpha * delta[index]);
  return { alpha, error: squaredDistance(pixel, reconstructed) };
}

async function extractedUiMark() {
  const { data, info } = await sharp(canonical).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const output = Buffer.alloc(info.width * info.height * 4);
  for (let index = 0; index < info.width * info.height; index += 1) {
    const sourceOffset = index * info.channels;
    const targetOffset = index * 4;
    const pixel = [data[sourceOffset], data[sourceOffset + 1], data[sourceOffset + 2]];
    const creamFit = fitComposite(pixel, expected.cream);
    const goldFit = fitComposite(pixel, expected.gold);
    const selected = creamFit.error <= goldFit.error
      ? { ...creamFit, color: markGreen }
      : { ...goldFit, color: expected.gold };
    const alpha = squaredDistance(pixel, expected.background) <= 1 ? 0 : Math.round(selected.alpha * 255);
    output[targetOffset] = selected.color[0];
    output[targetOffset + 1] = selected.color[1];
    output[targetOffset + 2] = selected.color[2];
    output[targetOffset + 3] = alpha;
  }
  return sharp(output, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
}

async function renderStandard(output, size) {
  await sharp(canonical)
    .resize(size, size, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .removeAlpha()
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(output);
}

async function renderMaskable(output, size) {
  const inset = Math.round(size * maskableScale);
  const resized = await sharp(canonical)
    .resize(inset, inset, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .removeAlpha()
    .png()
    .toBuffer();
  const offset = Math.floor((size - inset) / 2);
  await sharp({ create: { width: size, height: size, channels: 3, background: { r: 7, g: 62, b: 54 } } })
    .composite([{ input: resized, left: offset, top: offset }])
    .removeAlpha()
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(output);
}

const mark1024 = await extractedUiMark();
const markSvg = await readFile(markSvgPath);
const tracedMark = await sharp(markSvg).resize(1024, 1024).png().toBuffer();
const extractedRaw = await sharp(mark1024).raw().toBuffer();
const tracedRaw = await sharp(tracedMark).raw().toBuffer();
let maximumTraceDifference = 0;
for (let index = 0; index < extractedRaw.length; index += 4) {
  const extractedAlpha = extractedRaw[index + 3] / 255;
  const tracedAlpha = tracedRaw[index + 3] / 255;
  maximumTraceDifference = Math.max(maximumTraceDifference, Math.abs(extractedRaw[index + 3] - tracedRaw[index + 3]));
  for (let channel = 0; channel < 3; channel += 1) {
    maximumTraceDifference = Math.max(maximumTraceDifference, Math.abs(extractedRaw[index + channel] * extractedAlpha - tracedRaw[index + channel] * tracedAlpha));
  }
}
if (maximumTraceDifference > 2) throw new Error(`Vector mark differs from extracted canonical contours by ${maximumTraceDifference} levels`);

await copyFile(sourcePath, path.join(srcPath, "bridge-app-icon-1024.png"));
await copyFile(markSvgPath, path.join(srcPath, "bridge-ui-mark.svg"));
await writeFile(path.join(root, "assets", "branding", "app-icon", "final", "bridge-ui-mark.png"), mark1024);
await sharp(mark1024).resize(192, 192).png({ compressionLevel: 9 }).toFile(path.join(srcPath, "bridge-ui-mark-192.png"));

const standardSizes = [192, 512];
const faviconSizes = [16, 32, 48];
await Promise.all([
  ...standardSizes.map(size => renderStandard(path.join(srcPath, `bridge-app-icon-${size}.png`), size)),
  ...faviconSizes.map(size => renderStandard(path.join(srcPath, `favicon-${size}x${size}.png`), size)),
  renderStandard(path.join(srcPath, "apple-touch-icon.png"), 180),
  renderMaskable(path.join(srcPath, "bridge-app-icon-maskable-192.png"), 192),
  renderMaskable(path.join(srcPath, "bridge-app-icon-maskable-512.png"), 512)
]);

for (const name of [
  "bridge-app-icon-1024.png",
  "bridge-app-icon-192.png",
  "bridge-app-icon-512.png",
  "bridge-app-icon-maskable-192.png",
  "bridge-app-icon-maskable-512.png",
  "bridge-ui-mark.svg",
  "bridge-ui-mark-192.png",
  "apple-touch-icon.png",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "favicon-48x48.png"
]) await copyFile(path.join(srcPath, name), path.join(platformPath, name));

const previewPath = path.join(root, "assets", "branding", "app-icon", "previews");
await mkdir(previewPath, { recursive: true });
const maskable512 = await readFile(path.join(srcPath, "bridge-app-icon-maskable-512.png"));
const maskableDataUrl = `data:image/png;base64,${maskable512.toString("base64")}`;
const maskShapes = [
  ["Circle", '<circle cx="160" cy="160" r="160"/>'],
  ["Squircle", '<path d="M0 82C0 28 28 0 82 0H238C292 0 320 28 320 82V238C320 292 292 320 238 320H82C28 320 0 292 0 238Z"/>'],
  ["Rounded square", '<rect width="320" height="320" rx="72"/>'],
  ["Square", '<rect width="320" height="320"/>']
];
const maskPreview = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="620" viewBox="0 0 1600 620">
<rect width="1600" height="620" fill="#FBFAF7"/>
<text x="70" y="62" font-family="Arial,sans-serif" font-size="36" font-weight="700" fill="#1B1913">Maskable icon safe-zone verification</text>
<text x="70" y="101" font-family="Arial,sans-serif" font-size="20" fill="#847D70">The complete supplied artwork is scaled uniformly to 84%; the gold capsule remains visible in every mask.</text>
${maskShapes.map(([label, shape], index) => `<g transform="translate(${70 + index * 380} 155)"><clipPath id="mask-${index}" clipPathUnits="userSpaceOnUse">${shape}</clipPath><image width="320" height="320" href="${maskableDataUrl}" clip-path="url(#mask-${index})"/><text x="160" y="370" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="600" fill="#1B1913">${label}</text></g>`).join("")}
</svg>`;
await sharp(Buffer.from(maskPreview)).png({ compressionLevel: 9 }).toFile(path.join(previewPath, "icon-maskable-safe-zone-test.png"));

const markDataUrl = `data:image/svg+xml;base64,${markSvg.toString("base64")}`;
const transparencyPreview = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="640" viewBox="0 0 1200 640">
<defs><pattern id="checker" width="48" height="48" patternUnits="userSpaceOnUse"><rect width="48" height="48" fill="#FFFFFF"/><rect width="24" height="24" fill="#E5E1D9"/><rect x="24" y="24" width="24" height="24" fill="#E5E1D9"/></pattern></defs>
<rect width="1200" height="640" fill="#FBFAF7"/><text x="64" y="64" font-family="Arial,sans-serif" font-size="36" font-weight="700" fill="#1B1913">Transparent UI-mark verification</text>
<rect x="64" y="112" width="472" height="472" rx="24" fill="url(#checker)"/><image x="64" y="112" width="472" height="472" href="${markDataUrl}"/>
<rect x="664" y="112" width="472" height="472" rx="24" fill="#F5F2EC"/><image x="664" y="112" width="472" height="472" href="${markDataUrl}"/>
<text x="300" y="616" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="#847D70">Checkerboard: surrounding pixels are transparent</text><text x="900" y="616" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="#847D70">Today canvas: no square, tile, border, or shadow</text></svg>`;
await sharp(Buffer.from(transparencyPreview)).png({ compressionLevel: 9 }).toFile(path.join(previewPath, "icon-ui-mark-transparency-test.png"));

const generated = {};
for (const name of [
  "bridge-app-icon-1024.png",
  "bridge-app-icon-192.png",
  "bridge-app-icon-512.png",
  "bridge-app-icon-maskable-192.png",
  "bridge-app-icon-maskable-512.png",
  "bridge-ui-mark-192.png",
  "apple-touch-icon.png",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "favicon-48x48.png"
]) {
  const file = await readFile(path.join(srcPath, name));
  const info = await sharp(file).metadata();
  generated[name] = { width: info.width, height: info.height, alpha: Boolean(info.hasAlpha), sha256: createHash("sha256").update(file).digest("hex") };
}
const maskableRaw = await sharp(await readFile(path.join(srcPath, "bridge-app-icon-maskable-512.png"))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
let maskableForegroundMaximumRadius = 0;
for (let y = 0; y < maskableRaw.info.height; y += 1) {
  for (let x = 0; x < maskableRaw.info.width; x += 1) {
    const offset = (y * maskableRaw.info.width + x) * maskableRaw.info.channels;
    const pixel = [maskableRaw.data[offset], maskableRaw.data[offset + 1], maskableRaw.data[offset + 2]];
    if (squaredDistance(pixel, expected.background) <= 16) continue;
    maskableForegroundMaximumRadius = Math.max(maskableForegroundMaximumRadius, Math.hypot(x + 0.5 - 256, y + 0.5 - 256));
  }
}
await writeFile(path.join(platformPath, "generated-assets.json"), `${JSON.stringify({ canonicalSha256: canonicalHash, maskableScale, maximumTraceDifference, maskableForegroundMaximumRadius, generated }, null, 2)}\n`);
console.log(`Generated ${Object.keys(generated).length} Bridge brand assets from ${path.relative(root, sourcePath)}`);
