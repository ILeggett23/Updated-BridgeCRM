import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

test("touch navigation and text controls suppress the brown focus rectangle", () => {
  const touch = styles.slice(styles.indexOf("@media (hover: none) and (pointer: coarse)"), styles.indexOf(".hidden {", styles.indexOf("@media (hover: none) and (pointer: coarse)")));
  assert.match(touch, /:is\(a, button, input, select, textarea, \[role="button"\]\):is\(:focus, :focus-visible\)/);
  assert.match(touch, /box-shadow: none !important/);
  assert.match(touch, /-webkit-tap-highlight-color: transparent/);
  assert.match(touch, /\.ui-search-field/);
  assert.match(touch, /\.quick-capture-picker__search/);
});

test("keyboard users retain the global focus-visible treatment", () => {
  const beforeTouch = styles.slice(0, styles.indexOf("@media (hover: none) and (pointer: coarse)"));
  assert.match(beforeTouch, /:focus-visible \{ outline: 0; box-shadow: var\(--focus-ring\); \}/);
});
