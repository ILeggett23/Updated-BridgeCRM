(function (global) {
  const RELEASE_STORAGE_KEY = "bridgeLastSeenVersion";
  const APP_RELEASE = Object.freeze({
    version: "1.3.6",
    assetVersion: "v1.3.6",
    title: "What's New",
    items: Object.freeze([
      Object.freeze({
        icon: "bridge",
        title: "One cohesive Bridge",
        description: "Today, People, Pipeline, Insights, Settings, forms, cards, and dialogs now share the same compact mobile design system."
      }),
      Object.freeze({
        icon: "plus",
        title: "Faster everyday interactions",
        description: "People Search, swipe actions, profile headers, and navigation now stay responsive without unnecessary page rebuilds or layout shifts."
      }),
      Object.freeze({
        icon: "circleCheck",
        title: "Your data stays put",
        description: "The update preserves your relationships, follow-ups, analytics, exact pipeline stages, history, and local or account-backed storage."
      })
    ])
  });

  function shouldShowRelease(lastSeenVersion, release = APP_RELEASE) {
    return String(lastSeenVersion || "") !== release.version;
  }

  function readLastSeenVersion(storage = global.localStorage) {
    try { return storage?.getItem(RELEASE_STORAGE_KEY) || ""; }
    catch { return ""; }
  }

  function markReleaseSeen(storage = global.localStorage, release = APP_RELEASE) {
    try {
      storage?.setItem(RELEASE_STORAGE_KEY, release.version);
      return true;
    } catch {
      return false;
    }
  }

  global.BridgeRelease = Object.freeze({
    APP_RELEASE,
    RELEASE_STORAGE_KEY,
    shouldShowRelease,
    readLastSeenVersion,
    markReleaseSeen
  });
})(globalThis);
