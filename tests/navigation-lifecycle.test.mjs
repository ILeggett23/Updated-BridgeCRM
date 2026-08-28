import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

test("all unsaved relationship drafts participate in navigation protection", () => {
  const start = app.indexOf("function hasUnsavedNavigationDraft");
  const end = app.indexOf("function applyPresentationRoute", start);
  assert.ok(start >= 0 && end > start, "navigation dirty-state helper must remain available");
  const helper = app.slice(start, end);
  const check = values => {
    const context = { ui: values.ui, conversationDraftDirty: values.conversationDraftDirty, result: null, Boolean };
    vm.runInNewContext(`${helper}\nresult = hasUnsavedNavigationDraft();`, context);
    return context.result;
  };
  assert.equal(check({ ui: { personalInfoDirty: false, contactEditing: false, contactEditDirty: false }, conversationDraftDirty: false }), false);
  assert.equal(check({ ui: { personalInfoDirty: true, contactEditing: false, contactEditDirty: false }, conversationDraftDirty: false }), true);
  assert.equal(check({ ui: { personalInfoDirty: false, contactEditing: true, contactEditDirty: true }, conversationDraftDirty: false }), true);
  assert.equal(check({ ui: { personalInfoDirty: false, contactEditing: false, contactEditDirty: false }, conversationDraftDirty: true }), true);
});

test("confirmation rerenders preserve contact and Personal Info values until discard", () => {
  const helpers = app.slice(app.indexOf("function captureRelationshipFormDraft"), app.indexOf("function hasUnsavedNavigationDraft"));
  assert.match(helpers, /controls: \[\.\.\.form\.elements\]/);
  assert.match(helpers, /control\.value = saved\.value/);
  const render = app.slice(app.indexOf("function render()"), app.indexOf("function sharedBrand"));
  assert.match(render, /app\.innerHTML =[\s\S]*restoreRelationshipFormDraft\(\)/);
  const bindings = app.slice(app.indexOf("function bindContactModalEvents"), app.indexOf("function bindActivityHistoryEvents"));
  assert.match(bindings, /captureRelationshipFormDraft\(event\.currentTarget\)/);
  assert.match(app, /function clearContactEdit\(\)[^\n]*clearRelationshipFormDraft\("contactInfoForm"\)/);
  assert.match(app, /function clearPersonalInfoDraft\(\)[^\n]*clearRelationshipFormDraft\("personalInfoForm"\)/);
});

test("browser history defers dirty routes, restores the current entry, and replays only after discard", () => {
  const start = app.indexOf("function initializePresentationHistory");
  const end = app.indexOf("initializePresentationHistory();", start);
  const history = app.slice(start, end);
  assert.match(history, /if \(hasUnsavedNavigationDraft\(\)\)/);
  assert.match(history, /pendingHistoryNavigation = \{ url:location\.href, state:event\.state, nextIndex, direction, confirmationOpen:false \}/);
  assert.match(history, /historyNavigationRestoring = true/);
  assert.match(history, /history\.go\(delta\)/);
  assert.match(history, /restorePendingHistoryNavigation\(\)/);
  assert.match(app, /historyNavigationReplaying = true/);
  assert.ok(history.indexOf("if (hasUnsavedNavigationDraft())") < history.lastIndexOf("applyHistoryEvent(event);"), "dirty state must be checked before route application");
});

test("presentation navigation and beforeunload use the same dirty-state contract", () => {
  const navigation = app.slice(app.indexOf("function navigatePresentation"), app.indexOf("function navigateMain"));
  assert.match(navigation, /ui\.contactEditing&&ui\.contactEditDirty/);
  const unloadStart = app.indexOf('window.addEventListener("beforeunload"');
  const unload = app.slice(unloadStart, app.indexOf('window.addEventListener("pagehide"', unloadStart));
  assert.match(unload, /hasUnsavedNavigationDraft\(\)/);
  assert.doesNotMatch(unload, /if \(!conversationDraftDirty\) return/);
});

test("logout cleanup can reach an active worker before it controls the page", () => {
  const logout = app.slice(app.indexOf("function showSignedOutAccount"), app.indexOf("function bindSettingsEvents"));
  assert.match(logout, /navigator\.serviceWorker\?\.controller/);
  assert.match(logout, /navigator\.serviceWorker\?\.ready\?\.then\(sendLogoutToWorker\)/);
  assert.match(logout, /registration\?\.active \|\| navigator\.serviceWorker\?\.controller/);
});

