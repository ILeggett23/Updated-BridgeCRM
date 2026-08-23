import test from "node:test";
import assert from "node:assert/strict";

import { createBridgeFrontendFoundation } from "../src/ui-foundation.js";

const escapeHTML = (value = "") => String(value).replace(/[&<>'"]/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
})[character]);
const initials = name => String(name || "?").trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase();
const iconNames = ["home", "people", "plus", "network", "chart", "chevronLeft", "chevronRight", "chevronDown", "search", "close", "warning", "circleCheck", "pulse"];
const icons = Object.fromEntries(iconNames.map(name => [name, `<svg data-icon="${name}"></svg>`]));
const ui = { page: "dashboard", contactMode: "list", quickCreateOpen: false, routeDirection: "forward", routedScreen: "" };
const foundation = createBridgeFrontendFoundation({ escapeHTML, initials, icons, getRouteState: () => ui });

test("canonical shell renders four destinations and the centered Capture action", () => {
  const shell = foundation.AppShell("<article>Today</article>");
  assert.match(shell, /class="app-shell bridge-pattern-shell"/);
  assert.match(shell, /aria-label="Primary navigation"/);
  assert.equal((shell.match(/class="nav-button/g) || []).length, 5);
  assert.ok(shell.indexOf("People") < shell.indexOf("Capture"));
  assert.ok(shell.indexOf("Capture") < shell.indexOf("Pipeline"));
  assert.match(shell, /id="quickCreateButton" aria-haspopup="dialog" aria-expanded="false"/);
  assert.match(shell, /aria-current="page"/);
  assert.match(shell, /--nav-selection-index:0;--nav-selection-visible:1/);
});

test("navigation state follows the production page and contact mode", () => {
  ui.page = "contacts";
  ui.contactMode = "pipeline";
  assert.equal(foundation.navSelectionIndex(), 3);
  assert.match(foundation.BottomNavigation(), /data-open-pipeline[^>]+aria-label="Pipeline" aria-current="page"/);
  ui.quickCreateOpen = true;
  assert.equal(foundation.navSelectionIndex(), 3);
  assert.match(foundation.BottomNavigation(), /aria-expanded="true" aria-label="Capture what happened"/);
  assert.doesNotMatch(foundation.BottomNavigation(), /aria-label="Capture what happened" aria-current="page"/);
  ui.routedScreen = "person";
  assert.equal(foundation.navSelectionIndex(), 1);
  ui.routedScreen = "pipeline-stage";
  assert.equal(foundation.navSelectionIndex(), 3);
  ui.routedScreen = "analytics-detail";
  assert.equal(foundation.navSelectionIndex(), 4);
  ui.routedScreen = "settings";
  assert.equal(foundation.navSelectionIndex(), -1);
  ui.page = "dashboard";
  ui.contactMode = "list";
  ui.quickCreateOpen = false;
  ui.routedScreen = "";
});

test("shared headers, screens, controls, and overlays retain reference semantics", () => {
  ui.routeDirection = "back";
  ui.routedScreen = "person";
  ui.routeEntryMotion = "back";
  const screen = foundation.PresentationScreen("<p>Profile</p>", { title: "A & B", eyebrow: "Prospect" });
  assert.match(screen, /presentation-screen--back/);
  assert.match(screen, /presentation-screen--enter presentation-screen--enter-back/);
  assert.match(screen, /data-presentation-screen="person"/);
  assert.match(screen, /data-presentation-back aria-label="Back"/);
  assert.match(screen, /<h1 id="presentationTitle" tabindex="-1">A &amp; B<\/h1>/);

  assert.match(foundation.Button("Save", { tone: "primary", size: "large" }), /ui-button--primary ui-button--large/);
  assert.match(foundation.Avatar("Jasmine Dean"), />JD<\/span>/);
  assert.match(foundation.ProgressBar(3, { max: 5 }), /aria-valuenow="3"[\s\S]+--progress-value:60%/);
  assert.match(foundation.Tabs([{ label: "One", value: "one", active: true }]), /role="tablist"[\s\S]+ui-tabs__indicator[\s\S]+aria-selected="true"/);
  assert.match(foundation.MobileSheet("Body", { title: "Filters" }), /data-ui-sheet-backdrop[\s\S]+role="dialog" aria-modal="true" data-ui-dialog data-ui-sheet[\s\S]+data-ui-sheet-handle[\s\S]+data-ui-sheet-scroll/);
  assert.match(foundation.ConfirmDialog("Delete", "Are you sure?"), /role="alertdialog" aria-modal="true"/);
  ui.routeEntryMotion = "";
  assert.doesNotMatch(foundation.PresentationScreen("Body", { title:"Profile" }), /presentation-screen--enter/);
  ui.routedScreen = "";
});

test("settings rows and toggles share the reference static grammar", () => {
  const row = foundation.SettingsRow("Backup & export", { detail:"Download or restore data", end:"›" });
  assert.match(row, /class="ui-settings-row"/);
  assert.match(row, /<strong>Backup &amp; export<\/strong>/);
  assert.match(row, /Download or restore data/);
  const toggle = foundation.ToggleRow("Show relationship health", { detail:"Display scores", checked:true, name:"health" });
  assert.match(toggle, /class="ui-toggle-row"/);
  assert.match(toggle, /class="ui-toggle-input" type="checkbox" name="health" checked/);
});
