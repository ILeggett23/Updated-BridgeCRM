import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = fs.readFileSync(path.join(root, "src", "app.js"), "utf8");

const between = (start, end) => app.slice(app.indexOf(start), app.indexOf(end));

test("form date inputs fail closed before any contact, place, or log mutation", () => {
  assert.match(app, /function safeISO\(value/);
  const addContact = between("function handleAddContact", "function downloadBlob");
  assert.match(addContact, /if\(!safeISO\(conversationDate\)\)/);
  assert.match(addContact, /if\(followUpInput&&!followUpDate\)/);
  assert.match(addContact, /if\(checkBackInput&&!checkBackDate\)/);
  assert.ok(addContact.indexOf("if(!safeISO(conversationDate))") < addContact.indexOf("quickCapturePlace(form)"));
  const communication = between("function bindCommunicationLogEvents", 'if ("serviceWorker" in navigator)');
  assert.match(communication, /const occurredAt=quickCaptureISO\(f\.get\('conversationDate'\)\);if\(!occurredAt\)/);
  assert.ok(communication.indexOf("if(!occurredAt)") < communication.indexOf("Object.assign(log,"));
});

test("duplicate conversation confirmation preserves captured relationship inputs without pre-mutating places", () => {
  const handler = between("function handleAddContact", "function downloadBlob");
  const duplicate = handler.indexOf("if(duplicate){");
  assert.ok(duplicate > 0);
  assert.ok(handler.indexOf("quickCapturePlace(form)") > duplicate);
  assert.match(handler, /applyQuickCaptureDetails\(duplicate,form,conversationDate,'add-duplicate'\)/);
  assert.match(handler, /duplicate\.conversations\.push/);
  assert.match(handler, /clearConversationDraft\(\)/);
});

test("authenticated legacy scorecard revocation sends the management token and async operations reject stale completions", () => {
  const revoke = between("async function revokeScorecardLink", "function bindScorecardShareEvents");
  assert.match(revoke, /X-Bridge-Management-Token/);
  assert.match(revoke, /accountClient\.request\(path,options\)/);
  const scorecard = between("function bindScorecardShareEvents", "function updateNewRoleFields");
  assert.match(scorecard, /if\(ui\.scorecardShareBusy\)return/);
  assert.match(scorecard, /const operation=\+\+scorecardOperation/);
  assert.match(scorecard, /if\(operation!==scorecardOperation\)return/);
  const settings = between("function bindSettingsEvents", "function bindProfileCollapsingHeader");
  assert.match(settings, /if\(settingsSaveInProgress\|\|ui\.accountBusy\)return/);
  assert.match(settings, /settingsSaveInProgress=true/);
  assert.match(settings, /settingsSaveInProgress=false/);
});

test("settings and scorecard close paths clear drafts/results when routed screens reopen", () => {
  const closeSettings = between("function closeSettings", "function closeReleaseNotes");
  assert.match(closeSettings, /ui\.settingsExcludedDatesDraft=null/);
  assert.match(closeSettings, /ui\.settingsRestRulesDraft=null/);
  const closeScorecard = between("function closeScorecardShare", "function closeSettings");
  assert.match(closeScorecard, /ui\.scorecardCreated = null/);
  assert.match(closeScorecard, /scorecardOperation \+= 1/);
  const route = between("function applyPresentationRoute", "function navigatePresentation");
  assert.match(route, /previousScreen === "settings"/);
  assert.match(route, /previousScreen === "scorecard"/);
});
