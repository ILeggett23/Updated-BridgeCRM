(() => {
  const productionAPI = "https://bridge-crm-api.bridgecrm-zayway.workers.dev";
  const hostname = String(globalThis.location?.hostname || "").toLowerCase();
  const localHost = hostname === "localhost" || hostname === "127.0.0.1";
  const injectedAPI = String(globalThis.BRIDGE_API_BASE || "").trim();

  globalThis.BridgeConfig = Object.freeze({
    apiBase: (injectedAPI || (localHost ? globalThis.location.origin : productionAPI)).replace(/\/+$/, "")
  });
})();
