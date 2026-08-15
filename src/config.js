(() => {
  const productionAPI = "https://bridge-crm-api.bridgecrm-zayway.workers.dev";
  const hostname = String(globalThis.location?.hostname || "").toLowerCase();
  const localWorker = (hostname === "localhost" || hostname === "127.0.0.1")
    && String(globalThis.location?.port || "") === "8787";
  const injectedAPI = String(globalThis.BRIDGE_API_BASE || "").trim();

  globalThis.BridgeConfig = Object.freeze({
    apiBase: (injectedAPI || (localWorker ? globalThis.location.origin : productionAPI)).replace(/\/+$/, "")
  });
})();
