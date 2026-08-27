import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { BRIDGE_GUIDE_STEPS, BRIDGE_GUIDE_VERSION } from "../src/walkthrough.js";

const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const foundation = await readFile(new URL("../src/ui-foundation.js", import.meta.url), "utf8");
const walkthrough = await readFile(new URL("../src/walkthrough.js", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../src/sw.js", import.meta.url), "utf8");
const devServer = await readFile(new URL("../dev.mjs", import.meta.url), "utf8");
const page = await readFile(new URL("../src/index.html", import.meta.url), "utf8");

test("Bridge Guide is versioned, chapter-based, and data driven", () => {
  assert.equal(BRIDGE_GUIDE_VERSION, "3.0");
  assert.ok(BRIDGE_GUIDE_STEPS.length > 40);
  assert.equal(new Set(BRIDGE_GUIDE_STEPS.map(item => item.id)).size, BRIDGE_GUIDE_STEPS.length);
  assert.deepEqual([...new Set(BRIDGE_GUIDE_STEPS.map(item => item.chapter))], ["Getting Oriented", "Capture", "People", "Pipeline", "Follow-ups / Places", "Insights", "Settings"]);
  for (const guideStep of BRIDGE_GUIDE_STEPS) {
    for (const key of ["id", "chapter", "route", "captureStep", "target", "title", "description", "instruction", "placement", "interaction", "advanceOn", "beforeEnter", "blockTarget"]) assert.ok(key in guideStep, `${guideStep.id} is missing ${key}`);
    assert.ok(guideStep.title.length <= 40, `${guideStep.id} title should stay compact`);
    assert.ok(guideStep.description.length <= 190, `${guideStep.id} description should stay concise`);
  }
});

test("interactive steps identify the exact safe control and expected action", () => {
  const interactive = BRIDGE_GUIDE_STEPS.filter(item => item.advanceOn === "click");
  assert.deepEqual(interactive.map(item => item.id), ["open-capture", "choose-conversation", "choose-person", "open-people", "open-person", "open-pipeline", "customer-tab", "open-places", "open-insights", "open-settings"]);
  for (const guideStep of interactive) {
    assert.equal(guideStep.interaction, "target");
    assert.ok(guideStep.target);
    assert.match(guideStep.instruction, /Tap/);
  }
  assert.ok(BRIDGE_GUIDE_STEPS.find(item => item.id === "open-person").optional);
  assert.match(walkthrough, /target\.addEventListener\("click", onTargetClick, true\)/);
  assert.match(walkthrough, /queueMicrotask\(advanceGuide\)/);
  assert.match(walkthrough, /pendingTargetAdvance/);
  assert.doesNotMatch(walkthrough, /Skip step|data-guide-skip-step/);
  assert.match(walkthrough, /data-guide-skip>Skip guide/);
  assert.equal(BRIDGE_GUIDE_STEPS.find(item => item.id === "save-capture").blockTarget, true);
  assert.match(styles, /\.bridge-guide__spotlight\.is-blocking \{ pointer-events: auto; \}/);
  assert.match(walkthrough, /targetInteractionBlocked\(guideStep\) && "disabled" in target/);
  assert.match(walkthrough, /spotlight\.classList\.toggle\("is-blocking", targetInteractionBlocked\(guideStep\)\)/);
});

test("guide teaches exact production taxonomy without changing it", () => {
  assert.match(BRIDGE_GUIDE_STEPS.find(item => item.id === "prospect-stages").description, /PQI → QI\/P → FUP → LA/);
  assert.match(BRIDGE_GUIDE_STEPS.find(item => item.id === "prospect-stages").description, /MSA and DTM/);
  assert.match(BRIDGE_GUIDE_STEPS.find(item => item.id === "customer-stages").description, /CNA → Proposal → Follow-Up → Order Placed → Active Customer/);
  assert.doesNotMatch(BRIDGE_GUIDE_STEPS.find(item => item.id === "capture-types").description, /note/i);
  assert.deepEqual(
    BRIDGE_GUIDE_STEPS.filter(item => item.chapter === "Capture" && item.route.startsWith("capture-")).map(item => item.route),
    ["capture-menu", "capture-menu", "capture-conversation", "capture-place", "capture-learned", "capture-learned", "capture-next", "capture-next", "capture-next"]
  );
  assert.match(walkthrough, /\$\{progress\.chapter\} · \$\{progress\.position\} of \$\{progress\.count\}/);
});

test("stable data-guide-target hooks cover real routes, sheets, and conditional states", () => {
  const sources = `${app}\n${foundation}`;
  for (const target of [...new Set(BRIDGE_GUIDE_STEPS.map(item => item.target).filter(Boolean))]) {
    const dynamicSettingsTarget = target.startsWith("settings-") && sources.includes('data-guide-target="settings-${escapeHTML(section)}"');
    assert.ok(dynamicSettingsTarget || sources.includes(`data-guide-target=\"${target}\"`), `missing stable guide target ${target}`);
  }
  assert.match(app, /\["capture-conversation", "capture-place", "capture-learned", "capture-next"\]/);
  assert.match(app, /destination === "capture-place" \? 1/);
  assert.match(app, /ui\.quickCreateStep = captureStep/);
  assert.match(app, /const liveForm = \$\("#quickConversationForm"\)/);
  assert.match(app, /setQuickCaptureStep\(liveForm, captureStep, \{ direction: captureStep < currentStep \? "back" : "forward", behavior: "auto", restore: true \}\)/);
  assert.match(app, /destination === "places"/);
  assert.match(app, /destination === "current"/);
  assert.match(app, /navigateWalkthroughMain[\s\S]*positionLockedGuideTarget\(null, 0\)/);
  assert.match(app, /async function activateWalkthroughDestination\(destination, beforeEnter = null, guideStep = null\)/);
  assert.match(app, /typeof beforeEnter === "function"/);
});

test("route changes wait for rendered targets and missing targets fall back safely", () => {
  assert.match(walkthrough, /async function enterGuideStep/);
  assert.match(walkthrough, /await activate\(guideStep\.route, guideStep\.beforeEnter, guideStep\)/);
  assert.match(walkthrough, /await waitForGuideTarget\(guideStep, sequence\)/);
  assert.match(walkthrough, /framesRemaining = 30/);
  assert.match(walkthrough, /if \(!target \|\| !targetAvailable\)/);
  assert.match(walkthrough, /is-fallback/);
  assert.match(walkthrough, /coverGuideViewport\(root\)/);
  assert.match(walkthrough, /Required target.*was not ready for step/);
  assert.match(walkthrough, /if \(guideStep\.target && !target\)[\s\S]*exitGuide\(GUIDE_STATUS\.inProgress\)/);
  assert.doesNotMatch(walkthrough, /setTimeout/);
});

test("guide locks and restores document scroll while keeping target placement deterministic", () => {
  assert.match(app, /walkthrough\.visible\(\)\|\|ui\.confirmation/);
  assert.match(app, /bringIntoView: \(target, restoreY\) => positionLockedGuideTarget\(target, restoreY\)/);
  assert.match(app, /lockedDocumentScrollY = nextY/);
  assert.match(walkthrough, /originScrollY = window\.scrollY/);
  assert.match(walkthrough, /if \(originScrollY === null\) originScrollY = window\.scrollY/);
  assert.match(walkthrough, /bringIntoView\(null, originScrollY\)/);
  assert.match(walkthrough, /addEventListener\("wheel", stopScroll, \{ passive:false \}\)/);
  assert.match(walkthrough, /addEventListener\("touchmove", stopScroll, \{ passive:false \}\)/);
  assert.match(walkthrough, /scrollableGuideAncestor/);
  assert.match(walkthrough, /scrollContainer\?\.addEventListener\("scroll", schedulePosition/);
  assert.match(styles, /body\.bridge-guide-active \{[^}]*overflow: hidden;[^}]*touch-action: none;[^}]*overscroll-behavior: none;/);
  assert.match(walkthrough, /savedStatus === GUIDE_STATUS\.unseen && isFreshWorkspace\(getState\(\)\)/);
  assert.match(walkthrough, /document\.body\.classList\.add\("bridge-guide-active"\)/);
  assert.match(app, /scrollGuideTargetWithinContainer/);
  assert.match(app, /container\.scrollTo\(\{ top:nextTop, behavior:"auto" \}\)/);
});

test("the guide owns one persistent host outside the application render tree", () => {
  assert.match(page, /<div id="bridgeGuideRoot"><\/div>/);
  assert.doesNotMatch(app, /\$\{walkthrough\.markup\(\)\}/);
  assert.match(walkthrough, /const guideHost = \(\) => document\.getElementById\("bridgeGuideRoot"\)/);
  assert.match(walkthrough, /host\.dataset\.guidePhase/);
  assert.match(walkthrough, /updateGuidePanel\(\)/);
  assert.doesNotMatch(walkthrough, /panel\.outerHTML|root\.innerHTML/);
});

test("editorial panel removes the chart tile and supports safe mobile geometry", () => {
  assert.match(styles, /\.bridge-guide__header/);
  assert.match(styles, /\.bridge-guide__rule/);
  assert.match(styles, /font-family: var\(--font-editorial\)/);
  assert.match(styles, /\.bridge-guide__instruction/);
  assert.doesNotMatch(styles, /bridge-tour__mark/);
  assert.doesNotMatch(walkthrough, /bridge-tour__mark/);
  assert.match(walkthrough, /window\.visualViewport/);
  assert.match(walkthrough, /dockClearance/);
  assert.match(walkthrough, /--guide-max-height/);
  assert.match(styles, /max-height: var\(--guide-max-height/);
  assert.match(styles, /overflow-y: auto; overscroll-behavior: contain/);
  assert.match(styles, /@media \(max-width: 359px\), \(max-height: 520px\)/);
  assert.match(styles, /env\(safe-area-inset-top\)/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
});

test("focus, keyboard, reduced motion, and lifecycle cleanup remain accessible", () => {
  assert.match(walkthrough, /event\.key === "Escape"/);
  assert.match(walkthrough, /event\.key !== "Tab"/);
  assert.match(walkthrough, /aria-describedby/);
  assert.match(walkthrough, /clearTargetBinding/);
  assert.match(walkthrough, /resizeObserver\?\.disconnect/);
  assert.match(walkthrough, /globalCleanup\?\.\(\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.bridge-guide__panel/);
});

test("completion, interrupted progress, replay, and cache availability are wired", () => {
  assert.match(app, /version, status, stepId, chapter/);
  assert.match(app, /queueStateSnapshot\(preferenceState, "Walkthrough preference saved", \{ silent:true, syncReminders:false \}\)/);
  assert.match(app, /data-replay-walkthrough data-guide-target="guide-replay"/);
  assert.match(app, /walkthrough\.restart\(button\)/);
  assert.match(walkthrough, /resumeAvailable = savedStatus === GUIDE_STATUS\.inProgress && versionMatches/);
  assert.match(walkthrough, /savedStatus === GUIDE_STATUS\.inProgress && !versionMatches/);
  assert.match(walkthrough, /persistGuide\(GUIDE_STATUS\.unseen\)/);
  assert.match(walkthrough, /data-guide-resume/);
  assert.match(app, /walkthrough\.hydrate\(\{ suppressPrompt:/);
  assert.ok((app.match(/walkthrough\.hydrate\(\);/g) || []).length >= 2);
  assert.match(app, /if \(walkthrough\.visible\(\)\) walkthrough\.exitGuide\(\)/);
  assert.match(walkthrough, /exitGuide\(GUIDE_STATUS\.completed\)/);
  assert.match(serviceWorker, /new URL\("walkthrough\.js", ROOT\)\.href/);
  assert.match(devServer, /\["\/walkthrough\.js", \["\.\/src\/walkthrough\.js", "text\/javascript/);
});

test("dismissing Capture exits the active guide instead of orphaning its overlay", () => {
  assert.match(app, /function closeQuickCreate\(\) \{\s+if \(walkthrough\.active\(\)\) \{\s+walkthrough\.exitGuide\(\);\s+return;/);
  assert.match(app, /bindBottomSheetGesture\(\$\('\.quick-create-modal'\),closeQuickCreate\)/);
  assert.match(app, /id='closeQuickCreate'|id="closeQuickCreate"/);
});

test("Capture wizard state survives production account-sync rerenders", () => {
  assert.match(app, /quickCreateStep: 0/);
  assert.match(app, /function setQuickCaptureStep\(form,nextIndex,\{direction='forward',behavior=null,restore=false\}=\{\}\)/);
  assert.match(app, /ui\.quickCreateStep=next;form\.dataset\.captureStepIndex=String\(next\)/);
  assert.match(app, /setQuickCaptureStep\(form,ui\.quickCreateStep,\{behavior:'auto',restore:true\}\)/);
  assert.match(app, /if\(restore\)return/);
  assert.match(app, /status\?\.stateData && accountContext\.authenticated[\s\S]*if \(stateHydrated\) render\(\)/);
});
