import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const foundation = await readFile(new URL("../src/ui-foundation.js", import.meta.url), "utf8");
const analyticsLogic = await readFile(new URL("../src/analytics-logic.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const devServer = await readFile(new URL("../dev.mjs", import.meta.url), "utf8");
const worker = await readFile(new URL("../dist/server/index.js", import.meta.url), "utf8");
const page = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");

test("production worker is a backend-only Cloudflare API", () => {
  assert.match(worker, /Bridge CRM/);
  assert.match(worker, /bridge_state/);
  assert.ok(worker.includes("/api/state"));
  assert.ok(worker.includes('env.BACKEND_ONLY === "true"'));
  assert.ok(worker.includes("defaultAllowedOrigins"));
  assert.ok(worker.includes("https://bridgecrm-human-network.mr-zayway.chatgpt.site"));
  assert.ok(worker.includes("https://ileggett23.github.io"));
  assert.ok(worker.includes("access-control-allow-origin"));
});

test("secure scorecards use a tokenized hosted API and never serialize private contact fields", () => {
  assert.ok(worker.includes("bridge_shared_scorecards"));
  assert.ok(worker.includes("/api/scorecards"));
  assert.ok(worker.includes("management_hash"));
  assert.ok(worker.includes("x-robots-tag"));
  assert.ok(source.includes("scorecardShareModal"));
  assert.ok(source.includes("loadSharedScorecard"));
  assert.match(source, /Phone numbers, notes, follow-ups/);
  assert.ok(source.includes('apiFetch("/api/scorecards"'));
  assert.ok(worker.includes("PUBLIC_APP_URL"));
  assert.ok(worker.includes('new URL("/s/" + createdToken, request.url)'));
  assert.ok(worker.includes('property=\\"og:image\\"'));
  assert.ok(source.includes("const body = encodeURIComponent(url)"));
  assert.equal(source.includes("Here's my Bridge scorecard"), false);
  assert.equal(source.includes("Active links on this device"), false);
  assert.equal(source.includes('name="scorecardExpiry"'), false);
});

test("Analytics uses one share button with privacy-scoped, revocable link and image choices inside its sheet", () => {
  assert.equal((source.match(/id="shareScorecard"/g) || []).length, 1);
  assert.ok(source.includes("Share metrics as image"));
  assert.ok(source.includes("Create share link"));
  assert.ok(source.includes("Message link"));
  assert.ok(source.includes("Revoke link"));
  assert.ok(source.includes("What gets shared?"));
  assert.equal(source.includes("Copy link"), false);
  assert.ok(source.includes("scorecardSnapshot({ includeContacts: false })"));
  assert.ok(source.includes("navigator.canShare?.({ files: [file] })"));
  assert.ok(source.includes('navigator.share({ files: [file], title: "Bridge Scorecard" })'));
  assert.ok(source.includes('const action = event.submitter?.value === "image" ? "image" : "link"'));
  assert.ok(source.includes('scorecardPreviewPNG(scorecard, { format: "image" })'));
  assert.ok(source.includes('canvas.height = isImage ? 1200 : 630'));
  assert.ok(source.includes('["contactCard", "Contacts"'));
  assert.ok(source.includes('["target", "Prospective Customers"'));
  assert.ok(source.includes("drawScorecardIcon("));
  assert.ok(source.includes("const body = encodeURIComponent(url)"));
  assert.ok(source.includes("ui.scorecardCreated=created"));
  assert.ok(source.includes("async function revokeScorecardLink(created)"));
  assert.ok(source.includes('accountClient.request(path,{method:"DELETE"})'));
  assert.ok(source.includes('Authorization:`Bearer ${created.managementToken}`'));
  assert.equal(source.includes("localStorage.setItem(created.managementToken"), false);
  assert.ok(source.includes('else $("#shareScorecard")?.focus();'));
});

test("a missing optional scorecard runtime cannot strand Bridge on the launch screen", () => {
  assert.ok(source.includes("globalThis.BridgeScorecard || {}"));
});

test("production serves scripts as JavaScript without corrupting selector helpers", () => {
  assert.ok(worker.includes('url.pathname === "/app.js"'));
  assert.ok(worker.includes('url.pathname === "/network-logic.js"'));
  assert.ok(devServer.includes('["/network-logic.js", ["./src/network-logic.js"'));
  assert.ok(worker.includes('url.pathname === "/styles.css"'));
  assert.ok(page.includes('<script type="module" src="./app.js?v=1.3.9"'));
  assert.ok(worker.includes('url.pathname === "/ui-foundation.js"'));
  assert.ok(devServer.includes('["/ui-foundation.js", ["./src/ui-foundation.js"'));
  assert.equal(page.includes('const $ = (selector, root = document) => [...root.querySelectorAll(selector)]'), false);
  assert.ok(source.includes('const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]'));
  assert.match(source, /startBridge\(\)\.catch\(error => \{/);
  assert.match(source, /Bridge startup failed/);
});

test("production worker supports durable background follow-up pushes", () => {
  assert.ok(worker.includes("bridge_push_subscriptions"));
  assert.ok(worker.includes("bridge_push_deliveries"));
  assert.ok(worker.includes("/api/push/subscribe"));
  assert.ok(worker.includes("/api/push/schedule"));
  assert.ok(worker.includes("/api/push/test-device"));
  assert.ok(worker.includes("/api/push/dispatch"));
  assert.ok(worker.includes("async scheduled"));
  assert.ok(worker.includes("Content-Encoding"));
  assert.ok(source.includes("enableBackgroundPush"));
  assert.ok(source.includes("syncHostedReminderSchedule"));
  assert.ok(source.includes("bridge-hosted-push-device-token-v1"));
  assert.ok(source.includes("Reminders ready"));
});

test("hosted reminders remain isolated from device-local CRM state", () => {
  assert.ok(page.includes('<meta name="bridge-cloud-state" content="disabled"'));
  assert.ok(page.includes('<meta name="bridge-hosted-push" content="enabled"'));
  assert.ok(worker.includes('env.BRIDGE_CLOUD_STATE_ENABLED !== "true"'));
  assert.ok(worker.includes("token_hash"));
  assert.ok(worker.includes("authorizedSubscription"));
  assert.ok(source.includes('apiFetch("/api/push/config"'));
  assert.ok(source.includes('apiFetch("/api/push/schedule"'));
});

test("iPhone web app assets are included in the production worker", () => {
  assert.ok(worker.includes("apple-touch-icon.png"));
  assert.ok(worker.includes("bridge-icon-192.png"));
  assert.ok(worker.includes("bridge-icon-512.png"));
  assert.ok(worker.includes("manifest.webmanifest"));
  assert.ok(worker.includes("service-worker-allowed"));
  assert.ok(worker.includes("apple-mobile-web-app-capable"));
});

test("Phase 15A serves the approved typography and shared visual primitives without remote dependencies", () => {
  assert.ok(styles.includes('@font-face'));
  assert.ok(styles.includes('font-family: "Inter Tight"'));
  assert.ok(styles.includes('font-family: "Newsreader"'));
  assert.ok(styles.includes('./fonts/inter-tight-latin.woff2'));
  assert.ok(styles.includes('./fonts/newsreader-latin.woff2'));
  assert.ok(page.includes('rel="preload" href="./fonts/inter-tight-latin.woff2"'));
  assert.ok(page.includes('rel="preload" href="./fonts/newsreader-latin.woff2"'));
  assert.ok(worker.includes('"content-type": "font/woff2"'));
  assert.ok(worker.includes('/fonts/inter-tight-latin.woff2'));
  assert.ok(devServer.includes('"font/woff2"'));
  assert.ok(styles.includes('--shadow-sheet: 0 -18px 50px -20px'));
  assert.ok(styles.includes('.ui-mobile-sheet-backdrop.is-closing'));
  assert.ok(styles.includes('@keyframes ui-toast-enter'));
  assert.ok(styles.includes('.motion-step[data-motion-direction="back"]'));
  assert.ok(styles.includes('.nav-selection-indicator'));
  assert.ok(styles.includes('@media (prefers-reduced-motion: reduce)'));
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.ui-mobile-sheet-backdrop,[\s\S]*?animation: none !important;/);
  assert.ok(source.includes("matchMedia('(prefers-reduced-motion: reduce)').matches"));
  assert.ok(source.includes('document.body.classList.remove("modal-open")'));
  assert.ok(source.includes("shell.inert=true"));
  assert.ok(source.includes("shell.inert=false"));
  assert.ok(source.includes("backgroundShell.inert=true"));
});

test("Phase 15A high-visibility icons use the approved Lucide 0.522 geometry", () => {
  assert.ok(source.includes('M12 2v8'));
  assert.ok(source.includes('M18 9a9 9 0 0 1-9 9'));
  assert.ok(source.includes('M14 9a2 2 0 0 1-2 2H6l-4 4V4'));
  assert.ok(source.includes('M13.832 16.568'));
  assert.ok(source.includes('M9.937 15.5'));
  assert.ok(source.includes('icons.calendarPlus'));
  assert.ok(source.includes('icons.penLine'));
  assert.ok(source.includes('if(event.kind==="pipeline")return "arrowUpRight"'));
  assert.ok(source.includes('return "handshake"'));
});

test("role-specific pipeline stages remain separated from MSA and DTM", () => {
  assert.ok(source.includes('Prospect: ["PQI", "QI/P", "FUP", "LA"]'));
  assert.ok(source.includes('Customer: ["CNA", "Proposal", "Follow-Up", "Order Placed", "Active Customer"]'));
  assert.ok(source.includes('["MSA", "DTM"'));
});

test("pipeline stage labels preserve exact saved values", () => {
  const stageLabelSource = source.match(/function stageLabel\(stage\) \{[^\n]+\}/)?.[0];
  assert.ok(stageLabelSource);
  const displayStage = new Function(`${stageLabelSource}; return stageLabel;`)();
  assert.equal(displayStage("FUP"), "FUP");
  assert.equal(displayStage("LA"), "LA");
  assert.ok(source.includes('showDescription:false'));
  assert.equal(source.includes('stageTitle(stage)!==stage'), false);
  assert.equal(source.includes('CNA — Customer Needs Assessment'), false);
});

test("standalone MSA and DTM cards use concise names without grey descriptions", () => {
  assert.ok(source.includes('stageCheck("MSA","",{showDescription:false})'));
  assert.ok(source.includes('stageCheck("DTM","",{showDescription:false})'));
  assert.ok(source.includes('editStageCheck(c,"MSA","")'));
  assert.ok(source.includes('editStageCheck(c,"DTM","")'));
});

test("Conversation Studio uses the six-step guided flow without changing saved fields", () => {
  assert.ok(source.includes('aria-label="Conversation sections"'));
  for (const step of ["person", "context", "learnings", "tracking", "next-step", "review"]) {
    assert.ok(source.includes(`["${step}",`));
  }
  for (const fieldName of ["fullName", "phoneNumber", "role", "judgement", "interestLevel", "conversationDate", "conversationType", "placeId", "newPlaceName", "personalInfo", "notes", "checkBackDate", "followUpDate"]) {
    assert.ok(source.includes(`name="${fieldName}"`));
  }
  assert.ok(source.includes("updateConversationReview"));
  assert.ok(source.includes("createFollowUp(contact,new Date(String(form.get('followUpDate')))"));
  assert.ok(source.includes("createFollowUp(contact,new Date(String(form.get('checkBackDate')))"));
  assert.ok(source.includes("Conversation added to existing contact"));
  assert.ok(source.includes("validateConversationStudio"));
  assert.ok(source.includes("data-conversation-next"));
  assert.ok(source.includes("data-conversation-back"));
  assert.ok(styles.includes(".conversation-step-navigation"));
  assert.ok(styles.includes('.conversation-step[data-active="true"]'));
  assert.ok(styles.includes(".conversation-review-card"));
});

test("Quick Capture counts conversations and meetings without counting calls, texts, or notes", () => {
  const captureSource = source.slice(source.indexOf("function bindQuickCreateEvents"), source.indexOf("function renderPage"));
  assert.ok(captureSource.includes("isCountedConversation:true"));
  assert.ok(captureSource.includes("type=meeting?'Meeting'"));
  assert.ok(captureSource.includes("type:type==='Text'?'Text Message':'Call'"));
  assert.ok((captureSource.match(/isCountedConversation:false/g) || []).length >= 2);
});

test("dashboard and analytics use the saved-goal streak calculation", () => {
  assert.ok(source.includes("const { dailyGoalMetrics, dayKey"));
  assert.ok(source.includes("const dailyGoal = dailyGoalMetrics(state);"));
  assert.equal(source.includes("Complete today's goal to earn a streak."), false);
  assert.equal(source.includes("Current daily-goal ${streakText}"), false);
  assert.equal(source.includes("function calculateStreak()"), false);
});

test("Follow-Ups groups overdue items with the same current-time predicate used by their rows", () => {
  assert.ok(source.includes('const overdue=openItems.filter(item=>new Date(item.dueDate)<now);'));
  assert.ok(source.includes('const scheduled=openItems.filter(item=>new Date(item.dueDate)>=now);'));
  assert.ok(source.includes('const overdue=!completed&&new Date(item.dueDate)<new Date();'));
  const rescheduleSource = source.slice(source.indexOf("function rescheduleFollowUp"), source.indexOf("function replaceScheduledFollowUp"));
  assert.ok(rescheduleSource.includes("item.notificationSentAt = null;"));
});

test("Follow-Ups presents real queue records with exact stages and existing actions", () => {
  const followUpsSource = source.slice(source.indexOf("function renderFollowUps"), source.indexOf("function analyticsDateControls"));
  const actionHandlers = source.slice(source.indexOf("$$('.action-edit-form')"), source.indexOf("const conversationForm"));
  assert.ok(followUpsSource.includes("activeFollowUps()"));
  assert.ok(followUpsSource.includes("followUpStatus(item)===\"completed\""));
  assert.ok(followUpsSource.includes("function followUpPipelineLabel(contact){const stage=contact.role===\"Team\"?\"Team\":currentPipelineStage(contact);"));
  assert.ok(followUpsSource.includes("followUpLastInteractionLabel"));
  assert.ok(followUpsSource.includes('data-communication-type="Call"'));
  assert.ok(followUpsSource.includes('data-communication-type="Text"'));
  assert.ok(followUpsSource.includes('class="followup-card__done complete-action"'));
  assert.ok(followUpsSource.includes('class="followup-card__reschedule edit-action"'));
  assert.ok(followUpsSource.includes("followUpEmptyState"));
  assert.equal(followUpsSource.includes("createFollowUp("), false);
  assert.ok(actionHandlers.includes("rescheduleFollowUp(record.followUp,dueDate)"));
  assert.ok(actionHandlers.includes("transitionFollowUp(record.followUp,'completed')"));
  assert.ok(actionHandlers.includes("button.dataset.followupContactId||button.dataset.contactId"));
  assert.ok(styles.includes(".followups-home"));
  assert.ok(styles.includes(".followup-card__actions"));
});

test("Person Profile composes the relationship headquarters from existing records", () => {
  assert.ok(source.includes("function relationshipProfileOverview(c,active,{routed=false}={})"));
  assert.ok(source.includes("function relationshipTimelineEvents(c)"));
  assert.ok(source.includes("function profileNextAction(c,active)"));
  assert.ok(source.includes("function profileBridgeBrief(c)"));
  assert.ok(source.includes("function profilePipelineSection(c)"));
  assert.ok(source.includes("function profileDetails(c)"));
  assert.ok(source.includes('aria-label="Relationship profile"'));
  assert.ok(source.includes("data-edit-contact-info"));
  assert.ok(source.includes("contactInformation(c)"));
  assert.ok(styles.includes(".relationship-profile-modal"));
  assert.ok(styles.includes(".profile-collapse-header"));
});

test("Add Conversation preserves an in-progress draft and guards accidental navigation", () => {
  assert.ok(source.includes("function captureConversationDraft(form)"));
  assert.ok(source.includes("function restoreConversationDraft(form)"));
  assert.ok(source.includes('title:"Discard this conversation draft?"'));
  assert.ok(source.includes("discardConversationDraft(()=>navigatePresentation"));
  assert.ok(source.includes('window.addEventListener("beforeunload"'));
  assert.ok(source.includes("clearConversationDraft(); ui.conversationStep=0; queueSave('Conversation saved')"));
});

test("People uses compact rows while retaining the existing query and workspaces", () => {
  assert.ok(source.includes('class="people-home"'));
  assert.ok(source.includes('function renderContactWorkspace(filtered, connectionState="")'));
  assert.ok(source.includes('id:"contactSearch"'));
  assert.ok(source.includes('data-people-quick="${label}"'));
  assert.ok(source.includes('id:"peopleSort"'));
  assert.ok(source.includes('id:"peopleVisibility"'));
  assert.ok(source.includes('function peopleFilterSheet(resultCount)'));
  assert.ok(source.includes('function peopleVisibleContacts(filtered = getFilteredContacts())'));
  assert.ok(source.includes('id="conversationFrom"'));
  assert.ok(source.includes('id="conversationTo"'));
  assert.ok(source.includes('data-communication-type="Call"'));
  assert.ok(source.includes('data-communication-type="Text"'));
  assert.ok(source.includes("function contactsLoading()"));
  assert.ok(source.includes('Showing the latest saved contacts while Bridge reconnects.'));
  assert.ok(source.includes('class="people-row__open"'));
  assert.ok(source.includes('stageFor(contact)'));
  assert.ok(source.includes('data-people-contact-mode="places"'));
  assert.ok(source.includes('contacts-pipeline-column'));
  assert.ok(source.includes('contacts-pipeline-person'));
  assert.ok(source.includes('Relationship context'));
  assert.ok(source.includes('function renderPlaces(connectionState="")'));
  assert.ok(styles.includes('.people-home'));
  assert.ok(styles.includes('.people-row__open'));
  assert.ok(styles.includes('.people-filter-sheet'));
  assert.ok(styles.includes('.contacts-route .contacts-pipeline-column'));
  assert.ok(styles.includes('.places-home'));
  assert.ok(styles.includes('.people-home--loading'));
});

test("Places uses existing saved places, links, and recorded interaction history", () => {
  const placeSource = source.slice(source.indexOf("function placeMatchesContact"), source.indexOf("function renderNetworkWorkspace"));
  assert.ok(placeSource.includes("contact?.placeId"));
  assert.ok(placeSource.includes("contact?.placeName"));
  assert.ok(placeSource.includes("function placeActivityRecords"));
  assert.ok(placeSource.includes("contact.conversations"));
  assert.ok(placeSource.includes("currentPipelineStage(contact)"));
  assert.ok(placeSource.includes('data-place-detail-id'));
  assert.ok(placeSource.includes('data-contact-id'));
  assert.ok(placeSource.includes("function placeDetailSheet"));
  assert.equal(placeSource.includes("state.places.push"), false);
  assert.ok(source.includes("quickCapturePlace(form)"));
  assert.ok(source.includes("data-followup-contact-id"));
  assert.ok(styles.includes(".place-detail-sheet"));
  assert.ok(styles.includes(".place-row__body"));
});

test("Contacts adds an isolated real-data Human Network workspace", async () => {
  const network = await readFile(new URL("../src/network-logic.js", import.meta.url), "utf8");
  assert.ok(source.includes('const modes=["list","pipeline","places","network"]'));
  assert.ok(source.includes('renderContactWorkspace(filtered, connectionState)'));
  assert.ok(source.includes("buildNetworkModel({contacts:withStages,places:state.places"));
  assert.ok(source.includes('class="relationship-network-graph${model.personCount>12?" is-dense":""}"'));
  assert.ok(source.includes('data-network-node-id="${escapeHTML(node.id)}"'));
  assert.ok(source.includes("event.key!==\"Enter\"&&event.key!==\" \""));
  assert.ok(source.includes('data-network-filter="companies"'));
  assert.ok(source.includes('model.nodes.length===1&&["places","companies"].includes(model.entityFilter)'));
  assert.ok(source.includes('Recent network activity'));
  assert.ok(source.includes('recentNetworkActivity(ids,5)'));
  assert.ok(source.includes('data-communication-type="Call"'));
  assert.ok(source.includes('data-communication-type="Text"'));
  assert.ok(network.includes("allowedContacts.slice(0, Math.max(1, maxPeople))"));
  assert.ok(network.includes("contact.companyId ? companyMap.get"));
  assert.ok(source.includes('class="network-node-hit"'));
  assert.ok(source.includes('requestAnimationFrame(()=>document.querySelector(`[data-network-node-id='));
  assert.ok(styles.includes('.network-workspace-grid'));
  assert.ok(styles.includes('.network-node:focus-visible .network-node-surface'));
  assert.ok(styles.includes('.network-entity-filter > button { min-height: 44px'));
  assert.ok(styles.includes('.relationship-network-graph { width: 100%;'));
  assert.ok(styles.includes('.network-workspace { padding-bottom: calc(var(--space-2) + env(safe-area-inset-bottom));'));
  assert.ok(styles.includes('.contacts-route .toolbar .contacts-segmented, .contacts-route .toolbar > .select-wrap { width: 100%; grid-column: 1 / -1;'));
});

test("recurring streak rest schedules migrate through settings, backups, and a saved draft", () => {
  assert.ok(source.includes("streakExcludedDates: []"));
  assert.ok(source.includes("streakRestRules: []"));
  assert.ok(source.includes("next.settings.streakExcludedDates = normalizeExcludedDates(next.settings.streakExcludedDates)"));
  assert.ok(source.includes("next.settings.streakRestRules = normalizeRestRules(next.settings.streakRestRules)"));
  assert.ok(source.includes("function settingsRestControls("));
  assert.ok(source.includes('id="streakRestFrequency"'));
  assert.ok(source.includes('<option value="once"'));
  assert.ok(source.includes('id="oneTimeRestDate"'));
  assert.ok(source.includes('id="oneTimeRestDaysSection"'));
  assert.ok(source.includes('oneTimeSection.hidden=!dates.length'));
  assert.equal(source.includes("No rest days selected."), false);
  assert.equal(source.includes("No repeating rest days."), false);
  assert.ok(source.includes("ui.settingsExcludedDatesDraft=next"));
  assert.ok(source.includes('data-rest-panel="weekly"'));
  assert.ok(source.includes('id="addStreakRestRule"'));
  assert.ok(source.includes('class="ui-icon-button remove-rest-rule"'));
  assert.ok(source.includes("next.streakExcludedDates=normalizeExcludedDates(ui.settingsExcludedDatesDraft)"));
  assert.ok(source.includes("next.streakRestRules=normalizeRestRules(ui.settingsRestRulesDraft)"));
  assert.ok(source.includes("JSON.stringify(state,null,2)"));
  assert.ok(source.includes("const imported=normalizeState(JSON.parse(await file.text()))"));
  assert.ok(styles.includes(".rest-rule-builder"));
  assert.ok(styles.includes(".weekday-picker"));
  assert.ok(styles.includes(".rest-day-list"));
  assert.ok(styles.includes(".rest-day-row .ui-icon-button"));
});

test("Settings uses a progressive preference hierarchy without changing its persisted controls", () => {
  assert.ok(source.includes('class="modal hn-settings-modal"'));
  assert.ok(source.includes('class="hn-settings-form settings-route-stack"'));
  assert.ok(source.includes('Bridge preferences'));
  assert.ok(source.includes('function settingsMomentumSummary(metrics)'));
  assert.ok(source.includes('function settingsNavigationGroup(title,content)'));
  assert.ok(source.includes('settingsNavigationGroup("Profile"'));
  assert.ok(source.includes('settingsNavigationGroup("Notifications"'));
  assert.ok(source.includes('settingsNavigationRow("Notifications"'));
  assert.ok(source.includes('settingsNavigationGroup("Relationships"'));
  assert.ok(source.includes('settingsNavigationRow("Workflow"'));
  assert.ok(source.includes('settingsNavigationRow("Relationship health"'));
  assert.ok(source.includes('settingsNavigationRow("Archive"'));
  assert.equal(source.includes('settingsNavigationRow("Appearance"'), false);
  assert.ok(source.includes('function settingsSection(title,content){return SurfaceCard('));
  for (const id of ["settingsForm", "syncAccountNow", "exportBackup", "exportCSV", "importBackup", "createCloudBackup", "exportAccountData", "deleteBridgeAccount", "openReleaseNotes", "streakRestFrequency", "requestNotifications"]) {
    assert.ok(source.includes(`id="${id}"`), `missing settings control ${id}`);
  }
  assert.ok(source.includes('next.streakRestRules=normalizeRestRules(ui.settingsRestRulesDraft)'));
  assert.ok(source.includes('await accountClient.updateAccount({firstName,lastName})'));
  assert.ok(source.includes('await accountClient.restoreBackup(action.backupId, password, confirmation)'));
  assert.ok(source.includes('function settingsFocusableElements()'));
  assert.ok(source.includes('function closeSettings()'));
  assert.ok(source.includes('settingsFocusReturn=document.activeElement'));
  assert.ok(source.includes('closeReleaseNotes();return;'));
  assert.ok(styles.includes('.hn-settings-modal'));
  assert.ok(styles.includes('.hn-settings-momentum'));
  assert.ok(styles.includes('.settings-nav-row'));
  assert.ok(styles.includes('.settings-route-stack'));
  assert.ok(source.includes('class="hn-account-workspace"'));
  assert.ok(source.includes('Backup & export'));
  assert.ok(source.includes('profile:"Profile"'));
  assert.ok(source.includes('health:"Relationship health"'));
  assert.ok(source.includes('archive:"Archive"'));
  assert.ok(source.includes('data:"Data & sync"'));
  assert.ok(source.includes('Changing your password signs out other devices'));
  assert.ok(source.includes('const hasControl=name=>Boolean(form.elements.namedItem(name))'));
  assert.ok(styles.includes('.hn-settings-save .button { width: 100%;'));
});

test("v1.3.9 cache busting is coordinated across scripts, styles, manifest, and service worker", () => {
  assert.ok(page.includes("./config.js?v=1.3.9"));
  assert.ok(page.includes("./styles.css?v=1.3.9"));
  assert.ok(page.includes("./engagement-logic.js?v=1.3.9"));
  assert.ok(page.includes("./release-logic.js?v=1.3.9"));
  assert.ok(page.includes("./app.js?v=1.3.9"));
  assert.ok(worker.includes("bridge-app-v1.3.9"));
});

test("the GitHub Pages client opens locally without loading the Cloudflare account gate", async () => {
  const config = await readFile(new URL("../src/config.js", import.meta.url), "utf8");
  const serviceWorker = await readFile(new URL("../src/sw.js", import.meta.url), "utf8");
  assert.ok(config.includes("https://bridge-crm-api.bridgecrm-zayway.workers.dev"));
  assert.ok(source.includes("globalThis.BridgeConfig?.apiBase"));
  assert.ok(source.includes("const apiFetch = (path, options) => fetch(apiURL(path), options)"));
  assert.ok(source.includes('mode: "local"'));
  assert.equal(page.includes("account-client.js"), false);
  assert.equal(serviceWorker.includes("account-client.js"), false);
  assert.ok(serviceWorker.includes('importScripts(new URL("config.js?v=1.3.9", ROOT).href)'));
  assert.ok(serviceWorker.includes('new URL("ui-foundation.js", ROOT).href'));
  assert.ok(serviceWorker.includes("const API_BASE = String(self.BridgeConfig?.apiBase"));
  assert.ok(serviceWorker.includes('fetch(apiURL("/api/push/subscribe")'));
});

test("the root-hosted app allows account APIs and Cloudflare Turnstile", () => {
  assert.ok(worker.includes("https://bridgecrm-human-network.mr-zayway.chatgpt.site"));
  assert.ok(worker.includes("https://bridge-crm-api.bridgecrm-zayway.workers.dev"));
  assert.ok(worker.includes("script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com"));
  assert.ok(worker.includes("frame-src https://challenges.cloudflare.com"));
});

test("pipeline selects the approved role-specific Prospect and Customer experiences", () => {
  assert.ok(source.includes('renderPipelineGroup(role, contacts)'));
  assert.ok(source.includes('pipelineRole: "Prospect"'));
  assert.ok(source.includes('data-pipeline-role="Prospect"'));
  assert.ok(source.includes('data-pipeline-role="Customer"'));
  assert.ok(source.includes('renderProspectPipeline(prospectContacts,now):renderCustomerPipeline(customerContacts,now)'));
  assert.ok(source.includes('c.role===role&&stageFor(c)===stage'));
  assert.equal(source.includes('const stages=["No stage"'), false);
});

test("Prospect Pipeline composes exact canonical stages from real assignments and history", () => {
  assert.ok(source.includes('Prospect: ["PQI", "QI/P", "FUP", "LA"]'));
  assert.ok(source.includes('function activePipelineContacts(role)'));
  assert.ok(source.includes('function pipelineStageEnteredAt(contact,stage)'));
  assert.ok(source.includes('function prospectPipelineStage(stage,contacts,now=new Date())'));
  assert.ok(source.includes('PIPELINES.Prospect.map(stage=>prospectPipelineStage(stage,contacts,now))'));
  assert.ok(source.includes('function prospectPipelineMovements(now=new Date())'));
  assert.ok(source.includes('function prospectStageHistory(contact)'));
  assert.ok(source.includes('function prospectTransitionSheet(contact)'));
  assert.ok(source.includes('data-prospect-contact-id="${escapeHTML(contact.id)}"'));
  assert.equal(source.includes('id="prospectStageTransitionForm" class="prospect-transition-form" data-contact-id='), false);
  assert.ok(source.includes('setPipelineStage(contact,selected,nowISO(),"prospect-pipeline")'));
  assert.ok(source.includes('PIPELINE_STALL_DAYS = 21'));
  assert.ok(styles.includes('.prospect-pipeline-stages'));
  assert.ok(styles.includes('.prospect-stage-person.is-stalled'));
  assert.ok(styles.includes('.prospect-transition-form'));
});

test("Customer Pipeline composes exact canonical stages from real assignments and history", () => {
  assert.ok(source.includes('Customer: ["CNA", "Proposal", "Follow-Up", "Order Placed", "Active Customer"]'));
  assert.ok(source.includes('function customerPipelineStage(stage,contacts,now=new Date())'));
  assert.ok(source.includes('PIPELINES.Customer.map(stage=>customerPipelineStage(stage,contacts,now))'));
  assert.ok(source.includes('function customerPipelineMovements(now=new Date())'));
  assert.ok(source.includes('function customerStageHistory(contact)'));
  assert.ok(source.includes('function customerTransitionSheet(contact)'));
  assert.ok(source.includes('function customerNotInPipeline(contacts)'));
  assert.ok(source.includes('data-customer-contact-id="${escapeHTML(contact.id)}"'));
  assert.equal(source.includes('id="customerStageTransitionForm" class="prospect-transition-form customer-transition-form" data-contact-id='), false);
  assert.ok(source.includes('setPipelineStage(contact,selected,nowISO(),"customer-pipeline")'));
  assert.ok(styles.includes('.prospect-stage.is-empty'));
  assert.ok(styles.includes('.customer-not-pipeline'));
});

test("Today uses real goal, follow-up, health, contact, and momentum data", () => {
  assert.ok(source.includes('function todayGoalProgress(dailyGoal)'));
  assert.ok(source.includes('function todayAttentionItems(now = new Date())'));
  assert.ok(source.includes('const actionItems = activeFollowUps()'));
  assert.ok(source.includes('relationshipScoreMap(now)'));
  assert.ok(source.includes('function todayNextAction(item, now = new Date())'));
  assert.ok(source.includes('class="today-next-card'));
  assert.ok(source.includes('class="today-attention-row'));
  assert.ok(source.includes('function recentlyMetContacts(limit = 4)'));
  assert.ok(source.includes('function todayMomentum(now = new Date())'));
  assert.ok(source.includes('countedConversations().filter'));
  assert.ok(source.includes('PIPELINE_STAGES.includes(event.stage) && new Date(event.occurredAt) >= weekStart'));
  assert.ok(source.includes('data-action-id="${escapeHTML(contact.id)}:${escapeHTML(followUp.id)}"'));
  assert.ok(source.includes('class="button subtle today-complete-action"'));
  assert.ok(source.includes("completeTodayAction(button.dataset.todayContactId,button.dataset.followUpId)"));
  assert.ok(source.includes('class="today-momentum__summary"'));
  assert.ok(source.includes('data-page="analytics">Insights'));
  assert.ok(styles.includes('.today-home'));
  assert.ok(styles.includes('.today-next-card'));
  assert.ok(styles.includes('.today-attention-row'));
  assert.ok(styles.includes('.today-momentum'));
  assert.equal(source.includes('className:"dashboard-goal"'), false);
  assert.equal(source.includes('dashboardMetricCard('), false);
});

test("approved appearance is fixed and customization state is retired", () => {
  assert.equal(source.includes("const ACCENTS"), false);
  assert.equal(source.includes('accent: "Terracotta"'), false);
  assert.equal(source.includes('theme: "system"'), false);
  assert.equal(source.includes('compact: false'), false);
  assert.equal(source.includes('settingsAccentDraft'), false);
  assert.equal(source.includes('settingsNavigationRow("Appearance"'), false);
  assert.ok(source.includes('function applyFixedAppearance()'));
  assert.ok(source.includes('delete next.settings.theme'));
  assert.ok(source.includes('delete next.settings.accent'));
  assert.ok(source.includes('delete next.settings.compact'));
  assert.equal(styles.includes("prefers-color-scheme: dark"), false);
  assert.ok(styles.includes("prefers-reduced-motion: reduce"));
});

test("SwiftUI-inspired motion is scoped and search avoids per-keystroke rebuilds", () => {
  assert.ok(source.includes("lastRenderedPresentationKey"));
  assert.ok(source.includes("routeEntryMotion"));
  assert.ok(source.includes("searchRenderTimer=setTimeout"));
  assert.ok(foundation.includes('aria-current="page"'));
  assert.ok(styles.includes(".page.page-enter, .page.mode-enter { animation: none; }"));
  assert.ok(styles.includes(".presentation-screen--enter"));
  assert.ok(styles.includes("--motion-standard"));
  assert.equal(styles.includes(".page { width: 100%; max-width: 1280px; margin: 0 auto; animation:"), false);
});

test("shared glass surfaces use consistent highlight, border, and safe dock tokens", () => {
  assert.ok(styles.includes("--glass-border"));
  assert.ok(styles.includes("--glass-highlight"));
  assert.ok(styles.includes("--control-surface"));
  assert.ok(styles.includes("--selected-surface"));
  assert.ok(styles.includes("--shadow-control"));
  assert.ok(styles.includes("--control-height"));
  assert.ok(styles.includes("--mobile-content-clearance"));
  assert.ok(styles.includes("env(safe-area-inset-bottom)"));
  assert.ok(styles.includes(".segmented::before"));
  assert.ok(styles.includes("will-change: transform"));
  assert.ok(styles.includes(".settings-row:has(input[type=checkbox])"));
  assert.ok(styles.includes("input, select, textarea { font-size: 16px; }"));
  const desktopFidelityStart = styles.indexOf("/* Phase 12 desktop fidelity");
  assert.ok(desktopFidelityStart > 0);
  assert.equal(/font-size:\s*clamp/.test(styles.slice(0, desktopFidelityStart)), false);
  assert.ok(/font-size:\s*clamp/.test(styles.slice(desktopFidelityStart)));
  assert.ok(source.includes('aria-label="Quick people filters"'));
});

test("selection indicators and mobile dock share exact border-box geometry", () => {
  assert.ok(styles.includes("*, *::before, *::after { box-sizing: border-box; }"));
  assert.ok(styles.includes(".nav { --nav-index: 0; width: 100%; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0; }"));
  assert.ok(styles.includes(".nav-button { width: 100%; height: 100%; min-width: 0; min-height: 0;"));
  assert.ok(styles.includes(".nav::before"));
  assert.ok(styles.includes("width: 20%"));
  assert.ok(styles.includes("translateX(calc(var(--nav-index) * 100%))"));
  assert.ok(styles.includes(".segmented::before"));
  assert.ok(styles.includes("width: calc((100% - 8px) / var(--segment-count))"));
  assert.ok(styles.includes("translateX(calc(var(--segment-index) * 100%))"));
  assert.equal(styles.includes(".nav-button { min-width: 0; min-height: 58px;"), false);
});

test("Bridge shell preserves route controls in the approved mobile navigation", () => {
  assert.ok(foundation.includes('class="app-shell bridge-pattern-shell"'));
  assert.ok(foundation.includes('aria-label="Primary navigation"'));
  assert.ok(foundation.includes('id="quickCreateButton"'));
  assert.ok(foundation.includes('data-open-people'));
  assert.ok(foundation.includes('data-open-pipeline'));
  assert.ok(styles.includes('body .bridge-pattern-shell'));
  assert.ok(styles.includes('body .bridge-pattern-nav .quick-create-button'));
  assert.ok(styles.includes('transform: translateY(-8px)'));
  assert.ok(styles.includes('--safe-bottom: env(safe-area-inset-bottom, 0px)'));
});

test("Quick Create keeps keyboard focus within its real dialog and returns it to Add New", () => {
  assert.ok(source.includes("let quickCreateFocusReturn = null;"));
  assert.ok(source.includes("function quickCreateFocusableElements()"));
  assert.ok(source.includes("if(event.key===\"Escape\"){event.preventDefault();closeQuickCreate();}"));
  assert.ok(source.includes("quickCreateFocusReturn?.isConnected?quickCreateFocusReturn:$('[aria-label=\"Capture what happened\"]')"));
});

test("restrained native motion remains responsive and accessible", () => {
  assert.ok(styles.includes("--motion-spring"));
  assert.ok(styles.includes(".nav::before"));
  assert.ok(styles.includes("var(--nav-index)"));
  assert.ok(styles.includes("width: 20%"));
  assert.ok(styles.includes("translateX(calc(var(--nav-index) * 100%))"));
  assert.ok(styles.includes("@supports not ((-webkit-backdrop-filter"));
  assert.ok(styles.includes("@media (prefers-contrast: more)"));
  assert.ok(styles.includes("@media (prefers-reduced-motion: reduce)"));
  assert.equal(source.includes("function installGlassInteractions()"), false);
  assert.ok(source.includes("function bindTodaySwipeCard()"));
  assert.ok(styles.includes(".today-swipe-shell .today-next-card"));
  assert.equal(styles.includes(".is-glass-pressing"), false);
});

test("profile names migrate safely and only the first name appears in the greeting", () => {
  assert.ok(source.includes('name="firstName"'));
  assert.ok(source.includes('name="lastName"'));
  assert.ok(source.includes('autocomplete="given-name"'));
  assert.ok(source.includes('autocomplete="family-name"'));
  assert.ok(source.includes('legacyName.split(/\\s+/)'));
  assert.ok(source.includes('next.settings.name = [next.settings.firstName, next.settings.lastName].filter(Boolean).join(" ")'));
  assert.ok(source.includes('next.name=[firstName,lastName].filter(Boolean).join(" ")'));
  assert.equal(source.includes('settingsRow("Your name"'), false);
});

test("analytics offers day, week, month, and custom local date controls", () => {
  assert.ok(source.includes('["day","week","month","custom"]'));
  assert.ok(source.includes('id="analyticsMonth"'));
  assert.ok(source.includes('id="analyticsCustomStart"'));
  assert.ok(source.includes('id="analyticsCustomEnd"'));
  assert.ok(source.includes('idPrefix:"analytics-detail-range"'));
  assert.ok(source.includes('attributes:`data-range="${mode}"`'));
  assert.ok(source.includes('event.key==="ArrowRight"||event.key==="ArrowDown"'));
  assert.ok(source.includes("shiftAnalyticsPeriod(-1)"));
  assert.ok(source.includes("shiftAnalyticsPeriod(1)"));
  assert.ok(source.includes('if (ui.analyticsRange === "month") anchor.setMonth(anchor.getMonth() - 1, 1);'));
  assert.ok(source.includes("analyticsMetricsForRange(previousAnalyticsRange(range))"));
  assert.ok(source.includes('BridgeAnalytics'));
  assert.ok(styles.includes('input[type="month"]::-webkit-date-and-time-value'));
  assert.ok(styles.includes('input[type="month"]::-webkit-datetime-edit'));
});

test("Insights preserves scorecard phone capture definitions and uses tested derived metrics", () => {
  assert.ok(source.includes('uniquePhoneCaptures(state.contacts, range)'));
  assert.ok(source.includes('phoneCapturedAt:phoneNumber?conversationDate:null'));
  assert.ok(source.includes('buildInsightsModel({contacts:state.contacts,places:state.places'));
  assert.ok(source.includes('["Phone numbers captured",scorecard.metrics.contacts,previousScorecard.metrics.contacts]'));
  assert.ok(source.includes('const previousScorecard=analyticsMetricsForRange(previousAnalyticsRange(range))'));
  assert.ok(source.includes('model.followUpCompletion===null'));
  assert.ok(source.includes('Counts are recorded conversations among people linked to each saved place.'));
  assert.ok(source.includes('No activity in this period'));
});

test("Insights uses the approved editorial hierarchy and exact pipeline stage values", () => {
  const insightsSource = source.slice(source.indexOf("function analyticsPeriodEyebrow"), source.indexOf("function achievementsModal"));
  assert.ok(insightsSource.includes('class="analytics-workspace insights-home"'));
  assert.ok(insightsSource.includes('pageHead("Insights"'));
  assert.ok(insightsSource.includes('Conversation activity'));
  assert.ok(insightsSource.includes('Pipeline intelligence'));
  assert.ok(insightsSource.includes('Follow-up effectiveness'));
  assert.ok(insightsSource.includes('Where you’re connecting'));
  assert.ok(insightsSource.includes('["MSA","DTM"].map(stage=>analyticsDetailMetricRow'));
  assert.ok(insightsSource.includes('model.standaloneEvents'));
  assert.ok(insightsSource.includes('Current stage distribution uses Bridge’s exact Prospect and Customer stages.'));
  assert.ok(insightsSource.includes('PIPELINES.Prospect.map(stage=>analyticsDetailMetricRow(stage'));
  assert.ok(insightsSource.includes('PIPELINES.Customer.map(stage=>analyticsDetailMetricRow(stage'));
  assert.equal(insightsSource.includes('stageLabel(stage)'), false);
  assert.ok(styles.includes('.insights-home'));
  assert.ok(styles.includes('.insights-chart__bar.has-value'));
  assert.ok(styles.includes('.insights-intelligence article'));
});

test("existing contact information is read-only until Edit is selected", () => {
  assert.ok(source.includes('id="editContactInfo"'));
  assert.ok(source.includes('id="contactInfoForm"'));
  assert.ok(source.includes('id="cancelContactInfoEdit"'));
  assert.ok(source.includes('id="editTrackingForm"'));
  const contactInformationSource = source.slice(source.indexOf("function contactInformation"), source.indexOf("function contactHealthCard"));
  assert.ok(contactInformationSource.includes('class="contact-information relationship-edit-form"'));
  assert.ok(contactInformationSource.includes('name="placeId"'));
  assert.ok(contactInformationSource.includes('name="newPlaceName"'));
  assert.ok(contactInformationSource.includes('name="dateFirstMet"'));
  assert.ok(source.includes("const place=quickCapturePlace(f);c.placeId=place.placeId;c.placeName=place.placeName"));
  assert.ok(source.includes('title:"Discard unsaved changes?"'));
  assert.equal(source.includes('id="editContactForm"'), false);
});

test("Personal Info remains a separate, editable relationship-context workspace", () => {
  assert.ok(source.includes('name="personalInfo" placeholder="Occupation, goals, family, interests, needs, or helpful background"'));
  assert.ok(source.includes('personalInfo=String(form.get(\'personalInfo\')||\'\').trim()'));
  assert.ok(source.includes('id="personalInfoForm"'));
  assert.ok(source.includes("contactPersonalInfo(c)"));
  assert.ok(source.includes('data-contact-detail-tab="personal"'));
  const contactInformationSource = source.slice(source.indexOf("function contactInformation"), source.indexOf("function contactHealthCard"));
  assert.equal(contactInformationSource.includes("personalInfo"), false);
});

test("calling and texting remain intentional PWA actions without unsupported contact import", () => {
  assert.equal(source.includes('id="importContact"'), false);
  assert.equal(source.includes('id="vcardImport"'), false);
  assert.equal(source.includes("navigator.contacts.select"), false);
  assert.equal(source.includes("parseVCard"), false);
  assert.ok(source.includes('href="${phoneHref(contact.phoneNumber)}"'));
  assert.ok(source.includes('href="${messageHref(contact.phoneNumber)}"'));
  assert.ok(source.includes('data-log-communication-contact-id'));
});

test("communication logs do not count as conversations and support CRM follow-through", () => {
  assert.ok(source.includes("communicationType"));
  assert.ok(source.includes("'Text Message':'Call'"));
  assert.ok(source.includes("isCountedConversation:false"));
  assert.ok(source.includes('Opening Messages does not confirm that a text was sent'));
  assert.ok(source.includes('sourceCommunicationId:log.id'));
  assert.ok(source.includes("setPipelineStage(c,nextStage,occurredAt,'communication')"));
});

test("submitted call and text logs keep content and actions aligned on iPhone", () => {
  assert.ok(styles.includes("grid-template-columns: minmax(0, 1fr) auto"));
  assert.ok(styles.includes(".log-actions { min-width: max-content"));
  assert.ok(styles.includes(".communication-log .log-note-wrap { margin-left: 42px"));
});

test("Human Network disclosures stay compact and contact facts lead the overview", () => {
  assert.ok(styles.includes(".overdue-disclosure > summary .app-icon { width: 18px; height: 18px; flex: 0 0 18px"));
  assert.ok(styles.includes(".analytics-context > summary .app-icon { width: 18px; height: 18px; flex: 0 0 18px"));
  assert.equal(styles.includes(".analytics-context > summary::after"), false);
  assert.ok(source.includes('class="profile-identity"'));
  assert.ok(source.includes('class="profile-identity__status"'));
  assert.ok(source.includes('class="profile-details__rows"'));
  assert.ok(source.includes('class="contact-health-summary"'));
  assert.ok(source.includes('${contactHealthCard(c)}${contactArchiveCard(c)}'));
});

test("Bridge design tokens and shared primitives form one compact semantic system", () => {
  for (const token of [
    "--color-page: #f5f2ec",
    "--color-surface: #ffffff",
    "--color-text-primary: #1b1913",
    "--color-brand: #0e6b5c",
    "--color-info: #966a15",
    "--color-positive: #3c6b3f",
    "--color-uncertain: #966a15",
    "--color-overdue: #ae3e2a",
    "--color-brand-soft: #e1eeea",
    "--color-overdue-soft: #f8e7e2",
    "--font-editorial:",
    "--shadow-card: none",
    "--focus-ring-color:",
    "--control-height: 48px",
    "--motion-duration-standard:",
  ]) assert.ok(styles.includes(token), `missing ${token}`);
  for (const primitive of ["Button", "SurfaceCard", "MetricCard", "MetricGrid", "Avatar", "StatusBadge", "IconButton", "ProgressBar", "ListRow", "SettingsRow", "ToggleRow", "Chip", "Menu", "SectionHeader", "SegmentedControl", "Tabs", "InformationRow", "SearchField", "FilterControl", "DateNavigator", "EmptyState", "FeedbackState", "LoadingSkeleton", "MobileSheet", "ConfirmDialog", "ChartCard"]) {
    assert.ok(foundation.includes(`function ${primitive}`), `missing ${primitive}`);
  }
  assert.ok(styles.includes(".ui-editorial-heading"));
  for (const selector of [".ui-metric-grid", ".ui-tabs", ".ui-information-row", ".ui-settings-row", ".ui-toggle-row", ".ui-search-field", ".ui-filter-control", ".ui-date-navigator", ".ui-mobile-sheet", ".ui-confirm-dialog", ".ui-chart-card"]) {
    assert.ok(styles.includes(selector), `missing ${selector}`);
  }
  assert.ok(styles.includes(".ui-segmented > button[aria-pressed=\"true\"]"));
  assert.ok(foundation.includes('role="alertdialog" aria-modal="true"'));
  assert.ok(foundation.includes('role="tablist" aria-label="${escapeHTML(label)}"'));
  assert.ok(foundation.includes('class="ui-tabs__indicator"'));
  assert.equal(foundation.includes('aria-controls="${escapeHTML(prefix)}-panel-${escapeHTML(value)}"'), false);
  assert.ok(source.includes("function bindSharedPrimitiveEvents()"));
  assert.ok(foundation.includes("data-ui-dialog-close"));
  assert.ok(styles.includes("--color-border-strong: #d5cec0;"));
  assert.ok(styles.includes("@media (prefers-reduced-motion: reduce)"));
});

test("relationship timeline uses stored conversations, follow-ups, and pipeline events", () => {
  assert.ok(source.includes("const conversations=(c.conversations || []).map"));
  assert.ok(source.includes("const actions=(c.followUps || []).flatMap"));
  assert.ok(source.includes("const pipeline=profileStageEvents(c).map"));
  assert.ok(source.includes('{label:"Everything",value:"All"}'));
  assert.ok(source.includes('{label:"Follow-ups",value:"Actions"}'));
  assert.ok(source.includes("profileTimelineGroups(events)"));
  assert.ok(source.includes('events.slice(0,limit).map(profileTimelineEvent)'));
  assert.ok(source.includes('class="profile-timeline-event profile-timeline-event--${event.kind}"'));
  assert.ok(source.includes('class="button subtle show-less-activity"'));
  assert.ok(styles.includes(".profile-timeline-event"));
  assert.ok(styles.includes("white-space: pre-wrap"));
});

test("Person Profile displays exact saved pipeline values and recorded stage history", () => {
  const profileSource=source.slice(source.indexOf("function profileStageEditor"),source.indexOf("function contactModal"));
  assert.ok(profileSource.includes('${escapeHTML(stage)}'));
  assert.ok(profileSource.includes('${from} → ${to}'));
  assert.ok(profileSource.includes("profileStageEvents(c)"));
  assert.equal(profileSource.includes("stageLabel("),false);
  assert.ok(source.includes('${escapeHTML(current||"No stage")}'));
  assert.ok(source.includes('${escapeHTML(stage)}</option>'));
});

test("Person Profile retains canonical stage history after role conversion", () => {
  const profileStageEventsSource = source.match(/function profileStageEvents\(c\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(profileStageEventsSource);
  const profileStageEvents = new Function("PIPELINE_STAGES", `${profileStageEventsSource}; return profileStageEvents;`)(
    ["PQI", "QI/P", "FUP", "LA", "CNA", "Proposal", "Follow-Up", "Order Placed", "Active Customer"]
  );
  const history = profileStageEvents({
    role: "Customer",
    stageEvents: [
      { stage: "QI/P", occurredAt: "2026-08-10T12:00:00" },
      { stage: "Active Customer", occurredAt: "2026-08-11T12:00:00" },
      { stage: "MSA", occurredAt: "2026-08-12T12:00:00" }
    ]
  });

  assert.deepEqual(history.map(event => event.stage), ["Active Customer", "QI/P"]);
});

test("communication analytics respect the selected analytics range", () => {
  assert.ok(analyticsLogic.includes('log.communicationType && inAnalyticsRange(log.conversationDate || log.createdAt, range)'));
  assert.ok(analyticsLogic.includes('communicationOutcomes'));
  assert.ok(source.includes('Communication outcomes'));
  assert.ok(source.includes('Logged communication outcomes for this period will appear here.'));
});

test("All Types contact filtering is removed without deleting conversation type data", () => {
  assert.equal(source.includes('id="typeFilter"'), false);
  assert.equal(source.includes('ui.typeFilter'), false);
  assert.equal(source.includes('All Types'), false);
  assert.ok(source.includes('name="conversationType"'));
});

test("desktop Human Network fidelity uses route workspaces without changing mobile", () => {
  assert.ok(styles.includes("/* Phase 12 desktop fidelity: editorial workspaces, never enlarged mobile stacks. */"));
  assert.ok(styles.includes("grid-template-columns: 292px minmax(0, 1fr)"));
  assert.ok(styles.includes("grid-template-columns: repeat(2, minmax(0, 1fr));"));
  assert.ok(styles.includes(".followthrough-workspace__overdue { grid-column: 1; grid-row: 1 / span 2; }"));
  assert.ok(styles.includes(".analytics-workspace > .analytics-period-card { grid-column: 1 / span 5; margin: 0; }"));
  assert.ok(styles.includes(".network-workspace-grid { grid-template-columns: minmax(0, 1.8fr) minmax(300px, .72fr); gap: 14px; }"));
  assert.ok(styles.includes("@media (max-width: 767px)"));
});

test("global Capture exposes every approved progressive composer", () => {
  assert.ok(source.includes('const greeting = savedFirstName ? `Hi, ${escapeHTML(savedFirstName)}` : "Hi there";'));
  assert.ok(styles.includes("body .bridge-pattern-nav .nav-button.active { color: var(--color-text-primary); background: transparent; box-shadow: none;"));
  assert.ok(styles.includes("--color-primary-action: #1b1913;"));
  assert.ok(styles.includes("body .bridge-pattern-nav .quick-create-button"));
  assert.ok(styles.includes("box-shadow: var(--shadow-float)"));
  assert.ok(source.includes('aria-label="Capture what happened"'));
  for (const choice of ['["conversation","Conversation"', '["call","Call"', '["text","Text"', '["meeting","Meeting"', '["action","Follow-up"', '["contact","Add person"']) {
    assert.ok(source.includes(choice));
  }
  const modalSource = source.slice(source.indexOf("function quickCreateModal"), source.indexOf("function closeQuickCreate"));
  assert.ok(modalSource.includes('data-quick-mode="${mode}"'));
  assert.equal(modalSource.includes('data-quick-mode="note"'), false);
  assert.equal(modalSource.includes("Other activity · note, MSA, or DTM"), false);
  assert.equal(modalSource.includes("disabled"), false);
  assert.ok(source.includes("function quickCaptureAdvanced"));
  assert.ok(source.includes("function quickCaptureConversationForm"));
  assert.ok(source.includes("function quickCaptureCommunicationForm"));
  assert.ok(source.includes("function quickCaptureContactForm"));
  assert.ok(source.includes("function quickCaptureActionForm"));
  assert.ok(source.includes("function quickCaptureNoteForm"));
  assert.ok(source.includes("selected&&(PIPELINES[contact.role]||[]).includes(selected)"));
  assert.ok(source.includes("selected?.conversationType||String(form.get('conversationType')"));
  assert.ok(source.includes('iconName:"sliders"'));
  assert.ok(styles.includes(".followup-status-control { display: none; }"));
  assert.ok(styles.includes(".analytics-range-edit:not([open]) { display: none; }"));
  assert.ok(styles.includes(".contacts-route .page-head .button.primary { background: var(--color-primary-action); }"));
  assert.ok(styles.includes(".quick-create-modal .ui-icon-button { color: var(--color-text-primary); }"));
  assert.ok(styles.includes("@media (max-width: 350px)"));
  assert.ok(styles.includes(".nav-button { gap: 1px; font-size: 8px; letter-spacing: -.025em; }"));
});
