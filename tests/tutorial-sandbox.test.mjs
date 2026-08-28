import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { BRIDGE_GUIDE_CAPTURE_CONTENT, BRIDGE_GUIDE_CONTACT_ID, createBridgeGuideFixture } from "../src/tutorial-fixture.js";
import { BRIDGE_GUIDE_STEPS } from "../src/walkthrough.js";

const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const build = await readFile(new URL("../build.mjs", import.meta.url), "utf8");
const dev = await readFile(new URL("../dev.mjs", import.meta.url), "utf8");
const worker = await readFile(new URL("../src/sw.js", import.meta.url), "utf8");
const allStages = ["MSA", "DTM", "PQI", "QI/P", "FUP", "LA", "CNA", "Proposal", "Follow-Up", "Order Placed", "Active Customer"];
const baseState = { contacts:[], places:[], settings:{ dailyGoal:5, weeklyGoal:25, monthlyGoal:100 }, analytics:{ records:[{ id:"real-analytics" }] }, meta:{ version:6, achievements:{ real:true } } };

test("new and existing users receive the same isolated tutorial fixture", () => {
  const empty = createBridgeGuideFixture({ baseState, allStages, now:Date.UTC(2026,7,27,12), walkthroughPreference:{ status:"in-progress" } });
  const existing = createBridgeGuideFixture({ baseState:{ ...baseState, contacts:[{ id:"private-contact", fullName:"Real Person" }], places:[{ id:"private-place", name:"Private Place" }] }, allStages, now:Date.UTC(2026,7,27,12), walkthroughPreference:{ status:"in-progress" } });
  assert.deepEqual(existing, empty);
  assert.deepEqual(empty.contacts.map(contact => contact.fullName), ["Jordan Brooks", "Maya Chen", "Marcus Reed", "Avery Collins"]);
  assert.equal(empty.contacts.every(contact => contact.source === "tutorial" && contact.isTutorialRecord), true);
  assert.equal(JSON.stringify(empty).includes("private-contact"), false);
  assert.equal(JSON.stringify(empty).includes("real-analytics"), false);
  assert.equal(empty.settings.firstName, "Taylor");
});

test("Capture guide steps declare exact wizard state and deterministic setup", () => {
  const capture = Object.fromEntries(BRIDGE_GUIDE_STEPS.filter(step => step.chapter === "Capture").map(step => [step.id, step]));
  assert.equal(capture["choose-person"].target, "capture-tutorial-person");
  assert.equal(capture["choose-person"].beforeEnter, "prepare-tutorial-person");
  assert.equal(capture["choose-person"].captureStep, 0);
  assert.equal(capture["conversation-notes"].beforeEnter, "seed-tutorial-notes");
  assert.equal(capture["conversation-notes"].captureStep, 2);
  assert.equal(capture["what-i-know"].beforeEnter, "seed-tutorial-context");
  assert.equal(capture["what-i-know"].captureStep, 2);
  assert.equal(capture["next-action"].beforeEnter, "prepare-tutorial-next-action");
  assert.equal(capture["next-action"].captureStep, 3);
  assert.equal(capture["capture-tracking"].beforeEnter, "expand-tutorial-tracking");
  assert.equal(capture["save-capture"].beforeEnter, "complete-tutorial-capture");
  assert.match(app, /Number\.isInteger\(guideStep\?\.captureStep\) \? guideStep\.captureStep/);
  assert.match(app, /advanced\.open = tracking/);
  assert.match(app, /setTutorialFormValue\(form, "notes", atLeast\("seed-tutorial-notes"\)/);
  assert.match(app, /setTutorialFormValue\(form, "personalInfo", atLeast\("seed-tutorial-context"\)/);
  assert.match(app, /input\.checked = input\.value === \(scheduled \? "followUp" : "none"\)/);
  assert.ok(BRIDGE_GUIDE_CAPTURE_CONTENT.notes.length > 20);
});

test("tutorial sandbox owns production-write guards and complete cleanup", () => {
  assert.match(app, /if \(bridgeGuideTutorialActive\(\)\) \{\s+console\.warn\("\[Bridge Guide\] Blocked a production persistence attempt/);
  assert.match(app, /async function persistStateSilently\(\) \{\s+if \(bridgeGuideTutorialActive\(\)\) return false/);
  assert.match(app, /async function syncHostedReminderSchedule\(\) \{\s+if \(bridgeGuideTutorialActive\(\)\) return false/);
  assert.match(app, /async function checkReminders\(\) \{\s+if \(bridgeGuideTutorialActive\(\)\) return/);
  assert.match(app, /if \(sharedScorecardToken \|\| !stateHydrated \|\| bridgeGuideTutorialActive\(\)\) return/);
  assert.match(app, /state = tutorialSession\.realState;\s+tutorialSession = null/);
  assert.match(app, /closeWalkthroughCapture\(\);\s+endBridgeGuideTutorialSession\(\);\s+render\(\)/);
  assert.match(app, /startSession: \(\) => beginBridgeGuideTutorialSession\(\)/);
  assert.match(app, /bridgeGuidePreferenceState\(\)/);
  assert.match(app, /BRIDGE_GUIDE_CONTACT_ID/);
});

test("tutorial fixture is available in preview, production build, and offline shell", () => {
  assert.match(app, /tutorial-fixture\.js\?v=1\.3\.40/);
  assert.match(dev, /\["\/tutorial-fixture\.js", \["\.\/src\/tutorial-fixture\.js"/);
  assert.match(build, /const tutorialFixture = await readFile/);
  assert.match(build, /url\.pathname === "\/tutorial-fixture\.js"/);
  assert.match(build, /dist\/tutorial-fixture\.js/);
  assert.match(worker, /new URL\("tutorial-fixture\.js", ROOT\)\.href/);
});
