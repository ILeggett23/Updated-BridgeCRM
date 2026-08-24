import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

test("the primary dock has no transformed fixed layer that can retain an iOS keyboard offset", () => {
  const start = styles.indexOf("body .bridge-pattern-shell > .bridge-pattern-nav {");
  const end = styles.indexOf("body .bridge-pattern-nav .nav-button {", start);
  const dock = styles.slice(start, end);
  assert.match(dock, /position: fixed !important/);
  assert.match(dock, /inset: auto 0 0 0 !important/);
  assert.match(dock, /margin-inline: auto/);
  assert.match(dock, /transform: none/);
  assert.doesNotMatch(dock, /translateX\(-50%\)/);
});

test("settled presentation routes release their transform compositor layer", () => {
  assert.match(styles, /\.presentation-screen--enter,[\s\S]*?\.presentation-screen--enter-back \{ animation: none; \}/);
  assert.match(styles, /@keyframes ui-step-forward-in \{[^}]*from \{[^}]*translateX\(16px\)[^}]*\} to \{[^}]*transform: none/);
  assert.match(styles, /@keyframes ui-step-back-in \{[^}]*from \{[^}]*translateX\(-16px\)[^}]*\} to \{[^}]*transform: none/);
});
