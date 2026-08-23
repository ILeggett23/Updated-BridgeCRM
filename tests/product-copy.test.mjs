import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const app=fs.readFileSync(path.join(root,"src/app.js"),"utf8");

test("repaired screens do not expose engineering implementation copy",()=>{
  for(const phrase of [
    "production delivery path",
    "existing production calculations",
    "pipeline history remains accurate",
    "dedicated relationship workspace",
    "no production scheduler",
    "Additional production analytics",
    "Communication logs never increase the Conversations metric",
    "Bridge stores the existing preference for compatibility"
  ]) assert.equal(app.includes(phrase),false,`remove user-facing phrase: ${phrase}`);
  assert.match(app,/Health updated \$\{escapeHTML\(fmtDateTime\(score\.calculatedAt\)\)\}/);
  assert.match(app,/<summary>More detail<\/summary>/);
});
