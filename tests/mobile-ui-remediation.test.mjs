import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const remediation = styles.slice(styles.indexOf("/* 1.3.17 — shared mobile hierarchy"));

test("people quick filters keep one physical control contract", () => {
  assert.match(remediation, /\.people-home__quick-filter,[\s\S]*?height: 44px;[\s\S]*?min-height: 44px;[\s\S]*?max-height: 44px;/);
  assert.match(remediation, /\.people-home__quick-filter\.is-active \{[\s\S]*?height: 44px;[\s\S]*?padding-inline: 12px;/);
});

test("mobile navigation uses safe-area clearance and a moving local focus zone", () => {
  assert.match(remediation, /\.nav-selection-indicator \{[\s\S]*?radial-gradient[\s\S]*?box-shadow:/);
  assert.match(remediation, /height: calc\(var\(--nav-height\) \+ var\(--safe-bottom\) \+ var\(--nav-lift\)\)/);
  assert.match(remediation, /padding-bottom: calc\(var\(--safe-bottom\) \+ var\(--nav-lift\)\)/);
  assert.match(remediation, /\.quick-create-button \{ z-index: 3; \}/);
});

test("edit person actions no longer cover mobile form fields", () => {
  assert.match(remediation, /\.relationship-profile--editor \{[\s\S]*?padding-bottom: calc\(var\(--nav-height\) \+ var\(--safe-bottom\) \+ var\(--nav-lift\) \+ var\(--space-5\)\)/);
  assert.match(remediation, /\.relationship-profile--editor \.contact-edit-actions \{[\s\S]*?position: static;[\s\S]*?background: transparent;/);
});

test("one multi-select activity component is reused across capture and tracking", () => {
  assert.match(source, /function ActivitySelector\(/);
  assert.match(source, /\["MSA","DTM"\]\.map/);
  assert.equal((source.match(/ActivitySelector\(/g) || []).length >= 6, true);
  assert.equal(source.includes('<select name="standaloneActivity"'), false);
  assert.match(source, /for\(const activity of \['MSA','DTM'\]\)\{if\(f\.has\(stageInputName\(activity\)\)/);
  assert.match(remediation, /\.activity-selector__option:has\(input:checked\)/);
});

test("form hierarchy removes decorative section dividers", () => {
  assert.match(remediation, /\.relationship-edit-section,[\s\S]*?border: 0;/);
  assert.match(remediation, /\.quick-capture-advanced \{ border: 0; \}/);
  assert.match(remediation, /\.capture-detail-section \{ border: 0; \}/);
  assert.match(remediation, /\.capture-detail-actions \{[\s\S]*?border-top: 0;/);
});
