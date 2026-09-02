(function (global) {
  const RELEASE_STORAGE_KEY = "bridgeLastSeenVersion";
  const APP_RELEASE = Object.freeze({
    version: "1.3.45",
    assetVersion: "v1.3.45",
    title: "What's New",
    items: Object.freeze([
      Object.freeze({
        icon: "link",
        title: "Meet Open Span",
        description: "Bridge has a distinctive new icon: one calm span with a broken support that steps forward."
      }),
      Object.freeze({
        icon: "target",
        title: "Clear at every size",
        description: "The same silhouette remains recognizable on your Home Screen, in search, in folders, and under platform masks."
      }),
      Object.freeze({
        icon: "sparkles",
        title: "Built for light and dark surfaces",
        description: "Warm paper, deep Bridge green, and monochrome appearances all preserve the arch, gap, and forward step."
      }),
      Object.freeze({
        icon: "archive",
        title: "The previous icon is preserved",
        description: "The former production artwork remains archived with checksums for exact comparison or rollback."
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
