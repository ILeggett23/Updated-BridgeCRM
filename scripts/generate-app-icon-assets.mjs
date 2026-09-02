import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);
const sharp = require(process.env.BRIDGE_SHARP_PATH || "sharp");

const root = path.resolve(import.meta.dirname, "..");
const brandingRoot = path.join(root, "assets", "branding", "app-icon");
const srcRoot = path.join(root, "src");
const palette = {
  forest: "#0A4F44",
  forestDeep: "#073E36",
  cream: "#F7F1E6",
  paper: "#FBFAF7",
  ink: "#1B1913",
  warmGray: "#847D70",
  amber: "#E1A64A",
  ember: "#AE3E2A",
  moss: "#3C6B3F"
};

const directories = [
  "strategy",
  "concepts",
  "refinements",
  "final",
  "previews",
  "platform/apple",
  "platform/android",
  "platform/web",
  "archive/pre-1.3.44"
];

await Promise.all(directories.map(directory => mkdir(path.join(brandingRoot, directory), { recursive: true })));
await mkdir(path.join(root, "scripts"), { recursive: true });

function svgDocument(content, { width = 1024, height = 1024, title = "", description = "", background = "" } = {}) {
  const accessible = title
    ? `<title id="title">${title}</title>${description ? `<desc id="description">${description}</desc>` : ""}`
    : "";
  const aria = title ? ` role="img" aria-labelledby="title${description ? " description" : ""}"` : " aria-hidden=\"true\"";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"${aria}>
${accessible}
${background ? `<rect width="${width}" height="${height}" fill="${background}"/>` : ""}
${content}
</svg>\n`;
}

function openSpan({ main = palette.ink, accent = main, refinement = "c" } = {}) {
  const variants = {
    a: {
      main: "M226 786V430C226 248 354 126 512 126C684 126 812 260 812 434V536C812 592 766 638 710 638C654 638 608 592 608 536V438C608 366 566 320 512 320C458 320 420 366 420 438V786C420 842 374 888 318 888C262 888 226 842 226 786Z",
      step: "M716 698C716 646 758 604 810 604C862 604 904 646 904 698V788C904 840 862 882 810 882C758 882 716 840 716 788Z"
    },
    b: {
      main: "M246 780V426C246 252 366 140 520 140C682 140 798 264 798 430V516C798 570 754 614 700 614C646 614 602 570 602 516V438C602 368 566 326 516 326C466 326 430 368 430 438V780C430 834 386 878 332 878C278 878 246 834 246 780Z",
      step: "M742 676C742 626 782 586 832 586C882 586 922 626 922 676V788C922 838 882 878 832 878C782 878 742 838 742 788Z"
    },
    c: {
      main: "M236 780V430C236 250 358 130 520 130C690 130 814 264 814 434V520C814 574 770 618 716 618C662 618 618 574 618 520V438C618 364 574 320 520 320C466 320 430 364 430 438V780C430 834 386 878 332 878C278 878 236 834 236 780Z",
      step: "M734 728C734 678 774 638 824 638C874 638 914 678 914 728V788C914 838 874 878 824 878C774 878 734 838 734 788Z"
    }
  };
  const geometry = variants[refinement] || variants.c;
  return `<g id="open-span">
  <path id="span" fill="${main}" d="${geometry.main}"/>
  <path id="forward-step" fill="${accent}" d="${geometry.step}"/>
</g>`;
}

function heldThread({ main = palette.ink, refinement = "a" } = {}) {
  const variants = {
    a: { width: 154, path: "M746 300C676 188 506 152 366 224C226 296 168 470 238 606C308 742 472 804 608 742C690 704 746 636 764 558", cut: "M338 686L444 576" },
    b: { width: 166, path: "M752 322C660 180 446 164 302 286C180 390 178 584 300 700C420 814 620 798 724 666", cut: "M324 654L444 544" },
    c: { width: 146, path: "M744 286C630 176 436 178 310 294C184 410 184 608 310 724C432 836 624 830 742 714", cut: "M358 702L470 578" }
  };
  const geometry = variants[refinement] || variants.a;
  return `<g id="held-thread">
  <path d="${geometry.path}" fill="none" stroke="${main}" stroke-width="${geometry.width}" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${geometry.cut}" fill="none" stroke="${main}" stroke-width="${geometry.width}" stroke-linecap="round"/>
</g>`;
}

function memoryFold({ main = palette.ink } = {}) {
  return `<g id="memory-fold">
  <path fill="${main}" fill-rule="evenodd" d="M284 154H648L854 360V724L700 878H334L170 714V268L284 154ZM358 328V672H646V556H532V442H646V328H358Z"/>
  <path fill="${main}" d="M646 328L796 478L646 556Z"/>
</g>`;
}

function secondBeat({ main = palette.ink } = {}) {
  return `<g id="second-beat">
  <path fill="${main}" d="M184 438C184 292 302 174 448 174C594 174 712 292 712 438C712 584 594 702 448 702C302 702 184 584 184 438ZM354 438C354 490 396 532 448 532C500 532 542 490 542 438C542 386 500 344 448 344C396 344 354 386 354 438Z"/>
  <path fill="${main}" d="M604 676C604 580 682 502 778 502C874 502 952 580 952 676C952 772 874 850 778 850C682 850 604 772 604 676Z"/>
</g>`;
}

function relayCut({ main = palette.ink } = {}) {
  return `<g id="relay-cut">
  <path fill="${main}" d="M156 226C156 170 202 124 258 124H536C592 124 638 170 638 226V462C638 518 592 564 536 564H258C202 564 156 518 156 462Z"/>
  <path fill="${main}" d="M386 562C386 506 432 460 488 460H766C822 460 868 506 868 562V798C868 854 822 900 766 900H488C432 900 386 854 386 798Z"/>
  <path fill="${palette.paper}" d="M488 460H638L536 564H386Z"/>
</g>`;
}

const concepts = [
  { slug: "01-open-span", name: "Open Span", story: "A relationship moves because one support becomes the next step.", draw: () => openSpan() },
  { slug: "02-held-thread", name: "Held Thread", story: "Context stays held while the relationship remains open.", draw: () => heldThread() },
  { slug: "03-memory-fold", name: "Memory Fold", story: "What you learn is folded into the next useful moment.", draw: () => memoryFold() },
  { slug: "04-second-beat", name: "Second Beat", story: "A conversation creates a second beat: the follow-through.", draw: () => secondBeat() },
  { slug: "05-relay-cut", name: "Relay Cut", story: "The important detail passes cleanly from memory into action.", draw: () => relayCut() }
];

const conceptSvgs = new Map();
for (const concept of concepts) {
  const svg = svgDocument(concept.draw(), {
    title: `${concept.name} monochrome concept`,
    description: concept.story,
    background: palette.paper
  });
  conceptSvgs.set(concept.slug, svg);
  await writeFile(path.join(brandingRoot, "concepts", `${concept.slug}.svg`), svg);
}

const refinements = [
  { slug: "open-span-a-balanced", name: "Open Span A / Balanced", draw: () => openSpan({ refinement: "a" }) },
  { slug: "open-span-b-forward", name: "Open Span B / Forward", draw: () => openSpan({ refinement: "b" }) },
  { slug: "open-span-c-quiet", name: "Open Span C / Quiet", draw: () => openSpan({ refinement: "c" }) },
  { slug: "held-thread-a-loop", name: "Held Thread A / Loop", draw: () => heldThread({ refinement: "a" }) },
  { slug: "held-thread-b-clasp", name: "Held Thread B / Clasp", draw: () => heldThread({ refinement: "b" }) },
  { slug: "held-thread-c-release", name: "Held Thread C / Release", draw: () => heldThread({ refinement: "c" }) }
];

for (const refinement of refinements) {
  await writeFile(path.join(brandingRoot, "refinements", `${refinement.slug}.svg`), svgDocument(refinement.draw(), {
    title: refinement.name,
    description: "Black and white structural refinement for BridgeCRM app-icon evaluation.",
    background: palette.paper
  }));
}

const finalSymbolColor = openSpan({ main: palette.forest, accent: palette.amber, refinement: "c" });
const finalSymbolDark = openSpan({ main: palette.cream, accent: palette.amber, refinement: "c" });
const finalSymbolMono = openSpan({ main: palette.ink, accent: palette.ink, refinement: "c" });
const finalSymbolWhite = openSpan({ main: "#FFFFFF", accent: "#FFFFFF", refinement: "c" });

const finalFiles = new Map([
  ["icon-master.svg", svgDocument(finalSymbolDark, {
    title: "BridgeCRM Open Span app icon",
    description: "A calm bridge arch with a deliberately broken and forward-stepped second support.",
    background: palette.forestDeep
  })],
  ["icon-monochrome.svg", svgDocument(finalSymbolMono, {
    title: "BridgeCRM Open Span monochrome symbol",
    description: "Single-color master mark with the gap and stepped support preserved."
  })],
  ["icon-light.svg", svgDocument(finalSymbolColor, {
    title: "BridgeCRM Open Span light appearance",
    description: "Forest and amber Open Span symbol on warm paper.",
    background: palette.cream
  })],
  ["icon-dark.svg", svgDocument(finalSymbolDark, {
    title: "BridgeCRM Open Span dark appearance",
    description: "Cream and amber Open Span symbol on Bridge forest.",
    background: palette.forestDeep
  })],
  ["icon-symbol.svg", svgDocument(finalSymbolColor, {
    title: "BridgeCRM Open Span transparent symbol",
    description: "Transparent full-color Open Span brand mark."
  })]
]);

for (const [name, svg] of finalFiles) await writeFile(path.join(brandingRoot, "final", name), svg);

await writeFile(path.join(brandingRoot, "platform", "apple", "icon-default.svg"), finalFiles.get("icon-light.svg"));
await writeFile(path.join(brandingRoot, "platform", "apple", "icon-dark.svg"), finalFiles.get("icon-dark.svg"));
await writeFile(path.join(brandingRoot, "platform", "apple", "icon-mono.svg"), svgDocument(finalSymbolWhite, { background: "#000000" }));
await writeFile(path.join(brandingRoot, "platform", "android", "foreground.svg"), svgDocument(finalSymbolDark));
await writeFile(path.join(brandingRoot, "platform", "android", "background.svg"), svgDocument("", { background: palette.forestDeep }));
await writeFile(path.join(brandingRoot, "platform", "android", "monochrome.svg"), svgDocument(finalSymbolMono));
await writeFile(path.join(brandingRoot, "platform", "web", "favicon.svg"), finalFiles.get("icon-master.svg"));
await writeFile(path.join(srcRoot, "favicon.svg"), finalFiles.get("icon-master.svg"));
await writeFile(path.join(srcRoot, "bridge-icon-monochrome.svg"), svgDocument(finalSymbolMono, {
  title: "BridgeCRM Open Span monochrome icon",
  description: "Single-color Open Span symbol for system tinting."
}));

function card({ x, y, width, height, title, subtitle = "", content, background = "#FFFFFF" }) {
  return `<g transform="translate(${x} ${y})">
  <rect width="${width}" height="${height}" rx="28" fill="${background}" stroke="#DDD7CD"/>
  ${content}
  <text x="28" y="${height - 58}" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700" fill="${palette.ink}">${title}</text>
  ${subtitle ? `<text x="28" y="${height - 28}" font-family="Inter, Arial, sans-serif" font-size="16" fill="${palette.warmGray}">${subtitle}</text>` : ""}
</g>`;
}

const conceptCards = concepts.map((concept, index) => {
  const x = 50 + (index % 3) * 500;
  const y = 138 + Math.floor(index / 3) * 500;
  return card({
    x,
    y,
    width: 450,
    height: 450,
    title: concept.name,
    subtitle: ["bridge + forward gap", "continuity + openness", "retained context + reveal", "conversation + follow-through", "handoff + usable context"][index],
    content: `<g transform="translate(93 34) scale(.258)">${concept.draw()}</g>`
  });
}).join("\n");

const refinementCards = refinements.map((refinement, index) => {
  const x = 50 + (index % 6) * 250;
  const y = 1160;
  return card({
    x,
    y,
    width: 220,
    height: 270,
    title: refinement.name.split(" / ")[1],
    subtitle: refinement.name.split(" / ")[0],
    content: `<g transform="translate(46 24) scale(.125)">${refinement.draw()}</g>`
  });
}).join("\n");

const conceptBoardSvg = svgDocument(`
<rect width="1600" height="1500" fill="#F1EEE8"/>
<text x="50" y="68" font-family="Inter, Arial, sans-serif" font-size="38" font-weight="700" fill="${palette.ink}">BridgeCRM app-icon concept territories</text>
<text x="50" y="103" font-family="Inter, Arial, sans-serif" font-size="20" fill="${palette.warmGray}">Five strategic ideas in monochrome, followed by the six structural finalists.</text>
${conceptCards}
<text x="50" y="1117" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="700" fill="${palette.ink}">Refinements: Open Span and Held Thread</text>
${refinementCards}
`, { width: 1600, height: 1500, title: "BridgeCRM app icon concept board" });
await writeFile(path.join(brandingRoot, "icon-concept-board.svg"), conceptBoardSvg);

const genericColors = ["#4776E6", "#D65F4A", "#6E55A3", "#2A8F7B", "#D4932F", "#33485F", "#A34E7A", "#4B8BC9", "#8A6B40", "#557A46"];
function genericGlyph(index, x, y, size) {
  const white = "rgba(255,255,255,.9)";
  const inset = size * .23;
  switch (index % 6) {
    case 0: return `<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size * .24}" fill="none" stroke="${white}" stroke-width="${size * .09}"/><circle cx="${x + size * .68}" cy="${y + size * .32}" r="${size * .08}" fill="${white}"/>`;
    case 1: return `<path d="M${x + inset} ${y + size * .68}L${x + size * .46} ${y + inset}L${x + size - inset} ${y + size * .68}Z" fill="none" stroke="${white}" stroke-width="${size * .08}" stroke-linejoin="round"/>`;
    case 2: return `<rect x="${x + inset}" y="${y + inset}" width="${size * .19}" height="${size * .54}" rx="${size * .09}" fill="${white}"/><rect x="${x + size * .55}" y="${y + size * .34}" width="${size * .19}" height="${size * .40}" rx="${size * .09}" fill="${white}"/>`;
    case 3: return `<path d="M${x + inset} ${y + size * .5}H${x + size - inset}M${x + size * .5} ${y + inset}V${y + size - inset}" stroke="${white}" stroke-width="${size * .09}" stroke-linecap="round"/>`;
    case 4: return `<circle cx="${x + size * .36}" cy="${y + size * .5}" r="${size * .17}" fill="${white}"/><circle cx="${x + size * .68}" cy="${y + size * .5}" r="${size * .12}" fill="none" stroke="${white}" stroke-width="${size * .07}"/>`;
    default: return `<path d="M${x + inset} ${y + size * .31}H${x + size - inset}M${x + inset} ${y + size * .5}H${x + size * .68}M${x + inset} ${y + size * .69}H${x + size * .56}" stroke="${white}" stroke-width="${size * .08}" stroke-linecap="round"/>`;
  }
}

