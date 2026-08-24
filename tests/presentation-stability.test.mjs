import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

const between = (start, end) => app.slice(app.indexOf(start), app.indexOf(end));

test("new routes set their destination scroll before the browser can paint", () => {
  const navigation = between("function navigatePresentation", "function initializePresentationHistory");
  assert.match(navigation, /applyPresentationRoute\(next, \{ renderNow:true, direction:"forward" \}\);\n  window\.scrollTo\(\{ top:0, left:0, behavior:"auto" \}\);/);
  assert.match(navigation, /applyPresentationRoute\(parent, \{ renderNow:true, direction:"back" \}\);\n  window\.scrollTo\(\{ top:0, left:0, behavior:"auto" \}\);/);
  assert.doesNotMatch(navigation, /requestAnimationFrame\(\(\) => \{ window\.scrollTo/);
});

test("history restoration sets scroll synchronously and defers only focus", () => {
  const history = between("function initializePresentationHistory", "initializePresentationHistory();");
  const apply = history.indexOf("applyPresentationRoute(location.href");
  const scroll = history.indexOf("window.scrollTo({ top:Number(event.state?.bridgeScrollY)");
  const frame = history.indexOf("requestAnimationFrame(() =>", apply);
  assert.ok(apply >= 0 && scroll > apply && frame > scroll);
});

test("routed screens fade without spatial translation", () => {
  assert.match(styles, /@keyframes ui-route-fade-in \{ from \{ opacity: \.96; \} to \{ opacity: 1; \} \}/);
  assert.match(styles, /\.presentation-screen--enter \{ animation: ui-route-fade-in 100ms ease-out backwards; \}/);
  const routeKeyframes = styles.match(/@keyframes ui-route-fade-in \{[^\n]+\}/)?.[0] || "";
  assert.doesNotMatch(routeKeyframes, /translate|transform/);
});
