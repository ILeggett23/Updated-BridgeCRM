(function (global) {
  const RELEASE_STORAGE_KEY = "bridgeLastSeenVersion";
  const APP_RELEASE = Object.freeze({
    version: "1.3.46",
    assetVersion: "v1.3.46",
    title: "What's New",
    items: Object.freeze([
      Object.freeze({
        icon: "people",
        title: "Duplicate names stay distinct",
        description: "People who share the same name can now coexist as independent relationships with their own history and next steps."
      }),
      Object.freeze({
        icon: "userPlus",
        title: "Capture makes the choice clear",
        description: "When a name already exists, Capture keeps the existing matches visible and offers an explicit Add another action."
      }),
      Object.freeze({
        icon: "home",
        title: "Navigation stays anchored",
        description: "The mobile dock now stays attached to the physical bottom edge through sheets, forms, scrolling, and viewport changes."
      }),
      Object.freeze({
        icon: "circleCheck",
        title: "Existing relationship safeguards remain",
        description: "Phone-number duplicate detection, stable IDs, cloud sync, persistence, and relationship associations continue to work as before."
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