function homeScreenSvg() {
  const iconSize = 120;
  const startX = 117;
  const startY = 150;
  const gapX = 96;
  const gapY = 62;
  const items = [];
  for (let index = 0; index < 30; index += 1) {
    const column = index % 6;
    const row = Math.floor(index / 6);
    const x = startX + column * (iconSize + gapX);
    const y = startY + row * (iconSize + gapY);
    if (index === 14) {
      items.push(`<g transform="translate(${x} ${y})"><clipPath id="home-bridge" clipPathUnits="userSpaceOnUse"><rect width="${iconSize}" height="${iconSize}" rx="27"/></clipPath><g clip-path="url(#home-bridge)"><rect width="${iconSize}" height="${iconSize}" fill="${palette.forestDeep}"/><g transform="scale(${iconSize / 1024})">${finalSymbolDark}</g></g></g>`);
      continue;
    }
    const background = genericColors[index % genericColors.length];
    items.push(`<g><rect x="${x}" y="${y}" width="${iconSize}" height="${iconSize}" rx="27" fill="${background}"/>${genericGlyph(index, x, y, iconSize)}</g>`);
  }
  return svgDocument(`
  <rect width="1536" height="1120" fill="#17201E"/>
  <circle cx="1260" cy="110" r="420" fill="#213832" opacity=".75"/>
  <circle cx="260" cy="1030" r="520" fill="#242C39" opacity=".72"/>
  <text x="118" y="78" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="600" fill="#FFFFFF">9:41</text>
  <g opacity=".9">${items.join("\n")}</g>
  <rect x="522" y="1034" width="492" height="8" rx="4" fill="#FFFFFF" opacity=".8"/>
  `, { width: 1536, height: 1120, title: "BridgeCRM unlabeled home-screen recognition test" });
}

