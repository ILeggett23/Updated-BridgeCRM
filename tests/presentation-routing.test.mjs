import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = fs.readFileSync(path.join(root, "src", "app.js"), "utf8");
const foundation = fs.readFileSync(path.join(root, "src", "ui-foundation.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "src", "styles.css"), "utf8");

test("Phase 15B focused screens have stable presentation URLs and one shared header", () => {
  for (const screen of [
    "people-search", "person", "person-timeline", "person-edit",
    "pipeline-stage", "stage-transition", "place", "analytics-detail",
    "goals", "achievements", "scorecard", "settings"
  ]) assert.match(app, new RegExp(`PRESENTATION_SCREENS[^\\n]+[\"']${screen}[\"']`));

  assert.match(app, /function presentationURL\(/);
  assert.match(app, /createBridgeFrontendFoundation/);
  assert.match(foundation, /function ScreenHeader\(/);
  assert.match(foundation, /data-presentation-back/);
  assert.match(foundation, /id="presentationTitle" tabindex="-1"/);
  assert.match(app, /if\(ui\.routedScreen==="settings"\).*settingsModal\(\{routed:true\}\)/);
});

test("presentation navigation supports browser history, focus return, and scroll restoration", () => {
  assert.match(app, /history\.pushState\(nextState/);
  assert.match(app, /window\.addEventListener\("popstate"/);
  assert.match(app, /bridgeScrollY:window\.scrollY/);
  assert.match(app, /window\.scrollTo\(\{ top:Number\(event\.state\?\.bridgeScrollY\) \|\| 0/);
  assert.match(app, /bridgeFocusSelector/);
  assert.match(app, /focusPresentationEntry\(\)/);
  assert.match(foundation, /ui\.routeEntryMotion \? ` presentation-screen--enter/);
  assert.match(app, /lastRenderedPresentationKey/);
  assert.match(app, /ui\.routeEntryMotion=nextPresentationKey&&nextPresentationKey!==lastRenderedPresentationKey\?ui\.routeDirection:""/);
  assert.match(styles, /\.presentation-screen--enter,[\s\S]*?\.presentation-screen--enter-back \{ animation: none; \}/);
  assert.match(styles, /view-transition-name: bridge-page/);
  assert.match(styles, /\.page\.page-enter, \.page\.mode-enter \{ animation: none; \}/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]+\.presentation-screen \{ animation: none !important; \}/);
});

test("legacy pages, notification launches, and secure shared scorecards retain their contracts", () => {
  assert.match(app, /const launchPageAliases = \{ actions: "followups", insights: "analytics" \}/);
  assert.match(app, /if \(requestedLaunchPage === "add"\)/);
  assert.match(app, /if \(sharedScorecardToken\) return false/);
  assert.match(app, /window\.addEventListener\("pagehide", \(\) => \{\s+if \(sharedScorecardToken \|\| !stateHydrated\) return/);
  assert.match(app, /target\.searchParams\.get\("notification"\) !== "1"/);
  assert.match(app, /screen:"person", person:openedContactId/);
  assert.match(app, /const legacyContact = String\(target\.searchParams\.get\("contact"\)/);
});

test("pipeline presentation routes validate against canonical role-specific stage arrays", () => {
  assert.match(app, /!\["Prospect", "Customer"\]\.includes\(role\) \|\| !\(PIPELINES\[role\] \|\| \[\]\)\.includes\(stage\)/);
  assert.match(app, /navigatePresentation\("pipeline-stage",\{role:"Prospect",stage/);
  assert.match(app, /navigatePresentation\("pipeline-stage",\{role:"Customer",stage/);
  assert.match(app, /navigatePresentation\("stage-transition",\{role:c\.role,person:c\.id\}/);
  assert.match(app, /Team relationships do not use a pipeline stage/);
});

test("invalid deep links fail safely and Settings subpages reuse existing controls", () => {
  assert.match(app, /ui\.routedError = personId \? "This person no longer exists\."/);
  assert.match(app, /ui\.routedError = placeId \? "This place no longer exists\."/);
  assert.match(app, /ui\.routedError = "That Settings section is not available\."/);
  assert.match(app, /const SETTINGS_SECTIONS = \["root", "profile", "goals", "notifications", "preferences", "health", "archive", "data", "account", "sessions", "backup", "privacy", "about"\]/);
  assert.match(app, /settingsNavigationGroup\("Profile"/);
  assert.match(app, /No account required/);
  assert.match(styles, /\.settings-nav-row \{/);
});

test("Escape remains reserved for transient overlays instead of closing routed screens", () => {
  assert.match(app, /ui\.settingsOpen&&ui\.routedScreen!=="settings"/);
  assert.match(app, /ui\.placeDetailId&&ui\.routedScreen!=="place"/);
  assert.match(app, /ui\.activityHistoryContactId&&ui\.routedScreen!=="person-timeline"/);
  assert.match(app, /ui\.scorecardShareOpen&&ui\.routedScreen!=="scorecard"/);
  assert.match(app, /if\(ui\.routedScreen==="settings"\)return/);
});
