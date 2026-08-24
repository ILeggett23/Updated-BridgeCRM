import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const page = await readFile(new URL("../src/index.html", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const foundation = await readFile(new URL("../src/ui-foundation.js", import.meta.url), "utf8");
const worker = await readFile(new URL("../src/sw.js", import.meta.url), "utf8");

test("mobile viewport and controls disable accidental Safari zoom globally", () => {
  assert.match(page, /width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover/);
  assert.match(styles, /a, button, input, select, textarea, \[role="button"\] \{ touch-action: manipulation; \}/);
  assert.match(styles, /\[data-ui-sheet-scroll\][^{]*\{[^}]*touch-action: pan-y/);
  assert.match(styles, /today-swipe-shell \.today-next-card[^{]*\{[^}]*touch-action: pan-y/);
});

test("Share Scorecard has no redundant acknowledgement state or submit gate", () => {
  assert.doesNotMatch(app, /scorecardConfirmed|share-confirmation|Confirm what will be shared|I understand what this scorecard will include/);
  assert.match(app, /name="scorecardScope"/);
  assert.match(app, /name="shareAction" value="link"/);
  assert.match(app, /name="shareAction" value="image"/);
  assert.doesNotMatch(styles, /\.share-confirmation/);
});

test("Today preserves exact tallies and uses proportional progress for large goals", () => {
  const start = app.indexOf("function todayGoalProgress");
  const end = app.indexOf("function todayRelativeTime", start);
  const source = app.slice(start, end);
  assert.match(source, /goal <= 8/);
  assert.match(source, /percentage = Math\.round\(ratio \* 10000\) \/ 100/);
  assert.match(source, /style="width:\$\{percentage\}%"/);
  assert.match(source, /\$\{completed\} \/ \$\{goal\}/);
  assert.match(source, /role="progressbar"/);
  assert.match(source, /aria-valuemax="\$\{goal\}"/);
  assert.match(styles, /\.today-goal__track span[^{]*\{[^}]*background: var\(--color-brand\)/);
});

test("People filters stay predictable while Pipeline tabs remain compact", () => {
  assert.match(styles, /\.people-home__quick-filter,[\s\S]*?\.people-home__filter-button \{ min-width: 68px; \}/);
  assert.match(app, /\{label:"Prospect",value:"Prospect"[\s\S]*?\{label:"Customer",value:"Customer"/);
  assert.doesNotMatch(app, /label:`Prospect \$\{prospectContacts\.length\}`|label:`Customer \$\{customerContacts\.length\}`/);
  assert.match(styles, /\.pipeline-home__tabs \{ display: flex; grid-template-columns: none; gap: 20px; overflow: visible; \}/);
  assert.match(styles, /\.pipeline-home__tabs button \{ width: auto;[^}]*flex: 0 0 auto;[^}]*text-align: left/);
  assert.match(styles, /\.people-row__open \{[\s\S]*?grid-template-columns: 40px minmax\(0, 1fr\) 16px/);
  assert.match(styles, /\.prospect-stage__chevron \{ width: 16px; display: grid; justify-self: end/);
});

test("shared sheets apply the bottom safe area exactly once when a footer exists", () => {
  assert.match(foundation, /footer \? " has-footer"/);
  assert.match(styles, /\.ui-mobile-sheet\.has-footer \.ui-mobile-sheet__body \{ padding-bottom: var\(--space-4\); \}/);
  assert.match(styles, /\.ui-mobile-sheet__footer \{[^}]*calc\(var\(--space-4\) \+ var\(--safe-bottom\)\)/);
  assert.match(styles, /\.modal \{ width: 100%;[^}]*padding-bottom: 0; \}/);
  assert.match(app, /requestAnimationFrame\(\(\) => \{\s+if \(lockedDocumentScrollY !== null\) return;[\s\S]*?window\.scrollTo\(0, restoreY\)/);
  assert.match(app, /target\?\.focus\(\{preventScroll:true\}\)/);
});

test("the primary dock is raised cleanly while short Capture keeps preview spacing", () => {
  assert.match(styles, /--nav-interaction-inset: 16px/);
  assert.match(styles, /body \.bridge-pattern-shell > \.bridge-pattern-nav \{\s+height: calc\(var\(--nav-height\) \+ var\(--nav-interaction-inset\)\) !important;\s+padding-bottom: var\(--nav-interaction-inset\) !important;/);
  assert.match(styles, /body \.bridge-pattern-nav \.nav-selection-indicator \{ bottom: calc\(var\(--nav-interaction-inset\) \+ 3px\); \}/);
  assert.match(styles, /html, body, #app \{ background: var\(--color-page\); \}/);
  assert.match(styles, /border-top-color: var\(--color-surface-soft\) !important;[\s\S]*?background: var\(--color-page\) !important;[\s\S]*?box-shadow: var\(--shadow-nav\) !important;/);
  assert.match(styles, /\.quick-create-modal:not\(\.has-step\) \.modal-body \{ padding-bottom: var\(--space-4\); \}/);
});

test("What's New reuses Bridge surfaces, typography, accent, and compact geometry", () => {
  assert.match(styles, /\.release-notes-modal \{[^}]*width: min\(460px, 100%\)[^}]*background: var\(--color-page\)/);
  assert.match(styles, /\.release-notes-mark \{ width: 44px; height: 44px/);
  assert.match(styles, /\.release-notes-header h2 \{[^}]*font-family: var\(--font-editorial\)[^}]*font-size: 26px/);
  assert.match(styles, /\.release-note-icon \{[^}]*background: var\(--surface-brand-subtle\)/);
  assert.match(styles, /\.release-notes-actions \.button\.primary \{[^}]*background: var\(--color-brand\)[^}]*font-size: 15px/);
});

test("Safari receives current shell assets before falling back to offline cache", () => {
  assert.match(page, /navigator\.serviceWorker\.register\("\.\/sw\.js\?v=1\.3\.20"\)/);
  assert.doesNotMatch(app, /serviceWorker\.register\(`/);
  assert.match(worker, /fetch\(event\.request, \{ cache: "no-store" \}\)/);
  assert.match(worker, /\.catch\(\(\) => caches\.match\(event\.request, \{ ignoreSearch: true \}\)\)/);
  assert.doesNotMatch(worker, /return cached \|\| network/);
});

test("Capture removes the fixed dock from Safari's backdrop composition", () => {
  assert.match(foundation, /if \(ui\.quickCreateOpen\) return "";/);
  assert.doesNotMatch(foundation, /is-covered-by-capture/);
  assert.doesNotMatch(styles, /bridge-pattern-nav\.is-covered-by-capture/);
});
