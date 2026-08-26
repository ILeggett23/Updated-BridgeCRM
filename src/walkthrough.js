const STEP_STATUS = Object.freeze({
  unseen: "unseen",
  inProgress: "in-progress",
  skipped: "skipped",
  completed: "completed"
});

export const BRIDGE_WALKTHROUGH_STEPS = Object.freeze([
  Object.freeze({ id: "today", destination: "today", target: '[data-tour="today-overview"]', placement: "below", title: "Your day at a glance", description: "Today surfaces the relationship or follow-up that most needs your attention." }),
  Object.freeze({ id: "daily-goal", destination: "today", target: '[data-tour="daily-goal"]', placement: "below", title: "Build conversation momentum", description: "Counted conversations move your daily goal. Meeting it contributes to your streak." }),
  Object.freeze({ id: "capture", destination: "today", target: '[data-tour="capture-menu"]', placement: "above", title: "Capture what happened", description: "Use Capture to add a person, conversation, call, text, meeting, follow-up, or note." }),
  Object.freeze({ id: "relationship-context", destination: "capture-context", target: '[data-tour="capture-context"]', placement: "above", title: "Remember useful context", description: "Add lasting details to What I Know so they are ready for your next conversation." }),
  Object.freeze({ id: "people", destination: "people", target: '[data-tour="people-overview"]', placement: "below", title: "Find every relationship", description: "People keeps contact details, context, activity, pipeline position, and next actions together." }),
  Object.freeze({ id: "pipeline", destination: "pipeline", target: '[data-tour="pipeline-overview"]', placement: "below", title: "Track clear stage movement", description: "Prospects move through PQI, QI/P, FUP, and LA. Switch tabs to manage the separate Customer pipeline." }),
  Object.freeze({ id: "follow-ups", destination: "followups", target: '[data-tour="followups-overview"]', placement: "below", title: "Keep every promise visible", description: "Follow-Ups organizes overdue, today, upcoming, and completed actions so the next step stays clear." }),
  Object.freeze({ id: "insights", destination: "insights", target: '[data-tour="insights-overview"]', placement: "below", title: "See relationship momentum", description: "Insights summarizes the conversations, follow-through, pipeline movement, and places already recorded." }),
  Object.freeze({ id: "replay", destination: "settings", target: '[data-tour="walkthrough-replay"]', placement: "below", title: "Replay whenever you need it", description: "Restart this guide from Settings without changing your people, activity, goals, or follow-ups." }),
  Object.freeze({ id: "relationship-loop", destination: "relationship-loop", target: "", placement: "center", title: "Keep the relationship moving", description: "Capture the conversation, remember the context, choose the stage, and follow through on the next step." })
]);

const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), Math.max(minimum, maximum));

function firstUsableStepIndex(stepId) {
  const index = BRIDGE_WALKTHROUGH_STEPS.findIndex(step => step.id === stepId);
  return index < 0 ? 0 : index;
}

function isFreshWorkspace(state) {
  return !Array.isArray(state?.contacts) || state.contacts.length === 0;
}

function cardMarkup({ title, description, progress = "", controls = "", intro = false }) {
  return `<section class="bridge-tour__card${intro ? " bridge-tour__card--intro" : ""}" data-tour-card role="dialog" aria-modal="true" aria-labelledby="bridgeTourTitle" aria-describedby="bridgeTourDescription" tabindex="-1"><div class="bridge-tour__mark" aria-hidden="true"><i></i><i></i><i></i></div>${progress}<h2 id="bridgeTourTitle">${title}</h2><p id="bridgeTourDescription">${description}</p>${controls}</section>`;
}

