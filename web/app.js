// @ts-check
const API = "https://yokoten-doctor--yokoten-doctor-fastapi-app.us-east.modal.run";

import { PROGRESS, markLabel, viewModel, repoFromInput, repoFromQuery, splitCode, formatRecordTime } from "./view.js";
import {
  fileLinkPlan,
  buildPatch,
  orderFiles,
  fixMessage,
  claudeImportMessage,
  PATCH_COMMANDS,
  recordView,
} from "./fixes.js";

const appEl = document.getElementById("app");

let state = "empty"; // empty | working | result
let currentProgress = [];
let lastResult = null;
let errorMessage = "";
let inputValue = "";
let lastFixes = null;
let isWaitingForFixes = false;
let hasChecked = false;
let lastRecord = null;
let hasScrolledForResult = false;

/** @type {Set<string>} */
let openDetailsKeys = new Set();

function safeUrl(href) {
  if (typeof href !== "string") return null;
  if (href.startsWith("https://github.com/")) return href;
  if (href.startsWith("https://yokoten.app/")) return href;
  if (href.startsWith("https://")) return href;
  return null;
}

function createLink(href, text) {
  const a = document.createElement("a");
  const safe = safeUrl(href);
  if (safe) {
    a.href = safe;
    a.textContent = text;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  } else {
    const span = document.createElement("span");
    span.textContent = text + " (" + href + ")";
    return span;
  }
  return a;
}

function fallbackSelect(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

function markFixesLost() {
  if (lastResult && lastFixes == null) {
    lastFixes = { files: [], summary: "", muse: "lost" };
    isWaitingForFixes = false;
    render();
  }
}

function addCopyButton(label, text, codeEl) {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.className = "button-quiet";
  btn.type = "button";
  btn.addEventListener("click", () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => {
          btn.textContent = "Copied";
          setTimeout(() => {
            btn.textContent = label;
          }, 2000);
        },
        () => {
          fallbackSelect(codeEl);
          btn.textContent = "Press Ctrl+C to copy";
          const details = codeEl.closest("details");
          if (details) details.open = true;
        },
      ).catch(() => {
        fallbackSelect(codeEl);
        btn.textContent = "Press Ctrl+C to copy";
        const details = codeEl.closest("details");
        if (details) details.open = true;
      });
    } else {
      fallbackSelect(codeEl);
      btn.textContent = "Press Ctrl+C to copy";
      const details = codeEl.closest("details");
      if (details) details.open = true;
    }
  });
  return btn;
}

function captureDetailsState(root) {
  if (!root) return;
  const detailsEls = root.querySelectorAll("details[data-key]");
  for (const d of detailsEls) {
    const key = d.getAttribute("data-key");
    if (!key) continue;
    if (d.open) openDetailsKeys.add(key);
    else openDetailsKeys.delete(key);
  }
}

function restoreDetailsState(root) {
  if (!root) return;
  const detailsEls = root.querySelectorAll("details[data-key]");
  for (const d of detailsEls) {
    const key = d.getAttribute("data-key");
    if (!key) continue;
    if (openDetailsKeys.has(key)) d.open = true;
  }
}

function renderRichText(text, parent) {
  if (text == null || text === "") return;
  const parts = splitCode(text);
  for (const p of parts) {
    if (p.isCode) {
      const c = document.createElement("code");
      c.textContent = p.text;
      parent.appendChild(c);
    } else {
      parent.appendChild(document.createTextNode(p.text));
    }
  }
}