function iconGroup({ x, y, size, background = palette.forestDeep, symbol = finalSymbolDark, radius = size * .23, opacity = 1, filter = "" }) {
  const clipId = `clip-${String(x).replace(".", "-")}-${String(y).replace(".", "-")}-${String(size).replace(".", "-")}`;
  return `<g opacity="${opacity}" ${filter ? `filter="url(#${filter})"` : ""}>
  <clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}"/></clipPath>
  <g clip-path="url(#${clipId})"><rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${background}"/><g transform="translate(${x} ${y}) scale(${size / 1024})">${symbol}</g></g>
</g>`;
}

function smallSizeSvg() {
  const sizes = [160, 96, 64, 48, 32, 24, 16];
  let x = 62;
  const icons = [];
  for (const size of sizes) {
    const y = 248 - size / 2;
    icons.push(iconGroup({ x, y, size }));
    icons.push(`<text x="${x + size / 2}" y="330" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="18" fill="${palette.warmGray}">${size}px</text>`);
    x += size + 62;
  }
  return svgDocument(`
  <defs><filter id="blur"><feGaussianBlur stdDeviation="6"/></filter></defs>
  <rect width="1280" height="720" fill="${palette.paper}"/>
  <text x="62" y="62" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="700" fill="${palette.ink}">Small-size and signal-loss test</text>
  <text x="62" y="98" font-family="Inter, Arial, sans-serif" font-size="19" fill="${palette.warmGray}">The arch, break, and forward step remain the same three-part memory contour.</text>
  ${icons.join("\n")}
  <g transform="translate(72 404)">${iconGroup({ x: 0, y: 0, size: 132, background: "#FFFFFF", symbol: finalSymbolMono })}<text x="66" y="162" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="18" fill="${palette.warmGray}">black / white</text></g>
  <g transform="translate(268 404)">${iconGroup({ x: 0, y: 0, size: 132, background: "#E6E6E6", symbol: openSpan({ main: "#555555", accent: "#555555" }) })}<text x="66" y="162" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="18" fill="${palette.warmGray}">grayscale</text></g>
  <g transform="translate(464 404)">${iconGroup({ x: 0, y: 0, size: 132, background: "#000000", symbol: finalSymbolWhite })}<text x="66" y="162" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="18" fill="${palette.warmGray}">inverted</text></g>
  <g transform="translate(660 404)">${iconGroup({ x: 0, y: 0, size: 132, filter: "blur" })}<text x="66" y="162" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="18" fill="${palette.warmGray}">blurred</text></g>
  <g transform="translate(856 404)">${iconGroup({ x: 0, y: 0, size: 132, background: "#B9C8C2", symbol: openSpan({ main: "#E8E3D9", accent: "#D6BD8C" }) })}<text x="66" y="162" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="18" fill="${palette.warmGray}">low contrast</text></g>
  `, { width: 1280, height: 720, title: "BridgeCRM small-size validation board" });
}

