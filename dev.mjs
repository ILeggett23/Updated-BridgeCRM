import http from "node:http";
import { readFile, writeFile } from "node:fs/promises";

const port = Number(process.env.PORT || 4173);
const configuredAPIBase = String(process.env.BRIDGE_API_BASE || "").trim().replace(/\/+$/, "");
const dataFile = new URL("./.dev-state.json", import.meta.url);
const emptyState = { contacts: [], places: [], settings: {}, meta: { version: 1 } };

const staticFiles = new Map([
  ["/styles.css", ["./src/styles.css", "text/css; charset=utf-8"]],
  ["/ui-foundation.js", ["./src/ui-foundation.js", "text/javascript; charset=utf-8"]],
  ["/contact-logic.js", ["./src/contact-logic.js", "text/javascript; charset=utf-8"]],
  ["/engagement-logic.js", ["./src/engagement-logic.js", "text/javascript; charset=utf-8"]],
  ["/communication-logic.js", ["./src/communication-logic.js", "text/javascript; charset=utf-8"]],
  ["/analytics-logic.js", ["./src/analytics-logic.js", "text/javascript; charset=utf-8"]],
  ["/relationship-health-logic.js", ["./src/relationship-health-logic.js", "text/javascript; charset=utf-8"]],
  ["/network-logic.js", ["./src/network-logic.js", "text/javascript; charset=utf-8"]],
  ["/scorecard-logic.js", ["./src/scorecard-logic.js", "text/javascript; charset=utf-8"]],
  ["/release-logic.js", ["./src/release-logic.js", "text/javascript; charset=utf-8"]],
  ["/account-client.js", ["./src/account-client.js", "text/javascript; charset=utf-8"]],
  ["/config.js", ["./src/config.js", "text/javascript; charset=utf-8"]],
  ["/app.js", ["./src/app.js", "text/javascript; charset=utf-8"]],
  ["/sw.js", ["./src/sw.js", "text/javascript; charset=utf-8"]],
  ["/manifest.webmanifest", ["./src/manifest.webmanifest", "application/manifest+json; charset=utf-8"]],
  ["/apple-touch-icon.png", ["./src/apple-touch-icon.png", "image/png"]],
  ["/bridge-icon-192.png", ["./src/bridge-icon-192.png", "image/png"]],
  ["/bridge-icon-512.png", ["./src/bridge-icon-512.png", "image/png"]],
  ["/bridge-icon-1024.png", ["./src/bridge-icon-1024.png", "image/png"]]
]);

for (const fontFile of [
  "inter-tight-latin.woff2",
  "inter-tight-latin-ext.woff2",
  "inter-tight-italic-latin.woff2",
  "inter-tight-italic-latin-ext.woff2",
  "newsreader-latin.woff2",
  "newsreader-latin-ext.woff2",
  "newsreader-italic-latin.woff2",
  "newsreader-italic-latin-ext.woff2"
]) staticFiles.set(`/fonts/${fontFile}`, [`./src/fonts/${fontFile}`, "font/woff2"]);

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === "/api/v1/config" && !configuredAPIBase) {
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.setHeader("cache-control", "no-store");
    response.end(JSON.stringify({
      authEnabled: false,
      turnstileSiteKey: "",
      emailConfigured: false,
      cloudBackupConfigured: false,
      sessionTransport: "bearer-indexeddb",
      productionReady: false
    }));
    return;
  }
  if (url.pathname === "/api/state") {
    response.setHeader("content-type", "application/json");
    if (request.method === "GET") {
      try { response.end(await readFile(dataFile, "utf8")); }
      catch { response.end(JSON.stringify(emptyState)); }
      return;
    }
    if (request.method === "PUT") {
      let body = "";
      request.on("data", chunk => { body += chunk; });
      request.on("end", async () => {
        try {
          const parsed = JSON.parse(body);
          if (!Array.isArray(parsed.contacts) || !Array.isArray(parsed.places)) throw new Error("Invalid state");
          await writeFile(dataFile, JSON.stringify(parsed));
          response.end(JSON.stringify({ ok: true }));
        } catch { response.statusCode = 400; response.end(JSON.stringify({ error: "Invalid state" })); }
      });
      return;
    }
  }
  if (url.pathname === "/config.js") {
    const configSource = await readFile(new URL("./src/config.js", import.meta.url), "utf8");
    const config = configuredAPIBase
      ? configSource.replace(
          'const injectedAPI = String(globalThis.BRIDGE_API_BASE || "").trim();',
          `const injectedAPI = String(globalThis.BRIDGE_API_BASE || ${JSON.stringify(configuredAPIBase)}).trim();`
        )
      : configSource;
    response.setHeader("content-type", "text/javascript; charset=utf-8");
    response.end(config);
    return;
  }
  const staticFile = staticFiles.get(url.pathname);
  if (staticFile) {
    response.setHeader("content-type", staticFile[1]);
    response.end(await readFile(new URL(staticFile[0], import.meta.url)));
    return;
  }
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(await readFile(new URL("./src/index.html", import.meta.url), "utf8"));
});

server.listen(port, "127.0.0.1", () => console.log(`Local URL: http://127.0.0.1:${port}`));
