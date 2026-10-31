import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";

const forbidden = ["innerHTML", "insertAdjacentHTML", "outerHTML", "document.write", "eval("];

function walkJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...walkJsFiles(full));
    else if (e.isFile() && path.extname(e.name) === ".js") files.push(full);
  }
  return files;
}

const webDir = path.resolve("web");
const jsFiles = walkJsFiles(webDir);

for (const file of jsFiles) {
  test(`${path.relative(path.resolve("."), file)} does not contain HTML injection patterns`, () => {
    const content = fs.readFileSync(file, "utf8");
    for (const pat of forbidden) {
      assert.equal(content.includes(pat), false, `${file} should not contain ${pat}`);
    }
  });
}
