// BridgeCRM's presentation foundation is adapted from the approved
// BridgeCRM-Mobile-Redesign component library. It deliberately renders HTML
// only: production state, persistence, routing decisions, and feature actions
// remain owned by app.js.

export function createBridgeFrontendFoundation({ escapeHTML, initials, icons, getRouteState }) {
  if (typeof escapeHTML !== "function" || typeof initials !== "function" || !icons || typeof getRouteState !== "function") {
    throw new TypeError("Bridge frontend foundation requires escaping, initials, icons, and route state");
  }

  let sharedPrimitiveId = 0;
  const routeState = () => getRouteState() || {};

  function navSelectionIndex() {
    const ui = routeState();
    if (ui.quickCreateOpen || ui.page === "add") return -1;
    if (ui.page === "dashboard") return 0;
    if (ui.page === "contacts") return ui.contactMode === "pipeline" ? 3 : 1;
    if (ui.page === "analytics") return 4;
    return -1;
  }

  function BottomNavigation() {
    const ui = routeState();
    const selection = navSelectionIndex();
    const destinations = [
      { label: "Today", icon: "home", active: ui.page === "dashboard", attributes: 'data-page="dashboard"' },
      { label: "People", icon: "people", active: ui.page === "contacts" && ui.contactMode !== "pipeline", attributes: "data-open-people" },
      { label: "Capture", icon: "plus", active: Boolean(ui.quickCreateOpen || ui.page === "add"), capture: true, attributes: `id="quickCreateButton" aria-haspopup="dialog" aria-expanded="${Boolean(ui.quickCreateOpen)}"` },
      { label: "Pipeline", icon: "network", active: ui.page === "contacts" && ui.contactMode === "pipeline", attributes: "data-open-pipeline" },
      { label: "Insights", icon: "chart", active: ui.page === "analytics", attributes: 'data-page="analytics"' }
    ];
    const buttons = destinations.map(destination => {
      const current = destination.active ? ' aria-current="page"' : "";
      const captureClass = destination.capture ? " quick-create-button" : "";
      const label = destination.capture ? "Capture what happened" : destination.label;
      return `<button type="button" class="nav-button${captureClass}${destination.active ? " active" : ""}" ${destination.attributes} aria-label="${escapeHTML(label)}"${current}>${icons[destination.icon]}<span>${escapeHTML(destination.label)}</span></button>`;
    }).join("");
    return `<nav class="nav bridge-pattern-nav" aria-label="Primary navigation">${buttons}<span class="nav-selection-indicator" aria-hidden="true" style="--nav-selection-index:${Math.max(0, selection)};--nav-selection-visible:${selection < 0 ? 0 : 1}"></span></nav>`;
  }

  function AppShell(content, { pageClass = "", inert = false } = {}) {
    return `<div class="app-shell bridge-pattern-shell" ${inert ? 'aria-hidden="true" inert' : ""}><main class="main"><section class="page${pageClass ? ` ${pageClass}` : ""}">${content}</section></main>${BottomNavigation()}</div>`;
  }

  function ScreenHeader(title, { eyebrow = "", action = "", back = true, large = false } = {}) {
    return `<header class="ui-screen-header${large ? " ui-screen-header--large" : ""}">${back ? `<button type="button" class="ui-screen-header__back" data-presentation-back aria-label="Back">${icons.chevronLeft}</button>` : ""}<div class="ui-screen-header__title">${eyebrow ? `<span>${escapeHTML(eyebrow)}</span>` : ""}<h1 id="presentationTitle" tabindex="-1">${escapeHTML(title)}</h1></div>${action ? `<div class="ui-screen-header__action">${action}</div>` : '<span class="ui-screen-header__spacer" aria-hidden="true"></span>'}</header>`;
  }

  function PresentationScreen(content, { className = "", title = "", eyebrow = "", action = "", back = true, large = false } = {}) {
    const ui = routeState();
    return `<section class="presentation-screen presentation-screen--${escapeHTML(ui.routeDirection || "forward")}${className ? ` ${className}` : ""}" data-presentation-screen="${escapeHTML(ui.routedScreen || "")}">${ScreenHeader(title, { eyebrow, action, back, large })}<div class="presentation-screen__body">${content}</div></section>`;
  }

  function Button(content, { tone = "secondary", size = "medium", className = "", attributes = "", type = "button" } = {}) {
    const tones = ["primary", "secondary", "quiet", "danger"];
    const sizes = ["small", "medium", "large"];
    return `<button type="${type}" class="ui-button ui-button--${tones.includes(tone) ? tone : "secondary"} ui-button--${sizes.includes(size) ? size : "medium"}${className ? ` ${className}` : ""}" ${attributes}>${content}</button>`;
  }
  function SurfaceCard(content, { cream = false, raised = false, className = "", tag = "section" } = {}) { return `<${tag} class="ui-surface-card${cream ? " ui-surface-card--cream" : ""}${raised ? " ui-surface-card--raised" : ""}${className ? ` ${className}` : ""}">${content}</${tag}>`; }
  function IconButton(iconName, label, { className = "", attributes = "", type = "button" } = {}) { return `<button type="${type}" class="ui-icon-button${className ? ` ${className}` : ""}" aria-label="${escapeHTML(label)}" ${attributes}>${icons[iconName] || ""}</button>`; }
  function StatusBadge(label, tone = "neutral") { const supported = ["brand", "info", "positive", "uncertain", "overdue"]; return `<span class="ui-status-badge${supported.includes(tone) ? ` ui-status-badge--${tone}` : ""}">${escapeHTML(label)}</span>`; }
  function ProgressBar(value, { label = "Progress", max = 100 } = {}) { const normalizedMax = Number.isFinite(Number(max)) && Number(max) > 0 ? Number(max) : 100; const normalizedValue = Math.max(0, Math.min(normalizedMax, Number.isFinite(Number(value)) ? Number(value) : 0)); const percent = normalizedValue / normalizedMax * 100; return `<div class="ui-progress" role="progressbar" aria-label="${escapeHTML(label)}" aria-valuemin="0" aria-valuemax="${normalizedMax}" aria-valuenow="${normalizedValue}"><span style="--progress-value:${percent}%"></span></div>`; }
  function SegmentedControl(items, { label = "Options", className = "" } = {}) { const activeIndex = Math.max(0, items.findIndex(item => item.active)); return `<div class="ui-segmented${className ? ` ${className}` : ""}" role="group" aria-label="${escapeHTML(label)}" style="--segment-count:${Math.max(1, items.length)};--segment-index:${activeIndex}"><span class="ui-segmented__indicator" aria-hidden="true"></span>${items.map(({ label: itemLabel, value, active = false, attributes = "" }) => `<button type="button" data-value="${escapeHTML(value)}" aria-pressed="${active}" ${attributes}>${escapeHTML(itemLabel)}</button>`).join("")}</div>`; }
  function Avatar(name, { size = "", className = "" } = {}) { const supported = ["small", "large"]; return `<span class="ui-avatar${supported.includes(size) ? ` ui-avatar--${size}` : ""}${className ? ` ${className}` : ""}" aria-hidden="true">${escapeHTML(initials(name))}</span>`; }
  function ListRow(content, { end = "", className = "", tag = "div" } = {}) { return `<${tag} class="ui-list-row${className ? ` ${className}` : ""}"><div class="ui-list-row__content">${content}</div>${end ? `<div class="ui-list-row__end">${end}</div>` : ""}</${tag}>`; }
  function Chip(label, { active = false, count = "", iconName = "", className = "", attributes = "" } = {}) { return `<button type="button" class="ui-chip${active ? " is-active" : ""}${className ? ` ${className}` : ""}" aria-pressed="${active}" ${attributes}>${iconName && icons[iconName] ? icons[iconName] : ""}<span>${escapeHTML(label)}</span>${count !== "" ? `<strong>${escapeHTML(count)}</strong>` : ""}</button>`; }
  function Menu(items, { label = "Menu", className = "" } = {}) { return `<div class="ui-menu${className ? ` ${className}` : ""}" role="menu" aria-label="${escapeHTML(label)}">${items.map(item => `<button type="button" role="menuitem" ${item.disabled ? 'disabled aria-disabled="true"' : ""} ${item.attributes || ""}>${item.iconName && icons[item.iconName] ? `<span aria-hidden="true">${icons[item.iconName]}</span>` : ""}<span><strong>${escapeHTML(item.label)}</strong>${item.description ? `<small>${escapeHTML(item.description)}</small>` : ""}</span></button>`).join("")}</div>`; }
  function MetricCard(value, label, { detail = "", iconName = "", className = "" } = {}) { return `<section class="ui-metric-card${className ? ` ${className}` : ""}">${iconName && icons[iconName] ? `<span class="ui-metric-card__icon" aria-hidden="true">${icons[iconName]}</span>` : ""}<strong class="ui-metric-card__value">${escapeHTML(value)}</strong><span class="ui-metric-card__label">${escapeHTML(label)}</span>${detail ? `<small class="ui-metric-card__detail">${escapeHTML(detail)}</small>` : ""}</section>`; }
  function MetricGrid(content, { className = "", label = "Metrics" } = {}) { return `<div class="ui-metric-grid${className ? ` ${className}` : ""}" aria-label="${escapeHTML(label)}">${content}</div>`; }
  function SectionHeader(title, { eyebrow = "", action = "", description = "", className = "", level = 2 } = {}) { const tag = [2, 3, 4].includes(Number(level)) ? `h${level}` : "h2"; return `<header class="ui-section-header${className ? ` ${className}` : ""}"><div>${eyebrow ? `<span class="ui-eyebrow">${escapeHTML(eyebrow)}</span>` : ""}<${tag}>${escapeHTML(title)}</${tag}>${description ? `<p>${escapeHTML(description)}</p>` : ""}</div>${action ? `<div class="ui-section-header__action">${action}</div>` : ""}</header>`; }
  function Tabs(items, { label = "Sections", className = "", idPrefix = "" } = {}) { const prefix = idPrefix || `ui-tabs-${++sharedPrimitiveId}`; return `<div class="ui-tabs${className ? ` ${className}` : ""}" role="tablist" aria-label="${escapeHTML(label)}">${items.map(({ label: itemLabel, value, active = false, attributes = "" }) => `<button type="button" id="${escapeHTML(prefix)}-tab-${escapeHTML(value)}" role="tab" data-value="${escapeHTML(value)}" aria-controls="${escapeHTML(prefix)}-panel-${escapeHTML(value)}" aria-selected="${active}" tabindex="${active ? "0" : "-1"}" ${attributes}>${escapeHTML(itemLabel)}</button>`).join("")}</div>`; }
  function InformationRow(label, value, { iconName = "", action = "", className = "" } = {}) { return `<div class="ui-information-row${className ? ` ${className}` : ""}">${iconName && icons[iconName] ? `<span class="ui-information-row__icon" aria-hidden="true">${icons[iconName]}</span>` : ""}<span class="ui-information-row__label">${escapeHTML(label)}</span><span class="ui-information-row__value">${escapeHTML(value || "—")}</span>${action ? `<span class="ui-information-row__action">${action}</span>` : ""}</div>`; }
  function SearchField({ id, value = "", placeholder = "Search", label = "Search", className = "", attributes = "", trailing = "" } = {}) { const inputId = escapeHTML(id || "search"); return `<div class="ui-search-field${className ? ` ${className}` : ""}"><label class="sr-only" for="${inputId}">${escapeHTML(label)}</label>${icons.search}<input id="${inputId}" type="search" value="${escapeHTML(value)}" placeholder="${escapeHTML(placeholder)}" autocomplete="off" ${attributes}>${trailing}</div>`; }
  function FilterControl({ id, label = "Filter", options = [], value = "", className = "", iconName = "", attributes = "" } = {}) { return `<label class="ui-filter-control${className ? ` ${className}` : ""}"><span class="sr-only">${escapeHTML(label)}</span>${iconName && icons[iconName] ? `<span class="ui-filter-control__icon" aria-hidden="true">${icons[iconName]}</span>` : ""}<select id="${escapeHTML(id || "filter")}" aria-label="${escapeHTML(label)}" ${attributes}>${options.map(option => { const item = typeof option === "string" ? { label: option, value: option } : option; return `<option value="${escapeHTML(item.value)}" ${String(item.value) === String(value) ? "selected" : ""}>${escapeHTML(item.label)}</option>`; }).join("")}</select><span class="ui-filter-control__chevron" aria-hidden="true">${icons.chevronDown}</span></label>`; }
  function DateNavigator(label, { previousAttributes = "", nextAttributes = "", className = "", previousClassName = "", nextClassName = "" } = {}) { return `<div class="ui-date-navigator${className ? ` ${className}` : ""}"><button type="button" class="ui-date-navigator__previous${previousClassName ? ` ${previousClassName}` : ""}" aria-label="Previous period" ${previousAttributes}>${icons.chevronRight}</button><strong aria-live="polite">${escapeHTML(label)}</strong><button type="button" class="ui-date-navigator__next${nextClassName ? ` ${nextClassName}` : ""}" aria-label="Next period" ${nextAttributes}>${icons.chevronRight}</button></div>`; }
  function EmptyState(title, text, { className = "" } = {}) { return `<div class="ui-empty-state${className ? ` ${className}` : ""}"><div><strong>${escapeHTML(title)}</strong><span>${escapeHTML(text)}</span></div></div>`; }
  function FeedbackState(kind, title, text, { action = "", className = "" } = {}) { const supported = ["info", "success", "warning", "error"]; const tone = supported.includes(kind) ? kind : "info"; const iconName = tone === "success" ? "circleCheck" : tone === "warning" || tone === "error" ? "warning" : "pulse"; return `<div class="ui-feedback ui-feedback--${tone}${className ? ` ${className}` : ""}" role="${tone === "error" ? "alert" : "status"}"><span class="ui-feedback__icon" aria-hidden="true">${icons[iconName]}</span><div><strong>${escapeHTML(title)}</strong><span>${escapeHTML(text)}</span></div>${action ? `<div class="ui-feedback__action">${action}</div>` : ""}</div>`; }
  function LoadingSkeleton({ lines = 3, className = "" } = {}) { return `<div class="ui-loading-skeleton${className ? ` ${className}` : ""}" role="status" aria-busy="true" aria-label="Loading">${Array.from({ length: Math.max(1, Number(lines) || 1) }, () => '<span aria-hidden="true"></span>').join("")}</div>`; }
  function MobileSheet(content, { title = "", id = "ui-sheet", className = "", labelledBy = "", label = "Sheet", closeAttributes = "", footer = "" } = {}) { const titleId = labelledBy || `${id}-title`; const accessibleName = title || label; const continuing = typeof document !== "undefined" && Boolean(document.getElementById(id)); return `<div class="ui-mobile-sheet-backdrop${continuing ? " is-continuing" : ""}" id="${escapeHTML(id)}" data-ui-dialog-backdrop><section class="ui-mobile-sheet${className ? ` ${className}` : ""}" role="dialog" aria-modal="true" data-ui-dialog ${title || labelledBy ? `aria-labelledby="${escapeHTML(titleId)}"` : `aria-label="${escapeHTML(accessibleName)}"`}><div class="ui-mobile-sheet__handle" aria-hidden="true"></div><header>${title ? `<h2 id="${escapeHTML(titleId)}">${escapeHTML(title)}</h2>` : ""}<button type="button" class="ui-mobile-sheet__close" aria-label="Close" data-ui-dialog-close ${closeAttributes}>${icons.close}</button></header><div class="ui-mobile-sheet__body">${content}</div>${footer ? `<footer class="ui-mobile-sheet__footer">${footer}</footer>` : ""}</section></div>`; }
  function ConfirmDialog(title, message, { confirmLabel = "Confirm", cancelLabel = "Cancel", id = "ui-confirm-dialog", className = "", confirmAttributes = "", cancelAttributes = "" } = {}) { return `<div class="ui-confirm-dialog-backdrop" id="${escapeHTML(id)}" data-ui-dialog-backdrop><section class="ui-confirm-dialog${className ? ` ${className}` : ""}" role="alertdialog" aria-modal="true" data-ui-dialog aria-labelledby="${escapeHTML(id)}-title" aria-describedby="${escapeHTML(id)}-description"><h2 id="${escapeHTML(id)}-title">${escapeHTML(title)}</h2><p id="${escapeHTML(id)}-description">${escapeHTML(message)}</p><div class="ui-confirm-dialog__actions"><button type="button" class="ui-confirm-dialog__cancel" data-ui-dialog-close ${cancelAttributes}>${escapeHTML(cancelLabel)}</button><button type="button" class="ui-confirm-dialog__confirm" ${confirmAttributes}>${escapeHTML(confirmLabel)}</button></div></section></div>`; }
  function ChartCard(title, chart, { summary = "", action = "", className = "" } = {}) { return `<section class="ui-chart-card${className ? ` ${className}` : ""}">${SectionHeader(title, { action, level: 3 })}<div class="ui-chart-card__visual" role="img" aria-label="${escapeHTML(summary || title)}">${chart}</div>${summary ? `<p class="ui-chart-card__summary">${escapeHTML(summary)}</p>` : ""}</section>`; }

  return Object.freeze({
    AppShell, BottomNavigation, ScreenHeader, PresentationScreen, navSelectionIndex,
    Button, SurfaceCard, IconButton, StatusBadge, ProgressBar, SegmentedControl,
    Avatar, ListRow, Chip, Menu, MetricCard, MetricGrid, SectionHeader, Tabs,
    InformationRow, SearchField, FilterControl, DateNavigator, EmptyState,
    FeedbackState, LoadingSkeleton, MobileSheet, ConfirmDialog, ChartCard
  });
}
