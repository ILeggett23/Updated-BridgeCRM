import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const app=fs.readFileSync(path.join(root,"src","app.js"),"utf8");
const styles=fs.readFileSync(path.join(root,"src","styles.css"),"utf8");
const between=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end));

test("Settings root has one canonical destination per concern",()=>{
  const rootContent=between("function settingsRootContent","function settingsRestControls");
  for(const section of ["profile","goals","notifications","preferences","health","archive","data","backup","privacy","about"]){
    assert.equal((rootContent.match(new RegExp(`"${section}"`,"g"))||[]).length,1,`${section} should appear once`);
  }
  assert.equal((rootContent.match(/"account"/g)||[]).length,1);
  assert.doesNotMatch(rootContent,/Streak & achievements|Conversation reminders|Follow-up reminders/);
});

test("Settings does not duplicate the Achievements entry",()=>{
  const goals=between("function settingsGoalsContent","function settingsPreferencesContent");
  assert.doesNotMatch(goals,/data-open-achievements|View unlocked milestones|settings-linked-action/);
  const progress=between("function renderGoalsScreen","function renderPresentationScreen");
  assert.match(progress,/goals-achievement-list/);
  assert.match(app,/data-open-goals/);
});

test("Settings ownership separates workflow, health, archive, data, and backup",()=>{
  const workflow=between("function settingsPreferencesContent","function settingsHealthContent");
  const health=between("function settingsHealthContent","function settingsArchiveContent");
  const archive=between("function settingsArchiveContent","function settingsDataContent");
  const data=between("function settingsDataContent","function settingsBackupContent");
  const backup=between("function settingsBackupContent","function settingsAccountContent");
  assert.match(workflow,/defaultFollowUpDays/);
  assert.match(workflow,/weekStart/);
  assert.doesNotMatch(workflow,/autoArchiveInactive|healthScoresVisible/);
  assert.match(health,/relationshipHealthSettings/);
  assert.match(archive,/autoArchiveInactive/);
  assert.doesNotMatch(data,/data-settings-section-open="backup"/);
  assert.match(backup,/dataAndBackupSettings/);
});

test("Profile and account security no longer emit competing controls",()=>{
  const profile=between("function settingsProfileContent","function settingsGoalsContent");
  const account=between("function accountWorkspaceSettings","function accountSessionRow");
  assert.doesNotMatch(profile,/changeAccountPassword|signOutAccount|account-session-list/);
  assert.match(account,/id="changeAccountPassword"/);
  assert.match(account,/id="signOutAccount"/);
  assert.match(account,/data-settings-section-open="sessions"/);
});

test("Privacy and About present actions instead of duplicate settings facts",()=>{
  const privacy=between("function settingsPrivacyContent","function settingsAboutContent");
  const about=between("function settingsAboutContent","function settingsPageForm");
  assert.match(privacy,/data-open-scorecard-settings/);
  assert.doesNotMatch(privacy,/Link lifetime|Contact details|Account deletion/);
  assert.match(about,/Email feedback about Bridge/);
  assert.match(about,/Email a bug report/);
  assert.match(styles,/\.settings-reference-rows > :is\(button,a,\.ui-settings-row\)/);
});

test("Legacy compatibility fields remain stored but unexposed",()=>{
  assert.match(app,/healthNotificationsEnabled/);
  assert.doesNotMatch(app,/name="healthNotificationsEnabled"/);
  assert.match(app,/delete next\.settings\.theme/);
  assert.doesNotMatch(app,/name="theme"|name="accent"|name="compact"/);
});
