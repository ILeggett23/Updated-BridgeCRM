import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectURL = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, projectURL), "utf8");
const missing = async path => {
  try {
    await access(new URL(path, projectURL));
    return false;
  } catch {
    return true;
  }
};

test("standalone project has normal npm entry points and no Sites build metadata", async () => {
  const packageJSON = JSON.parse(await read("package.json"));
  assert.equal(packageJSON.scripts.dev.includes("dev.mjs"), true);
  assert.equal(packageJSON.scripts.build.includes("build.mjs"), true);
  assert.equal(packageJSON.scripts.test.includes("node --test"), true);
  assert.equal(await missing(".openai/hosting.json"), true);
  assert.equal(await missing("dist/.openai/hosting.json"), true);
});

test("standalone configuration preserves production while supporting a local Worker", async () => {
  const config = await read("src/config.js");
  const devVariables = await read(".dev.vars.example");
  assert.match(config, /bridge-crm-api\.bridgecrm-zayway\.workers\.dev/);
  assert.match(config, /location\?\.port[^\n]+8787/);
  assert.match(devVariables, /BACKEND_ONLY=false/);
  assert.match(devVariables, /PUBLIC_APP_URL=http:\/\/localhost:8787\//);
  assert.match(devVariables, /AUTH_ENABLED=false/);
});

test("portable setup documents secrets without committing real values", async () => {
  const envExample = await read(".env.example");
  const gitignore = await read(".gitignore");
  const readme = await read("README.md");
  assert.match(envExample, /AUTH_HASH_PEPPER=replace-with/);
  assert.match(envExample, /TURNSTILE_SECRET_KEY=replace-with/);
  assert.match(gitignore, /\.env\*/);
  assert.match(gitignore, /!\.env\.example/);
  assert.match(readme, /npm install/);
  assert.match(readme, /npm run dev/);
  assert.match(readme, /npm run build/);
});
