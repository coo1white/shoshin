// @ts-check
import { createLink, addCopyButton } from "./dom.js";
import { fileLinkPlan, buildPatch, orderFiles, fixMessage, claudeImportMessage, PATCH_COMMANDS } from "../fixes.js";

function createFixCard(owner, repo, branch, file, lastFixes) {
  const card = document.createElement("div");
  card.className = "fix-card";

  const title = document.createElement("p");
  title.className = "mono fix-card-title";
  title.textContent = file.path;
  card.appendChild(title);

  if (file.source === "yokoten and Muse") {
    const museNote = document.createElement("p");
    museNote.className = "small";
    museNote.textContent = "The section called This project is suggested by Muse. Read it before you apply it.";
    card.appendChild(museNote);
  }

  const details = document.createElement("details");
  details.setAttribute("data-key", "read-" + file.path);
  const sum = document.createElement("summary");
  sum.textContent = "Read this file";
  details.appendChild(sum);
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
  card.appendChild(details);

  if (file.path === "AGENTS.md" && lastFixes) {
    const msg = claudeImportMessage(lastFixes);
    if (msg) {
      const claudeP = document.createElement("p");
      claudeP.textContent = msg;
      card.appendChild(claudeP);
    }
  }

  const plan = fileLinkPlan(owner, repo, branch, file);
  if (plan.kind === "filled") {
    const link = createLink(plan.href, "Add on GitHub");
    link.className = "button-link";
    card.appendChild(link);
    const hint = document.createElement("p");
    hint.className = "small muted";
    hint.textContent = "GitHub asks you to commit. Choose a new branch to open a pull request.";
    card.appendChild(hint);
  } else {
    const wrap = document.createElement("div");
    wrap.className = "fix-card-actions";
    const copyBtn = addCopyButton("1. Copy the text", file.content, code);
    copyBtn.className = "button-link";
    wrap.appendChild(copyBtn);
    const link = createLink(plan.href, "2. Open GitHub and paste");
    link.className = "button-link";
    wrap.appendChild(link);
    card.appendChild(wrap);
    const hint2 = document.createElement("p");
    hint2.className = "small muted";
    hint2.textContent = "Paste it into the empty box on GitHub. Then choose a new branch to open a pull request.";
    card.appendChild(hint2);
  }

  return card;
}

export function renderFixSection({ vm, lastFixes, isWaitingForFixes, lastResult }) {
  const fixSection = document.createElement("div");
  fixSection.className = "fix-section";
  const fixTitle = document.createElement("h3");
  fixTitle.textContent = "Fix it";
  fixSection.appendChild(fixTitle);

  if (isWaitingForFixes && !lastFixes) {
    const waitingP = document.createElement("p");
    waitingP.textContent = "Writing the fix files…";
    fixSection.appendChild(waitingP);
    return fixSection;
  }

  if (lastFixes) {
    if (lastFixes.muse === "lost") {
      const lostP = document.createElement("p");
      lostP.textContent = "The fix files did not arrive. Please run the check again.";
      fixSection.appendChild(lostP);
      return fixSection;
    }
    const files = lastFixes.files || [];
    const hasOpenInstallOnly = vm.installOnly.length > 0;
    const msg = fixMessage(lastFixes);
    const shouldShowFixMessage = !(files.length === 0 && hasOpenInstallOnly);
    if (msg && shouldShowFixMessage) {
      const msgP = document.createElement("p");
      msgP.textContent = msg;
      fixSection.appendChild(msgP);
    }
    if (files.length > 0) {
      const notice = document.createElement("p");
      notice.textContent = "Nothing changes until you click Commit on GitHub. We have no access to your repo.";
      fixSection.appendChild(notice);
      const owner = lastResult.owner;
      const repo = lastResult.repo;
      const branch = lastResult.default_branch || lastResult.branch || null;
      const ordered = orderFiles(files);
      if (ordered.first) {
        const card = createFixCard(owner, repo, branch, ordered.first, lastFixes);
        fixSection.appendChild(card);
      }
      if (ordered.rest.length > 0) {
        const detailsRest = document.createElement("details");
        detailsRest.setAttribute("data-key", "more-files");
        const sumRest = document.createElement("summary");
        sumRest.textContent = `${ordered.rest.length} more files`;
        detailsRest.appendChild(sumRest);
        for (const f of ordered.rest) {
          const c = createFixCard(owner, repo, branch, f, lastFixes);
          detailsRest.appendChild(c);
        }
        fixSection.appendChild(detailsRest);
      }
      const termDetails = document.createElement("details");
      termDetails.setAttribute("data-key", "use-terminal");
      const termSum = document.createElement("summary");
      termSum.textContent = "Use the terminal instead";
      termDetails.appendChild(termSum);
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
      fixSection.appendChild(termDetails);
    }
    if (hasOpenInstallOnly) {
      const intro = document.createElement("p");
      intro.textContent = "These need yokoten in your repo:";
      fixSection.appendChild(intro);
      const ul = document.createElement("ul");
      for (const s of vm.installOnly) {
        const li = document.createElement("li");
        li.textContent = s.title;
        ul.appendChild(li);
      }
      fixSection.appendChild(ul);
      const wrap = document.createElement("div");
      wrap.className = "code-wrap";
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      const cmd = "npx yokoten init";
      code.textContent = cmd;
      pre.appendChild(code);
      wrap.appendChild(pre);
      const copyBtn = addCopyButton("Copy", cmd, code);
      wrap.appendChild(copyBtn);
      fixSection.appendChild(wrap);
    }
    if (files.length === 0 && !hasOpenInstallOnly) {
      if (lastFixes.muse !== "failed") {
        const nothingP = document.createElement("p");
        nothingP.textContent = "Nothing to fix here.";
        fixSection.appendChild(nothingP);
      }
    }
  }
  return fixSection;
}
