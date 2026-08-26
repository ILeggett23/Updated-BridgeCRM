const STEP_STATUS = Object.freeze({
  unseen: "unseen",
  inProgress: "in-progress",
  skipped: "skipped",
  completed: "completed"
});

export const BRIDGE_WALKTHROUGH_STEPS = Object.freeze([
  Object.freeze({
    id: "today",
    destination: "today",
    target: '[data-tour="today-overview"]',
    placement: "below",
    title: "Start with the relationship in front of you",
    description: "Bridge is for remembering people, not managing abstract deals. Today brings the next person or relationship signal into focus."
  }),
  Object.freeze({
    id: "daily-goal",
    destination: "today",
    target: '[data-tour="daily-goal"]',
    placement: "below",
    title: "Let conversations build momentum",
    description: "Counted conversations move your daily goal. Reaching it keeps a gentle streak going, without turning relationships into a scorecard."
  }),
  Object.freeze({
    id: "capture",
    destination: "today",
    target: '[data-tour="capture-menu"]',
    placement: "above",
    title: "Capture the moment while it is fresh",
    description: "After meeting someone, choose what happened: a conversation, call, text, meeting, follow-up, or a new person."
  }),
  Object.freeze({
    id: "relationship-context",
    destination: "capture-context",
    target: '[data-tour="capture-context"]',
    placement: "above",
    title: "Save what future you will want to remember",
    description: "The conversation records what happened. Add durable details to What I Know—goals, work, family, interests, or needs—so every next conversation has context."
  }),
  Object.freeze({
    id: "people",
    destination: "people",
    target: '[data-tour="people-workspace"]',
    placement: "below",
    title: "Every relationship has a home",
    description: "People is where everyone you meet lives. Open a person to revisit their context, activity timeline, pipeline position, and next action."
  }),
  Object.freeze({
    id: "pipeline",
    destination: "pipeline",
    target: '[data-tour="pipeline-workspace"]',
    placement: "below",
    title: "Move a relationship only when the next stage is clear",
    description: "Prospects move through PQI, QI/P, FUP, and LA. Customer relationships use CNA, Proposal, Follow-Up, Order Placed, and Active Customer. Bridge keeps those lanes distinct."
  }),
  Object.freeze({
    id: "follow-ups",
    destination: "followups",
    target: '[data-tour="followups-workspace"]',
    placement: "below",
    title: "Turn a good conversation into a real next step",
    description: "Give a follow-up a reason and a time. This queue keeps today, upcoming, and overdue promises visible until you complete or reschedule them."
  }),
  Object.freeze({
    id: "insights",
    destination: "insights",
    target: '[data-tour="insights-workspace"]',
    placement: "below",
    title: "See the relationship work you are actually doing",
    description: "Insights reflects the conversations, people, stage movement, follow-through, and places already recorded in Bridge."
  }),
  Object.freeze({
    id: "replay",
    destination: "settings",
    target: '[data-tour="walkthrough-replay"]',
    placement: "below",
    title: "Come back whenever you need a reset",
    description: "Replay this walkthrough from Settings at any time. Your people, conversations, goals, and follow-ups are never reset."
  }),
  Object.freeze({
    id: "relationship-loop",
    destination: "relationship-loop",
    target: "",
    placement: "center",
    title: "Keep the relationship loop moving",
    description: "Meet someone → capture the conversation → remember context → set the stage → choose a next step → follow through. Your next real move is simply to capture the next person you talk with."
  })
]);

const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), Math.max(minimum, maximum));

