import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),"..");
const app=fs.readFileSync(path.join(root,"src/app.js"),"utf8");
const styles=fs.readFileSync(path.join(root,"src/styles.css"),"utf8");

function sourceBetween(start,end) {
  return app.slice(app.indexOf(start),app.indexOf(end));
}

test("Phase 15D activity composer keeps reference ordering and production-only activities",()=>{
  const modal=sourceBetween("function quickCreateModal","function closeQuickCreate");
  const ordered=["conversation","call","text","meeting","action","contact"];
  let cursor=-1;
  for(const mode of ordered){const next=modal.indexOf(`[\"${mode}\"`);assert.ok(next>cursor,`${mode} should retain composer order`);cursor=next;}
  assert.match(modal,/class="capture-other-action"[^>]+data-quick-mode="note"/);
  assert.match(modal,/Other activity · note, MSA, or DTM/);
  assert.match(app,/applyQuickCaptureDetails\(contact,form,occurredAt,'quick-other-activity'\)/);
});

test("Conversation and Meeting use the reference atomic four-step form",()=>{
  const conversation=sourceBetween("function quickCaptureConversationForm","function quickCaptureCommunicationForm");
  assert.match(conversation,/const steps=\["person","place","learned","next"\]/);
  assert.match(conversation,/id="quickConversationForm"/);
  assert.equal((conversation.match(/<form/g)||[]).length,1);
  assert.match(conversation,/quickCapturePersonPicker\(contacts,\{allowNew:true\}\)/);
  assert.match(conversation,/quickCapturePlacePicker\(\)/);
  assert.match(conversation,/quickCaptureNextAction\(\)/);
  assert.match(conversation,/quickCaptureTrackingFields\(\)/);
  assert.match(conversation,/Date, stage, and activity details/);
});

test("Real person and place pickers never rely on demo records",()=>{
  const people=sourceBetween("function quickCaptureRecentContacts","function quickCapturePlaceActivityAt");
  const places=sourceBetween("function quickCapturePlaceActivityAt","function quickCaptureWizardFooter");
  assert.match(people,/peopleActivityAt/);
  assert.match(people,/contacts/);
  assert.match(people,/contacts\.filter\(contact=>!recentIds\.has/);
  assert.match(people,/data-capture-recent/);
  assert.match(people,/data-capture-new-person/);
  assert.match(places,/state\.places/);
  assert.match(places,/contact\.placeId/);
  assert.match(places,/data-capture-new-place/);
  assert.doesNotMatch(`${people}${places}`,/Jasmine|Mario|Onyx Coffee|mock|seed/i);
});

test("Step validation protects required data and final submission retains production writes",()=>{
  const validation=sourceBetween("function validateQuickCaptureStep","function setQuickCaptureStep");
  const binding=sourceBetween("function bindQuickCreateEvents","function renderPage");
  assert.match(validation,/Choose a person or add a new person name/);
  assert.match(validation,/Add what happened before continuing/);
  assert.match(validation,/Choose a valid follow-up time/);
  assert.match(binding,/duplicate=isCallablePhone/);
  assert.match(binding,/applyQuickCaptureDetails\(contact,form,occurredAt/);
  assert.match(binding,/isCountedConversation:true/);
  assert.match(binding,/queueSave\(meeting\?'Meeting saved':'Conversation saved'\)/);
});

test("Wizard presentation supports safe areas, reduced motion, and touch-sized controls",()=>{
  for(const contract of [
    ".quick-capture-wizard__progress",
    ".quick-capture-wizard__footer",
    "calc(var(--space-5) + var(--safe-bottom))",
    "min-height: 50px",
    "@media (prefers-reduced-motion: reduce)",
    ".quick-capture-picker__row",
    ".quick-capture-next"
  ]) assert.ok(styles.includes(contract),`missing ${contract}`);
  assert.match(app,/quickCreateFocusReturn\?\.isConnected\?quickCreateFocusReturn:\$\('\[aria-label="Capture what happened"\]'\)/);
});
