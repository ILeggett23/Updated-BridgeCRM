import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const app=fs.readFileSync(path.join(root,"src/app.js"),"utf8");
const styles=fs.readFileSync(path.join(root,"src/styles.css"),"utf8");
const between=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end));

test("notification delivery models every real permission and device state",()=>{
  const model=between("function notificationDeliveryState","function settingsNavigationRow");
  for(const kind of ["unsupported","blocked","install","checking","active","granted","default"]){
    assert.match(model,new RegExp(`kind:\"${kind}\"`));
  }
  assert.match(model,/permission===\"denied\"\|\|pushSubscriptionState===\"blocked\"/);
  assert.match(model,/permission===\"granted\"&&pushSubscriptionState===\"active\"/);
});

test("notification permission and subscription changes drive the persisted production path",()=>{
  const refresh=between("async function refreshPushSubscriptionState","async function enableBackgroundPush");
  const enable=between("async function enableBackgroundPush","async function disableBackgroundPush");
  assert.match(refresh,/permission === \"denied\"/);
  assert.match(refresh,/subscription && permission === \"granted\" \? \"active\" : \"inactive\"/);
  assert.match(enable,/Notification\.requestPermission\(\)/);
  assert.match(enable,/pushManager\.subscribe/);
  assert.match(enable,/registerHostedSubscription/);
  assert.match(enable,/syncHostedReminderSchedule/);
});

test("unavailable notification controls are honest, disabled, and free of engineering copy",()=>{
  const screen=between("function notificationSettings","function detailItem");
  assert.doesNotMatch(screen,/status-dot|production delivery path|registered for hosted/i);
  assert.match(screen,/disabled:!active/);
  assert.match(screen,/active&&s\.dailyReminderEnabled/);
  assert.match(screen,/active&&s\.followUpNotifications/);
  assert.match(screen,/Enable reminders on this device to adjust delivery/);
  assert.match(styles,/\.settings-notification-status \{[^}]*grid-template-columns: minmax\(0,1fr\)/);
});
