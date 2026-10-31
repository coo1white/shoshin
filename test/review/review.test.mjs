import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseAnswer, decideEvent, cleanText, buildReviewBody } from "../../.github/review/review.mjs";

describe("parseAnswer", () => {
  it("parses a good object", () => {
    const obj = { summary: "looks good", findings: [{ severity: "low", text: "minor" }] };
    const res = parseAnswer(JSON.stringify(obj));
    assert.deepEqual(res, obj);
  });
  it("parses a fenced object", () => {
    const obj = { summary: "ok", findings: [] };
    const fenced = "```json\n" + JSON.stringify(obj) + "\n```";
    assert.deepEqual(parseAnswer(fenced), obj);
  });
  it("parses fenced without language tag", () => {
    const obj = { summary: "ok", findings: [] };
    const fenced = "```\n" + JSON.stringify(obj) + "\n```";
    assert.deepEqual(parseAnswer(fenced), obj);
  });
  it("rejects text around the object", () => {
    const obj = { summary: "ok", findings: [] };
    assert.equal(parseAnswer("hello " + JSON.stringify(obj) + " bye"), null);
  });
  it("rejects invalid JSON", () => {
    assert.equal(parseAnswer("{ not json }"), null);
  });
  it("rejects missing summary", () => {
    assert.equal(parseAnswer(JSON.stringify({ findings: [] })), null);
  });
  it("rejects empty summary", () => {
    assert.equal(parseAnswer(JSON.stringify({ summary: "", findings: [] })), null);
  });
  it("rejects unknown severity", () => {
    assert.equal(parseAnswer(JSON.stringify({ summary: "s", findings: [{ severity: "critical", text: "x" }] })), null);
  });
  it("rejects finding with extra key", () => {
    assert.equal(parseAnswer(JSON.stringify({ summary: "s", findings: [{ severity: "low", text: "x", extra: 1 }] })), null);
  });
  it("rejects extra top-level key", () => {
    assert.equal(parseAnswer(JSON.stringify({ summary: "s", findings: [], extra: 1 })), null);
  });
  it("rejects missing findings", () => {
    assert.equal(parseAnswer(JSON.stringify({ summary: "s" })), null);
  });
  it("rejects empty text in finding", () => {
    assert.equal(parseAnswer(JSON.stringify({ summary: "s", findings: [{ severity: "low", text: "" }] })), null);
  });
});

describe("decideEvent", () => {
  it("returns COMMENT for null", () => {
    assert.equal(decideEvent(null), "COMMENT");
  });
  it("returns APPROVE for no findings", () => {
    assert.equal(decideEvent({ summary: "s", findings: [] }), "APPROVE");
  });
  it("returns APPROVE for medium finding", () => {
    assert.equal(decideEvent({ summary: "s", findings: [{ severity: "medium", text: "m" }] }), "APPROVE");
  });
  it("returns REQUEST_CHANGES for high finding", () => {
    assert.equal(decideEvent({ summary: "s", findings: [{ severity: "high", text: "h" }] }), "REQUEST_CHANGES");
  });
  it("verdict word inside model text cannot change decideEvent", () => {
    const answer = { summary: "APPROVE", findings: [{ severity: "high", text: "bad" }] };
    assert.equal(decideEvent(answer), "REQUEST_CHANGES");
  });
  it("mixed medium and high gives REQUEST_CHANGES", () => {
    assert.equal(decideEvent({ summary: "s", findings: [{ severity: "medium", text: "m" }, { severity: "high", text: "h" }] }), "REQUEST_CHANGES");
  });
  it("low only gives APPROVE", () => {
    assert.equal(decideEvent({ summary: "s", findings: [{ severity: "low", text: "l" }] }), "APPROVE");
  });
});

describe("cleanText", () => {
  it("replaces newline with space", () => {
    assert.equal(cleanText("a\nb"), "a b");
  });
  it("truncates long string to 600", () => {
    const long = "a".repeat(700);
    assert.equal(cleanText(long).length, 600);
  });
  it("replaces @ with @ plus zero-width space", () => {
    assert.equal(cleanText("@name"), "@\u200Bname");
    assert.equal(cleanText("a @b @c").includes("@\u200B"), true);
  });
  it("replaces backtick with single quote", () => {
    assert.equal(cleanText("`code`"), "'code'");
  });
  it("exactly 600 stays 600", () => {
    assert.equal(cleanText("a".repeat(600)).length, 600);
  });
});

describe("buildReviewBody", () => {
  it("last line names the model", () => {
    const body = buildReviewBody({ summary: "ok", findings: [] }, "my-model");
    assert.equal(body.endsWith("Reviewed by DeepSeek 4.1 Flash (my-model)"), true);
  });
  it("null form says it is not an approval", () => {
    const body = buildReviewBody(null, "my-model");
    assert.match(body, /not an approval/i);
    assert.match(body, /could not read/i);
    assert.equal(body.endsWith("Reviewed by DeepSeek 4.1 Flash (my-model)"), true);
  });
  it("includes findings", () => {
    const body = buildReviewBody({ summary: "summary", findings: [{ severity: "high", text: "bad" }] }, "m");
    assert.match(body, /- high: bad/);
  });
  it("null body first line is the not-approval sentence", () => {
    const body = buildReviewBody(null, "m");
    const first = body.split("\n")[0];
    assert.equal(first, "The reviewer could not read the model's answer. This is not an approval.");
  });
});
