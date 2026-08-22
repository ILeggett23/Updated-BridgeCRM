import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const app=fs.readFileSync(path.join(root,"src","app.js"),"utf8");
const styles=fs.readFileSync(path.join(root,"src","styles.css"),"utf8");
await import(new URL("../src/engagement-logic.js",import.meta.url));
const {todaySwipeDecision}=globalThis.BridgeEngagement;

const between=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end));

test("Today renders one swipe shell while retaining explicit accessible actions",()=>{
  const card=between("function todayNextAction","function todayClearAction");
  assert.match(card,/data-today-swipe-card/);
  assert.match(card,/today-swipe-feedback--done/);
  assert.match(card,/today-swipe-feedback--reschedule/);
  assert.match(card,/Swipe left to mark this follow-up done or right to open rescheduling/);
  assert.match(card,/today-reschedule-action/);
  assert.match(card,/today-complete-action/);
  assert.match(card,/aria-label="Mark follow-up with \$\{escapeHTML\(name\)\} done"/);
});

test("Today gesture uses intent, distance, and velocity thresholds without stealing vertical scroll",()=>{
  const gesture=between("const TODAY_SWIPE_INTENT_PX","function bindPageEvents");
  assert.match(gesture,/TODAY_SWIPE_INTENT_PX=8/);
  assert.match(gesture,/samples\.filter\(sample=>sample\.t>=event\.timeStamp-80\)/);
  assert.match(gesture,/Math\.min\(120,Math\.max\(84,width\*\.28\)\)/);
  assert.match(gesture,/event\.target\.closest\("button,a,input,select,textarea,summary,label"\)/);
  assert.match(gesture,/pointerdown/);
  assert.match(gesture,/pointermove/);
  assert.match(gesture,/pointerup/);
  assert.match(gesture,/pointercancel/);
  assert.match(gesture,/lostpointercapture/);
  assert.match(styles,/touch-action: pan-y/);
});

test("Swipe decision covers vertical, distance, flick, reverse-jitter, and boundary cases",()=>{
  assert.equal(todaySwipeDecision({dx:90,dy:100,velocityX:1,width:353}),"");
  assert.equal(todaySwipeDecision({dx:80,dy:2,velocityX:.2,width:353}),"");
  assert.equal(todaySwipeDecision({dx:-110,dy:3,velocityX:0,width:353}),"done");
  assert.equal(todaySwipeDecision({dx:110,dy:3,velocityX:0,width:353}),"reschedule");
  assert.equal(todaySwipeDecision({dx:-40,dy:2,velocityX:-.7,width:353}),"done");
  assert.equal(todaySwipeDecision({dx:40,dy:2,velocityX:.7,width:353}),"reschedule");
  assert.equal(todaySwipeDecision({dx:40,dy:2,velocityX:-.9,width:353}),"");
  assert.equal(todaySwipeDecision({dx:84,dy:0,velocityX:0,width:200}),"reschedule");
});

test("Swipe completion reuses production lifecycle and right swipe opens existing rescheduling",()=>{
  const gesture=between("function completeTodayAction","function bindPageEvents");
  assert.match(gesture,/isScheduledFollowUp\(record\.followUp\)/);
  assert.match(gesture,/todayActionLocks\.has/);
  assert.match(gesture,/transitionFollowUp\(record\.followUp,"completed"\)/);
  assert.match(gesture,/queueSave\("Action completed"\)/);
  assert.match(gesture,/ui\.actionEditId=actionId/);
  assert.doesNotMatch(gesture,/ui\.page="followups"/);
  assert.doesNotMatch(gesture,/rescheduleFollowUp\(/);
  assert.match(gesture,/if\(direction==="done"\)completeTodayAction/);
  assert.match(gesture,/else openTodayReschedule/);
  assert.match(gesture,/aria-busy/);
  assert.match(gesture,/button\.disabled=true/);
});

test("Gesture cancellation springs back and reduced motion commits without delay",()=>{
  const gesture=between("function bindTodaySwipeCard","function bindPageEvents");
  assert.match(gesture,/transform 320ms cubic-bezier\(\.16,1,\.3,1\)/);
  assert.match(gesture,/prefers-reduced-motion: reduce/);
  assert.match(gesture,/reduced\?0:245/);
  assert.match(gesture,/if\(direction\)finish\(direction\);else snapBack\(\)/);
});
