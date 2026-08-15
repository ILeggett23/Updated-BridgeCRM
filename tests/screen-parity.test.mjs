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

test("Phase 15F Follow-Ups presents timing segments and retains completed history",()=>{
  for(const value of ["today","upcoming","overdue"])assert.match(app,new RegExp(`data-action-view=\\"${value}\\"`));
  assert.match(app,/data-action-view="completed"/);
  assert.match(app,/Completed follow-ups remain in relationship history/);
  for(const action of ["followup-card__reschedule","followup-card__done","followup-card__relationship","followup-card__delete"])assert.match(app,new RegExp(action));
  assert.match(styles,/\.followups-home__status \{ display: grid; grid-template-columns: repeat\(3/);
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
