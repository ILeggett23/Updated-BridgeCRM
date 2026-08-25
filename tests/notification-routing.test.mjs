import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workerURL = new URL("../dist/server/index.js", import.meta.url);
workerURL.searchParams.set("notification-routing", String(Date.now()));
const { bridgeAppURL, remindersForSubscription } = await import(workerURL.href);
const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../src/sw.js", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../src/manifest.webmanifest", import.meta.url), "utf8"));

const env = { PUBLIC_APP_URL: "https://ileggett23.github.io/Updated-BridgeCRM/" };

test("hosted reminder URLs stay inside the GitHub Pages project path", () => {
  const target = new URL(bridgeAppURL(env, {
    page: "followups",
    contact: "contact-42",
    followUp: "followup-7"
  }));
  assert.equal(target.origin, "https://ileggett23.github.io");
  assert.equal(target.pathname, "/Updated-BridgeCRM/");
  assert.equal(target.searchParams.get("page"), "followups");
  assert.equal(target.searchParams.get("contact"), "contact-42");
  assert.equal(target.searchParams.get("followUp"), "followup-7");
  assert.equal(target.searchParams.get("notification"), "1");
});

test("scheduled follow-ups carry the exact contact and follow-up destination", () => {
  const row = {
    endpoint: "https://push.example/subscription-123",
    time_zone: "America/Chicago",
    schedule_json: JSON.stringify({
      notificationsEnabled: true,
      followUpNotifications: true,
      dailyReminderEnabled: false,
      followUps: [{
        id: "followup-7",
        contactId: "contact-42",
        contactName: "Taylor",
        dueDate: "2026-07-28T12:00:00.000Z",
        note: "Reconnect"
      }]
    })
  };
  const reminders = remindersForSubscription(row, env, new Date("2026-07-29T12:00:00.000Z"));
  assert.equal(reminders.length, 1);
  const target = new URL(reminders[0].url);
  assert.equal(target.pathname, "/Updated-BridgeCRM/");
  assert.equal(target.searchParams.get("contact"), "contact-42");
  assert.equal(target.searchParams.get("followUp"), "followup-7");
});

test("foreground follow-up reminders use the same exact in-app destination", () => {
  const reminderSource = appSource.slice(
    appSource.indexOf("async function checkReminders"),
    appSource.indexOf("function startReminderChecks")
  );
  assert.match(reminderSource, /page=followups&contact=\$\{encodeURIComponent\(event\.contact\.id\)\}&followUp=\$\{encodeURIComponent\(event\.followUp\.id\)\}&notification=1/);
});

test("the PWA constrains click targets and routes warm launches in-app", () => {
  assert.match(serviceWorker, /candidate\.origin !== APP_ROOT\.origin/);
  assert.match(serviceWorker, /candidate\.pathname\.startsWith\(rootPath\)/);
  assert.match(serviceWorker, /windows\.filter\(isBridgeClient\)/);
  assert.match(serviceWorker, /bridge-notification-navigation/);
  assert.match(serviceWorker, /existing\.postMessage/);
  assert.match(appSource, /navigator\.serviceWorker\.addEventListener\("message"/);
  assert.match(appSource, /consumeNotificationNavigation/);
  assert.match(appSource, /That follow-up is no longer active/);
  assert.match(appSource, /contactId: String\(contact\.id\)/);
});

test("warm notification navigation waits for the active modal without discarding its draft", () => {
  const messageHandler = appSource.slice(
    appSource.indexOf('navigator.serviceWorker.addEventListener("message"'),
    appSource.indexOf('window.addEventListener("load"', appSource.indexOf('navigator.serviceWorker.addEventListener("message"'))
  );
  const renderTail = appSource.slice(
    appSource.indexOf("if (ui.releaseNotesOpen) bindReleaseNotesEvents()"),
    appSource.indexOf("function renderSharedScorecard")
  );
  const blocker = appSource.slice(
    appSource.indexOf("function blockingModalOpen"),
    appSource.indexOf("function releaseNotesModal")
  );
  const deferredNavigation = appSource.slice(
    appSource.indexOf("function deferNotificationNavigation"),
    appSource.indexOf("function resumePendingNotificationNavigation")
  );
  const sharedDialogClose = appSource.slice(
    appSource.indexOf("const closeDialog = dialog =>"),
    appSource.indexOf("const activateTab", appSource.indexOf("const closeDialog = dialog =>"))
  );

  assert.match(messageHandler, /if \(!stateHydrated\)[\s\S]*pendingNotificationNavigationURL = String\(event\.data\.url\);[\s\S]*return;/);
  assert.match(messageHandler, /if \(blockingModalOpen\(\)\)[\s\S]*deferNotificationNavigation\(event\.data\.url\);[\s\S]*return;/);
  assert.match(messageHandler, /deferNotificationNavigation\(event\.data\.url\)/);
  assert.match(appSource, /pendingNotificationNavigationURL = String\(url \|\| ""\)/);
  assert.doesNotMatch(deferredNavigation, /render\(/);
  assert.match(renderTail, /pendingNotificationNavigationURL && stateHydrated && !blockingModalOpen\(\)/);
  assert.match(renderTail, /setTimeout\(resumePendingNotificationNavigation, 0\)/);
  assert.match(sharedDialogClose, /setTimeout\(resumePendingNotificationNavigation, 0\)/);
  assert.match(blocker, /ui\.quickCreateOpen/);
  assert.match(blocker, /ui\.peopleFiltersOpen/);
  assert.match(blocker, /ui\.pipelineStageDetail/);
  assert.match(blocker, /ui\.customerPipelineStageDetail/);
  assert.match(blocker, /ui\.releaseNotesOpen/);
});

test("the install manifest launches relative to either root or repository hosting", () => {
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
});

test("daily reminder routes open global Capture on cold and warm launches", () => {
  assert.match(appSource, /if \(requestedLaunchPage === "add"\) \{[\s\S]*ui\.page = "dashboard";[\s\S]*ui\.quickCreateOpen = true;/);
  assert.match(appSource, /if \(requestedPage === "add"\) \{[\s\S]*ui\.quickCreateOpen = true;[\s\S]*ui\.quickCreateMode = null;/);
  assert.doesNotMatch(appSource, /if \(ui\.page === "add"\) return renderDashboard\(\)/);
});
