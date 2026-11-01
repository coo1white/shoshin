import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { claudeImportMessage } from "../../web/src/client/fixes.ts";

describe("claudeImportMessage", () => {
  it("returns message with value", () => {
    const fixes = { claude_import: { file: "CLAUDE.md", line: "@AGENTS.md" } };
    const msg = claudeImportMessage(fixes);
    assert.equal(
      msg,
      "Your repo already has CLAUDE.md. Add this line to it so Claude Code picks up the new rules: @AGENTS.md"
    );
  });

  it("returns empty string with null", () => {
    const fixes = { claude_import: null };
    assert.equal(claudeImportMessage(fixes), "");
  });

  it("returns empty string when fixes has no such field", () => {
    const fixes = {};
    assert.equal(claudeImportMessage(fixes), "");
  });

  it("returns empty string when claude_import missing file or line", () => {
    assert.equal(claudeImportMessage({ claude_import: { file: "CLAUDE.md" } }), "");
    assert.equal(claudeImportMessage({ claude_import: { line: "@AGENTS.md" } }), "");
    assert.equal(claudeImportMessage({ claude_import: {} }), "");
  });

  it("handles .claude/CLAUDE.md variant", () => {
    const fixes = { claude_import: { file: ".claude/CLAUDE.md", line: "@../AGENTS.md" } };
    const msg = claudeImportMessage(fixes);
    assert.equal(
      msg,
      "Your repo already has .claude/CLAUDE.md. Add this line to it so Claude Code picks up the new rules: @../AGENTS.md"
    );
  });
});
