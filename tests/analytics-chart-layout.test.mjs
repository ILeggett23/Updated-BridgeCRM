import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

await import(new URL("../src/communication-logic.js",import.meta.url));
await import(new URL("../src/analytics-logic.js",import.meta.url));
const {analyticsRange,buildInsightsModel}=globalThis.BridgeAnalytics;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const app=fs.readFileSync(path.join(root,"src/app.js"),"utf8");
const styles=fs.readFileSync(path.join(root,"src/styles.css"),"utf8");

const pipelines={Prospect:["PQI","QI/P","FUP","LA"],Customer:["CNA","Proposal","Follow-Up","Order Placed","Active Customer"]};
const contactWithDates=dates=>({id:"chart",role:"Prospect",conversations:dates.map((date,index)=>({id:String(index),isCountedConversation:true,conversationDate:`${date}T12:00:00`})),stageEvents:[],followUps:[]});

test("month analytics produces one deterministic point per local calendar day",()=>{
  const august=buildInsightsModel({contacts:[contactWithDates(["2026-08-01","2026-08-01","2026-08-31"])],range:analyticsRange({mode:"month",anchor:"2026-08-15"}),pipelines});
  assert.equal(august.daySeries.length,31);
  assert.deepEqual(august.daySeries.slice(0,2).map(point=>point.value),[2,0]);
  assert.equal(august.daySeries.at(-1).value,1);
  assert.equal(august.daySeries.every(point=>point.label.length===1),true);

  const february=buildInsightsModel({contacts:[],range:analyticsRange({mode:"month",anchor:"2026-02-12"}),pipelines});
  assert.equal(february.daySeries.length,28);
  const leapFebruary=buildInsightsModel({contacts:[],range:analyticsRange({mode:"month",anchor:"2028-02-12"}),pipelines});
  assert.equal(leapFebruary.daySeries.length,29);
  const april=buildInsightsModel({contacts:[],range:analyticsRange({mode:"month",anchor:"2026-04-12"}),pipelines});
  assert.equal(april.daySeries.length,30);
});

test("month landmarks preserve real Sunday week boundaries and month edges",()=>{
  const sundayStart=buildInsightsModel({contacts:[],range:analyticsRange({mode:"month",anchor:"2026-11-15"}),pipelines,now:"2026-08-28T12:00:00"});
  assert.equal(sundayStart.daySeries[0].day,1);
  assert.equal(sundayStart.daySeries[0].isWeekStart,true);
  assert.deepEqual(sundayStart.daySeries.filter(point=>point.isWeekStart).map(point=>point.day),[1,8,15,22,29]);

  const midweekStart=buildInsightsModel({contacts:[contactWithDates(["2026-09-01","2026-09-30"])],range:analyticsRange({mode:"month",anchor:"2026-09-15"}),pipelines,now:"2026-08-28T12:00:00"});
  assert.equal(midweekStart.daySeries[0].weekday,"Tue");
  assert.equal(midweekStart.daySeries[0].isWeekStart,false);
  assert.deepEqual(midweekStart.daySeries.filter(point=>point.isWeekStart).map(point=>point.day),[6,13,20,27]);
  assert.equal(midweekStart.daySeries[0].value,1);
  assert.equal(midweekStart.daySeries.at(-1).value,1);
  assert.equal(midweekStart.daySeries.slice(1,-1).every(point=>point.value===0),true);
});

test("week series always preserves seven weekday and date associations",()=>{
  const week=buildInsightsModel({contacts:[contactWithDates(["2026-08-23","2026-08-29"])],range:analyticsRange({mode:"week",anchor:"2026-08-28",weekStart:0}),pipelines});
  assert.equal(week.daySeries.length,7);
  assert.deepEqual(week.daySeries.map(point=>[point.weekday,point.day,point.value]),[["Sun",23,1],["Mon",24,0],["Tue",25,0],["Wed",26,0],["Thu",27,0],["Fri",28,0],["Sat",29,1]]);
});

