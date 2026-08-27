export const BRIDGE_GUIDE_VERSION = "2.0";

const GUIDE_STATUS = Object.freeze({
  unseen: "unseen",
  inProgress: "in-progress",
  skipped: "skipped",
  completed: "completed"
});

const step = (definition) => Object.freeze({
  instruction: "",
  placement: "below",
  interaction: "manual",
  advanceOn: "next",
  beforeEnter: null,
  optional: false,
  ...definition
});

export const BRIDGE_GUIDE_STEPS = Object.freeze([
  step({ id:"today-overview", chapter:"Getting Oriented", route:"today", target:"today-overview", title:"Today is your starting point", description:"Today gathers the relationship signals and follow-ups that deserve attention now." }),
  step({ id:"daily-goal", chapter:"Getting Oriented", route:"today", target:"daily-goal", title:"Build a daily rhythm", description:"Only saved conversations and meetings count toward this goal. Reaching the goal contributes to your streak." }),
  step({ id:"next-up", chapter:"Getting Oriented", route:"today", target:"today-next-up", title:"Start with Next Up", description:"Bridge chooses the clearest current relationship action from your real follow-ups and relationship health signals." }),
  step({ id:"needs-attention", chapter:"Getting Oriented", route:"today", target:"today-needs-attention", title:"Review what needs attention", description:"This list brings overdue actions, quiet relationships, and other honest signals into one place." }),
  step({ id:"worth-doing", chapter:"Getting Oriented", route:"today", target:"today-worth-doing", title:"Use context before acting", description:"Worth Doing pairs a relationship signal with useful saved context so outreach feels personal." }),
  step({ id:"momentum", chapter:"Getting Oriented", route:"today", target:"today-momentum", title:"See this week’s momentum", description:"The weekly view uses recorded conversations and pipeline movements—never invented activity." }),
  step({ id:"primary-navigation", chapter:"Getting Oriented", route:"today", target:"primary-navigation", placement:"above", title:"Move through Bridge", description:"The dock opens Today, People, Capture, Pipeline, and Insights. Follow-Ups also appear from Today and Insights." }),

  step({ id:"open-capture", chapter:"Capture", route:"today", target:"capture-button", placement:"above", title:"Open Capture", description:"Capture is where every relationship update begins.", instruction:"Tap the + button below.", interaction:"target", advanceOn:"click" }),
  step({ id:"capture-types", chapter:"Capture", route:"capture-menu", target:"capture-types", placement:"above", title:"Choose what happened", description:"Record a conversation, meeting, call, text, follow-up, person, or note. Each path saves only its real activity type." }),
  step({ id:"choose-conversation", chapter:"Capture", route:"capture-menu", target:"capture-conversation", placement:"above", title:"Start a conversation", description:"The Conversation flow connects what happened to a person, place, context, and next action.", instruction:"Tap Conversation to open the guided flow.", interaction:"target", advanceOn:"click" }),
  step({ id:"choose-person", chapter:"Capture", route:"capture-conversation", target:"capture-person", title:"Choose the relationship", description:"Select an existing person or search and add someone new. Nothing is saved until the final review.", instruction:"Explore the person picker, then select Next when ready.", optional:true }),
  step({ id:"conversation-notes", chapter:"Capture", route:"capture-learned", target:"capture-notes", placement:"above", title:"Record what happened", description:"Conversation notes belong to this interaction and appear in the relationship timeline." }),
  step({ id:"what-i-know", chapter:"Capture", route:"capture-learned", target:"capture-context", placement:"above", title:"Keep durable context separate", description:"What I Know is for lasting details—goals, work, family, interests, or needs—that should help later." }),
  step({ id:"next-action", chapter:"Capture", route:"capture-next", target:"capture-next-action", placement:"above", title:"Choose the next step", description:"Save without a reminder, reconnect later, or schedule a specific follow-up with a reason and time." }),
  step({ id:"capture-tracking", chapter:"Capture", route:"capture-next", target:"capture-tracking", placement:"above", title:"Track activity and stage accurately", description:"Advanced details hold MSA and DTM activity markers plus exact Prospect or Customer stage movement. They never rewrite earlier history." }),
  step({ id:"save-capture", chapter:"Capture", route:"capture-next", target:"capture-save", placement:"above", title:"Review before saving", description:"Saving writes the activity to the person, analytics, and any chosen follow-up or stage history.", instruction:"Do not save a tutorial record. Select Next to continue safely." }),

  step({ id:"open-people", chapter:"People", route:"today", target:"nav-people", placement:"above", title:"Open People", description:"People is the complete relationship workspace.", instruction:"Tap People in the navigation.", interaction:"target", advanceOn:"click" }),
  step({ id:"people-search", chapter:"People", route:"people", target:"people-search", title:"Search saved context", description:"Search finds names, contact details, places, conversation notes, and What I Know text." }),
  step({ id:"people-filters", chapter:"People", route:"people", target:"people-filters", title:"Focus the list", description:"Quick filters and the full Filter control narrow relationships by role, stage, recency, health, follow-up state, and more." }),
  step({ id:"open-person", chapter:"People", route:"people", target:"person-row", title:"Open a relationship", description:"A person profile brings the relationship’s context, activity, actions, and pipeline history together.", instruction:"Tap any person row, or Skip step if your list is empty.", interaction:"target", advanceOn:"click", optional:true }),
  step({ id:"person-actions", chapter:"People", route:"current", target:"person-actions", placement:"below", title:"Act from the profile", description:"Call, text, log activity, schedule a follow-up, or edit the relationship from these production actions.", optional:true }),
  step({ id:"bridge-brief", chapter:"People", route:"current", target:"bridge-brief", title:"Read the Bridge Brief", description:"Bridge Brief summarizes durable What I Know context without mixing it into individual conversation notes.", optional:true }),
  step({ id:"person-timeline", chapter:"People", route:"current", target:"person-timeline", title:"Review the timeline", description:"The timeline keeps conversations, follow-ups, and exact pipeline events in chronological relationship history.", optional:true }),
  step({ id:"person-pipeline", chapter:"People", route:"current", target:"person-pipeline", title:"Understand status and history", description:"The profile shows the current stage separately from historical stage movement, along with relationship details and follow-up information.", optional:true }),

  step({ id:"open-pipeline", chapter:"Pipeline", route:"people", target:"nav-pipeline", placement:"above", title:"Open Pipeline", description:"Pipeline shows where a relationship currently stands when the next stage is clear.", instruction:"Tap Pipeline in the navigation.", interaction:"target", advanceOn:"click" }),
  step({ id:"pipeline-types", chapter:"Pipeline", route:"pipeline", target:"pipeline-tabs", title:"Keep the pipelines distinct", description:"Prospect and Customer are separate workflows. Changing tabs never changes a person’s stored role or stage." }),
  step({ id:"prospect-stages", chapter:"Pipeline", route:"pipeline", target:"prospect-stages", title:"Follow the Prospect path", description:"Prospect stages remain exactly PQI → QI/P → FUP → LA. Counts show current people; MSA and DTM remain standalone activity markers." }),
  step({ id:"customer-tab", chapter:"Pipeline", route:"pipeline", target:"customer-tab", title:"View Customer relationships", description:"Customer work uses its own exact stage sequence.", instruction:"Tap Customer to switch pipeline views.", interaction:"target", advanceOn:"click" }),
  step({ id:"customer-stages", chapter:"Pipeline", route:"current", target:"customer-stages", title:"Follow the Customer path", description:"Customer stages remain CNA → Proposal → Follow-Up → Order Placed → Active Customer." }),
  step({ id:"stage-workflow", chapter:"Pipeline", route:"pipeline", target:"pipeline-stage", title:"Open a stage when needed", description:"Each stage reveals its count and relationships. Open a person to review context before recording a real move.", optional:true }),

  step({ id:"followups-overview", chapter:"Follow-ups / Places", route:"followups", target:"followups-overview", title:"Keep promises visible", description:"Follow-Ups organizes overdue, today, upcoming, and completed actions while preserving relationship history." }),
  step({ id:"followup-actions", chapter:"Follow-ups / Places", route:"followups", target:"followup-actions", title:"Work the next action", description:"Done completes the follow-up. Reschedule changes its time. Call and Text launch the saved contact method, and the person name opens the relationship.", optional:true }),
  step({ id:"open-places", chapter:"Follow-ups / Places", route:"people", target:"people-places", title:"Open Places", description:"Places groups people and recorded interactions by genuine saved location context.", instruction:"Tap the location button beside People.", interaction:"target", advanceOn:"click" }),
  step({ id:"places-workspace", chapter:"Follow-ups / Places", route:"current", target:"places-workspace", title:"See where relationships happen", description:"Place totals come from saved people and conversations. Empty accounts stay empty—Bridge never creates tutorial data." }),

  step({ id:"open-insights", chapter:"Insights", route:"today", target:"nav-insights", placement:"above", title:"Open Insights", description:"Insights explains the activity already recorded in Bridge.", instruction:"Tap Insights in the navigation.", interaction:"target", advanceOn:"click" }),
  step({ id:"insights-week", chapter:"Insights", route:"insights", target:"insights-week", title:"Read the period summary", description:"The hero summarizes conversations, new people, pipeline movement, follow-through, and places for the selected period." }),
  step({ id:"insights-conversations", chapter:"Insights", route:"insights", target:"insights-conversations", title:"See conversation rhythm", description:"The chart uses counted conversations only, so calls, texts, and notes remain separate activity." }),
  step({ id:"insights-pipeline", chapter:"Insights", route:"insights", target:"insights-pipeline", title:"Spot pipeline signals", description:"Pipeline intelligence identifies genuine movement and relationships that may have stalled in their current exact stage." }),
  step({ id:"insights-distribution", chapter:"Insights", route:"insights", target:"insights-distribution", title:"Compare stage distribution", description:"Prospect and Customer snapshots show current people in each unchanged production stage." }),
  step({ id:"insights-followups", chapter:"Insights", route:"insights", target:"insights-followups", title:"Measure follow-through", description:"Follow-up effectiveness compares completed actions with follow-ups recorded or due in the selected period." }),
  step({ id:"analytics-periods", chapter:"Insights", route:"insights", target:"analytics-periods", title:"Choose the right period", description:"Detailed analytics offers day, week, month, and custom local-date views with the meaning of each real metric." }),

  step({ id:"open-settings", chapter:"Settings", route:"today", target:"settings-button", title:"Open Settings", description:"Settings controls your account, goals, reminders, relationship workflow, and data tools.", instruction:"Tap Settings.", interaction:"target", advanceOn:"click" }),
  step({ id:"settings-profile", chapter:"Settings", route:"settings", target:"settings-profile", title:"Manage profile and account", description:"Profile stores your Bridge identity. Account & Security manages password, sessions, and account controls when cloud accounts are enabled." }),
  step({ id:"settings-goals", chapter:"Settings", route:"settings", target:"settings-goals", title:"Set goals and protect streaks", description:"Choose daily, weekly, and monthly conversation goals. Rest days preserve streak continuity without inventing completed days." }),
  step({ id:"settings-notifications", chapter:"Settings", route:"settings", target:"settings-notifications", title:"Control reminders", description:"Configure the daily nudge and follow-up notifications according to the capabilities available on this device." }),
  step({ id:"settings-data", chapter:"Settings", route:"settings", target:"settings-data", title:"Understand data and sync", description:"Data & Sync shows whether this workspace is device-local, offline, pending, or synced to your private account." }),
  step({ id:"settings-backup", chapter:"Settings", route:"settings", target:"settings-backup", title:"Keep a recoverable backup", description:"Backup & Export provides local exports and, when configured, private cloud backup and restore tools." }),
  step({ id:"replay-guide", chapter:"Settings", route:"settings", target:"guide-replay", title:"Return whenever you need help", description:"Replay the Bridge Guide from Settings at any time. Your CRM records are never reset." }),
  step({ id:"complete", chapter:"Settings", route:"today", target:"", placement:"center", title:"You’re ready to use Bridge", description:"Capture the conversation, keep useful context, choose an honest stage, and follow through on the next step." })
]);

