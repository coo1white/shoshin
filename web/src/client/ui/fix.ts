import { createLink, addCopyButton } from "./dom.ts";
import { fileLinkPlan, buildPatch, orderFiles, fixMessage, claudeImportMessage, PATCH_COMMANDS, projectSection } from "../fixes.ts";
import type { CheckResult, FixesPayload, ViewModel } from "../types.ts";

function createFileRow(owner: string, repo: string, branch: string | null, file: { path: string; content: string; source?: string }, isFirst: boolean, lastFixes: FixesPayload | null): HTMLLIElement {
  const li = document.createElement("li");
  li.className = isFirst ? "file-row is-first" : "file-row";
  const pathSpan = document.createElement("span");
  pathSpan.className = "file-path";
  pathSpan.textContent = file.path;
  li.appendChild(pathSpan);
  const plan = fileLinkPlan(owner, repo, branch, file);
  const action = document.createElement("a");
  action.href = plan.href;
  action.textContent = "Add on GitHub";
  action.target = "_blank";
  action.rel = "noopener noreferrer";
  if (isFirst) action.className = "file-action-primary";
  else action.className = "file-action-link";
  li.appendChild(action);

  const details = document.createElement("details");
  details.setAttribute("data-key", "read-" + file.path);
  const sum = document.createElement("summary");
  sum.textContent = "Read this file";
  details.appendChild(sum);
  if (file.source === "yokoten and Muse") {
    const museNote = document.createElement("p");
    museNote.className = "small";
    museNote.textContent = "The section called This project is suggested by Muse. Read it before you apply it.";
    details.appendChild(museNote);
  }
  const preWrap = document.createElement("div");
  preWrap.className = "code-wrap";
  const pre = document.createElement("pre");
  pre.className = "fix-code";
  const code = document.createElement("code");
  code.textContent = file.content;
  pre.appendChild(code);
  preWrap.appendChild(pre);
  const copyBtn2 = addCopyButton("Copy", file.content, code);
  preWrap.appendChild(copyBtn2);
  details.appendChild(preWrap);
  if (file.path === "AGENTS.md" && lastFixes) {
    const msg = claudeImportMessage(lastFixes);
    if (msg) {
      const claudeP = document.createElement("p");
      claudeP.textContent = msg;
      details.appendChild(claudeP);
    }
  }
  if (plan.kind !== "filled") {
    const hint = document.createElement("p");
    hint.className = "small muted";
    hint.textContent = "Paste it into the empty box on GitHub. Then choose a new branch to open a pull request.";
    details.appendChild(hint);
  } else {
    const hint = document.createElement("p");
    hint.className = "small muted";
    hint.textContent = "GitHub asks you to commit. Choose a new branch to open a pull request.";
    details.appendChild(hint);
  }
  const wrap = document.createElement("div");
  wrap.className = "file-details-wrap";
  wrap.appendChild(details);
  li.appendChild(wrap);
  return li;
}