function reducedMotion() {
  return Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

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
  let missingTargetAttempts = 0;
  let missingTargetTimer = 0;
  let positionFrame = 0;
  let resizeBound = false;

  const currentStep = () => BRIDGE_WALKTHROUGH_STEPS[stepIndex] || BRIDGE_WALKTHROUGH_STEPS[0];
  const active = () => phase === "active";

  function clearPendingPosition() {
    if (positionFrame) cancelAnimationFrame(positionFrame);
    if (missingTargetTimer) clearTimeout(missingTargetTimer);
    positionFrame = 0;
    missingTargetTimer = 0;
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
      return;
    }
    if (status === STEP_STATUS.unseen && isFreshWorkspace(getState())) {
      phase = "intro";
      focusRequested = true;
      return;
    }
    phase = "hidden";
  }

  function resume() {
    if (!active()) return;
    activate(currentStep().destination);
  }

  function start(opener = document.activeElement) {
    focusReturn = opener instanceof HTMLElement ? opener : null;
    phase = "active";
    stepIndex = 0;
    missingTargetAttempts = 0;
    focusRequested = true;
    persistProgress(STEP_STATUS.inProgress, currentStep());
    activate(currentStep().destination);
  }

  function restart(opener = document.activeElement) {
    start(opener);
  }

  function go(nextIndex) {
    if (!active()) return;
    const next = clamp(nextIndex, 0, BRIDGE_WALKTHROUGH_STEPS.length - 1);
    stepIndex = next;
    missingTargetAttempts = 0;
    focusRequested = true;
    persistProgress(STEP_STATUS.inProgress, currentStep());
    activate(currentStep().destination);
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
    clearPendingPosition();
    phase = "hidden";
    persistProgress(status);
    close?.({ status });
    restoreFocus();
  }

  function finish() {
    leave(STEP_STATUS.completed);
  }

  function skip() {
    leave(STEP_STATUS.skipped);
  }

  function markup() {
    if (phase === "hidden") return "";
    if (phase === "intro") {
      return `<div class="bridge-tour bridge-tour--intro" data-bridge-walkthrough>${cardMarkup({
        intro: true,
        title: "Welcome to BridgeCRM",
        description: "A quick walkthrough will show how Bridge helps you keep track of people, conversations, and the next step that keeps each relationship moving.",
        controls: '<div class="bridge-tour__intro-actions"><button class="button subtle" type="button" data-tour-later>Maybe later</button><button class="button primary" type="button" data-tour-start>Start tour</button></div>'
      })}</div>`;
    }
    const step = currentStep();
    const count = BRIDGE_WALKTHROUGH_STEPS.length;
    const last = stepIndex === count - 1;
    const progress = `<div class="bridge-tour__progress"><span>Bridge guide</span><span>${stepIndex + 1} of ${count}</span><i role="progressbar" aria-label="Walkthrough progress" aria-valuemin="1" aria-valuemax="${count}" aria-valuenow="${stepIndex + 1}"><b style="--tour-progress:${Math.round((stepIndex + 1) / count * 100)}%"></b></i></div>`;
    const controls = `<div class="bridge-tour__actions"><button class="button subtle" type="button" data-tour-back ${stepIndex === 0 ? "disabled" : ""}>Back</button><button class="bridge-tour__skip" type="button" data-tour-skip>Skip tour</button><button class="button primary" type="button" data-tour-next>${last ? "Finish" : "Next"}</button></div>`;
    return `<div class="bridge-tour" data-bridge-walkthrough><div class="bridge-tour__scrim" data-tour-scrim="top"></div><div class="bridge-tour__scrim" data-tour-scrim="right"></div><div class="bridge-tour__scrim" data-tour-scrim="bottom"></div><div class="bridge-tour__scrim" data-tour-scrim="left"></div><div class="bridge-tour__spotlight" data-tour-spotlight aria-hidden="true"></div>${cardMarkup({ title: step.title, description: step.description, progress, controls })}</div>`;
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

  function targetFor(step) {
    if (!step?.target) return null;
    try { return document.querySelector(step.target); }
    catch { return null; }
  }

  function setScrim(scrim, { top = 0, left = 0, width = 0, height = 0 } = {}) {
    if (!scrim) return;
    scrim.style.top = `${Math.max(0, top)}px`;
    scrim.style.left = `${Math.max(0, left)}px`;
    scrim.style.width = `${Math.max(0, width)}px`;
    scrim.style.height = `${Math.max(0, height)}px`;
  }

  function renderFallback(root) {
    root.classList.add("is-fallback", "is-positioned");
    root.classList.remove("is-targeted");
    const width = window.innerWidth;
    const height = window.innerHeight;
    setScrim(root.querySelector('[data-tour-scrim="top"]'), { width, height });
    ["right", "bottom", "left"].forEach(name => setScrim(root.querySelector(`[data-tour-scrim="${name}"]`)));
    const spotlight = root.querySelector("[data-tour-spotlight]");
    if (spotlight) spotlight.style.cssText = "";
    const card = root.querySelector("[data-tour-card]");
    if (card) {
      const maxTop = Math.max(16, height - card.offsetHeight - 16);
      card.style.setProperty("--tour-card-left", `${clamp((width - card.offsetWidth) / 2, 16, width - card.offsetWidth - 16)}px`);
      card.style.setProperty("--tour-card-top", `${clamp((height - card.offsetHeight) / 2, 16, maxTop)}px`);
    }
  }

  function recoverMissingTarget(root) {
    if (missingTargetTimer || !active()) return;
    if (missingTargetAttempts >= 2) {
      renderFallback(root);
      return;
    }
    missingTargetTimer = setTimeout(() => {
      missingTargetTimer = 0;
      if (!active()) return;
      const target = targetFor(currentStep());
      if (target) {
        position(root);
        return;
      }
      missingTargetAttempts += 1;
      activate(currentStep().destination);
    }, 160);
  }

  function position(root) {
    if (!root?.isConnected || phase !== "active") return;
    const step = currentStep();
    const card = root.querySelector("[data-tour-card]");
    const target = targetFor(step);
    if (!card || !target) {
      renderFallback(root);
      recoverMissingTarget(root);
      return;
    }
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      renderFallback(root);
      recoverMissingTarget(root);
      return;
    }
    const mobile = viewportWidth <= 767;
    const safeTop = 12;
    const safeBottom = mobile ? 88 : 16;
    const needsTopScroll = rect.top < safeTop && window.scrollY > 0;
    const needsBottomScroll = rect.bottom > viewportHeight - safeBottom;
    if (needsTopScroll || needsBottomScroll) {
      target.scrollIntoView({ block: needsTopScroll ? "start" : "center", inline: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
      if (!positionFrame) positionFrame = requestAnimationFrame(() => {
        positionFrame = 0;
        setTimeout(() => position(root), reducedMotion() ? 0 : 150);
      });
      return;
    }
    missingTargetAttempts = 0;
    root.classList.add("is-targeted", "is-positioned");
    root.classList.remove("is-fallback");
    const padding = 8;
    const cutLeft = clamp(rect.left - padding, 4, viewportWidth);
    const cutTop = clamp(rect.top - padding, 4, viewportHeight);
    const cutRight = clamp(rect.right + padding, 0, viewportWidth - 4);
    const cutBottom = clamp(rect.bottom + padding, 0, viewportHeight - 4);
    setScrim(root.querySelector('[data-tour-scrim="top"]'), { width: viewportWidth, height: cutTop });
    setScrim(root.querySelector('[data-tour-scrim="bottom"]'), { top: cutBottom, width: viewportWidth, height: viewportHeight - cutBottom });
    setScrim(root.querySelector('[data-tour-scrim="left"]'), { top: cutTop, width: cutLeft, height: cutBottom - cutTop });
    setScrim(root.querySelector('[data-tour-scrim="right"]'), { top: cutTop, left: cutRight, width: viewportWidth - cutRight, height: cutBottom - cutTop });
    const spotlight = root.querySelector("[data-tour-spotlight]");
    if (spotlight) {
      spotlight.style.left = `${cutLeft}px`;
      spotlight.style.top = `${cutTop}px`;
      spotlight.style.width = `${Math.max(1, cutRight - cutLeft)}px`;
      spotlight.style.height = `${Math.max(1, cutBottom - cutTop)}px`;
    }
    const cardWidth = card.offsetWidth;
    const cardHeight = card.offsetHeight;
    const gap = 14;
    const maxLeft = Math.max(16, viewportWidth - cardWidth - 16);
    const maxTop = Math.max(safeTop, viewportHeight - cardHeight - safeBottom);
    const centeredLeft = clamp(rect.left + rect.width / 2 - cardWidth / 2, 16, maxLeft);
    const below = rect.bottom + gap;
    const above = rect.top - cardHeight - gap;
    let left = centeredLeft;
    let top = below;
    if (!mobile && step.placement === "right" && rect.right + gap + cardWidth <= viewportWidth - 16) {
      left = rect.right + gap;
      top = clamp(rect.top + rect.height / 2 - cardHeight / 2, safeTop, maxTop);
    } else if (!mobile && step.placement === "left" && rect.left - gap - cardWidth >= 16) {
      left = rect.left - gap - cardWidth;
      top = clamp(rect.top + rect.height / 2 - cardHeight / 2, safeTop, maxTop);
    } else if (below + cardHeight > viewportHeight - safeBottom && above >= safeTop) {
      top = above;
    } else if (below + cardHeight > viewportHeight - safeBottom) {
      top = clamp(viewportHeight - cardHeight - safeBottom, safeTop, maxTop);
    }
    card.style.setProperty("--tour-card-left", `${left}px`);
    card.style.setProperty("--tour-card-top", `${clamp(top, safeTop, maxTop)}px`);
    if (focusRequested) {
      focusRequested = false;
      requestAnimationFrame(() => card.focus({ preventScroll: true }));
    }
  }

  function bind() {
    const root = document.querySelector("[data-bridge-walkthrough]");
    if (!root) return;
    const card = root.querySelector("[data-tour-card]");
    root.querySelector("[data-tour-start]")?.addEventListener("click", event => start(event.currentTarget));
    root.querySelector("[data-tour-later]")?.addEventListener("click", skip);
    root.querySelector("[data-tour-back]")?.addEventListener("click", () => go(stepIndex - 1));
    root.querySelector("[data-tour-skip]")?.addEventListener("click", skip);
    root.querySelector("[data-tour-next]")?.addEventListener("click", () => {
      if (stepIndex === BRIDGE_WALKTHROUGH_STEPS.length - 1) finish();
      else go(stepIndex + 1);
    });
    bindKeyboard(card);
    if (!resizeBound) {
      resizeBound = true;
      const refresh = () => {
        if (!active()) return;
        const activeRoot = document.querySelector("[data-bridge-walkthrough]");
        if (!activeRoot || positionFrame) return;
        positionFrame = requestAnimationFrame(() => { positionFrame = 0; position(activeRoot); });
      };
      window.addEventListener("resize", refresh, { passive: true });
      window.addEventListener("scroll", refresh, { passive: true });
      window.visualViewport?.addEventListener("resize", refresh, { passive: true });
      window.visualViewport?.addEventListener("scroll", refresh, { passive: true });
    }
    requestAnimationFrame(() => {
      if (phase === "intro" && focusRequested) {
        focusRequested = false;
        card?.focus({ preventScroll: true });
      } else if (active()) position(root);
    });
    if (active()) setTimeout(() => {
      const activeRoot = document.querySelector("[data-bridge-walkthrough]");
      if (activeRoot && activeRoot.isConnected) position(activeRoot);
    }, 80);
  }

  return Object.freeze({
    active,
    bind,
    finish,
    hydrate,
    markup,
    restart,
    resume,
    skip
  });
}
