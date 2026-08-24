import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

const between = (start, end) => app.slice(app.indexOf(start), app.indexOf(end));

test("new routes set their destination scroll before the browser can paint", () => {
  const navigation = between("function navigatePresentation", "function initializePresentationHistory");
  assert.match(navigation, /updatePresentationView\(\(\) => \{\n    applyPresentationRoute\(next, \{ renderNow:true, direction:"forward" \}\);\n    window\.scrollTo\(\{ top:0, left:0, behavior:"auto" \}\);/);
  assert.match(navigation, /updatePresentationView\(\(\) => \{\n    applyPresentationRoute\(parent, \{ renderNow:true, direction:"back" \}\);\n    window\.scrollTo\(\{ top:0, left:0, behavior:"auto" \}\);/);
  assert.doesNotMatch(navigation, /requestAnimationFrame\(\(\) => \{ window\.scrollTo/);
});

test("history restoration sets scroll synchronously and defers only focus", () => {
  const history = between("function initializePresentationHistory", "initializePresentationHistory();");
  const transition = history.indexOf("updatePresentationView(() =>");
  const apply = history.indexOf("applyPresentationRoute(location.href");
  const scroll = history.indexOf("window.scrollTo({ top:Number(event.state?.bridgeScrollY)");
  const focus = history.indexOf("}, () => {", scroll);
  assert.ok(transition >= 0 && apply > transition && scroll > apply && focus > scroll);
});

test("routed screens update atomically without page-level animation layers", () => {
  assert.match(app, /function updatePresentationView\(update, onReady = null\)/);
  assert.match(app, /function updatePresentationView\(update, onReady = null\) \{\n  update\(\);\n  if \(onReady\) requestAnimationFrame\(onReady\);\n\}/);
  assert.doesNotMatch(app, /document\.startViewTransition/);
  assert.match(styles, /\.presentation-screen--enter,[\s\S]*?\.presentation-screen--enter-back \{ animation: none; \}/);
  assert.doesNotMatch(styles, /::view-transition|view-transition-name/);
});
