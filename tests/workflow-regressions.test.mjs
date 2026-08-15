import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

await import(new URL("../src/contact-logic.js", import.meta.url));
const contactLogic = globalThis.BridgeLogic;
const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const stylesSource = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

const day = 24 * 60 * 60 * 1000;
const oldContact = (id, now, followUps) => ({
  id,
  role: "Prospect",
  stages: {},
  stageDates: {},
  stageEvents: [],
  followUps,
  conversations: [],
  createdAt: new Date(now - 60 * day).toISOString(),
  updatedAt: new Date(now - 60 * day).toISOString(),
  archivedAt: null,
  isFilteredOut: false
});

test("auto-archive blocks only scheduled or open follow-ups and retains closed lifecycle history", () => {
  const now = new Date("2026-08-11T12:00:00.000Z").getTime();
  const oldDate = new Date(now - 45 * day).toISOString();
  const recentDate = new Date(now - day).toISOString();
  const contacts = [
    oldContact("scheduled", now, [{ status: "scheduled", createdAt: oldDate, dueDate: oldDate }]),
    oldContact("open", now, [{ status: "open", createdAt: oldDate, dueDate: oldDate }]),
    oldContact("legacy-open", now, [{ createdAt: oldDate, dueDate: oldDate }]),
    oldContact("completed", now, [{ status: "completed", createdAt: oldDate, completedAt: oldDate }]),
    oldContact("canceled", now, [{ status: "canceled", createdAt: oldDate, canceledAt: oldDate }]),
    oldContact("deleted", now, [{ status: "deleted", createdAt: oldDate, deletedAt: oldDate }]),
    oldContact("legacy-completed", now, [{ createdAt: oldDate, completedAt: oldDate }]),
    oldContact("legacy-canceled", now, [{ createdAt: oldDate, canceledAt: oldDate }]),
    oldContact("legacy-deleted", now, [{ createdAt: oldDate, deletedAt: oldDate }]),
    oldContact("recent-canceled", now, [{ status: "canceled", createdAt: oldDate, canceledAt: recentDate }]),
    oldContact("recent-deleted", now, [{ status: "deleted", createdAt: oldDate, deletedAt: recentDate }]),
    oldContact("recent-followup-update", now, [{ status: "canceled", createdAt: oldDate, updatedAt: recentDate }])
  ];

  assert.equal(contactLogic.archiveInactiveContacts(contacts, true, now), 6);
  assert.deepEqual(
    contacts.filter(contact => !contact.archivedAt).map(contact => contact.id),
    ["scheduled", "open", "legacy-open", "recent-canceled", "recent-deleted", "recent-followup-update"]
  );
  assert.ok(contacts.filter(contact => contact.archivedAt).every(contact => contact.followUps.length === 1));
});

test("Person Profile reschedules only its earliest active follow-up in place", () => {
  const handler = appSource.slice(
    appSource.indexOf("$('#setFollowUpForm')?.addEventListener('submit'"),
    appSource.indexOf("$('#completeFollowUp')?.addEventListener('click'")
  );
  const reschedule = appSource.slice(
    appSource.indexOf("function rescheduleFollowUp"),
    appSource.indexOf("function replaceScheduledFollowUp")
  );

  assert.match(handler, /c\.followUps\.filter\(isScheduledFollowUp\)\.sort/);
  assert.match(handler, /if\(active\)rescheduleFollowUp\(active,dueDate\)/);
  assert.match(handler, /else createFollowUp\(c,dueDate,'Follow up'\)/);
  assert.doesNotMatch(handler, /replaceScheduledFollowUp/);
  assert.match(reschedule, /item\.rescheduleHistory\.push/);
  assert.match(reschedule, /item\.notificationSentAt = null/);
  assert.doesNotMatch(reschedule, /item\.id\s*=/);
});

test("existing-person Quick Capture exposes and persists relationship details consistently", () => {
  const personFields = appSource.slice(
    appSource.indexOf("function quickCapturePersonDetails"),
    appSource.indexOf("function quickCaptureTrackingFields")
  );
  const applyDetails = appSource.slice(
    appSource.indexOf("function applyQuickCaptureDetails"),
    appSource.indexOf("function quickCreateModal")
  );
  const syncFields = appSource.slice(
    appSource.indexOf("function syncQuickCaptureFields"),
    appSource.indexOf("function bindQuickCreateEvents")
  );

  assert.match(personFields, /data-new-person-fields/);
  assert.match(personFields, /quick-capture-person-fields">\$\{newPersonFields\}\$\{field\("Saved place"/);
  assert.match(personFields, /field\("What I Know"/);
  assert.match(applyDetails, /contact\.personalInfo=personalInfo/);
  assert.match(applyDetails, /contact\.placeId=place\.placeId/);
  assert.match(applyDetails, /contact\.checkBackDate=checkBackDate/);
  assert.match(syncFields, /hydrateRelationship/);
  assert.match(syncFields, /form\.elements\.placeId\.value/);
  assert.match(syncFields, /form\.elements\.personalInfo\.value/);
  assert.match(stylesSource, /\[data-new-person-fields\]\[hidden\]/);
});

test("Places overview and detail share the unfiltered all-record model", () => {
  const workspace = appSource.slice(
    appSource.indexOf("function renderContactWorkspace"),
    appSource.indexOf("function contactsLoading")
  );
  const places = appSource.slice(
    appSource.indexOf("function placeMatchesContact"),
    appSource.indexOf("function networkModel")
  );

  assert.match(workspace, /renderPlaces\(connectionState\)/);
  assert.doesNotMatch(workspace, /renderPlaces\(filtered/);
  assert.match(places, /function placeModels\(\)\{const allContacts=state\.contacts/);
  assert.equal((places.match(/placeModels\(\)/g) || []).length, 3);
  assert.doesNotMatch(places, /ui\.search/);
  assert.doesNotMatch(places, /filter\(place=>place\.count/);
  assert.match(places, /EmptyState\("No saved places"/);
});