function createFixCard(owner, repo, branch, file) {
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

function appendLabeledSection(parent, labelText, value) {
  if (value == null || value === "") return;
  const block = document.createElement("div");
  block.className = "field-block";
  const label = document.createElement("p");
  label.className = "field-label small muted";
  label.textContent = labelText;
  block.appendChild(label);
  const p = document.createElement("p");
  renderRichText(value, p);
  block.appendChild(p);
  parent.appendChild(block);
}

function maybeUpdateUrl(inputText) {
  const repo = repoFromInput(inputText);
  if (repo) {
    const next = "?repo=" + encodeURIComponent(repo);
    try {
      history.replaceState(null, "", next);
    } catch {}
  }
}

function scrollResultIntoView() {
  const el = document.getElementById("result-panel");
  if (!el) return;
  const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const behavior = prefersReduced ? "auto" : "smooth";
  try {
    el.scrollIntoView({ behavior, block: "start" });
  } catch {}
}

function render() {
  if (appEl) captureDetailsState(appEl);
  if (!appEl) return;
  while (appEl.firstChild) appEl.removeChild(appEl.firstChild);

  const h1 = document.createElement("h1");
  h1.textContent = "Is your repo ready for AI agents?";
  appEl.appendChild(h1);

  const formWrap = document.createElement("div");
  formWrap.className = "panel";
  const label = document.createElement("label");
  label.textContent = "GitHub repo URL";
  label.setAttribute("for", "repo-input");
  formWrap.appendChild(label);

  const form = document.createElement("form");
  form.className = "input-row";
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    startCheck();
  });

  const input = document.createElement("input");
  input.type = "text";
  input.id = "repo-input";
  input.placeholder = "https://github.com/owner/repo";
  input.value = inputValue;
  input.autocomplete = "off";
  input.addEventListener("input", (e) => {
    inputValue = /** @type {HTMLInputElement} */ (e.target).value;
  });
  form.appendChild(input);

  const btn = document.createElement("button");
  btn.textContent = "Check";
  btn.type = "submit";
  if (state === "working") btn.disabled = true;
  form.appendChild(btn);
  formWrap.appendChild(form);

  const showExtra = state === "empty";
  if (showExtra) {
    const info = document.createElement("p");
    info.className = "small muted";
    info.textContent = "We copy the public files of this repo into a throwaway sandbox, run yokoten on them, and keep nothing. Public repos only.";
    formWrap.appendChild(info);

    const tryP = document.createElement("p");
    tryP.className = "small";
    const tryLabel = document.createElement("span");
    tryLabel.textContent = "Try one: ";
    tryP.appendChild(tryLabel);
    const examples = [
      { label: "Uniswap/v4-core", url: "https://github.com/Uniswap/v4-core" },
      { label: "OpenZeppelin/openzeppelin-contracts", url: "https://github.com/OpenZeppelin/openzeppelin-contracts" },
      { label: "jup-ag/jupiter-quote-api-node", url: "https://github.com/jup-ag/jupiter-quote-api-node" },
    ];
    examples.forEach((ex, idx) => {
      const link = document.createElement("a");
      link.href = "#";
      link.textContent = ex.label;
      link.addEventListener("click", (ev) => {
        ev.preventDefault();
        inputValue = ex.url;
        startCheck();
      });
      tryP.appendChild(link);
      if (idx < examples.length - 1) {
        const sep = document.createElement("span");
        sep.textContent = ", ";
        tryP.appendChild(sep);
      }
    });
    formWrap.appendChild(tryP);

    const noRepoP = document.createElement("p");
    noRepoP.className = "small muted";
    noRepoP.textContent = "An AI coding agent can run commands, change files and push code. These checks show whether a repo tells it the rules.";
    formWrap.appendChild(noRepoP);
  }

  appEl.appendChild(formWrap);

  if (errorMessage) {
    const err = document.createElement("p");
    err.setAttribute("role", "alert");
    err.textContent = errorMessage;
    err.className = "error-box";
    appEl.appendChild(err);
  }

  if (state === "working") {
    const progWrap = document.createElement("div");
    progWrap.className = "panel";
    const title = document.createElement("h2");
    title.textContent = "Checking…";
    progWrap.appendChild(title);
    const stepsOrder = ["reading", "copying", "checking"];
    stepsOrder.forEach((step) => {
      const idx = stepsOrder.indexOf(step);
      const currentIdx = stepsOrder.indexOf(currentProgress[currentProgress.length - 1]);
      if (currentProgress.length === 0) return;
      if (idx > currentIdx) return;
      const p = document.createElement("p");
      p.className = "progress-item";
      const prefix = idx < currentIdx ? "✓ " : "";
      p.textContent = prefix + (PROGRESS[step] || step);
      progWrap.appendChild(p);
    });
    appEl.appendChild(progWrap);
  }

  if (state === "result" && lastResult) {
    const vm = viewModel(lastResult);
    const term = document.createElement("div");
    term.className = "terminal";
    term.id = "result-panel";

    const repoNameRow = document.createElement("div");
    repoNameRow.className = "repo-row";
    const repoName = document.createElement("h2");
    repoName.textContent = `${lastResult.owner}/${lastResult.repo}`;
    repoNameRow.appendChild(repoName);
    const copyLinkBtn = document.createElement("button");
    copyLinkBtn.type = "button";
    copyLinkBtn.textContent = "Copy link to this result";
    copyLinkBtn.className = "button-quiet";
    const currentUrl = window.location.href;
    copyLinkBtn.addEventListener("click", () => {
      const fakeCode = document.createElement("code");
      fakeCode.textContent = currentUrl;
      const btn = copyLinkBtn;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(currentUrl).then(() => {
          btn.textContent = "Copied";
          setTimeout(() => { btn.textContent = "Copy link to this result"; }, 2000);
        }).catch(() => {
          fallbackSelect(fakeCode);
          btn.textContent = "Press Ctrl+C to copy";
        });
      } else {
        fallbackSelect(fakeCode);
        copyLinkBtn.textContent = "Press Ctrl+C to copy";
      }
    });
    repoNameRow.appendChild(copyLinkBtn);
    term.appendChild(repoNameRow);

    // Score
    const scoreLine = document.createElement("p");
    scoreLine.className = "score-line";
    scoreLine.textContent = vm.score.text;
    term.appendChild(scoreLine);

    const prog = document.createElement("progress");
    prog.max = vm.score.total;
    prog.value = vm.score.done;
    prog.setAttribute("aria-label", vm.score.text);
    term.appendChild(prog);

    // Muse summary under score if present
    if (lastFixes && lastFixes.summary && lastFixes.summary.trim() !== "") {
      const sumP = document.createElement("p");
      sumP.textContent = lastFixes.summary;
      term.appendChild(sumP);
      const small = document.createElement("p");
      small.className = "small muted";
      small.textContent = "Summary by Muse.";
      term.appendChild(small);
    }

    // Private findings warning below score
    if (vm.secretCount && vm.secretCount > 0) {
      const warn = document.createElement("div");
      warn.className = "warning";
      const warnTitle = document.createElement("p");
      const strong = document.createElement("strong");
      if (vm.secretCount === 1) strong.textContent = "yokoten found 1 thing that looks private in this repo";
      else strong.textContent = `yokoten found ${vm.secretCount} things that look private in this repo`;
      warnTitle.appendChild(strong);
      warn.appendChild(warnTitle);
      const details = document.createElement("details");
      details.setAttribute("data-key", "secrets-where");
      const summaryEl = document.createElement("summary");
      summaryEl.textContent = "Show where";
      details.appendChild(summaryEl);
      for (const g of vm.secretGroups) {
        const item = document.createElement("div");
        item.className = "secret-group";
        if (g.what) {
          const what = document.createElement("p");
          renderRichText(g.what, what);
          item.appendChild(what);
        }
        if (g.why) {
          const why = document.createElement("p");
          renderRichText(g.why, why);
          item.appendChild(why);
        }
        if (g.fix) {
          const fix = document.createElement("p");
          renderRichText(g.fix, fix);
          item.appendChild(fix);
        }
        const list = document.createElement("ul");
        list.className = "mono secret-list";
        for (const place of g.places) {
          const li = document.createElement("li");
          li.textContent = place;
          li.className = "mono";
          list.appendChild(li);
        }
        item.appendChild(list);
        details.appendChild(item);
      }
      warn.appendChild(details);
      term.appendChild(warn);
    }

    // Next step
    if (vm.next) {
      const nextWrap = document.createElement("div");
      nextWrap.className = "next-step";
      const nextHeading = document.createElement("p");
      nextHeading.className = "section-label small muted";
      nextHeading.textContent = "Next step";
      nextWrap.appendChild(nextHeading);
      const nextTitle = document.createElement("h3");
      nextTitle.textContent = vm.next.title;
      nextWrap.appendChild(nextTitle);
      const idEl = document.createElement("p");
      idEl.className = "small muted";
      const idLabel = document.createElement("span");
      idLabel.textContent = "Step id: ";
      idEl.appendChild(idLabel);
      const idMono = document.createElement("span");
      idMono.className = "mono";
      idMono.textContent = vm.next.id;
      idEl.appendChild(idMono);
      nextWrap.appendChild(idEl);
      appendLabeledSection(nextWrap, "What we found", vm.next.what);
      appendLabeledSection(nextWrap, "Why it matters", vm.next.why);
      appendLabeledSection(nextWrap, "How to fix it", vm.next.fix);
      if (vm.next.docs) {
        const docsP = document.createElement("p");
        const link = createLink(vm.next.docs, vm.next.docs);
        docsP.appendChild(link);
        nextWrap.appendChild(docsP);
      }
      if (vm.next.how) {
        const details = document.createElement("details");
        details.setAttribute("data-key", "next-how");
        const summaryEl = document.createElement("summary");
        summaryEl.textContent = "How this was judged";
        details.appendChild(summaryEl);
        const howP = document.createElement("p");
        renderRichText(vm.next.how, howP);
        details.appendChild(howP);
        nextWrap.appendChild(details);
      }
      term.appendChild(nextWrap);
    } else if (!vm.next && vm.installOnly.length === 0) {
      const doneP = document.createElement("p");
      doneP.textContent = "Every file check is done.";
      term.appendChild(doneP);
    }

    // Fix it section
    const fixSection = document.createElement("div");
    fixSection.className = "fix-section";
    const fixTitle = document.createElement("h3");
    fixTitle.textContent = "Fix it";
    fixSection.appendChild(fixTitle);

    if (isWaitingForFixes && !lastFixes) {
      const waitingP = document.createElement("p");
      waitingP.textContent = "Writing the fix files…";
      fixSection.appendChild(waitingP);
    } else if (lastFixes) {
      if (lastFixes.muse === "lost") {
        const lostP = document.createElement("p");
        lostP.textContent = "The fix files did not arrive. Please run the check again.";
        fixSection.appendChild(lostP);
      } else {
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
            const card = createFixCard(owner, repo, branch, ordered.first);
            fixSection.appendChild(card);
          }
          if (ordered.rest.length > 0) {
            const detailsRest = document.createElement("details");
            detailsRest.setAttribute("data-key", "more-files");
            const sumRest = document.createElement("summary");
            sumRest.textContent = `${ordered.rest.length} more files`;
            detailsRest.appendChild(sumRest);
            for (const f of ordered.rest) {
              const c = createFixCard(owner, repo, branch, f);
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
        // install-only steps inside Fix it
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
    }
    term.appendChild(fixSection);

    // Show all checks
    if (vm.others.length > 0) {
      const detailsAll = document.createElement("details");
      detailsAll.setAttribute("data-key", "show-all-checks");
      const sumAll = document.createElement("summary");
      sumAll.textContent = "Show all checks";
      detailsAll.appendChild(sumAll);
      vm.others.forEach((st) => {
        const stWrap = document.createElement("div");
        stWrap.className = "check-item";
        const titleEl = document.createElement("h4");
        titleEl.textContent = st.title;
        stWrap.appendChild(titleEl);
        const idEl2 = document.createElement("p");
        idEl2.className = "small muted";
        const lbl = document.createElement("span");
        lbl.textContent = "Step id: ";
        idEl2.appendChild(lbl);
        const mono = document.createElement("span");
        mono.className = "mono";
        mono.textContent = st.id;
        idEl2.appendChild(mono);
        stWrap.appendChild(idEl2);
        const labelEl = document.createElement("p");
        labelEl.className = "small muted";
        labelEl.textContent = st.label;
        stWrap.appendChild(labelEl);
        appendLabeledSection(stWrap, "What we found", st.what);
        appendLabeledSection(stWrap, "Why it matters", st.why);
        appendLabeledSection(stWrap, "How to fix it", st.fix);
        if (st.docs) {
          const docsP = document.createElement("p");
          const link = createLink(st.docs, st.docs);
          docsP.appendChild(link);
          stWrap.appendChild(docsP);
        }
        if (st.how) {
          const detHow = document.createElement("details");
          detHow.setAttribute("data-key", "how-" + st.id);
          const sumHow = document.createElement("summary");
          sumHow.textContent = "How this was judged";
          detHow.appendChild(sumHow);
          const howP2 = document.createElement("p");
          renderRichText(st.how, howP2);
          detHow.appendChild(howP2);
          stWrap.appendChild(detHow);
        }
        detailsAll.appendChild(stWrap);
      });
      term.appendChild(detailsAll);
    }

    // Check it yourself
    const checkYourself = document.createElement("div");
    checkYourself.className = "check-yourself";
    const hCheck = document.createElement("h3");
    hCheck.textContent = "Check it yourself";
    checkYourself.appendChild(hCheck);
    const checkedBy = document.createElement("p");
    checkedBy.className = "small";
    checkedBy.textContent = `Checked by yokoten ${vm.evidence.version} at commit ${vm.evidence.shortCommit}.`;
    checkYourself.appendChild(checkedBy);

    function addCodeBlockWithCopy(text) {
      const wrap = document.createElement("div");
      wrap.className = "code-wrap";
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = text;
      pre.appendChild(code);
      wrap.appendChild(pre);
      const btn = addCopyButton("Copy", text, code);
      wrap.appendChild(btn);
      return wrap;
    }

    const rv = recordView(lastRecord);
    if (rv) {
      const timeStr = formatRecordTime(rv.recordedAt);
      const recordedLine = document.createElement("p");
      recordedLine.className = "small";
      recordedLine.textContent = `Hash recorded publicly on ${timeStr}:`;
      checkYourself.appendChild(recordedLine);
      const linksP = document.createElement("p");
      let needSep = false;
      if (rv.rekorUrl) {
        const a = createLink(rv.rekorUrl, "Rekor entry");
        linksP.appendChild(a);
        needSep = true;
      }
      if (rv.solanaUrl) {
        if (needSep) linksP.appendChild(document.createTextNode(" "));
        const a2 = createLink(rv.solanaUrl, "Solana devnet memo");
        linksP.appendChild(a2);
      }
      if (rv.rekorUrl || rv.solanaUrl) checkYourself.appendChild(linksP);
      if (rv.solanaUrl) {
        const devnetNote = document.createElement("p");
        devnetNote.className = "small muted";
        devnetNote.textContent = "Devnet is a test network. It can be reset, and it holds no real money.";
        checkYourself.appendChild(devnetNote);
      }
    }

    const detailsRun = document.createElement("details");
    detailsRun.setAttribute("data-key", "run-same-check");
    const sumRun = document.createElement("summary");
    sumRun.textContent = "Run the same check yourself";
    detailsRun.appendChild(sumRun);
    if (vm.evidence.doctorCommand) {
      detailsRun.appendChild(addCodeBlockWithCopy(vm.evidence.doctorCommand));
    }
    if (vm.evidence.checkCommand) {
      detailsRun.appendChild(addCodeBlockWithCopy(vm.evidence.checkCommand));
      const note = document.createElement("p");
      note.className = "small muted";
      note.textContent = "Run this one in a clean home folder: on your own machine, check also looks for your own private marks, which this page never had.";
      detailsRun.appendChild(note);
    }
    checkYourself.appendChild(detailsRun);

    const detailsCompare = document.createElement("details");
    detailsCompare.setAttribute("data-key", "compare-hash");
    const sumCompare = document.createElement("summary");
    sumCompare.textContent = "Compare the hash";
    detailsCompare.appendChild(sumCompare);
    if (rv) {
      const dlDesc = document.createElement("p");
      dlDesc.className = "small";
      dlDesc.textContent = "Download the result file and compare its hash:";
      detailsCompare.appendChild(dlDesc);
      const hashP = document.createElement("p");
      hashP.className = "mono";
      hashP.textContent = rv.sha256;
      detailsCompare.appendChild(hashP);
      const dlBtn = document.createElement("button");
      dlBtn.textContent = "Download the result";
      dlBtn.className = "button-quiet";
      dlBtn.type = "button";
      dlBtn.addEventListener("click", () => {
        const blob = new Blob([rv.documentText], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = rv.documentName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
      detailsCompare.appendChild(dlBtn);
      const verifyWrap = document.createElement("div");
      verifyWrap.className = "code-wrap";
      const preV = document.createElement("pre");
      const codeV = document.createElement("code");
      codeV.textContent = rv.verifyCommand;
      preV.appendChild(codeV);
      verifyWrap.appendChild(preV);
      const copyV = addCopyButton("Copy", rv.verifyCommand, codeV);
      verifyWrap.appendChild(copyV);
      detailsCompare.appendChild(verifyWrap);
    } else {
      const noRec = document.createElement("p");
      noRec.className = "small muted";
      noRec.textContent = "No public record is available for this result.";
      detailsCompare.appendChild(noRec);
    }
    checkYourself.appendChild(detailsCompare);
    if (rv && rv.message) {
      const msgP = document.createElement("p");
      msgP.textContent = rv.message;
      checkYourself.appendChild(msgP);
    }

    term.appendChild(checkYourself);

    if (lastResult.about) {
      const aboutP = document.createElement("p");
      aboutP.className = "small";
      aboutP.textContent = lastResult.about;
      term.appendChild(aboutP);
    }
    const closingP = document.createElement("p");
    const codeNpx = document.createElement("code");
    codeNpx.textContent = "npx yokoten";
    closingP.appendChild(codeNpx);
    closingP.appendChild(document.createTextNode(" "));
    const yokLink = createLink("https://yokoten.app/", "https://yokoten.app/");
    closingP.appendChild(yokLink);
    term.appendChild(closingP);

    appEl.appendChild(term);

    const footer = document.createElement("footer");
    footer.className = "footer small muted";
    footer.appendChild(document.createTextNode("A wrong check result or a broken page? Tell yokoten: "));
    const footLink1 = createLink("https://github.com/yokoten-labs/yokoten/issues", "github.com/yokoten-labs/yokoten/issues");
    footer.appendChild(footLink1);
    footer.appendChild(document.createTextNode("."));
    appEl.appendChild(footer);
  }
  restoreDetailsState(appEl);
  if (errorMessage && hasChecked) {
    const inputEl = document.getElementById("repo-input");
    if (inputEl) inputEl.focus();
  }
}

async function startCheck() {
  errorMessage = "";
  const url = inputValue.trim();
  if (!url) {
    errorMessage = "That doesn't look like a public GitHub repo. Try https://github.com/owner/repo.";
    hasChecked = true;
    state = "empty";
    render();
    return;
  }
  maybeUpdateUrl(url);
  state = "working";
  currentProgress = [];
  lastResult = null;
  lastFixes = null;
  lastRecord = null;
  isWaitingForFixes = false;
  hasScrolledForResult = false;
  openDetailsKeys.clear();
  hasChecked = true;
  render();

  try {
    const resp = await fetch(API + "/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!resp.ok && !resp.body) throw new Error("network");
    const reader = resp.body ? resp.body.getReader() : null;
    if (!reader) throw new Error("no body");
    const decoder = new TextDecoder();
    let buffer = "";
    let hasResultOrError = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (!raw.trim()) continue;
        let eventName = "";
        let dataStr = "";
        const lines = raw.split("\n");
        for (const line of lines) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          else if (line.startsWith("data:")) dataStr = line.slice(5).trim();
        }
        if (!eventName) continue;
        let data = null;
        try { data = JSON.parse(dataStr); } catch { data = {}; }
        if (eventName === "progress") {
          const step = data.step;
          if (step) { currentProgress.push(step); render(); }
        } else if (eventName === "result") {
          hasResultOrError = true;
          lastResult = data;
          state = "result";
          isWaitingForFixes = true;
          render();
          if (!hasScrolledForResult) {
            hasScrolledForResult = true;
            requestAnimationFrame(() => {
              requestAnimationFrame(() => scrollResultIntoView());
            });
          }
        } else if (eventName === "fixes") {
          if (!lastResult) continue;
          lastFixes = data;
          isWaitingForFixes = false;
          render();
        } else if (eventName === "record") {
          lastRecord = data;
          render();
        } else if (eventName === "error") {
          hasResultOrError = true;
          errorMessage = data.message || "The check could not finish. Please try again in a minute.";
          state = "empty";
          render();
        }
      }
    }
    if (!hasResultOrError) {
      errorMessage = "The connection dropped. Please try again.";
      state = "empty";
      render();
    } else {
      markFixesLost();
    }
  } catch (e) {
    if (lastResult) { markFixesLost(); return; }
    errorMessage = "The connection dropped. Please try again.";
    state = "empty";
    render();
  }
}

render();

// Share: on load check query
try {
  const fromQ = repoFromQuery(window.location.search);
  if (fromQ) {
    const full = "https://github.com/" + fromQ;
    inputValue = full;
    // update input element if rendered
    const el = document.getElementById("repo-input");
    if (el) el.value = full;
    startCheck();
  }
} catch {}
