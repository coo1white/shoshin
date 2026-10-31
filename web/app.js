// @ts-check
const API = "https://yokoten-doctor--yokoten-doctor-fastapi-app.us-east.modal.run";

import { PROGRESS, markLabel, viewModel } from "./view.js";
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

/** @type {Set<string>} */
let openDetailsKeys = new Set();

function safeUrl(href) {
  if (typeof href !== "string") return null;
  if (href.startsWith("https://github.com/")) return href;
  if (href.startsWith("https://yokoten.app/")) return href;
  if (href.startsWith("https://")) {
    // docs value starting with https:// is allowed for docs links
    // we treat any https:// as allowed for docs
    return href;
  }
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
    // show as text
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

  // claude import message - show in AGENTS.md card, above buttons
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

function render() {
  // capture open details before clearing
  if (appEl) captureDetailsState(appEl);
  if (!appEl) return;
  // clear
  while (appEl.firstChild) appEl.removeChild(appEl.firstChild);

  // Header
  const h1 = document.createElement("h1");
  h1.textContent = "Is your repo ready for AI agents?";
  appEl.appendChild(h1);

  // Input section always visible
  const formWrap = document.createElement("div");
  formWrap.className = "panel";
  const label = document.createElement("label");
  label.textContent = "GitHub repo URL";
  label.setAttribute("for", "repo-input");
  formWrap.appendChild(label);

  const input = document.createElement("input");
  input.type = "text";
  input.id = "repo-input";
  input.placeholder = "https://github.com/owner/repo";
  input.value = inputValue;
  input.addEventListener("input", (e) => {
    inputValue = /** @type {HTMLInputElement} */ (e.target).value;
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      startCheck();
    }
  });
  formWrap.appendChild(input);

  const btn = document.createElement("button");
  btn.textContent = "Check";
  btn.addEventListener("click", startCheck);
  if (state === "working") btn.disabled = true;
  formWrap.appendChild(btn);

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

  appEl.appendChild(formWrap);

  if (errorMessage) {
    const err = document.createElement("p");
    err.setAttribute("role", "alert");
    err.textContent = errorMessage;
    err.style.color = "var(--fg)";
    err.style.border = "1px solid var(--border)";
    err.style.padding = "0.5rem";
    err.style.borderRadius = "6px";
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

    // 1. secrets warning first
    if (vm.secretCount && vm.secretCount > 0) {
      const warn = document.createElement("div");
      warn.className = "warning";
      const warnTitle = document.createElement("p");
      const strong = document.createElement("strong");
      if (vm.secretCount === 1) {
        strong.textContent = "yokoten found 1 thing that looks private in this repo";
      } else {
        strong.textContent = `yokoten found ${vm.secretCount} things that look private in this repo`;
      }
      warnTitle.appendChild(strong);
      warn.appendChild(warnTitle);
      const details = document.createElement("details");
      details.setAttribute("data-key", "secrets-where");
      const summaryEl = document.createElement("summary");
      summaryEl.textContent = "Show where";
      details.appendChild(summaryEl);
      for (const g of vm.secretGroups) {
        const item = document.createElement("div");
        if (g.what) {
          const what = document.createElement("p");
          what.textContent = g.what;
          item.appendChild(what);
        }
        if (g.why) {
          const why = document.createElement("p");
          why.textContent = g.why;
          item.appendChild(why);
        }
        if (g.fix) {
          const fix = document.createElement("p");
          fix.textContent = g.fix;
          item.appendChild(fix);
        }
        const list = document.createElement("ul");
        list.className = "mono";
        list.style.wordBreak = "break-all";
        list.style.overflowWrap = "anywhere";
        list.style.whiteSpace = "pre-wrap";
        for (const place of g.places) {
          const li = document.createElement("li");
          li.textContent = place;
          li.className = "mono";
          li.style.wordBreak = "break-all";
          li.style.overflowWrap = "anywhere";
          list.appendChild(li);
        }
        item.appendChild(list);
        details.appendChild(item);
      }
      warn.appendChild(details);
      term.appendChild(warn);
    }

    // 2. repo name, then headline
    const repoName = document.createElement("h2");
    repoName.textContent = `${lastResult.owner}/${lastResult.repo}`;
    term.appendChild(repoName);
    const headlineEl = document.createElement("p");
    headlineEl.textContent = vm.headline;
    term.appendChild(headlineEl);

    // 3. next step
    let nextWrap = null;
    if (vm.next) {
      nextWrap = document.createElement("div");
      const nextTitle = document.createElement("h3");
      nextTitle.textContent = vm.next.title;
      nextWrap.appendChild(nextTitle);
      const idEl = document.createElement("p");
      idEl.className = "id";
      idEl.textContent = vm.next.id;
      nextWrap.appendChild(idEl);
      if (vm.next.what) {
        const whatEl = document.createElement("p");
        whatEl.textContent = vm.next.what;
        nextWrap.appendChild(whatEl);
      }
      if (vm.next.why) {
        const whyEl = document.createElement("p");
        whyEl.textContent = vm.next.why;
        nextWrap.appendChild(whyEl);
      }
      if (vm.next.fix) {
        const fixEl = document.createElement("p");
        fixEl.textContent = vm.next.fix;
        nextWrap.appendChild(fixEl);
      }
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
        howP.textContent = vm.next.how;
        details.appendChild(howP);
        nextWrap.appendChild(details);
      }
      term.appendChild(nextWrap);
    } else if (!vm.next && vm.installOnly.length === 0) {
      const doneP = document.createElement("p");
      doneP.textContent = "Every file check is done.";
      term.appendChild(doneP);
    }

    // Fix it section: after next step block and before Show all checks
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
      // lost case
      if (lastFixes.muse === "lost") {
        const lostP = document.createElement("p");
        lostP.textContent = "The fix files did not arrive. Please run the check again.";
        fixSection.appendChild(lostP);
      } else {
        if (lastFixes.summary && lastFixes.summary.trim() !== "") {
          const sumP = document.createElement("p");
          sumP.textContent = lastFixes.summary;
          fixSection.appendChild(sumP);
          const small = document.createElement("p");
          small.className = "small muted";
          small.textContent = "Summary by Muse.";
          fixSection.appendChild(small);
        }
        const msg = fixMessage(lastFixes);
        if (msg) {
          const msgP = document.createElement("p");
          msgP.textContent = msg;
          fixSection.appendChild(msgP);
        }
        const files = lastFixes.files || [];
        if (files.length > 0) {
          const notice = document.createElement("p");
          notice.textContent = "Nothing changes until you click Commit on GitHub. We have no access to your repo.";
          fixSection.appendChild(notice);

          const owner = lastResult.owner;
          const repo = lastResult.repo;
          const branch = lastResult.default_branch || null;
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

          // Use the terminal instead
          const termDetails = document.createElement("details");
          termDetails.setAttribute("data-key", "use-terminal");
          const termSum = document.createElement("summary");
          termSum.textContent = "Use the terminal instead";
          termDetails.appendChild(termSum);

          const dlBtn = document.createElement("button");
          dlBtn.textContent = "Download the patch";
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
      }
    }

    term.appendChild(fixSection);

    // 4. Show all checks
    if (vm.others.length > 0) {
      const detailsAll = document.createElement("details");
      detailsAll.setAttribute("data-key", "show-all-checks");
      const sumAll = document.createElement("summary");
      sumAll.textContent = "Show all checks";
      detailsAll.appendChild(sumAll);
      vm.others.forEach((st) => {
        const stWrap = document.createElement("div");
        const titleEl = document.createElement("h4");
        titleEl.textContent = st.title;
        stWrap.appendChild(titleEl);
        const idEl2 = document.createElement("p");
        idEl2.className = "id";
        idEl2.textContent = st.id;
        stWrap.appendChild(idEl2);
        const labelEl = document.createElement("p");
        labelEl.className = "small muted";
        labelEl.textContent = st.label;
        stWrap.appendChild(labelEl);
        if (st.how) {
          const detHow = document.createElement("details");
          detHow.setAttribute("data-key", "how-" + st.id);
          const sumHow = document.createElement("summary");
          sumHow.textContent = "How this was judged";
          detHow.appendChild(sumHow);
          const howP2 = document.createElement("p");
          howP2.textContent = st.how;
          detHow.appendChild(howP2);
          stWrap.appendChild(detHow);
        }
        detailsAll.appendChild(stWrap);
      });
      term.appendChild(detailsAll);
    }

    // 5. installOnly
    if (vm.installOnly.length > 0) {
      const instP = document.createElement("p");
      instP.textContent = "Fixed when you install yokoten: " + vm.installOnly.map((s) => s.title).join(", ");
      term.appendChild(instP);
      const codePre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = "npx yokoten init";
      codePre.appendChild(code);
      term.appendChild(codePre);
    }

    // 7. Check it yourself
    const checkYourself = document.createElement("div");
    const hCheck = document.createElement("h3");
    hCheck.textContent = "Check it yourself";
    checkYourself.appendChild(hCheck);
    const checkedBy = document.createElement("p");
    checkedBy.className = "small";
    checkedBy.textContent = `Checked by yokoten ${vm.evidence.version} at commit ${vm.evidence.shortCommit}`;
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

    if (vm.evidence.doctorCommand) {
      checkYourself.appendChild(addCodeBlockWithCopy(vm.evidence.doctorCommand));
    }
    if (vm.evidence.checkCommand) {
      checkYourself.appendChild(addCodeBlockWithCopy(vm.evidence.checkCommand));
      const note = document.createElement("p");
      note.className = "small muted";
      note.textContent = "Run this one in a clean home folder: on your own machine, check also looks for your own private marks, which this page never had.";
      checkYourself.appendChild(note);
    }
    // Public record section
    const rv = recordView(lastRecord);
    if (rv) {
      const prTitle = document.createElement("h4");
      prTitle.textContent = "Public record";
      checkYourself.appendChild(prTitle);
      const prDesc = document.createElement("p");
      prDesc.textContent = "A hash of this result is in a public log. Download the result, hash it, and compare. The record holds no file contents.";
      checkYourself.appendChild(prDesc);
      const hashP = document.createElement("p");
      const hashMono = document.createElement("code");
      hashMono.textContent = rv.sha256;
      hashP.appendChild(hashMono);
      checkYourself.appendChild(hashP);
      const recordedP = document.createElement("p");
      recordedP.textContent = rv.recordedAt;
      checkYourself.appendChild(recordedP);
      const dlBtn = document.createElement("button");
      dlBtn.textContent = "Download the result";
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
      checkYourself.appendChild(dlBtn);
      const verifyWrap = document.createElement("div");
      verifyWrap.className = "code-wrap";
      const preV = document.createElement("pre");
      const codeV = document.createElement("code");
      codeV.textContent = rv.verifyCommand;
      preV.appendChild(codeV);
      verifyWrap.appendChild(preV);
      const copyV = addCopyButton("Copy", rv.verifyCommand, codeV);
      verifyWrap.appendChild(copyV);
      checkYourself.appendChild(verifyWrap);
      if (rv.rekorUrl) {
        const p = document.createElement("p");
        const a = createLink(rv.rekorUrl, "Rekor entry");
        p.appendChild(a);
        checkYourself.appendChild(p);
      }
      if (rv.solanaUrl) {
        const p2 = document.createElement("p");
        const a2 = createLink(rv.solanaUrl, "Solana devnet memo");
        p2.appendChild(a2);
        const small = document.createElement("span");
        small.textContent = " Devnet is a test network. It can be reset, and it holds no real money.";
        small.className = "small";
        p2.appendChild(small);
        checkYourself.appendChild(p2);
      }
      if (rv.message) {
        const msgP = document.createElement("p");
        msgP.textContent = rv.message;
        checkYourself.appendChild(msgP);
      }
    }
    term.appendChild(checkYourself);

    // 8. Closing about + npx yokoten link
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
    const yokLink = document.createElement("a");
    yokLink.href = "https://yokoten.app/";
    yokLink.textContent = "https://yokoten.app/";
    yokLink.target = "_blank";
    yokLink.rel = "noopener noreferrer";
    closingP.appendChild(yokLink);
    term.appendChild(closingP);

    appEl.appendChild(term);

    const footer = document.createElement("footer");
    footer.className = "footer small muted";
    const footText1 = document.createTextNode("A wrong check result or a broken page? Tell yokoten: ");
    footer.appendChild(footText1);
    const footLink1 = document.createElement("a");
    footLink1.href = "https://github.com/yokoten-labs/yokoten/issues";
    footLink1.textContent = "github.com/yokoten-labs/yokoten/issues";
    footLink1.target = "_blank";
    footLink1.rel = "noopener noreferrer";
    footer.appendChild(footLink1);
    footer.appendChild(document.createTextNode("."));
    appEl.appendChild(footer);
  }
  restoreDetailsState(appEl);
  if (errorMessage && hasChecked) {
    const inputEl = document.getElementById("repo-input");
    if (inputEl) {
      inputEl.focus();
    }
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
  state = "working";
  currentProgress = [];
  lastResult = null;
  lastFixes = null;
  lastRecord = null;
  isWaitingForFixes = false;
  openDetailsKeys.clear();
  hasChecked = true;
  render();

  try {
    const resp = await fetch(API + "/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!resp.ok && !resp.body) {
      throw new Error("network");
    }
    const reader = resp.body ? resp.body.getReader() : null;
    if (!reader) {
      throw new Error("no body");
    }
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
          if (step) {
            currentProgress.push(step);
            render();
          }
        } else if (eventName === "result") {
          hasResultOrError = true;
          lastResult = data;
          state = "result";
          isWaitingForFixes = true;
          render();
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
    if (lastResult) {
      markFixesLost();
      return;
    }
    errorMessage = "The connection dropped. Please try again.";
    state = "empty";
    render();
  }
}

// initial render
render();
