import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = fs.readFileSync(path.join(root, "src", "app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "src", "styles.css"), "utf8");
const index = fs.readFileSync(path.join(root, "src", "index.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "src", "manifest.webmanifest"), "utf8"));

test("Phase 15E Settings root and focused subpages are addressable", () => {
  for (const section of ["profile","goals","notifications","preferences","health","archive","data","account","sessions","backup","privacy","about"]) {
    assert.match(app, new RegExp(`SETTINGS_SECTIONS[^\\n]+["\\']${section}["\\']`));
    assert.match(app, new RegExp(`data-settings-section-open="\\$\\{escapeHTML\\(section\\)\\}"`));
  }
  for (const label of ["Profile","Goals & progress","Notifications","Workflow","Relationship health","Archive","Data & sync","Backup & export","Scorecards and sharing","About & support"]) assert.ok(app.includes(label), `missing Settings destination ${label}`);
  assert.ok(app.includes("presentationParentURL(screen = ui.routedScreen)"));
  assert.ok(app.includes('screen === "settings" && ui.routedSection && ui.routedSection !== "root"'));
  assert.equal(app.includes("function settingsDisclosure("), false);
});

test("split Settings forms merge only controls rendered on the current page", () => {
  assert.ok(app.includes("const hasControl=name=>Boolean(form.elements.namedItem(name))"));
  assert.ok(app.includes('if(hasControl("dailyGoal"))next.dailyGoal='));
  assert.ok(app.includes('if(hasControl("followUpNotifications"))next.followUpNotifications='));
  assert.ok(app.includes('if(hasControl("healthScoresVisible"))next.healthScoresVisible='));
  assert.equal(app.includes('name="healthNotificationsEnabled"'), false);
  assert.ok(app.includes("healthNotificationsEnabled"));
  assert.equal(app.includes("Bridge stores the existing preference for compatibility"), false);
});

test("approved appearance is fixed while accessibility preferences remain active", () => {
  assert.equal(app.includes('"appearance"'), false);
  assert.equal(app.includes("settingsAppearanceContent"), false);
  assert.equal(app.includes("settingsAccentDraft"), false);
  assert.equal(app.includes('name="theme"'), false);
  assert.equal(app.includes('name="accent"'), false);
  assert.equal(app.includes('name="compact"'), false);
  assert.match(app, /delete next\.settings\.theme;[\s\S]*delete next\.settings\.accent;[\s\S]*delete next\.settings\.compact;/);
  assert.match(app, /function applyFixedAppearance\(\)/);
  assert.match(styles, /:root \{[\s\S]*color-scheme: light;/);
  assert.equal(styles.includes("prefers-color-scheme: dark"), false);
  assert.equal(styles.includes('[data-theme="dark"]'), false);
  assert.equal(styles.includes(".accent-dot"), false);
  assert.match(styles, /@media \(prefers-contrast: more\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(index, /<meta name="theme-color" content="#f5f2ec"\s*\/?>/);
  assert.equal(manifest.theme_color, "#f5f2ec");
  assert.equal(manifest.background_color, "#f5f2ec");
});

test("goals and notification screens disclose production capability honestly", () => {
  assert.ok(app.includes("function goalPeriodMetrics("));
  assert.ok(app.includes("countedConversations(weekRange).length"));
  assert.ok(app.includes("countedConversations(monthRange).length"));
  assert.ok(app.includes("function notificationDeliveryState()"));
  assert.ok(app.includes("Notifications blocked"));
  assert.ok(app.includes("Finish turning on reminders"));
  assert.equal(app.includes("Stalled-relationship and weekly-recap notifications are not shown"), false);
  assert.equal(app.includes("Progress uses existing production calculations"), false);
  assert.equal(app.includes("View unlocked milestones and progress"), false);
  assert.match(app,/data-open-goals[\s\S]*icons\.fire|icons\.fire[\s\S]*data-open-goals/);
  assert.match(app,/next\.dailyGoal=Math\.min\(100,Math\.max\(1,/);
  assert.match(app,/next\.weeklyGoal=Math\.min\(500,Math\.max\(1,/);
  assert.match(app,/next\.monthlyGoal=Math\.min\(2000,Math\.max\(1,/);
  assert.equal(app.includes("Health notifications are not delivered"), false);
  assert.equal(app.includes("no production scheduler currently sends relationship-health reminders"), false);
  assert.equal(app.includes("weeklyGoal*3"), false);
});

test("account, data, and scorecard presentation retains production actions", () => {
  for (const id of ["syncAccountNow","changeAccountPassword","signOutAccount","deleteBridgeAccount","createCloudBackup","exportAccountData","exportBackup","exportCSV","importBackup"]) assert.ok(app.includes(`id="${id}"`), `missing production action ${id}`);
  assert.ok(app.includes("await accountClient.revokeSession("));
  assert.ok(app.includes("await accountClient.restoreBackup(action.backupId, password, confirmation)"));
  assert.ok(app.includes("data-open-scorecard-settings"));
  assert.ok(app.includes('navigatePresentation("scorecard"'));
  assert.ok(app.includes("Phone numbers, notes, follow-ups, private judgements, interest levels, and editing controls are never shared"));
  assert.ok(app.includes("Revoke link"));
});

test("Settings rows use the shared responsive and reduced-motion presentation system", () => {
  assert.match(styles, /\.settings-nav-row \{[^}]*min-height: 68px/);
  assert.match(styles, /\.settings-nav-row__copy strong \{[^}]*font-size: 15px/);
  assert.match(styles, /\.settings-route-stack \{/);
  assert.match(styles, /@media \(max-width: 359px\)[\s\S]+\.settings-nav-row/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]+\.presentation-screen \{ animation: none !important; \}/);
});
