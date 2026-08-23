import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const app=fs.readFileSync(path.join(root,"src/app.js"),"utf8");
const styles=fs.readFileSync(path.join(root,"src/styles.css"),"utf8");

test("all repaired forms opt into the shared field and action contract",()=>{
  for(const form of ["settingsForm","personalInfoForm","contactInfoForm","communicationLogForm","contactCadenceForm"]){
    assert.ok(app.includes(`id="${form}"`),`missing ${form}`);
  }
  assert.match(styles,/Shared mobile form contract/);
  assert.match(styles,/\.relationship-personal-info,[\s\S]*#contactInfoForm,[\s\S]*\.capture-detail-form,[\s\S]*\.contact-cadence-form\) \.field/);
  assert.match(styles,/min-height: 48px;[^}]*border-radius: var\(--radius-md\);[^}]*font-size: 16px/);
});

test("shared forms remain reachable above keyboards and the bottom navigation",()=>{
  assert.match(styles,/scroll-margin-bottom: calc\(var\(--nav-height\) \+ var\(--safe-bottom\) \+ 82px\)/);
  assert.match(styles,/\.settings-screen:not\(\.settings-screen--root\) \.hn-settings-save \{[^}]*position: sticky;[^}]*bottom: calc\(var\(--nav-height\)/);
  assert.match(styles,/\.relationship-personal-info \.personal-info-actions \{ position: static/);
  assert.match(styles,/\.capture-detail-actions \{[^}]*flex: 0 0 auto;[^}]*safe-bottom/);
  assert.doesNotMatch(styles,/\.capture-detail-actions \{[^}]*position: sticky/);
  assert.match(styles,/\.relationship-profile--editor \.contact-edit-actions \{[^}]*position: sticky/);
});

test("cadence fields reserve a distinct unit column at every mobile width",()=>{
  assert.match(styles,/\.cadence-input \{[^}]*width: 100%;[^}]*grid-template-columns: minmax\(0,1fr\) auto/);
  assert.match(styles,/\.cadence-input input \{ width: 100%; \}/);
  assert.match(styles,/\.cadence-input:focus-within \{ border-color: var\(--color-text-primary\); \}/);
});