export function createBridgeWalkthrough({ getState, persist, activate, close } = {}) {
  if (typeof getState !== "function" || typeof persist !== "function" || typeof activate !== "function") {
    throw new TypeError("Bridge walkthrough requires state, persistence, and navigation handlers.");
  }

  let phase = "hidden";
  let stepIndex = 0;
  let focusReturn = null;
  let focusRequested = false;
  let positionFrame = 0;
  let activationSequence = 0;
  let transitioning = false;
  let listenersBound = false;

  const currentStep = () => BRIDGE_WALKTHROUGH_STEPS[stepIndex] || BRIDGE_WALKTHROUGH_STEPS[0];
  const active = () => phase === "active";

  function cancelPosition() {
    if (positionFrame) cancelAnimationFrame(positionFrame);
    positionFrame = 0;
  }

  function persistProgress(status, step = null) {
    persist({ status, stepId: step?.id || null });
  }

  function hydrate() {
    const saved = getState()?.settings?.walkthrough || {};
    const status = String(saved.status || STEP_STATUS.unseen);
    if (status === STEP_STATUS.inProgress) {
      phase = "active";
      stepIndex = firstUsableStepIndex(saved.stepId);
      focusRequested = true;
      document.documentElement.classList.add("bridge-tour-active");
      return;
    }
    if (status === STEP_STATUS.unseen && isFreshWorkspace(getState())) {
      phase = "intro";
      focusRequested = true;
      return;
    }
    phase = "hidden";
  }

  function targetFor(step) {
    if (!step?.target) return null;
    try { return document.querySelector(step.target); }
    catch { return null; }
  }

  function targetReady(step) {
    if (!step.target) return true;
    const target = targetFor(step);
    if (!target || target.hidden) return false;
    const rect = target.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function waitForTarget(step, sequence) {
    if (!step.target) return Promise.resolve(true);
    return new Promise(resolve => {
      let framesRemaining = 24;
      const check = () => {
        if (!active() || sequence !== activationSequence) return resolve(false);
        if (targetReady(step)) return resolve(true);
        framesRemaining -= 1;
        if (framesRemaining <= 0) return resolve(false);
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
  }

  function setControlsBusy(root, busy) {
    const card = root?.querySelector("[data-tour-card]");
    card?.setAttribute("aria-busy", String(busy));
    root?.querySelectorAll("[data-tour-back], [data-tour-next]").forEach(button => {
      button.disabled = busy || (button.matches("[data-tour-back]") && stepIndex === 0);
    });
  }

  async function showStep(nextIndex, { save = true } = {}) {
    if (transitioning || phase === "hidden") return;
    transitioning = true;
    document.documentElement.classList.add("bridge-tour-active");
    cancelPosition();
    const sequence = ++activationSequence;
    stepIndex = clamp(nextIndex, 0, BRIDGE_WALKTHROUGH_STEPS.length - 1);
    const step = currentStep();
    focusRequested = true;
    if (save) persistProgress(STEP_STATUS.inProgress, step);
    try {
      await activate(step.destination);
      const ready = await waitForTarget(step, sequence);
      if (!active() || sequence !== activationSequence) return;
      const root = document.querySelector("[data-bridge-walkthrough]");
      if (ready) position(root, { reveal: true, allowScroll: true });
      else renderFallback(root);
      setControlsBusy(root, false);
    } finally {
      if (sequence === activationSequence) transitioning = false;
    }
  }

  function resume() {
    if (active()) showStep(stepIndex, { save: false });
  }

  function start(opener = document.activeElement) {
    focusReturn = opener instanceof HTMLElement ? opener : null;
    phase = "active";
    document.documentElement.classList.add("bridge-tour-active");
    stepIndex = 0;
    showStep(0);
  }

  function restart(opener = document.activeElement) {
    if (!transitioning) start(opener);
  }

  function restoreFocus() {
    requestAnimationFrame(() => {
      if (focusReturn?.isConnected) focusReturn.focus({ preventScroll: true });
      else document.querySelector('[data-tour="capture-menu"], #settingsButton')?.focus({ preventScroll: true });
      focusReturn = null;
    });
  }

  function leave(status) {
    if (phase === "hidden") return;
    activationSequence += 1;
    transitioning = false;
    cancelPosition();
    phase = "hidden";
    document.documentElement.classList.remove("bridge-tour-active");
    persistProgress(status);
    close?.({ status });
    restoreFocus();
  }

  function finish() { leave(STEP_STATUS.completed); }
  function skip() { leave(STEP_STATUS.skipped); }

  function markup() {
    if (phase === "hidden") return "";
    if (phase === "intro") {
      return `<div class="bridge-tour bridge-tour--intro" data-bridge-walkthrough>${cardMarkup({
        intro: true,
        title: "Welcome to BridgeCRM",
        description: "Take a quick tour of the relationship workflow—from capture to follow-through.",
        controls: '<div class="bridge-tour__intro-actions"><button class="button subtle" type="button" data-tour-later>Maybe later</button><button class="button primary" type="button" data-tour-start>Start tour</button></div>'
      })}</div>`;
    }
    const step = currentStep();
    const count = BRIDGE_WALKTHROUGH_STEPS.length;
    const last = stepIndex === count - 1;
    const progress = `<div class="bridge-tour__progress"><span>Bridge guide</span><span>${stepIndex + 1} of ${count}</span><i role="progressbar" aria-label="Walkthrough progress" aria-valuemin="1" aria-valuemax="${count}" aria-valuenow="${stepIndex + 1}"><b style="--tour-progress:${Math.round((stepIndex + 1) / count * 100)}%"></b></i></div>`;
    const controls = `<div class="bridge-tour__actions"><button class="button subtle" type="button" data-tour-back ${stepIndex === 0 || transitioning ? "disabled" : ""}>Back</button><button class="bridge-tour__skip" type="button" data-tour-skip>Skip</button><button class="button primary" type="button" data-tour-next ${transitioning ? "disabled" : ""}>${last ? "Finish" : "Next"}</button></div>`;
    return `<div class="bridge-tour${transitioning ? " is-settling" : ""}" data-bridge-walkthrough><div class="bridge-tour__blocker" aria-hidden="true"></div><div class="bridge-tour__spotlight" data-tour-spotlight aria-hidden="true"></div>${cardMarkup({ title: step.title, description: step.description, progress, controls })}</div>`;
  }

  function bindKeyboard(card) {
    card?.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.preventDefault();
        skip();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = [...card.querySelectorAll("button:not([disabled])")];
      if (!controls.length) return;
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  function viewportMetrics() {
    const viewport = window.visualViewport;
    return { left: viewport?.offsetLeft || 0, top: viewport?.offsetTop || 0, width: viewport?.width || window.innerWidth, height: viewport?.height || window.innerHeight };
  }

  function requestFocus(card) {
    if (!focusRequested) return;
    focusRequested = false;
    requestAnimationFrame(() => card?.focus({ preventScroll: true }));
  }

  function renderFallback(root) {
    if (!root?.isConnected) return;
    root.classList.add("is-fallback", "is-positioned");
    root.classList.remove("is-targeted", "is-settling");
    const spotlight = root.querySelector("[data-tour-spotlight]");
    if (spotlight) spotlight.style.cssText = "";
    const card = root.querySelector("[data-tour-card]");
    if (!card) return;
    const viewport = viewportMetrics();
    const rootRect = root.getBoundingClientRect();
    const edge = 12;
    const left = viewport.left + clamp((viewport.width - card.offsetWidth) / 2, edge, viewport.width - card.offsetWidth - edge);
    const top = viewport.top + clamp((viewport.height - card.offsetHeight) / 2, edge, viewport.height - card.offsetHeight - edge);
    card.style.setProperty("--tour-card-left", `${left - rootRect.left}px`);
    card.style.setProperty("--tour-card-top", `${top - rootRect.top}px`);
    requestFocus(card);
  }

  function placeCard(step, rect, card, viewport, safeBottom) {
    const edge = 12;
    const gap = 10;
    const cardWidth = card.offsetWidth;
    const cardHeight = card.offsetHeight;
    const minLeft = viewport.left + edge;
    const maxLeft = Math.max(minLeft, viewport.left + viewport.width - cardWidth - edge);
    const minTop = viewport.top + edge;
    const maxTop = Math.max(minTop, viewport.top + viewport.height - cardHeight - safeBottom);
    const centeredLeft = clamp(rect.left + rect.width / 2 - cardWidth / 2, minLeft, maxLeft);
    const candidates = {
      below: { left: centeredLeft, top: rect.bottom + gap, fits: rect.bottom + gap + cardHeight <= viewport.top + viewport.height - safeBottom },
      above: { left: centeredLeft, top: rect.top - cardHeight - gap, fits: rect.top - cardHeight - gap >= minTop },
      right: { left: rect.right + gap, top: clamp(rect.top + rect.height / 2 - cardHeight / 2, minTop, maxTop), fits: rect.right + gap + cardWidth <= viewport.left + viewport.width - edge },
      left: { left: rect.left - cardWidth - gap, top: clamp(rect.top + rect.height / 2 - cardHeight / 2, minTop, maxTop), fits: rect.left - cardWidth - gap >= minLeft }
    };
    const order = [step.placement, step.placement === "above" ? "below" : "above", "right", "left"].filter((value, index, values) => value && values.indexOf(value) === index);
    const selected = order.map(name => candidates[name]).find(candidate => candidate?.fits) || candidates[step.placement] || candidates.below;
    return { left: clamp(selected.left, minLeft, maxLeft), top: clamp(selected.top, minTop, maxTop) };
  }

  function position(root, { reveal = false, allowScroll = false } = {}) {
    if (!root?.isConnected || !active()) return;
    const step = currentStep();
    const card = root.querySelector("[data-tour-card]");
    const target = targetFor(step);
    if (!card || !target) {
      renderFallback(root);
      return;
    }
    const viewport = viewportMetrics();
    const rootRect = root.getBoundingClientRect();
    const mobile = viewport.width <= 767;
    const safeBottom = mobile ? 82 : 12;
    let rect = target.getBoundingClientRect();
    const viewTop = viewport.top + 8;
    const viewBottom = viewport.top + viewport.height - safeBottom;
    if (allowScroll && (rect.top < viewTop || rect.bottom > viewBottom)) {
      target.scrollIntoView({ block: rect.bottom > viewBottom ? "center" : "nearest", inline: "nearest", behavior: "auto" });
      rect = target.getBoundingClientRect();
    }
    if (!rect.width || !rect.height) {
      renderFallback(root);
      return;
    }
    const padding = 6;
    const left = clamp(rect.left - padding, viewport.left + 2, viewport.left + viewport.width - 2);
    const top = clamp(rect.top - padding, viewport.top + 2, viewport.top + viewport.height - 2);
    const right = clamp(rect.right + padding, viewport.left + 2, viewport.left + viewport.width - 2);
    const bottom = clamp(rect.bottom + padding, viewport.top + 2, viewport.top + viewport.height - 2);
    const spotlight = root.querySelector("[data-tour-spotlight]");
    if (spotlight) {
      spotlight.style.transform = `translate3d(${left - rootRect.left}px, ${top - rootRect.top}px, 0)`;
      spotlight.style.width = `${Math.max(1, right - left)}px`;
      spotlight.style.height = `${Math.max(1, bottom - top)}px`;
    }
    const cardPosition = placeCard(step, rect, card, viewport, safeBottom);
    card.style.setProperty("--tour-card-left", `${cardPosition.left - rootRect.left}px`);
    card.style.setProperty("--tour-card-top", `${cardPosition.top - rootRect.top}px`);
    root.classList.add("is-targeted");
    root.classList.remove("is-fallback", "is-settling");
    if (reveal) root.classList.add("is-positioned");
    requestFocus(card);
  }

  function schedulePosition() {
    if (!active() || positionFrame || transitioning) return;
    positionFrame = requestAnimationFrame(() => {
      positionFrame = 0;
      position(document.querySelector("[data-bridge-walkthrough]"), { reveal: true });
    });
  }

  function bindGlobalListeners() {
    if (listenersBound) return;
    listenersBound = true;
    window.addEventListener("resize", schedulePosition, { passive: true });
    window.addEventListener("scroll", schedulePosition, { passive: true });
    window.visualViewport?.addEventListener("resize", schedulePosition, { passive: true });
    window.visualViewport?.addEventListener("scroll", schedulePosition, { passive: true });
  }

  function bind() {
    const root = document.querySelector("[data-bridge-walkthrough]");
    if (!root) return;
    const card = root.querySelector("[data-tour-card]");
    root.querySelector("[data-tour-start]")?.addEventListener("click", event => start(event.currentTarget));
    root.querySelector("[data-tour-later]")?.addEventListener("click", skip);
    root.querySelector("[data-tour-back]")?.addEventListener("click", () => showStep(stepIndex - 1));
    root.querySelector("[data-tour-skip]")?.addEventListener("click", skip);
    root.querySelector("[data-tour-next]")?.addEventListener("click", () => {
      if (transitioning) return;
      if (stepIndex === BRIDGE_WALKTHROUGH_STEPS.length - 1) finish();
      else showStep(stepIndex + 1);
    });
    bindKeyboard(card);
    bindGlobalListeners();
    setControlsBusy(root, transitioning);
    requestAnimationFrame(() => {
      if (phase === "intro" && focusRequested) {
        focusRequested = false;
        card?.focus({ preventScroll: true });
      } else if (active() && !transitioning) position(root, { reveal: true });
    });
  }

  return Object.freeze({ active, bind, finish, hydrate, markup, restart, resume, skip });
}
