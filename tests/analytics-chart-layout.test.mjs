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
});

test("the shared analytics chart scrolls dense months and bounds every bar",()=>{
  const activity=app.slice(app.indexOf("function analyticsDetailActivity"),app.indexOf("function insightsDetailedAnalytics"));
  assert.match(activity,/minimumWidth=Math\.max\(1,model\.daySeries\.length\)\*28/);
  assert.match(activity,/analytics-detail-chart-scroll/);
  assert.match(styles,/\.analytics-detail-chart \{[^}]*min-width: max\(100%,var\(--analytics-chart-min\)\)/);
  assert.match(styles,/grid-template-columns: repeat\(var\(--insights-points\), minmax\(22px, 1fr\)\)/);
  assert.match(styles,/\.analytics-detail-chart i\.has-value \{ width: min\(100%,32px\)/);
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

  const activity=app.slice(app.indexOf("function analyticsDetailActivity"),app.indexOf("function insightsDetailedAnalytics"));
  assert.match(activity,/Math\.max\(6,Math\.round\(point\.value\/max\*70\)\)/);
  assert.match(activity,/model\.conversations\.length\?/);
  assert.match(styles,/\.analytics-detail-chart i\.has-value \{ width: min\(100%,32px\)/);
});

test("summary and pipeline activity consume the same selected-range model",()=>{
  const detail=app.slice(app.indexOf("function insightsDetailedAnalytics"),app.indexOf("function insightsHome"));
  for(const contract of ["analyticsDetailActivity(model)","model.conversations.length","model.newPeople.length","model.pipelineEvents.length","model.followUpCompletion","model.standaloneEvents"]){
    assert.ok(detail.includes(contract),`missing shared range contract ${contract}`);
  }
});
