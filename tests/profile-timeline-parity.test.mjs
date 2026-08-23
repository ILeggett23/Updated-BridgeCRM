import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const app=fs.readFileSync(path.join(root,"src/app.js"),"utf8");
const styles=fs.readFileSync(path.join(root,"src/styles.css"),"utf8");

test("relationship timeline uses semantic event icons without confusing Conversation with edit",()=>{
  const icons=app.slice(app.indexOf("function profileTimelineIconName"),app.indexOf("function profileTimelineEvent"));
  assert.match(icons,/communicationType==="Call"\)return "phone"/);
  assert.match(icons,/communicationType==="Text"\)return "chat"/);
  assert.match(icons,/isCountedConversation\?"chat":"pencilLine"/);
  assert.match(icons,/event\.kind==="followup"\)return "flag"/);
  assert.match(icons,/event\.kind==="pipeline"\)return "arrowUpRight"/);
  assert.match(icons,/return "handshake"/);
});

test("relationship timeline shares the redesign node and rail geometry",()=>{
  assert.match(styles,/\.profile-timeline__list::before \{[^}]*left: 9px;[^}]*\}/);
  assert.match(styles,/\.profile-timeline-event \{[^}]*grid-template-columns: 20px minmax\(0, 1fr\) auto;[^}]*gap: 12px;[^}]*\}/);
  assert.match(styles,/\.profile-timeline-event__icon \{[^}]*width: 19px; height: 19px;[^}]*margin-top: 2px;[^}]*\}/);
  assert.match(styles,/\.profile-timeline-event__icon \.app-icon \{ width: 11px; height: 11px; stroke-width: 2; \}/);
  assert.match(styles,/\.profile-timeline-event header strong \{[^}]*overflow-wrap: anywhere;[^}]*\}/);
  assert.match(styles,/\.profile-timeline-event__actions \.ui-icon-button \{ width: 44px; height: 44px; min-width: 44px;/);
});