// Backward-compatible export for code and tests that previously imported the old name.
export const BRIDGE_WALKTHROUGH_STEPS = BRIDGE_GUIDE_STEPS;

const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
const safeQuery = selector => { try { return document.querySelector(selector); } catch { return null; } };

function firstStepIndex(stepId) {
  const index = BRIDGE_GUIDE_STEPS.findIndex(item => item.id === stepId);
  return index < 0 ? 0 : index;
}

function isFreshWorkspace(state) {
  return !Array.isArray(state?.contacts) || state.contacts.length === 0;
}

function chapterProgress(index) {
  const chapter = BRIDGE_GUIDE_STEPS[index].chapter;
  const chapterSteps = BRIDGE_GUIDE_STEPS.filter(item => item.chapter === chapter);
  const position = chapterSteps.findIndex(item => item.id === BRIDGE_GUIDE_STEPS[index].id);
  return { chapter, position: position + 1, count: chapterSteps.length };
}

export function createBridgeWalkthrough({ getState, persist, activate, close, lockScroll, bringIntoView } = {}) {
  if ([getState, persist, activate, lockScroll, bringIntoView].some(callback => typeof callback !== "function")) {
    throw new TypeError("Bridge Guide requires state, persistence, navigation, and scroll-lock handlers.");
  }

  let phase = "hidden";
  let stepIndex = 0;
  let targetAvailable = false;
  let transitioning = false;
  let activationSequence = 0;
  let focusReturn = null;
  let positionFrame = 0;
  let targetCleanup = null;
  let resizeObserver = null;
  let globalCleanup = null;
  let originScrollY = null;
  let panelPosition = null;

  const currentStep = () => BRIDGE_GUIDE_STEPS[stepIndex] || BRIDGE_GUIDE_STEPS[0];
  const active = () => phase === "active";

  function persistGuide(status, guideStep = null) {
    persist({
      version: BRIDGE_GUIDE_VERSION,
      status,
      stepId: guideStep?.id || null,
      chapter: guideStep?.chapter || null
    });
  }

  function hydrate() {
    const saved = getState()?.settings?.walkthrough || {};
    const versionMatches = String(saved.version || "") === BRIDGE_GUIDE_VERSION;
    const savedStatus = Object.values(GUIDE_STATUS).includes(saved.status) ? saved.status : GUIDE_STATUS.unseen;
    if (savedStatus === GUIDE_STATUS.unseen && isFreshWorkspace(getState())) {
      phase = "intro";
      originScrollY = window.scrollY;
      document.body.classList.add("bridge-guide-active");
      lockScroll(true);
      bindGlobalLifecycle();
      return;
    }
    if (saved.status === GUIDE_STATUS.inProgress && versionMatches) stepIndex = firstStepIndex(saved.stepId);
    phase = "hidden";
  }

  function resolveGuideTarget(guideStep = currentStep()) {
    if (!guideStep?.target) return null;
    return safeQuery(`[data-guide-target="${CSS.escape(guideStep.target)}"]`);
  }

  function targetIsReady(guideStep = currentStep()) {
    const target = resolveGuideTarget(guideStep);
    if (!target || target.hidden) return false;
    const rect = target.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function waitForGuideTarget(guideStep, sequence) {
    if (!guideStep.target) return Promise.resolve(null);
    return new Promise(resolve => {
      let framesRemaining = guideStep.optional ? 6 : 30;
      let previousRect = null;
      let stableFrames = 0;
      const check = () => {
        if (!active() || sequence !== activationSequence) return resolve(null);
        if (targetIsReady(guideStep)) {
          const target = resolveGuideTarget(guideStep);
          const rect = target.getBoundingClientRect();
          const stable = previousRect && ["top", "left", "width", "height"].every(key => Math.abs(rect[key] - previousRect[key]) < .5);
          stableFrames = stable ? stableFrames + 1 : 0;
          previousRect = rect;
          if (stableFrames >= 2) return resolve(target);
        }
        framesRemaining -= 1;
        if (framesRemaining <= 0) return resolve(null);
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
  }

  function clearTargetBinding() {
    targetCleanup?.();
    targetCleanup = null;
    resizeObserver?.disconnect();
    resizeObserver = null;
    safeQuery(".bridge-guide-target")?.classList.remove("bridge-guide-target");
  }

  function setGuideControlsBusy(root, busy) {
    root?.querySelectorAll("[data-guide-back], [data-guide-next], [data-guide-skip-step]").forEach(button => {
      button.disabled = busy || (button.matches("[data-guide-back]") && stepIndex === 0);
    });
    root?.querySelector("[data-guide-panel]")?.setAttribute("aria-busy", String(busy));
  }

  function schedulePosition() {
    if (!active() || transitioning || positionFrame) return;
    positionFrame = requestAnimationFrame(() => {
      positionFrame = 0;
      positionGuidePanel();
    });
  }

  function bindGlobalLifecycle() {
    if (globalCleanup) return;
    const stopScroll = event => {
      if (event.cancelable) event.preventDefault();
    };
    const onKeyDown = event => {
      if (event.key === "Escape") {
        event.preventDefault();
        exitGuide();
        return;
      }
      if (event.key !== "Tab") return;
      const root = safeQuery("[data-bridge-guide]");
      if (!root) return;
      const items = [resolveGuideTarget(), ...root.querySelectorAll("button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])")]
        .filter((item, index, values) => item && item.getClientRects().length && values.indexOf(item) === index);
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("resize", schedulePosition, { passive:true });
    window.addEventListener("orientationchange", schedulePosition, { passive:true });
    window.visualViewport?.addEventListener("resize", schedulePosition, { passive:true });
    window.visualViewport?.addEventListener("scroll", schedulePosition, { passive:true });
    window.addEventListener("wheel", stopScroll, { passive:false });
    window.addEventListener("touchmove", stopScroll, { passive:false });
    document.addEventListener("keydown", onKeyDown, true);
    globalCleanup = () => {
      window.removeEventListener("resize", schedulePosition);
      window.removeEventListener("orientationchange", schedulePosition);
      window.visualViewport?.removeEventListener("resize", schedulePosition);
      window.visualViewport?.removeEventListener("scroll", schedulePosition);
      window.removeEventListener("wheel", stopScroll);
      window.removeEventListener("touchmove", stopScroll);
      document.removeEventListener("keydown", onKeyDown, true);
      globalCleanup = null;
    };
  }

  function startGuide(opener = document.activeElement) {
    focusReturn = opener instanceof HTMLElement ? opener : null;
    phase = "active";
    stepIndex = 0;
    panelPosition = null;
    if (originScrollY === null) originScrollY = window.scrollY;
    document.body.classList.add("bridge-guide-active");
    lockScroll(true);
    bindGlobalLifecycle();
    enterGuideStep(0);
  }

  function restart(opener = document.activeElement) {
    if (!transitioning) startGuide(opener);
  }

  async function enterGuideStep(nextIndex, { save = true } = {}) {
    if (!active() || transitioning) return;
    transitioning = true;
    clearTargetBinding();
    if (positionFrame) cancelAnimationFrame(positionFrame);
    positionFrame = 0;
    const sequence = ++activationSequence;
    stepIndex = clamp(nextIndex, 0, BRIDGE_GUIDE_STEPS.length - 1);
    const guideStep = currentStep();
    targetAvailable = false;
    if (save) persistGuide(GUIDE_STATUS.inProgress, guideStep);
    refreshGuidePanel();
    try {
      await activate(guideStep.route, guideStep.beforeEnter);
      const target = await waitForGuideTarget(guideStep, sequence);
      if (!active() || sequence !== activationSequence) return;
      targetAvailable = Boolean(target) || !guideStep.target;
      bindGuideTarget(target, guideStep);
      positionGuidePanel({ reveal:true });
      setGuideControlsBusy(safeQuery("[data-bridge-guide]"), false);
    } finally {
      if (sequence === activationSequence) {
        transitioning = false;
        safeQuery("[data-bridge-guide]")?.classList.remove("is-transitioning");
      }
    }
  }

  function advanceGuide() {
    if (!active() || transitioning) return;
    if (stepIndex === BRIDGE_GUIDE_STEPS.length - 1) completeGuide();
    else enterGuideStep(stepIndex + 1);
  }

  function previousGuideStep() {
    if (!active() || transitioning) return;
    enterGuideStep(stepIndex - 1);
  }

  function bindGuideTarget(target, guideStep) {
    if (!target) return;
    target.classList.add("bridge-guide-target");
    const previousDescription = target.getAttribute("aria-describedby");
    if (guideStep.instruction) target.setAttribute("aria-describedby", [previousDescription, "bridgeGuideInstruction"].filter(Boolean).join(" "));
    let handled = false;
    const onTargetClick = () => {
      if (handled || guideStep.advanceOn !== "click") return;
      handled = true;
      queueMicrotask(() => requestAnimationFrame(advanceGuide));
    };
    if (guideStep.advanceOn === "click") target.addEventListener("click", onTargetClick);
    targetCleanup = () => {
      target.removeEventListener("click", onTargetClick);
      target.classList.remove("bridge-guide-target");
      if (previousDescription) target.setAttribute("aria-describedby", previousDescription);
      else target.removeAttribute("aria-describedby");
    };
    if (globalThis.ResizeObserver) {
      resizeObserver = new ResizeObserver(schedulePosition);
      resizeObserver.observe(target);
      const card = safeQuery("[data-guide-panel]");
      if (card) resizeObserver.observe(card);
    }
  }

  function exitGuide(status = GUIDE_STATUS.inProgress) {
    if (phase === "hidden") return;
    activationSequence += 1;
    transitioning = false;
    clearTargetBinding();
    globalCleanup?.();
    phase = "hidden";
    document.body.classList.remove("bridge-guide-active");
    persistGuide(status, status === GUIDE_STATUS.inProgress ? currentStep() : null);
    close?.({ status });
    bringIntoView(null, originScrollY);
    originScrollY = null;
    lockScroll(false);
    requestAnimationFrame(() => focusReturn?.isConnected && focusReturn.focus({ preventScroll:true }));
  }

  function completeGuide() {
    exitGuide(GUIDE_STATUS.completed);
  }

  function skipGuide() {
    exitGuide(GUIDE_STATUS.skipped);
  }

  function viewportMetrics() {
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0;
    const top = viewport?.offsetTop || 0;
    const width = viewport?.width || innerWidth;
    const height = viewport?.height || innerHeight;
    const safeArea = safeQuery("[data-guide-safe-area]");
    const safeStyle = safeArea ? getComputedStyle(safeArea) : null;
    const inset = property => Math.max(0, Number.parseFloat(safeStyle?.getPropertyValue(property) || "0") || 0);
    const insetTop = inset("padding-top");
    const insetRight = inset("padding-right");
    const insetBottom = inset("padding-bottom");
    const insetLeft = inset("padding-left");
    return {
      left, top, width, height,
      safeTop: top + insetTop,
      safeRight: left + width - insetRight,
      safeBottom: top + height - insetBottom,
      safeLeft: left + insetLeft
    };
  }

  function setScrim(element, { top=0, left=0, width=0, height=0 } = {}) {
    if (!element) return;
    element.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    element.style.width = `${Math.max(0, width)}px`;
    element.style.height = `${Math.max(0, height)}px`;
  }

  function centerPanel(root, panel, viewport) {
    const edge = 12;
    const left = clamp(viewport.left + (viewport.width - panel.offsetWidth) / 2, viewport.safeLeft + edge, viewport.safeRight - panel.offsetWidth - edge);
    const top = clamp(viewport.top + (viewport.height - panel.offsetHeight) / 2, viewport.safeTop + edge, viewport.safeBottom - panel.offsetHeight - edge);
    panel.style.setProperty("--guide-left", `${left}px`);
    panel.style.setProperty("--guide-top", `${top}px`);
    panelPosition = { left, top };
    root.classList.add("is-positioned", "is-fallback");
    root.classList.remove("is-targeted");
  }

  function panelPlacement(guideStep, rect, panel, viewport) {
    const edge = 12;
    const gap = 10;
    const safeTop = viewport.safeTop + edge;
    const dockClearance = safeQuery(".bridge-pattern-nav") && viewport.width <= 767 ? 82 : edge;
    const safeBottom = viewport.safeBottom - Math.max(edge, dockClearance);
    const maxLeft = Math.max(viewport.safeLeft + edge, viewport.safeRight - panel.offsetWidth - edge);
    const centeredLeft = clamp(rect.left + rect.width / 2 - panel.offsetWidth / 2, viewport.safeLeft + edge, maxLeft);
    const above = rect.top - panel.offsetHeight - gap;
    const below = rect.bottom + gap;
    const preferredAbove = guideStep.placement === "above";
    const top = preferredAbove && above >= safeTop ? above
      : !preferredAbove && below + panel.offsetHeight <= safeBottom ? below
      : above >= safeTop ? above
      : clamp(below, safeTop, safeBottom - panel.offsetHeight);
    return { left:centeredLeft, top:clamp(top, safeTop, safeBottom - panel.offsetHeight) };
  }

  function positionGuidePanel({ reveal=false } = {}) {
    const root = safeQuery("[data-bridge-guide]");
    const panel = root?.querySelector("[data-guide-panel]");
    if (!root || !panel || !active()) return;
    const guideStep = currentStep();
    const target = resolveGuideTarget(guideStep);
    const viewport = viewportMetrics();
    if (!target || !targetAvailable) {
      root.querySelectorAll("[data-guide-scrim]").forEach((scrim, index) => setScrim(scrim, index ? {} : { width:viewport.width, height:viewport.height }));
      const spotlight = root.querySelector("[data-guide-spotlight]");
      if (spotlight) spotlight.style.cssText = "";
      centerPanel(root, panel, viewport);
      panel.focus({ preventScroll:true });
      return;
    }
    let rect = target.getBoundingClientRect();
    const safeTop = viewport.top + 10;
    const safeBottom = viewport.top + viewport.height - 10;
    if (rect.top < safeTop || rect.bottom > safeBottom) {
      bringIntoView(target);
      rect = target.getBoundingClientRect();
    }
    const padding = 8;
    const left = clamp(rect.left - padding, viewport.left, viewport.left + viewport.width);
    const top = clamp(rect.top - padding, viewport.top, viewport.top + viewport.height);
    const right = clamp(rect.right + padding, viewport.left, viewport.left + viewport.width);
    const bottom = clamp(rect.bottom + padding, viewport.top, viewport.top + viewport.height);
    setScrim(root.querySelector('[data-guide-scrim="top"]'), { left:viewport.left, top:viewport.top, width:viewport.width, height:top - viewport.top });
    setScrim(root.querySelector('[data-guide-scrim="bottom"]'), { left:viewport.left, top:bottom, width:viewport.width, height:viewport.top + viewport.height - bottom });
    setScrim(root.querySelector('[data-guide-scrim="left"]'), { left:viewport.left, top, width:left - viewport.left, height:bottom - top });
    setScrim(root.querySelector('[data-guide-scrim="right"]'), { left:right, top, width:viewport.left + viewport.width - right, height:bottom - top });
    const spotlight = root.querySelector("[data-guide-spotlight]");
    if (spotlight) {
      const radius = getComputedStyle(target).borderRadius || "12px";
      spotlight.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      spotlight.style.width = `${right - left}px`;
      spotlight.style.height = `${bottom - top}px`;
      spotlight.style.borderRadius = radius;
    }
    const placement = panelPlacement(guideStep, rect, panel, viewport);
    panel.style.setProperty("--guide-left", `${placement.left}px`);
    panel.style.setProperty("--guide-top", `${placement.top}px`);
    panelPosition = placement;
    root.classList.add("is-targeted");
    root.classList.remove("is-fallback");
    if (reveal) root.classList.add("is-positioned");
    if (guideStep.advanceOn === "click") target.focus({ preventScroll:true });
    else panel.focus({ preventScroll:true });
  }

  function guidePanelMarkup() {
    const guideStep = currentStep();
    const progress = chapterProgress(stepIndex);
    const last = stepIndex === BRIDGE_GUIDE_STEPS.length - 1;
    const interactive = guideStep.advanceOn === "click";
    const middle = interactive || guideStep.optional
      ? '<button type="button" class="bridge-guide__skip" data-guide-skip-step>Skip step</button>'
      : '<button type="button" class="bridge-guide__skip" data-guide-skip>Skip guide</button>';
    const primary = interactive ? "" : `<button type="button" class="button primary" data-guide-next>${last ? "Finish" : "Next"}</button>`;
    const position = panelPosition ? ` style="--guide-left:${panelPosition.left}px;--guide-top:${panelPosition.top}px"` : "";
    return `<section class="bridge-guide__panel" data-guide-panel role="dialog" aria-modal="true" aria-labelledby="bridgeGuideTitle" aria-describedby="bridgeGuideDescription${guideStep.instruction ? " bridgeGuideInstruction" : ""}" aria-busy="${transitioning}" tabindex="-1"${position}><header class="bridge-guide__header"><strong>Bridge Guide</strong><span>${progress.chapter} · ${progress.position}/${progress.count}</span></header><div class="bridge-guide__rule" aria-hidden="true"></div><h2 id="bridgeGuideTitle">${guideStep.title}</h2><p id="bridgeGuideDescription">${guideStep.description}</p>${guideStep.instruction ? `<p class="bridge-guide__instruction" id="bridgeGuideInstruction">${guideStep.instruction}</p>` : ""}<footer class="bridge-guide__actions"><button type="button" class="button subtle" data-guide-back ${stepIndex === 0 || transitioning ? "disabled" : ""}>Back</button>${middle}${primary}</footer></section>`;
  }

  function refreshGuidePanel() {
    const root = safeQuery("[data-bridge-guide]");
    const panel = root?.querySelector("[data-guide-panel]");
    if (!root || !panel || !active()) return;
    root.classList.toggle("is-positioned", Boolean(panelPosition));
    root.classList.add("is-transitioning");
    panel.outerHTML = guidePanelMarkup();
    bind();
  }

  function markup() {
    if (phase === "hidden") return "";
    if (phase === "intro") return `<div class="bridge-guide bridge-guide--intro" data-bridge-guide><section class="bridge-guide__panel bridge-guide__panel--intro" data-guide-panel role="dialog" aria-modal="true" aria-labelledby="bridgeGuideTitle" aria-describedby="bridgeGuideDescription" tabindex="-1"><header class="bridge-guide__header"><strong>Bridge Guide</strong><span>Interactive onboarding</span></header><div class="bridge-guide__rule" aria-hidden="true"></div><h2 id="bridgeGuideTitle">Learn Bridge by using it</h2><p id="bridgeGuideDescription">Follow the highlighted controls through Today, Capture, People, Pipeline, Follow-Ups, Insights, and Settings. The guide never creates tutorial records.</p><footer class="bridge-guide__intro-actions"><button class="button subtle" type="button" data-guide-later>Not now</button><button class="button primary" type="button" data-guide-start>Start guide</button></footer></section></div>`;
    const stateClasses = `${panelPosition ? " is-positioned" : ""}${transitioning ? " is-transitioning" : ""}`;
    return `<div class="bridge-guide${stateClasses}" data-bridge-guide><div class="bridge-guide__safe-area" data-guide-safe-area aria-hidden="true"></div><div class="bridge-guide__scrim" data-guide-scrim="top"></div><div class="bridge-guide__scrim" data-guide-scrim="right"></div><div class="bridge-guide__scrim" data-guide-scrim="bottom"></div><div class="bridge-guide__scrim" data-guide-scrim="left"></div><div class="bridge-guide__spotlight" data-guide-spotlight aria-hidden="true"></div>${guidePanelMarkup()}</div>`;
  }

  function bind() {
    const root = safeQuery("[data-bridge-guide]");
    if (!root) return;
    root.querySelector("[data-guide-start]")?.addEventListener("click", event => startGuide(event.currentTarget));
    root.querySelector("[data-guide-later]")?.addEventListener("click", skipGuide);
    root.querySelector("[data-guide-back]")?.addEventListener("click", previousGuideStep);
    root.querySelector("[data-guide-next]")?.addEventListener("click", advanceGuide);
    root.querySelector("[data-guide-skip]")?.addEventListener("click", skipGuide);
    root.querySelector("[data-guide-skip-step]")?.addEventListener("click", advanceGuide);
    setGuideControlsBusy(root, transitioning);
    if (phase === "intro") requestAnimationFrame(() => root.querySelector("[data-guide-panel]")?.focus({ preventScroll:true }));
    else if (active()) {
      document.body.classList.add("bridge-guide-active");
      lockScroll(true);
      bindGlobalLifecycle();
      if (!transitioning) {
        const target = resolveGuideTarget();
        targetAvailable = Boolean(target) || !currentStep().target;
        bindGuideTarget(target, currentStep());
        requestAnimationFrame(() => positionGuidePanel({ reveal:true }));
      }
    }
  }

  function resume() {
    // Interrupted guides remain saved but do not force themselves open again.
  }

  return Object.freeze({
    active,
    advanceGuide,
    bind,
    completeGuide,
    enterGuideStep,
    exitGuide,
    hydrate,
    markup,
    positionGuidePanel,
    previousGuideStep,
    resolveGuideTarget,
    restart,
    resume,
    startGuide,
    skip: skipGuide
  });
}