function maskTestSvg() {
  const masks = [
    { name: "Circle", shape: `<circle cx="160" cy="160" r="160"/>` },
    { name: "Squircle", shape: `<path d="M0 82C0 28 28 0 82 0H238C292 0 320 28 320 82V238C320 292 292 320 238 320H82C28 320 0 292 0 238Z"/>` },
    { name: "Rounded square", shape: `<rect width="320" height="320" rx="72"/>` },
    { name: "Square", shape: `<rect width="320" height="320"/>` }
  ];
  const cells = masks.map((mask, index) => {
    const x = 70 + index * 380;
    const clipId = `mask-${index}`;
    return `<g transform="translate(${x} 170)">
      <clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">${mask.shape}</clipPath>
      <g clip-path="url(#${clipId})"><g transform="scale(.3125)"><rect width="1024" height="1024" fill="${palette.forestDeep}"/>${finalSymbolDark}</g></g>
      <text x="160" y="366" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="21" font-weight="600" fill="${palette.ink}">${mask.name}</text>
    </g>`;
  }).join("\n");
  return svgDocument(`
  <rect width="1600" height="640" fill="${palette.paper}"/>
  <text x="70" y="70" font-family="Inter, Arial, sans-serif" font-size="36" font-weight="700" fill="${palette.ink}">Platform mask resilience</text>
  <text x="70" y="108" font-family="Inter, Arial, sans-serif" font-size="20" fill="${palette.warmGray}">All essential geometry remains inside the conservative adaptive-icon safe area.</text>
  ${cells}
  `, { width: 1600, height: 640, title: "BridgeCRM platform-mask validation board" });
}

