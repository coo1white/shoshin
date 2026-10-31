import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";

const forbidden = ["innerHTML", "insertAdjacentHTML", "outerHTML", "document.write", "eval("];

function walkFiles(dir, exts) {
  let out = [];
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkFiles(full, exts));
    else if (e.isFile() && exts.includes(path.extname(e.name))) out.push(full);
  }
  return out;
}

const tsFiles = walkFiles(path.resolve("web/src/client"), [".ts"]);
const astroFiles = walkFiles(path.resolve("web/src"), [".astro"]);

for (const file of tsFiles) {
  test(`${path.relative(path.resolve("."), file)} does not contain HTML injection patterns`, () => {
    const content = fs.readFileSync(file, "utf8");
    for (const pat of forbidden) {
      assert.equal(content.includes(pat), false, `${file} should not contain ${pat}`);
    }
  });
}

for (const file of astroFiles) {
  test(`${path.relative(path.resolve("."), file)} does not contain set:html`, () => {
    const content = fs.readFileSync(file, "utf8");
    assert.equal(content.includes("set:html"), false, `${file} should not contain set:html`);
  });
}