test("warm notifications wait for unsaved relationship edits before replacing the route", () => {
  const message = app.slice(app.indexOf('navigator.serviceWorker.addEventListener("message"'), app.indexOf('startBridge().catch'));
  assert.match(message, /if \(blockingModalOpen\(\)[\s\S]*deferNotificationNavigation\(event\.data\.url\)/);
  assert.match(message, /if \(hasUnsavedNavigationDraft\(\)[\s\S]*deferNotificationNavigation\(event\.data\.url\)/);
  const resume = app.slice(app.indexOf("function resumePendingNotificationNavigation"), app.indexOf("function normalizeState"));
  assert.match(resume, /blockingModalOpen\(\) \|\| hasUnsavedNavigationDraft\(\)/);
  assert.equal((app.match(/pendingNotificationNavigationURL && stateHydrated && !blockingModalOpen\(\) && !hasUnsavedNavigationDraft\(\)/g) || []).length, 2);
});

test("quick Capture snapshots and restores a dirty draft before navigation replay", () => {
  const helperStart = app.indexOf("function clearQuickCreateDraft");
  const helperEnd = app.indexOf("function restorePendingHistoryNavigation", helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart, "quick Capture draft helpers must remain available");

  const makeForm = () => {
    const elements = [
      { name: "contactId", type: "hidden", value: "person-1" },
      { name: "notes", type: "textarea", value: "Draft context" },
      { name: "favoritePlace", type: "checkbox", checked: true, value: "on" }
    ];
    const newPerson = { dataset: {}, hidden: true };
    const newPlace = { dataset: {}, hidden: true };
    return {
      elements,
      step: 0,
      querySelector(selector) {
        if (selector.includes("data-new-person")) return newPerson;
        if (selector.includes("data-capture-new-place-fields")) return newPlace;
        return null;
      },
      querySelectorAll(selector) {
        return selector.includes("data-new-person") ? [newPerson] : [];
      },
      _newPerson: newPerson,
      _newPlace: newPlace
    };
  };

  const context = {
    quickCreateDraft: null,
    quickCreateDraftDirty: false,
    conversationDraftDirty: false,
    ui: { quickCreateOpen: true, quickCreateMode: "conversation", quickCreateStep: 2, personalInfoDirty: false, contactEditing: false, contactEditDirty: false, quickCreateContactId: "person-1" },
    bridgeGuideTutorialActive: () => false,
    syncQuickCaptureFields: () => {},
    syncQuickCapturePickerState: () => {},
    syncQuickCaptureStepAction: () => {},
    setQuickCaptureStep: (form, step) => { form.step = step; },
    requestConfirmation: options => { context.confirmation = options; },
    result: null
  };
  vm.runInNewContext(`${app.slice(helperStart, helperEnd)}\nresult = { captureQuickCreateDraft, restoreQuickCreateDraft, discardQuickCreateDraft, hasUnsavedNavigationDraft, resetQuickCreateSurface };`, context);
  const form = makeForm();
  form._newPerson.dataset.captureNewPersonActive = "true";
  form._newPerson.hidden = false;
  context.result.captureQuickCreateDraft(form);
  assert.equal(context.quickCreateDraftDirty, true);
  assert.equal(context.result.hasUnsavedNavigationDraft(), true);

  const restored = makeForm();
  context.result.restoreQuickCreateDraft(restored);
  assert.equal(restored.elements.find(element => element.name === "notes").value, "Draft context");
  assert.equal(restored.elements.find(element => element.name === "favoritePlace").checked, true);
  assert.equal(restored.step, 2);
  assert.equal(restored._newPerson.hidden, false);

  assert.equal(context.result.discardQuickCreateDraft(() => { context.discarded = true; }), false);
  assert.equal(typeof context.confirmation.onConfirm, "function");
  context.confirmation.onConfirm();
  assert.equal(context.discarded, true);
  assert.equal(context.quickCreateDraftDirty, false);
  assert.equal(context.ui.quickCreateOpen, false);
  assert.equal(context.result.hasUnsavedNavigationDraft(), false);
});

test("quick Capture form events mark edits dirty and restore the captured draft", () => {
  const bind = app.slice(app.indexOf("function bindQuickCreateEvents"), app.indexOf("function renderPage", app.indexOf("function bindQuickCreateEvents")));
  assert.match(bind, /captureQuickCreateDraft\(form\)/);
  assert.match(bind, /restoreQuickCreateDraft\(form\)/);
  assert.match(bind, /form\.addEventListener\('change'/);
});