const homeSvg = homeScreenSvg();
const smallSvg = smallSizeSvg();
const maskSvg = maskTestSvg();
await writeFile(path.join(brandingRoot, "previews", "icon-home-screen-test.svg"), homeSvg);
await writeFile(path.join(brandingRoot, "previews", "icon-small-size-test.svg"), smallSvg);
await writeFile(path.join(brandingRoot, "previews", "icon-mask-test.svg"), maskSvg);

function validationBoardSvg() {
  const entries = [
    ["01", "Large presentation", iconGroup({ x: 74, y: 72, size: 220 })],
    ["02", "Home Screen", iconGroup({ x: 132, y: 130, size: 104 })],
    ["03", "Small folder", iconGroup({ x: 158, y: 156, size: 52 })],
    ["04", "Very small search", iconGroup({ x: 170, y: 168, size: 28 })],
    ["05", "Black and white", iconGroup({ x: 112, y: 110, size: 140, background: "#FFFFFF", symbol: finalSymbolMono })],
    ["06", "Grayscale", iconGroup({ x: 112, y: 110, size: 140, background: "#DDDDDD", symbol: openSpan({ main: "#555555", accent: "#555555" }) })],
    ["07", "Inverted", iconGroup({ x: 112, y: 110, size: 140, background: "#000000", symbol: finalSymbolWhite })],
    ["08", "Blurred", `<defs><filter id="validation-blur"><feGaussianBlur stdDeviation="6"/></filter></defs>${iconGroup({ x: 112, y: 110, size: 140, filter: "validation-blur" })}`],
    ["09", "Low contrast", iconGroup({ x: 112, y: 110, size: 140, background: "#AFC1BA", symbol: openSpan({ main: "#E0E2DC", accent: "#CEB889" }) })],
    ["10", "Light appearance", iconGroup({ x: 112, y: 110, size: 140, background: palette.cream, symbol: finalSymbolColor })],
    ["11", "Dark appearance", iconGroup({ x: 112, y: 110, size: 140 })],
    ["12", "System tint", iconGroup({ x: 112, y: 110, size: 140, background: "#DDE5FA", symbol: openSpan({ main: "#3457A5", accent: "#3457A5" }) })],
    ["13", "Circle mask", `<g transform="translate(102 100)"><clipPath id="validation-circle" clipPathUnits="userSpaceOnUse"><circle cx="80" cy="80" r="80"/></clipPath><g clip-path="url(#validation-circle)"><g transform="scale(.15625)"><rect width="1024" height="1024" fill="${palette.forestDeep}"/>${finalSymbolDark}</g></g></g>`],
    ["14", "Squircle mask", iconGroup({ x: 102, y: 100, size: 160, radius: 44 })],
    ["15", "Rounded-square mask", iconGroup({ x: 102, y: 100, size: 160, radius: 30 })],
    ["16", "25+ unrelated icons", `<g transform="translate(74 84)">${Array.from({ length: 25 }, (_, i) => { const size = i === 12 ? 46 : 34; const x = (i % 5) * 54 + (i === 12 ? -6 : 0); const y = Math.floor(i / 5) * 50 + (i === 12 ? -6 : 0); return i === 12 ? iconGroup({ x, y, size }) : `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="9" fill="${genericColors[i % genericColors.length]}"/>${genericGlyph(i, x, y, size)}`; }).join("")}</g>`],
    ["17", "CRM category set", `<g transform="translate(26 72)">${["Dex", "Clay", "folk", "Attio", "HubSpot", "Monica"].map((name, i) => { const slots = [0, 1, 2, 6, 7, 8]; const slot = slots[i]; const x = (slot % 3) * 70; const y = Math.floor(slot / 3) * 82; return `<g transform="translate(${x} ${y})"><rect width="54" height="54" rx="13" fill="${genericColors[(i + 2) % genericColors.length]}"/>${genericGlyph(i + 1, 0, 0, 54)}<text x="27" y="70" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="11" fill="${palette.warmGray}">${name}</text></g>`; }).join("")}${iconGroup({ x: 70, y: 82, size: 66 })}</g>`],
    ["18", "App name hidden", `<g transform="translate(78 88)">${iconGroup({ x: 38, y: 20, size: 180 })}<rect x="0" y="216" width="256" height="16" rx="8" fill="#E6E1D8"/></g>`]
  ];
  const cells = entries.map((entry, index) => {
    const column = index % 6;
    const row = Math.floor(index / 6);
    const x = 40 + column * 292;
    const y = 144 + row * 390;
    return `<g transform="translate(${x} ${y})">
      <rect width="264" height="350" rx="24" fill="#FFFFFF" stroke="#DED8CE"/>
      ${entry[2]}
      <text x="22" y="310" font-family="Inter, Arial, sans-serif" font-size="15" font-weight="700" fill="${palette.forest}">${entry[0]}</text>
      <text x="22" y="333" font-family="Inter, Arial, sans-serif" font-size="17" font-weight="600" fill="${palette.ink}">${entry[1]}</text>
    </g>`;
  }).join("\n");
  return svgDocument(`
  <rect width="1800" height="1360" fill="#F1EEE8"/>
  <text x="40" y="64" font-family="Inter, Arial, sans-serif" font-size="38" font-weight="700" fill="${palette.ink}">Open Span automated visual validation</text>
  <text x="40" y="104" font-family="Inter, Arial, sans-serif" font-size="20" fill="${palette.warmGray}">Automated render checks only. Recall, recognition speed, and emotional association still require people.</text>
  ${cells}
  `, { width: 1800, height: 1360, title: "BridgeCRM Open Span automated validation board" });
}

