import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const source=fs.readFileSync(path.join(root,"src","app.js"),"utf8");
const between=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end));

test("People search refreshes only its dynamic result body",()=>{
  const refresh=between("function refreshPeopleSearchResults","function renderPipelineStageScreen");
  assert.match(refresh,/body\.innerHTML=peopleSearchBodyMarkup\(\)/);
  assert.match(refresh,/bindPeopleSearchResultActions\(body\)/);
  assert.doesNotMatch(refresh,/\brender\(\)/);
  assert.match(source,/ui\.routedScreen==="people-search"&&refreshPeopleSearchResults\(cursor\)/);
});

test("Today swipe caches geometry before pointer movement",()=>{
  const swipe=between("function bindTodaySwipeCard","function bindPageEvents");
  const move=swipe.slice(swipe.indexOf('surface.addEventListener("pointermove"'),swipe.indexOf("const endGesture"));
  assert.match(swipe,/width:Math\.max\(1,surface\.getBoundingClientRect\(\)\.width\)/);
  assert.match(move,/const width=gesture\.width/);
  assert.doesNotMatch(move,/getBoundingClientRect/);
  assert.match(swipe,/width:current\.width/);
});

test("scroll restoration writes are throttled and flushed before navigation",()=>{
  const history=between("function initializePresentationHistory","initializePresentationHistory();");
  assert.match(history,/if\(scrollStateTimer\)clearTimeout\(scrollStateTimer\)/);
  assert.match(history,/scrollStateTimer=setTimeout/);
  assert.match(history,/,120\)/);
  assert.doesNotMatch(history,/scrollStateFrame|requestAnimationFrame\(\(\) => \{ scrollState/);
  assert.match(source,/flushScrollHistoryState\(\);\n  writeCurrentHistoryState/);
  assert.match(history,/pagehide",flushScrollHistoryState/);
});

test("Capture place activity is precomputed once per picker render",()=>{
  const places=between("function quickCapturePlaceActivityMap","function quickCaptureWizardFooter");
  assert.match(places,/for\(const contact of state\.contacts\)/);
  assert.match(places,/const activity=quickCapturePlaceActivityMap\(\)/);
  assert.match(places,/quickCapturePlaceActivityAt\(right,activity\)/);
  assert.match(places,/quickCapturePlaceActivityAt\(place,activity\)/);
});
