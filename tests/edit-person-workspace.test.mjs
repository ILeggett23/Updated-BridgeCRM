import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const app=fs.readFileSync(path.join(root,"src/app.js"),"utf8");
const styles=fs.readFileSync(path.join(root,"src/styles.css"),"utf8");

test("Edit Person expresses place creation accurately and gates favorite state",()=>{
  const screen=app.slice(app.indexOf("function contactInformation"),app.indexOf("function contactHealthCard"));
  assert.match(screen,/field\("Where we met"/);
  assert.match(screen,/field\("Add a new place"/);
  assert.match(screen,/data-edit-new-place-favorite hidden/);
  assert.match(screen,/name="favoritePlace" disabled/);
  assert.doesNotMatch(screen,/Create or rename place|Optional new place/);
  assert.doesNotMatch(screen,/profile-editor-note|pipeline history remains accurate/i);
});

test("existing place selection and same-name creation cannot create duplicate place records",()=>{
  const place=app.slice(app.indexOf("function quickCapturePlace"),app.indexOf("function quickCaptureISO"));
  const binding=app.slice(app.indexOf("const editNewPlaceInput"),app.indexOf("$('#cancelContactInfoEdit')"));
  assert.match(place,/state\.places\.find\(item=>item\.name\.toLowerCase\(\)===newName\.toLowerCase\(\)\)/);
  assert.match(place,/else if\(placeId\)/);
  assert.match(binding,/event\.target\.value&&editNewPlaceInput/);
  assert.match(binding,/checkbox\.disabled=!active/);
});

test("Edit Person leaves pipeline state and history untouched",()=>{
  const submit=app.slice(app.indexOf("$('#contactInfoForm')?.addEventListener('submit'"),app.indexOf("$('#personalInfoForm')"));
  assert.match(submit,/pipelineLocked=PIPELINE_STAGES\.some/);
  assert.match(submit,/pipeline stage before changing this role/);
  assert.doesNotMatch(submit,/setPipelineStage|normalizePipelineStages|stageEvents|stageDates|c\.stages\[/);
});

test("Edit Person uses a simple mobile action area",()=>{
  assert.match(styles,/\.relationship-profile--editor \.contact-edit-actions \{[^}]*display: grid;[^}]*border: 0;/);
  assert.match(styles,/\.relationship-profile--editor \.contact-edit-actions \.button \{ width: 100%; min-height: 50px; \}/);
});
