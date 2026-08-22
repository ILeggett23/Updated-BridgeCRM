import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const app=fs.readFileSync(path.join(root,"src","app.js"),"utf8");
const styles=fs.readFileSync(path.join(root,"src","styles.css"),"utf8");

test("Phase 15F Today adds truthful intelligence and weekly momentum without stage aliases",()=>{
  const today=app.slice(app.indexOf("function renderDashboard"),app.indexOf("function renderContacts"));
  assert.match(today,/todayWorthDoingSection\(attention\.slice\(1,3\), now\)/);
  assert.match(today,/series:conversationTrend\(7,now\)/);
  assert.match(today,/Relationship signals will appear here/);
  assert.doesNotMatch(today,/stageLabel\(stageFor\(contact\)\)/);
  assert.match(styles,/\.today-worth__list/);
  assert.match(styles,/\.today-momentum__bars/);
});

test("Phase 15F relationship history is grouped and keeps real event sources",()=>{
  assert.match(app,/function profileTimelineGroups\(events\)/);
  assert.match(app,/const conversations=\(c\.conversations \|\| \[\]\)\.map/);
  assert.match(app,/const actions=\(c\.followUps \|\| \[\]\)\.flatMap/);
  assert.match(app,/const pipeline=profileStageEvents\(c\)\.map/);
  assert.match(app,/\{label:"Everything",value:"All"\}/);
  assert.match(app,/\{label:"Follow-ups",value:"Actions"\}/);
  assert.match(styles,/\.profile-history-group > h2/);
});

test("Phase 15F stage details derive their rail and metrics from canonical pipeline arrays",()=>{
  assert.match(app,/Prospect:\s*\["PQI",\s*"QI\/P",\s*"FUP",\s*"LA"\]/);
  assert.match(app,/Customer:\s*\["CNA",\s*"Proposal",\s*"Follow-Up",\s*"Order Placed",\s*"Active Customer"\]/);
  assert.match(app,/function pipelineStageDetailContent\(role,stage,contacts/);
  assert.match(app,/const stages=PIPELINES\[role\]\|\|\[\]/);
  assert.match(app,/pipelineStageAge\(contact,stage,now\)/);
  assert.match(app,/\(event\.toStage\|\|event\.stage\)===stage/);
  assert.match(styles,/\.pipeline-stage-detail__rail/);
  assert.match(styles,/\.pipeline-stage-detail__metrics/);
});

test("Follow-Ups uses the compact Action Center queue and retains lifecycle actions",()=>{
  for(const value of ["today","upcoming","overdue"])assert.match(app,new RegExp(`data-action-view=\\"${value}\\"`));
  assert.match(app,/data-action-view="completed"/);
  assert.match(app,/Completed follow-ups remain in relationship history/);
  for(const action of ["followup-card__reschedule","followup-card__done","followUpRescheduleSheet","data-followup-delete"])assert.match(app,new RegExp(action));
  assert.doesNotMatch(app,/followup-card__reschedule-form/);
  assert.doesNotMatch(app,/followups-home__title/);
  assert.match(styles,/\.followups-home__status \{ display: grid; grid-template-columns: repeat\(3/);
  assert.match(styles,/\.followups-home \{ width: 100%; min-height: 100%; padding: 0;/);
  assert.match(styles,/\.followups-home__header h1 \{[^}]*font-size: 26px;/);
  assert.match(styles,/\.followup-card \{ padding: 16px 0;/);
  assert.match(styles,/\.followup-card__avatar \{ width: 40px; height: 40px;/);
  assert.match(styles,/\.followup-card__communication :is\(a,button\), \.followup-card__reschedule, \.followup-card__done \{ min-height: 34px;/);
});

test("Shared mobile parity keeps search focus, Capture sheets, and Profile scale compact",()=>{
  assert.match(styles,/\.ui-search-field:focus-within \{ border-color: var\(--color-text-primary\); box-shadow: none; \}/);
  assert.match(styles,/\.quick-capture-picker__search:focus-within \{ border-color: var\(--color-text-primary\); box-shadow: none; \}/);
  assert.match(styles,/\.quick-create-modal \{ position: relative; height: auto; max-height: 92dvh; display: flex; flex-direction: column; overflow: hidden; \}/);
  assert.match(styles,/\.quick-create-modal\.has-step \{\s*height: auto;\s*min-height: 0;\s*max-height: 92dvh;/);
  assert.match(styles,/\.profile-identity :is\(h1,h2\) \{[^}]*font-size: 28px;/);
  assert.match(styles,/\.profile-quick-actions > a, \.profile-quick-actions > button \{[^}]*min-height: 62px;/);
  assert.match(styles,/\.profile-next-action__content p \{[^}]*font-size: 15\.5px;/);
});

test("Main navigation motion stays restrained and uses one underline animation path",()=>{
  assert.match(styles,/\.page\.page-enter, \.page\.mode-enter \{ animation: none; \}/);
  assert.match(styles,/\.nav-selection-indicator \{[\s\S]*transition: opacity var\(--motion-fast\);[\s\S]*will-change: transform, opacity;/);
  assert.doesNotMatch(styles,/\.nav-selection-indicator \{[^}]*transition: transform/);
  assert.match(app,/navIndicator\.animate\(frames,\{duration:320,easing:'cubic-bezier\(\.16,1,\.3,1\)'\}\)/);
  assert.match(app,/from>=0&&to<0/);
  assert.doesNotMatch(app,/Math\.max\(0,previousNavSelection\)/);
});

test("Person Profile keeps next-action rescheduling compact and routes new actions through Capture",()=>{
  const profile=app.slice(app.indexOf("function profileNextAction"),app.indexOf("function profileBridgeBrief"));
  const bindings=app.slice(app.indexOf("function bindContactModalEvents"),app.indexOf("function bindActivityHistoryEvents"));
  assert.match(profile,/data-profile-reschedule/);
  assert.match(profile,/data-profile-followup/);
  assert.doesNotMatch(profile,/profile-followup-editor|Choose a new time|setFollowUpForm/);
  assert.match(bindings,/ui\.quickCreateMode="action"/);
  assert.match(bindings,/ui\.quickCreateContactId=c\.id/);
  assert.match(bindings,/addDays\(new Date\(active\.dueDate\),3\)\.toISOString\(\)/);
  assert.doesNotMatch(bindings,/#setFollowUpForm|#removeFollowUp/);
});

test("Phase 15F routed analytics renders only real detailed calculations",()=>{
  const route=app.slice(app.indexOf("function renderAnalyticsDetailScreen"),app.indexOf("function renderGoalsScreen"));
  assert.match(route,/buildInsightsModel/);
  assert.match(route,/insightsDetailedAnalytics\(model,scorecard,previousScorecard,\{embedded:false\}\)/);
  assert.doesNotMatch(route,/renderAnalytics\(\)\.replace/);
  assert.match(app,/if\(!embedded\)return body/);
  assert.match(styles,/\.analytics-detail-route > \.insights-period/);
});

test("Phase 15F place detail uses only derived production relationships and exact stages",()=>{
  assert.match(app,/const activePeople=people\.filter\(contact=>!contact\.archivedAt&&!contact\.isFilteredOut\)\.length/);
  assert.match(app,/const customers=people\.filter\(contact=>contact\.role==="Customer"\)\.length/);
  assert.match(app,/PIPELINE_STAGES\.map\(stage=>\(\{stage,count:people\.filter\(contact=>currentPipelineStage\(contact\)===stage\)\.length\}\)\)/);
  assert.match(app,/Exact current stages for relationships linked to this place/);
  assert.match(styles,/\.place-detail__outcomes/);
});
