import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const app=fs.readFileSync(path.join(root,"src","app.js"),"utf8");
const styles=fs.readFileSync(path.join(root,"src","styles.css"),"utf8");
const between=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end));

test("Routed Person Profile owns one accessible large identity and one aria-hidden compact label",()=>{
  const header=between("function profileHeader","function relationshipProfileOverview");
  const overview=between("function relationshipProfileOverview","function contactModal");
  assert.match(header,/data-profile-collapse-header/);
  assert.match(header,/data-profile-compact-title aria-hidden="true"/);
  assert.doesNotMatch(header,/ScreenHeader\(c\.fullName/);
  assert.match(overview,/identityTitle=routed\?`<h1 id="presentationTitle" tabindex="-1" data-profile-large-title>/);
});

test("Profile collapse switches only after the large title passes the sticky header",()=>{
  const binding=between("function bindProfileCollapsingHeader","function bindContactModalEvents");
  assert.match(binding,/largeTitle\.getBoundingClientRect\(\)\.bottom<=header\.getBoundingClientRect\(\)\.bottom\+\.5/);
  assert.match(binding,/screen\.classList\.toggle\("is-profile-collapsed",next\)/);
  assert.match(binding,/window\.addEventListener\("scroll",schedule,\{passive:true\}\)/);
  assert.match(binding,/window\.addEventListener\("resize",schedule,\{passive:true\}\)/);
  assert.match(binding,/profileHeaderScrollCleanup=/);
  assert.match(styles,/\.profile-collapse-header \{/);
  assert.match(styles,/\[data-profile-compact-title\][^}]*opacity: 0;[^}]*visibility: hidden;/);
  assert.match(styles,/\.is-profile-collapsed[^}]+\[data-profile-compact-title\][^}]*opacity: 1;[^}]*visibility: visible;/);
  assert.match(styles,/@media \(prefers-reduced-motion: reduce\)[^}]*\.profile-collapse-header/);
});

test("Profile collapse controller is disposed on rerender and synchronized after scroll restoration",()=>{
  assert.match(app,/profileHeaderScrollCleanup\?\.\(\);\s*profileHeaderScrollCleanup=null;\s*profileHeaderScrollSync=null;/);
  assert.match(app,/window\.scrollTo\(\{ top:Number\(event\.state\?\.bridgeScrollY\) \|\| 0[^\n]+\n\s*profileHeaderScrollSync\?\.\(\)/);
  assert.match(app,/window\.scrollTo\(\{ top:0, left:0, behavior:"auto" \}\); profileHeaderScrollSync\?\.\(\)/);
  assert.match(app,/if\(ui\.routedScreen==="person"\)bindProfileCollapsingHeader\(\)/);
});
