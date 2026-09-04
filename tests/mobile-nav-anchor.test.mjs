import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

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

test("modal scroll lock never fixes or offsets the body containing the dock", () => {
  const start = app.indexOf("function syncDocumentScrollLock");
  const end = app.indexOf("function scrollGuideTargetWithinContainer", start);
  assert.ok(start >= 0 && end > start);
  const implementation = app.slice(start, end);
  assert.doesNotMatch(implementation, /body\.style\.(?:position|inset|width)/);
  assert.doesNotMatch(implementation, /body\.style\.removeProperty/);

  const classSet = () => {
    const values = new Set();
    return { values, add: value => values.add(value), remove: value => values.delete(value) };
  };
  const bodyClasses = classSet();
  const htmlClasses = classSet();
  const scrollCalls = [];
  const context = {
    window: { scrollY: 180, scrollTo: (...args) => scrollCalls.push(args) },
    document: {
      body: { classList: bodyClasses },
      documentElement: { classList: htmlClasses, style: { scrollBehavior: "smooth" } }
    },
    cancelPendingScrollState: () => {},
    requestAnimationFrame: callback => callback(),
    result: null
  };
  vm.runInNewContext(`let lockedDocumentScrollY=null;${implementation}\nresult=syncDocumentScrollLock;`, context);
  context.result(true);
  assert.equal(bodyClasses.values.has("modal-open"), true);
  assert.equal(htmlClasses.values.has("modal-open"), true);
  context.result(false);
  assert.equal(bodyClasses.values.has("modal-open"), false);
  assert.equal(htmlClasses.values.has("modal-open"), false);
  assert.deepEqual(scrollCalls, [[0, 180], [0, 180]]);
});

test("mobile dock has one safe-area bottom inset model and matching content clearance", () => {
  assert.match(styles, /--nav-bottom-inset: max\(var\(--safe-bottom\), 16px\)/);
  assert.match(styles, /height: calc\(var\(--nav-height\) \+ var\(--nav-bottom-inset\)\) !important/);
  assert.match(styles, /padding-bottom: var\(--nav-bottom-inset\) !important/);
  assert.match(styles, /padding-bottom: calc\(var\(--nav-height\) \+ var\(--nav-bottom-inset\) \+ var\(--space-7\)\) !important/);
  assert.doesNotMatch(styles, /--nav-lift/);
  assert.match(styles, /html\.modal-open, body\.modal-open \{ height: 100%; overflow: hidden;/);
});