test("the shared analytics chart scrolls dense months and bounds every bar",()=>{
  const activity=app.slice(app.indexOf("function analyticsDetailActivity"),app.indexOf("function insightsDetailedAnalytics"));
  assert.match(activity,/minimumWidth=Math\.max\(1,model\.daySeries\.length\)\*28/);
  assert.match(activity,/analytics-detail-chart-scroll/);
  assert.match(styles,/\.analytics-detail-chart \{[^}]*min-width: max\(100%,var\(--analytics-chart-min\)\)/);
  assert.match(styles,/grid-template-columns: repeat\(var\(--insights-points\), minmax\(22px, 1fr\)\)/);
  assert.match(styles,/\.analytics-detail-chart i\.has-value \{ width: min\(100%,32px\)/);
  assert.match(activity,/analytics-detail-chart__column/);
  assert.match(styles,/\.analytics-detail-chart__column \{[^}]*flex-direction: column;[^}]*justify-content: flex-end/);
});

test("day chart remains bounded for zero, one, repeated, and large activity values",()=>{
  const empty=buildInsightsModel({contacts:[],range:analyticsRange({mode:"day",anchor:"2026-08-10"}),pipelines});
  assert.deepEqual(empty.daySeries.map(point=>point.value),[0]);

  const one=buildInsightsModel({contacts:[contactWithDates(["2026-08-10"])],range:analyticsRange({mode:"day",anchor:"2026-08-10"}),pipelines});
  assert.deepEqual(one.daySeries.map(point=>point.value),[1]);

  const repeated=buildInsightsModel({contacts:[contactWithDates(["2026-08-09","2026-08-09","2026-08-10","2026-08-10"])],range:analyticsRange({mode:"week",anchor:"2026-08-10",weekStart:0}),pipelines});
  assert.deepEqual(repeated.daySeries.slice(0,2).map(point=>point.value),[2,2]);

  const largeDates=Array.from({length:120},()=>"2026-08-10");
  const large=buildInsightsModel({contacts:[contactWithDates(largeDates)],range:analyticsRange({mode:"day",anchor:"2026-08-10"}),pipelines});
  assert.deepEqual(large.daySeries.map(point=>point.value),[120]);
  assert.equal(one.hourSeries.length,12);
  assert.equal(one.hourSeries[6].value,1);
  assert.equal(one.hourSeries.filter(point=>point.value===0).length,11);

  const activity=app.slice(app.indexOf("function analyticsDetailActivity"),app.indexOf("function insightsDetailedAnalytics"));
  assert.match(activity,/Math\.max\(6,Math\.round\(point\.value\/max\*70\)\)/);
  assert.match(activity,/model\.conversations\.length\?/);
  assert.match(styles,/\.analytics-detail-chart i\.has-value \{ width: min\(100%,32px\)/);
});

test("overview activity uses range-specific compact renderers and inspectable marks",()=>{
  const chart=app.slice(app.indexOf("function conversationActivityDomain"),app.indexOf("function insightsPipelineIntelligence"));
  for(const contract of ["ConversationActivityDay","ConversationActivityWeek","ConversationActivityMonth","ConversationActivityCustom","activity-tooltip","aria-label"]){
    assert.match(chart,new RegExp(contract));
  }
  assert.match(chart,/model\.hourSeries\.map/);
  assert.match(chart,/point\.isWeekStart/);
  assert.match(chart,/point\.day/);
  assert.match(styles,/\.activity-day__plot \{ height: 84px/);
  assert.match(styles,/\.activity-week__plot \{ height: 112px/);
  assert.match(styles,/\.activity-month__plot \{ height: 104px/);
  assert.match(styles,/grid-template-columns: repeat\(var\(--activity-days\),minmax\(0,1fr\)\)/);
});

test("summary and pipeline activity consume the same selected-range model",()=>{
  const detail=app.slice(app.indexOf("function insightsDetailedAnalytics"),app.indexOf("function insightsHome"));
  for(const contract of ["analyticsDetailActivity(model)","model.conversations.length","model.newPeople.length","model.pipelineEvents.length","model.followUpCompletion","model.standaloneEvents"]){
    assert.ok(detail.includes(contract),`missing shared range contract ${contract}`);
  }
});