export function renderFixSection({ vm, lastFixes, isWaitingForFixes, lastResult }: { vm: ViewModel; lastFixes: FixesPayload | null; isWaitingForFixes: boolean; lastResult: CheckResult }): HTMLElement {
  const section = document.createElement("section");
  section.id = "fix";
  section.className = "section-band";
  const inner = document.createElement("div");
  inner.className = "section-band-inner";
  section.appendChild(inner);

  const left = document.createElement("div");
  left.className = "fix-left";
  inner.appendChild(left);

  const label = document.createElement("p");
  label.className = "section-label";
  const num = document.createElement("span");
  num.textContent = "01 \u00b7";
  label.appendChild(num);
  label.appendChild(document.createTextNode(" Fix it"));
  left.appendChild(label);

  if (isWaitingForFixes && !lastFixes) {
    const h2 = document.createElement("h2");
    h2.className = "section-title";
    h2.textContent = "Fix it";
    left.appendChild(h2);
    const waitingP = document.createElement("p");
    waitingP.textContent = "Writing the fix files…";
    left.appendChild(waitingP);
    return section;
  }

  if (lastFixes) {
    if (lastFixes.muse === "lost") {
      const h2 = document.createElement("h2");
      h2.className = "section-title";
      h2.textContent = "Fix it";
      left.appendChild(h2);
      const lostP = document.createElement("p");
      lostP.textContent = "The fix files did not arrive. Please run the check again.";
      left.appendChild(lostP);
      return section;
    }
    const files = lastFixes.files || [];
    const hasOpenInstallOnly = vm.installOnly.length > 0;
    const msg = fixMessage(lastFixes);
    const shouldShowFixMessage = !(files.length === 0 && hasOpenInstallOnly);
    if (msg && shouldShowFixMessage) {
      const msgP = document.createElement("p");
      msgP.textContent = msg;
      left.appendChild(msgP);
    }
    if (files.length === 0 && hasOpenInstallOnly) {
      const h2 = document.createElement("h2");
      h2.className = "section-title";
      h2.textContent = "No files to add";
      left.appendChild(h2);
      const noFilesP = document.createElement("p");
      noFilesP.textContent = "Files from this page can't add what is left. The next section says what can.";
      left.appendChild(noFilesP);
    }
    if (files.length > 0) {
      const count = files.length;
      const h2 = document.createElement("h2");
      h2.className = "section-title";
      h2.textContent = count === 1 ? "1 file for this repo" : `${count} files for this repo`;
      left.appendChild(h2);
      const notice = document.createElement("p");
      notice.className = "muted";
      notice.textContent = "Nothing changes until you click Commit on GitHub. We have no access to your repo.";
      left.appendChild(notice);
      const owner = String(lastResult.owner ?? "");
      const repo = String(lastResult.repo ?? "");
      const branch = (lastResult.default_branch as string | null) ?? (lastResult.branch as string | null) ?? null;
      const ordered = orderFiles(files);
      const allFiles: { path: string; content: string; source?: string }[] = [];
      if (ordered.first) allFiles.push(ordered.first);
      for (const f of ordered.rest) allFiles.push(f);
      const ul = document.createElement("ul");
      ul.className = "file-list";
      for (let i = 0; i < allFiles.length; i++) {
        const row = createFileRow(owner, repo, branch, allFiles[i], i === 0, lastFixes);
        ul.appendChild(row);
      }
      left.appendChild(ul);

      const termDetails = document.createElement("details");
      termDetails.setAttribute("data-key", "use-terminal");
      const termSum = document.createElement("summary");
      termSum.textContent = "Use the terminal instead";
      termDetails.appendChild(termSum);
      const p2 = document.createElement("p");
      p2.className = "muted";
      p2.textContent = "Download the patch, then apply it in your repo.";
      termDetails.appendChild(p2);
      const dlBtn = document.createElement("button");
      dlBtn.textContent = "Download the patch";
      dlBtn.className = "button-quiet";
      dlBtn.type = "button";
      dlBtn.addEventListener("click", () => {
        const patch = buildPatch(files);
        const blob = new Blob([patch], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "yokoten-doctor.patch";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
      termDetails.appendChild(dlBtn);
      const putP = document.createElement("p");
      putP.textContent = "Put the file in your repo's folder, then run:";
      termDetails.appendChild(putP);
      const wrap = document.createElement("div");
      wrap.className = "code-wrap";
      const pre2 = document.createElement("pre");
      const code2 = document.createElement("code");
      code2.textContent = PATCH_COMMANDS;
      pre2.appendChild(code2);
      wrap.appendChild(pre2);
      const copyBtn3 = addCopyButton("Copy", PATCH_COMMANDS, code2);
      wrap.appendChild(copyBtn3);
      termDetails.appendChild(wrap);
      left.appendChild(termDetails);
    } else {
      if (lastFixes.muse !== "failed") {
        const hasOpen = vm.installOnly.length > 0;
        if (!hasOpen) {
          const h2 = document.createElement("h2");
          h2.className = "section-title";
          h2.textContent = "0 files for this repo";
          left.appendChild(h2);
          const nothingP = document.createElement("p");
          nothingP.textContent = "Nothing to fix here.";
          left.appendChild(nothingP);
        }
      } else {
        const h2 = document.createElement("h2");
        h2.className = "section-title";
        h2.textContent = "Fix it";
        left.appendChild(h2);
      }
    }
  } else {
    const h2 = document.createElement("h2");
    h2.className = "section-title";
    h2.textContent = "Fix it";
    left.appendChild(h2);
  }

  const hasAgents = lastFixes && lastFixes.files && lastFixes.files.some((f) => f.path === "AGENTS.md");
  if (hasAgents) {
    const agentsFile = (lastFixes as FixesPayload).files.find((f) => f.path === "AGENTS.md");
    const content = agentsFile ? agentsFile.content : "";
    const text = projectSection(content);
    const fig = document.createElement("figure");
    fig.className = "terminal-window";
    const head = document.createElement("figcaption");
    head.className = "terminal-head";
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement("span");
      dot.className = "terminal-dot";
      dot.setAttribute("aria-hidden", "true");
      head.appendChild(dot);
    }
    const t1 = document.createElement("span");
    t1.textContent = "AGENTS.MD";
    head.appendChild(t1);
    const t2 = document.createElement("span");
    t2.textContent = "WRITTEN BY MUSE. READ IT FIRST.";
    t2.className = "muse-label";
    head.appendChild(t2);
    fig.appendChild(head);
    const body = document.createElement("div");
    body.className = "terminal-body agents-terminal-body";
    const pre = document.createElement("pre");
    pre.className = "agents-pre";
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineSpan = document.createElement("span");
      lineSpan.className = "agents-line";
      if (line.startsWith("#")) lineSpan.classList.add("is-heading");
      if (line.startsWith("TODO")) lineSpan.classList.add("is-todo");
      lineSpan.textContent = line;
      pre.appendChild(lineSpan);
      if (i < lines.length - 1) pre.appendChild(document.createTextNode("\n"));
    }
    body.appendChild(pre);
    fig.appendChild(body);
    inner.appendChild(fig);
  }

  return section;
}

export function renderGuardSection({ vm }: { vm: ViewModel }): HTMLElement | null {
  if (!vm.installOnly || vm.installOnly.length === 0) return null;
  const section = document.createElement("section");
  section.className = "section-split guard-section";
  const left = document.createElement("div");
  const label = document.createElement("p");
  label.className = "section-label";
  const num = document.createElement("span");
  num.textContent = "02 \u00b7";
  label.appendChild(num);
  label.appendChild(document.createTextNode(" The guard"));
  left.appendChild(label);
  const n = vm.installOnly.length;
  const h2 = document.createElement("h2");
  h2.className = "section-title";
  h2.textContent = n === 1 ? "1 step needs yokoten" : `${n} steps need yokoten`;
  left.appendChild(h2);
  const ul = document.createElement("ul");
  ul.className = "guard-list";
  for (const s of vm.installOnly) {
    const li = document.createElement("li");
    li.textContent = s.title;
    ul.appendChild(li);
  }
  left.appendChild(ul);
  const p2 = document.createElement("p");
  p2.className = "muted";
  p2.textContent = "Files from this page can't add them.";
  left.appendChild(p2);
  const cmdRow = document.createElement("div");
  cmdRow.className = "cmd-row";
  const code = document.createElement("code");
  code.className = "cmd-code";
  code.textContent = "npx yokoten init";
  cmdRow.appendChild(code);
  const copyBtn = addCopyButton("Copy", "npx yokoten init", code);
  cmdRow.appendChild(copyBtn);
  const link = createLink("https://yokoten.app/", "See what it stops");
  cmdRow.appendChild(link);
  left.appendChild(cmdRow);
  section.appendChild(left);
  return section;
}
