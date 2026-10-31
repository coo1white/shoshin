import assert from "node:assert/strict";
import { test } from "node:test";
import { viewModel, markLabel } from "../../web/view.js";

test("viewModel: headline text, next, others leave out next and install-only, evidence short commit", () => {
  const result = {
    owner: "owner",
    repo: "repo",
    commit: "abcdef1234567890",
    yokoten_version: "1.2.3",
    about: "about",
    rerun: { doctor: "npx yokoten doctor", check: "npx yokoten check" },
    summary: {
      done: 3,
      total: 10,
      next: {
        id: "next-id",
        title: "Next Title",
        what: "what next",
        why: "why next",
        fix: "fix next",
        how: "how next",
        docs: "https://example.com/docs",
      },
      steps: [
        { id: "next-id", title: "Next Title", mark: "to do", how: "h" },
        { id: "other-1", title: "Other One", mark: "done", how: "h2" },
        { id: "install-1", title: "Install One", mark: "done", how: "h3" },
      ],
      install_only: [
        { id: "install-1", title: "Install One", mark: "done", how: "h3" },
      ],
    },
    secrets: [],
  };

  const vm = viewModel(result);
  // headline
  assert.equal(vm.headline, "done 3 of 10 file checks · next: Next Title");
  // next
  assert.ok(vm.next);
  assert.equal(vm.next.title, "Next Title");
  assert.equal(vm.next.id, "next-id");
  // others leaves out next and install-only
  assert.equal(vm.others.length, 1);
  assert.equal(vm.others[0].id, "other-1");
  // evidence short commit
  assert.equal(vm.evidence.shortCommit, "abcdef1");
  assert.equal(vm.evidence.commit, "abcdef1234567890");
  assert.equal(vm.evidence.version, "1.2.3");
});

test("markLabel for each mark, including unknown and not now with reason", () => {
  assert.equal(markLabel("done"), "done");
  assert.equal(markLabel("to do"), "to do");
  assert.equal(markLabel("next"), "to do");
  assert.equal(markLabel("not now"), "skipped on purpose");
  assert.equal(markLabel("not now", "we decided"), "skipped on purpose: we decided");
  assert.equal(markLabel("can't check"), "can't tell from the web");
  assert.equal(markLabel("something-unknown"), "unknown");
});

test("all-done case has next null", () => {
  const result = {
    commit: "abc123def4567899",
    yokoten_version: "2.0",
    summary: {
      done: 10,
      total: 10,
      next: null,
      steps: [],
      install_only: [],
    },
    secrets: [],
  };
  const vm = viewModel(result);
  assert.equal(vm.next, null);
  assert.equal(vm.headline, "done 10 of 10 file checks");
});

test("viewModel: secrets grouped by id in first-seen order", () => {
  const result = {
    summary: { done: 0, total: 0, steps: [], install_only: [] },
    secrets: [
      { id: "a", what: "what a", why: "why a", fix: "fix a", file: "file1.txt", line: 10 },
      { id: "b", what: "what b", why: "why b", fix: "fix b", file: "file2.txt", line: 5 },
      { id: "a", what: "what a second", why: "why a second", fix: "fix a second", file: "file3.txt", line: 20 },
    ],
  };
  const vm = viewModel(result);
  assert.equal(vm.secretCount, 3);
  assert.equal(vm.secretGroups.length, 2);
  // first-seen order: a then b
  assert.equal(vm.secretGroups[0].what, "what a");
  assert.equal(vm.secretGroups[0].why, "why a");
  assert.equal(vm.secretGroups[0].fix, "fix a");
  assert.deepEqual(vm.secretGroups[0].places, ["file1.txt:10", "file3.txt:20"]);
  assert.equal(vm.secretGroups[1].what, "what b");
  assert.deepEqual(vm.secretGroups[1].places, ["file2.txt:5"]);
});

test("viewModel: places with and without line", () => {
  const result = {
    summary: { done: 0, total: 0, steps: [], install_only: [] },
    secrets: [
      { id: "x", what: "w", why: "y", fix: "f", file: "a.txt", line: 1 },
      { id: "x", what: "w", why: "y", fix: "f", file: "b.txt" },
      { id: "x", what: "w", why: "y", fix: "f", file: "c.txt", line: null },
    ],
  };
  const vm = viewModel(result);
  assert.equal(vm.secretCount, 3);
  assert.equal(vm.secretGroups.length, 1);
  assert.deepEqual(vm.secretGroups[0].places, ["a.txt:1", "b.txt", "c.txt"]);
});

test("viewModel: secretCount total and empty case", () => {
  const emptyResult = {
    summary: { done: 0, total: 0, steps: [], install_only: [] },
    secrets: [],
  };
  const vmEmpty = viewModel(emptyResult);
  assert.equal(vmEmpty.secretCount, 0);
  assert.deepEqual(vmEmpty.secretGroups, []);

  const oneResult = {
    summary: { done: 0, total: 0, steps: [], install_only: [] },
    secrets: [{ id: "only", what: "w", why: "y", fix: "f", file: "f.txt", line: 2 }],
  };
  const vmOne = viewModel(oneResult);
  assert.equal(vmOne.secretCount, 1);
  assert.equal(vmOne.secretGroups.length, 1);
  assert.deepEqual(vmOne.secretGroups[0].places, ["f.txt:2"]);
});

test("viewModel: grouping preserves first-seen order with many ids", () => {
  const result = {
    summary: { done: 0, total: 0, steps: [], install_only: [] },
    secrets: [
      { id: "b", what: "wb", why: "yb", fix: "fb", file: "b.txt", line: 1 },
      { id: "a", what: "wa", why: "ya", fix: "fa", file: "a.txt", line: 1 },
      { id: "b", what: "wb2", why: "yb2", fix: "fb2", file: "b2.txt", line: 2 },
      { id: "c", what: "wc", why: "yc", fix: "fc", file: "c.txt" },
    ],
  };
  const vm = viewModel(result);
  assert.equal(vm.secretCount, 4);
  assert.equal(vm.secretGroups.length, 3);
  assert.equal(vm.secretGroups[0].what, "wb");
  assert.deepEqual(vm.secretGroups[0].places, ["b.txt:1", "b2.txt:2"]);
  assert.equal(vm.secretGroups[1].what, "wa");
  assert.equal(vm.secretGroups[2].what, "wc");
  assert.deepEqual(vm.secretGroups[2].places, ["c.txt"]);
});
