import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const app=fs.readFileSync(path.join(root,"src/app.js"),"utf8");
const styles=fs.readFileSync(path.join(root,"src/styles.css"),"utf8");
const foundation=fs.readFileSync(path.join(root,"src/ui-foundation.js"),"utf8");
const between=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end));

test("one bottom-sheet gesture controller owns Capture and shared sheets",()=>{
  const gesture=between("function bindBottomSheetGesture","function bindSharedPrimitiveEvents");
  assert.match(gesture,/data-ui-sheet-scroll/);
  assert.match(gesture,/scrollRoot\.scrollTop/);
  assert.match(gesture,/pointerdown/);
  assert.match(gesture,/pointermove/);
  assert.match(gesture,/mousedown/);
  assert.match(gesture,/touchstart/);
  assert.match(gesture,/touchmove/);
  assert.match(gesture,/current\.distance>=threshold\|\|\(current\.distance>=64&&current\.velocity>\.65\)/);
  assert.match(gesture,/springKeyframes\(Math\.max\(0,distance\),0,REFERENCE_MOTION\.sheet/);
  assert.match(app,/bindBottomSheetGesture\(dialog,\(\)=>closeDialog\(dialog\)\)/);
  assert.match(app,/bindBottomSheetGesture\(\$\('\.quick-create-modal'\),closeQuickCreate\)/);
  assert.match(foundation,/data-ui-sheet-backdrop[\s\S]*data-ui-sheet[\s\S]*data-ui-sheet-drag-region[\s\S]*data-ui-sheet-scroll/);
});

test("modal scroll lock clips the root without offsetting fixed descendants and restores scroll",()=>{
  const lock=between("function syncDocumentScrollLock","function springProgress");
  assert.match(lock,/lockedDocumentScrollY = window\.scrollY/);
  assert.doesNotMatch(lock,/document\.body\.style\.(?:position|inset|width)/);
  assert.match(lock,/document\.body\.classList\.add\("modal-open"\)/);
  assert.match(lock,/window\.scrollTo\(0, restoreY\)/);
  assert.match(app,/syncDocumentScrollLock\(transientModalOpen\)/);
  assert.match(styles,/html\.modal-open, body\.modal-open \{[^}]*height: 100%;[^}]*overflow: hidden;[^}]*overscroll-behavior: none/);
  assert.match(styles,/\[data-ui-sheet-scroll\][^{]*\{[^}]*touch-action: pan-y/);
});

test("tab indicators travel with the reference spring instead of toggling pseudo-elements",()=>{
  const indicator=between("function bindTravelingTabIndicator","function bindBottomSheetGesture");
  assert.match(app,/tab: Object\.freeze\(\{ stiffness:500, damping:40/);
  assert.match(indicator,/tabIndicatorMetrics\.get\(key\)/);
  assert.match(indicator,/indicator\.animate/);
  assert.match(indicator,/typeof indicator\.animate!=="function"/);
  assert.match(indicator,/transform 420ms cubic-bezier\(\.16,1,\.3,1\)/);
  assert.match(foundation,/class="ui-tabs__indicator"/);
  assert.doesNotMatch(styles,/\.ui-tabs > button\[aria-selected="true"\]::after/);
  assert.doesNotMatch(styles,/\.pipeline-home__tabs button\[aria-selected="true"\]::after/);
  assert.match(app,/idPrefix:"analytics-range"/);
  assert.match(app,/idPrefix:"analytics-detail-range"/);
  assert.doesNotMatch(styles,/\.analytics-detail-tabs button\.active::after/);
});

test("Filter People and Reschedule use fixed sheet footers above safe areas",()=>{
  const filter=between("function peopleFilterSheet","function renderPeopleHome");
  const reschedule=between("function followUpRescheduleSheet","function compactScorecardRangeLabel");
  assert.match(filter,/footer=`<div class="people-filter-sheet__actions"/);
  assert.doesNotMatch(filter,/<footer>/);
  assert.match(app,/function relationshipFilterSelect[^\n]+FilterControl\(\{id,label,value,options\}\)/);
  assert.doesNotMatch(app,/function relationshipFilterSelect[^\n]+select-wrap/);
  assert.match(reschedule,/form="followUpRescheduleForm"/);
  assert.match(reschedule,/data-ui-dialog-close>Cancel/);
  assert.match(styles,/\.ui-mobile-sheet__footer \{[^}]*var\(--safe-bottom\)/);
});
