import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";

const forbidden = ["innerHTML", "insertAdjacentHTML", "outerHTML", "document.write", "eval("];

for (const file of ["web/app.js", "web/view.js"]) {
  test(`${file} does not contain HTML injection patterns`, () => {
    const content = fs.readFileSync(path.resolve(file), "utf8");
    for (const pat of forbidden) {
      assert.equal(content.includes(pat), false, `${file} should not contain ${pat}`);
    }
  });
}
