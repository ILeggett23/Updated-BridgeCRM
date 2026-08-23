import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const app=fs.readFileSync(path.join(root,"src/app.js"),"utf8");
const styles=fs.readFileSync(path.join(root,"src/styles.css"),"utf8");

test("Personal Info is a flat relationship workspace with one back action",()=>{
  const screen=app.slice(app.indexOf("function contactPersonalInfo"),app.indexOf("function contactTracking"));
  const modal=app.slice(app.indexOf("function contactModal"),app.indexOf("function editStageCheck"));
  assert.match(screen,/class="personal-info-workspace"/);
  assert.match(screen,/id="personalInfoForm"/);
  assert.doesNotMatch(screen,/card glass|personal-info-card/);
  assert.match(modal,/relationship-personal-info/);
  assert.doesNotMatch(modal,/contactPersonalInfo\(c\).*Back to profile/);
  assert.match(app,/data-contact-detail-tab="overview" aria-label="Back to profile"/);
});

test("Personal Info saves only its dedicated field and guards unsaved navigation",()=>{
  const binding=app.slice(app.indexOf("$('#personalInfoForm')"),app.indexOf("const cadenceForm"));
  const guard=app.slice(app.indexOf("function clearPersonalInfoDraft"),app.indexOf("function closeContactDetail"));
  assert.match(binding,/c\.personalInfo=String\(f\.get\('personalInfo'\)/);
  assert.doesNotMatch(binding,/conversations|notes|pipeline|stage/);
  assert.match(binding,/ui\.personalInfoDirty=true/);
  assert.match(binding,/clearPersonalInfoDraft\(\)/);
  assert.match(guard,/Discard Personal Info changes/);
  assert.match(app,/if\(ui\.personalInfoDirty\)\{discardPersonalInfoDraft\(presentationBack\)/);
});

test("Personal Info form remains usable above the keyboard and bottom navigation",()=>{
  assert.match(styles,/\.personal-info-workspace textarea \{[^}]*min-height: 188px/);
  assert.match(styles,/\.personal-info-actions \{[^}]*position: sticky;[^}]*bottom: calc\(var\(--nav-height\)/);
  assert.match(styles,/\.personal-info-actions \.button \{ width: 100%; min-height: 50px; \}/);
});
