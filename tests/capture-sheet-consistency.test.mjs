import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const app=fs.readFileSync(path.join(root,"src/app.js"),"utf8");
const styles=fs.readFileSync(path.join(root,"src/styles.css"),"utf8");

test("Conversation, Follow-up, and Log Text share the capture sheet shell",()=>{
  const quick=app.slice(app.indexOf("function quickCreateModal"),app.indexOf("function closeQuickCreate"));
  const log=app.slice(app.indexOf("function communicationLogModal"),app.indexOf("function clearContactEdit"));
  for(const contract of ["capture-sheet-backdrop","capture-sheet","capture-sheet-head","capture-sheet-body"]){
    assert.ok(quick.includes(contract),`Quick Capture missing ${contract}`);
    assert.ok(log.includes(contract),`Log Text missing ${contract}`);
  }
  assert.match(quick,/action:"Follow-up"|action:"Follow-up"/);
  assert.match(quick,/titles=\{[^}]*conversation:"Conversation"[^}]*action:"Follow-up"/);
});

test("shared capture shell normalizes backdrop, handle, header, close, padding, and safe radius",()=>{
  assert.match(styles,/\.capture-sheet-backdrop \{[^}]*background: rgba\(27,25,19,\.35\)/);
  assert.match(styles,/\.capture-sheet::before \{[^}]*width: 36px; height: 4px/);
  assert.match(styles,/\.capture-sheet \.capture-sheet-head h2 \{[^}]*font-size: 21px/);
  assert.match(styles,/\.capture-sheet \.capture-sheet-head \.ui-icon-button \{[^}]*width: 44px; height: 44px;[^}]*border: 0;/);
  assert.match(styles,/\.capture-sheet \.capture-sheet-body \{[^}]*padding-inline: var\(--space-5\);[^}]*overflow-y: auto/);
  assert.match(styles,/@media \(max-width: 767px\) \{ \.capture-sheet \{ border-radius: 26px 26px 0 0; \} \}/);
});
