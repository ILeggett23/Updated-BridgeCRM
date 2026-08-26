import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { BRIDGE_WALKTHROUGH_STEPS } from "../src/walkthrough.js";

const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const foundation = await readFile(new URL("../src/ui-foundation.js", import.meta.url), "utf8");
const walkthrough = await readFile(new URL("../src/walkthrough.js", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../src/sw.js", import.meta.url), "utf8");
const devServer = await readFile(new URL("../dev.mjs", import.meta.url), "utf8");

test("walkthrough teaches the relationship loop in concise, stable moments", () => {
  assert.equal(BRIDGE_WALKTHROUGH_STEPS.length, 10);
  assert.deepEqual(
    BRIDGE_WALKTHROUGH_STEPS.map(step => step.id),
    ["today", "daily-goal", "capture", "relationship-context", "people", "pipeline", "follow-ups", "insights", "replay", "relationship-loop"]
  );
  assert.equal(new Set(BRIDGE_WALKTHROUGH_STEPS.map(step => step.id)).size, BRIDGE_WALKTHROUGH_STEPS.length);
  const pipeline = BRIDGE_WALKTHROUGH_STEPS.find(step => step.id === "pipeline");
  assert.match(pipeline.description, /PQI, QI\/P, FUP, and LA/);
  assert.match(pipeline.description, /CNA, Proposal, Follow-Up, Order Placed, and Active Customer/);
  assert.equal(BRIDGE_WALKTHROUGH_STEPS.find(step => step.id === "relationship-loop").target, "");
});

test("tour uses stable hooks, existing routing, and synced Settings persistence", () => {
  assert.match(app, /createBridgeWalkthrough/);
  assert.match(app, /state\.settings\.walkthrough =/);
  assert.match(app, /queueSave\("Walkthrough preference saved", \{ silent: true \}\)/);
  assert.match(app, /activateWalkthroughDestination/);
  assert.match(app, /navigateWalkthroughMain\("contacts", \{ mode: "pipeline", role: "Prospect" \}\)/);
  for (const target of ["today-overview", "daily-goal", "capture-menu", "capture-context", "people-workspace", "pipeline-workspace", "followups-workspace", "insights-workspace", "walkthrough-replay"]) {
    const source = target === "capture-menu" ? foundation : app;
    assert.ok(source.includes(`data-tour=\"${target}\"`), `missing stable tour target ${target}`);
  }
  assert.match(app, /data-replay-walkthrough/);
  assert.match(app, /walkthrough\.restart\(button\)/);
});

test("tour preserves accessibility, responsive positioning, and cache availability", () => {
  assert.match(styles, /\.bridge-tour__spotlight/);
  assert.match(styles, /@media \(max-width: 767px\), \(max-height: 500px\)[\s\S]*\.bridge-tour__card/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.bridge-tour__scrim/);
  assert.match(app, /setQuickCaptureStep\(form, 2/);
  assert.match(walkthrough, /target\.scrollIntoView/);
  assert.match(serviceWorker, /new URL\("walkthrough\.js", ROOT\)\.href/);
  assert.match(devServer, /\["\/walkthrough\.js", \["\.\/src\/walkthrough\.js", "text\/javascript/);
});
