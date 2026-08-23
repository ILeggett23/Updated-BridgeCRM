import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const app=fs.readFileSync(path.join(root,"src/app.js"),"utf8");
const styles=fs.readFileSync(path.join(root,"src/styles.css"),"utf8");

test("Log Text follows the intended mobile field order and one-column breakpoint",()=>{
  const modal=app.slice(app.indexOf("function communicationLogModal"),app.indexOf("function clearContactEdit"));
  const date=modal.indexOf('field("Date and time"');
  const direction=modal.indexOf('field("Direction"');
  const outcome=modal.indexOf('field("Outcome"');
  const notes=modal.indexOf('field(type==="Text"?"What did you discuss?"');
  assert.ok(date<direction&&direction<outcome&&outcome<notes);
  assert.match(styles,/@media \(max-width: 600px\) \{[\s\S]*\.capture-detail-fields \{ grid-template-columns: minmax\(0,1fr\); \}/);
});

test("capture detail sheet owns scrolling, safe areas, and visible actions",()=>{
  assert.match(styles,/\.capture-detail-sheet \{[^}]*height: min\(92dvh, 780px\);[^}]*display: flex;[^}]*overflow: hidden/);
  assert.match(styles,/\.capture-detail-sheet \.capture-sheet-body \{[^}]*flex: 1 1 auto;[^}]*scroll-padding-bottom:/);
  assert.match(styles,/\.capture-detail-actions \{[^}]*position: sticky; bottom: 0;/);
  assert.match(styles,/\.capture-detail-sheet \.modal-head \.ui-icon-button \{[^}]*border: 0;[^}]*border-radius: 50%/);
  assert.match(app,/transientModalOpen=Boolean\([^\n]*ui\.communicationContactId/);
  assert.match(styles,/html\.modal-open, body\.modal-open \{ overflow: hidden; overscroll-behavior: none; \}/);
});

test("Cancel and Close discard while Save retains production timeline and analytics writes",()=>{
  const binding=app.slice(app.indexOf("function bindCommunicationLogEvents"),app.indexOf('if ("serviceWorker" in navigator'));
  assert.match(binding,/\$\$\('\.close-communication-log'\)[\s\S]*ui\.communicationContactId=null/);
  assert.match(binding,/Object\.assign\(log,/);
  assert.match(binding,/isCountedConversation:false/);
  assert.match(binding,/queueSave\(isNew\?`\$\{communicationType\} logged`:'Communication log updated'\)/);
  assert.doesNotMatch(app,/Communication logs never increase the Conversations metric/);
});

test("routed relationship history binds its visible communication actions",()=>{
  const history=app.slice(app.indexOf("function bindActivityHistoryEvents"),app.indexOf("function bindCommunicationLogEvents"));
  assert.match(history,/\$\$\('\.edit-communication-log'\)/);
  assert.match(history,/openCommunicationLog\(contact\.id,log\.communicationType/);
  assert.match(history,/ui\.routedScreen!=="person-timeline"/);
  assert.match(history,/\$\$\('\.delete-log'\)/);
});
