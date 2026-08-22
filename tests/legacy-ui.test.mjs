import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const app=fs.readFileSync(path.join(root,"src","app.js"),"utf8");
const styles=fs.readFileSync(path.join(root,"src","styles.css"),"utf8");

test("production actions use the shared confirmation dialog instead of browser confirms",()=>{
  assert.doesNotMatch(app,/\bconfirm\s*\(/);
  assert.match(app,/function requestConfirmation/);
  assert.match(app,/ConfirmDialog\(confirmation\.title,confirmation\.message/);
  assert.match(app,/bridge:dialogclose/);
  assert.match(styles,/\.ui-confirm-dialog--danger/);
});

test("active icon controls use only the shared icon button",()=>{
  assert.doesNotMatch(app,/class="icon-button/);
  assert.doesNotMatch(styles,/(^|\n)\.icon-button(?:\s|\{|:)/);
  assert.match(app,/class="ui-icon-button remove-rest-rule"/);
  assert.match(app,/class="ui-icon-button delete-log"/);
});

test("relationship health composes shared surface, badge, metric, and button primitives",()=>{
  const health=app.slice(app.indexOf("function contactHealthCard"),app.indexOf("function contactPersonalInfo"));
  assert.match(health,/ui-surface-card contact-health-card/);
  assert.match(health,/ui-status-badge ui-status-badge--brand/);
  assert.match(health,/ui-metric-card health-component/);
  assert.match(health,/ui-button ui-button--secondary/);
  assert.doesNotMatch(health,/card glass|health-component unavailable/);
});

test("settings and progress screens call the shared production primitives",()=>{
  assert.match(app,/return SettingsRow\(label/);
  assert.match(app,/ToggleRow\("Show relationship health"/);
  assert.match(app,/ToggleRow\("Archive after 30 inactive days"/);
  assert.match(app,/ToggleRow\("Daily nudge"/);
  assert.match(app,/ProgressBar\(current,\{label:`\$\{item\.name\} progress`/);
});

test("field helper assigns canonical input, select, and textarea classes",()=>{
  assert.match(app,/const className=kind\?`ui-\$\{kind\}`/);
  assert.match(styles,/\.ui-input, \.ui-select, \.ui-textarea/);
});

test("mobile destinations retain stable width and touch-size action controls",()=>{
  assert.match(styles,/html, body \{ scrollbar-width: none; \}/);
  assert.match(styles,/html::-webkit-scrollbar, body::-webkit-scrollbar/);
  assert.match(styles,/\.pipeline-home,\n\.insights-home \{ padding-top: 0; \}/);
  assert.match(styles,/\.profile-timeline-event__actions \.ui-icon-button \{ width: 44px; height: 44px; min-width: 44px;/);
  assert.match(styles,/\.insights-places > header button \{ min-width: 44px; min-height: 44px;/);
  assert.match(styles,/\.quick-capture-wizard__back \{ width: 44px; height: 44px; min-width: 44px; min-height: 44px; \}/);
  assert.match(styles,/\.prospect-stage__open \{ min-height: 44px; \}/);
});
