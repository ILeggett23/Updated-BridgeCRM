(function (global) {
  const RELEASE_STORAGE_KEY = "bridgeLastSeenVersion";
  const APP_RELEASE = Object.freeze({
    version: "1.3.43",
    assetVersion: "v1.3.43",
    title: "What's New",
    items: Object.freeze([
      Object.freeze({
        icon: "chart",
        title: "Clearer conversation timelines",
        description: "Day, Week, and Month now use distinct activity views so hours, weekday dates, and calendar-week boundaries are immediately understandable."
      }),
      Object.freeze({
        icon: "calendar",
        title: "Calendar-correct month activity",
        description: "Every date remains visible, including zero-activity days, with subtle Sunday separators and useful month landmarks."
      }),
      Object.freeze({
        icon: "bridge",
        title: "Inspectable activity marks",
        description: "Tap or focus a mark to see its exact interval or date and conversation count without adding dashboard clutter."
      }),
      Object.freeze({
        icon: "clock",
        title: "A compact hourly Day view",
        description: "Time-stamped conversations are grouped into two-hour buckets, while date-only history remains honest and proportionally compact."
      })
    ])
  });

  function shouldShowRelease(lastSeenVersion, release = APP_RELEASE) {
    const currentRelease = release && typeof release === "object" ? release : APP_RELEASE;
    return String(lastSeenVersion ?? "") !== String(currentRelease.version ?? "");
  }

  function readLastSeenVersion(storage = global.localStorage) {
    try { return typeof storage?.getItem === "function" ? storage.getItem(RELEASE_STORAGE_KEY) || "" : ""; }
    catch { return ""; }
  }

  function markReleaseSeen(storage = global.localStorage, release = APP_RELEASE) {
    const currentRelease = release && typeof release === "object" ? release : APP_RELEASE;
    try {
      if (typeof storage?.setItem !== "function") return false;
      storage.setItem(RELEASE_STORAGE_KEY, currentRelease.version);
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