const validationSvg = validationBoardSvg();
await writeFile(path.join(brandingRoot, "previews", "icon-validation-board.svg"), validationSvg);

async function exists(file) {
  try { await stat(file); return true; } catch { return false; }
}

const archiveNames = [
  "bridge-icon-1024.png",
  "bridge-icon-512.png",
  "bridge-icon-192.png",
  "apple-touch-icon.png",
  "bridge-mark-transparent.png"
];
const archiveLines = [];
for (const name of archiveNames) {
  const source = path.join(srcRoot, name);
  const destination = path.join(brandingRoot, "archive", "pre-1.3.44", name);
  if (!await exists(destination)) await copyFile(source, destination);
  const buffer = await readFile(destination);
  archiveLines.push(`${createHash("sha256").update(buffer).digest("hex")}  ${name}`);
}
await writeFile(path.join(brandingRoot, "archive", "pre-1.3.44", "checksums.sha256"), `${archiveLines.join("\n")}\n`);

async function render(svg, output, width, height = width, { opaque = false } = {}) {
  let image = sharp(Buffer.from(svg)).resize(width, height, { fit: "fill" });
  if (opaque) image = image.removeAlpha();
  await image.png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(output);
}

const masterSvg = finalFiles.get("icon-master.svg");
const transparentSvg = finalFiles.get("icon-symbol.svg");
await Promise.all([
  render(masterSvg, path.join(srcRoot, "bridge-icon-1024.png"), 1024, 1024, { opaque: true }),
  render(masterSvg, path.join(srcRoot, "bridge-icon-512.png"), 512, 512, { opaque: true }),
  render(masterSvg, path.join(srcRoot, "bridge-icon-maskable-512.png"), 512, 512, { opaque: true }),
  render(masterSvg, path.join(srcRoot, "bridge-icon-192.png"), 192, 192, { opaque: true }),
  render(masterSvg, path.join(srcRoot, "apple-touch-icon.png"), 180, 180, { opaque: true }),
  render(transparentSvg, path.join(srcRoot, "bridge-mark-transparent.png"), 192),
  render(masterSvg, path.join(srcRoot, "favicon-32.png"), 32, 32, { opaque: true }),
  render(masterSvg, path.join(srcRoot, "favicon-48.png"), 48, 48, { opaque: true }),
  render(masterSvg, path.join(brandingRoot, "platform", "web", "bridge-icon-1024.png"), 1024, 1024, { opaque: true }),
  render(masterSvg, path.join(brandingRoot, "platform", "web", "bridge-icon-512.png"), 512, 512, { opaque: true }),
  render(masterSvg, path.join(brandingRoot, "platform", "web", "bridge-icon-maskable-512.png"), 512, 512, { opaque: true }),
  render(masterSvg, path.join(brandingRoot, "platform", "web", "bridge-icon-192.png"), 192, 192, { opaque: true }),
  render(masterSvg, path.join(brandingRoot, "platform", "web", "apple-touch-icon.png"), 180, 180, { opaque: true }),
  render(masterSvg, path.join(brandingRoot, "platform", "web", "favicon-32.png"), 32, 32, { opaque: true }),
  render(masterSvg, path.join(brandingRoot, "platform", "web", "favicon-48.png"), 48, 48, { opaque: true }),
  render(conceptBoardSvg, path.join(brandingRoot, "previews", "icon-concept-board.png"), 1600, 1500),
  render(homeSvg, path.join(brandingRoot, "previews", "icon-home-screen-test.png"), 1536, 1120),
  render(smallSvg, path.join(brandingRoot, "previews", "icon-small-size-test.png"), 1280, 720),
  render(maskSvg, path.join(brandingRoot, "previews", "icon-mask-test.png"), 1600, 640),
  render(validationSvg, path.join(brandingRoot, "previews", "icon-validation-board.png"), 1800, 1360)
]);

await writeFile(path.join(brandingRoot, "archive", "pre-1.3.44", "README.md"), `# Pre-1.3.44 icon archive

These files are the exact BridgeCRM production icon assets that existed before
the Open Span identity was generated. They are retained for comparison and
rollback. Verify them with \`shasum -a 256 -c checksums.sha256\` from this
directory.
`);

console.log(`Generated BridgeCRM icon system in ${brandingRoot}`);
