import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

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
  assert.match(styles, /\.primary-page-title \{[^}]*font-family: var\(--font-editorial\);[^}]*font-size: clamp\(40px, 10\.7vw, 50px\);[^}]*font-weight: var\(--font-weight-medium\);/);
  assert.match(styles, /\.primary-page-title, \.page-head h1\.primary-page-title \{ font-size: 26px !important; letter-spacing: -\.025em !important; line-height: 1\.15 !important; \}/);
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
