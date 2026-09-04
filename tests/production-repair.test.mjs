import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const accountClient = await readFile(new URL("../src/account-client.js", import.meta.url), "utf8");

function selectLatestBackup(backups) {
  const start = app.indexOf("function cloudBackupTimestamp");
  const end = app.indexOf("function accountBackupRow", start);
  assert.ok(start >= 0 && end > start, "latest-backup implementation must remain available");
  const context = { input: backups, result: null, Date, Number, String, Array };
  vm.runInNewContext(`${app.slice(start, end)}\nresult = latestCloudBackup(input);`, context);
  return context.result;
}

test("backup UI selects one newest valid record without trusting API order", () => {
  const backups = [
    { id: "older", status: "complete", created_at: "2026-08-23T10:00:00.000Z", completed_at: "2026-08-23T10:01:00.000Z" },
    { id: "invalid", status: "complete", created_at: "not-a-date" },
    { id: "newest", status: "complete", created_at: "2026-08-25T08:36:00.000Z", completed_at: "2026-08-25T08:37:00.000Z" },
    { id: "middle", status: "complete", created_at: "2026-08-24T12:00:00.000Z" }
  ];
  assert.equal(selectLatestBackup(backups).id, "newest");
  const backupUI = app.slice(app.indexOf("function accountBackupRows"), app.indexOf("function dataAndBackupSettings"));
  assert.match(backupUI, /accountBackupRow\(latest\)/);
  assert.doesNotMatch(backupUI, /backups\.map\(accountBackupRow\)/);
  assert.match(backupUI, /data-backup-id="\$\{escapeHTML\(backup\.id\)\}"/);
  assert.match(backupUI, /status !== "complete" \? "disabled" : ""/);
});

test("a newer processing backup is shown cleanly and cannot be restored", () => {
  const backups = [
    { id: "complete", status: "complete", completedAt: "2026-08-25T08:37:00.000Z" },
    { id: "processing", status: "running", createdAt: "2026-08-25T09:00:00.000Z" }
  ];
  assert.equal(selectLatestBackup(backups).id, "processing");
  assert.match(app, /status === "running" \|\| status === "queued" \? "Processing"/);
  assert.match(styles, /\.latest-cloud-backup \.restore-cloud-backup \{ min-width: 96px; min-height: 44px; \}/);
});

test("People, Pipeline, and Insights share the primary title typography class", () => {
  assert.match(app, /<h1 class="primary-page-title">People<\/h1>/);
  assert.match(app, /<h1 class="primary-page-title">Pipeline<\/h1>/);
  assert.match(app, /pageHead\("Insights",[\s\S]*"primary-page-title"\)/);
  assert.match(app, /<h1 class="primary-page-title">\$\{greeting\}<\/h1>/);
  assert.match(styles, /\.primary-page-title \{[^}]*font-family: var\(--font-editorial\);[^}]*font-size: clamp\(40px, 10\.7vw, 50px\);[^}]*font-weight: var\(--font-weight-medium\);/);
  assert.match(styles, /\.primary-page-title,[\s\S]*?\.today-home__header h1\.primary-page-title \{[\s\S]*?font-family: var\(--font-editorial\) !important;[\s\S]*?font-size: 26px !important;[\s\S]*?font-weight: var\(--font-weight-medium\) !important;[\s\S]*?letter-spacing: -\.025em !important;[\s\S]*?line-height: 1\.15 !important;/);
  assert.doesNotMatch(styles, /\.pipeline-home__header h1/);
});

test("scorecard PNG generation has no stale undefined theme reference", () => {
  const preview = app.slice(app.indexOf("function scorecardPreviewPNG"), app.indexOf("function scorecardImageFile"));
  assert.match(preview, /canvas\.width = 1200/);
  assert.match(preview, /canvas\.height = isImage \? 1200 : 630/);
  assert.match(preview, /RELATIONSHIP ACTIVITY/);
  assert.match(preview, /drawScorecardMetric\(context, metric/);
  assert.doesNotMatch(preview, /\bdark\b/);
});

test("same-name people receive independent IDs and survive independent lifecycle operations", () => {
  const start = app.indexOf("function quickCaptureNewContact");
  const end = app.indexOf("function applyQuickCaptureDetails", start);
  assert.ok(start >= 0 && end > start);
  let sequence = 0;
  const create = new Function(
    "uid", "quickCapturePlace", "nowISO", "quickCaptureISO", "ALL_STAGES", "stageInputName", "PIPELINES", "setPipelineStage",
    `${app.slice(start, end)}; return quickCaptureNewContact;`
  )(
    () => `person-${++sequence}`,
    () => ({ placeId:null, placeName:"" }),
    () => "2026-09-03T12:00:00.000Z",
    () => null,
    ["MSA", "DTM", "PQI"],
    stage => stage,
    { Prospect:["PQI"], Customer:[], Team:[] },
    () => {}
  );
  const form = values => ({ get:key => values[key] ?? "", has:() => false });
  const first = create(form({ fullName:"James", email:"first@example.com", role:"Prospect" }), "2026-09-01T12:00:00.000Z");
  const second = create(form({ fullName:"James", email:"second@example.com", role:"Prospect" }), "2026-09-02T12:00:00.000Z");
  assert.equal(first.fullName, "James");
  assert.equal(second.fullName, "James");
  assert.notEqual(first.id, second.id);

  const restored = JSON.parse(JSON.stringify([first, second]));
  restored.find(person => person.id === first.id).email = "edited@example.com";
  assert.equal(restored.find(person => person.id === second.id).email, "second@example.com");
  const afterDelete = restored.filter(person => person.id !== first.id);
  assert.deepEqual(afterDelete.map(person => person.id), [second.id]);

  assert.match(app, /state\.contacts=state\.contacts\.filter\(x=>x\.id!==c\.id\)/);
  assert.match(accountClient, /recordKey\("contact", contact\.id\)/);
  assert.match(accountClient, /new Map\(\(next\.contacts \|\| \[\]\)\.map\(item => \[String\(item\.id\), item\]\)\)/);
});
