// @ts-check
const API = "https://yokoten-doctor--yokoten-doctor-fastapi-app.us-east.modal.run";

import { PROGRESS, markLabel, viewModel } from "./view.js";

const appEl = document.getElementById("app");

let state = "empty"; // empty | working | result
let currentProgress = [];
let lastResult = null;
let errorMessage = "";
let inputValue = "";

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

function copyWithFallback(text, codeEl) {
  // must be called in click handler
  // @ts-ignore
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {
      fallbackSelect(codeEl);
    });
  } else {
    fallbackSelect(codeEl);
  }
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

function render() {
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
      const isDone = currentProgress.includes(step);
      const isCurrent = currentProgress.length > 0 && currentProgress[currentProgress.length - 1] === step;
      // Actually we show each progress item: earlier ticked, current step text
      // If step is in progress list, show tick; else not shown? Spec: current step's text, with earlier ones ticked.
      // We'll render only up to current
      const idx = stepsOrder.indexOf(step);
      const currentIdx = stepsOrder.indexOf(currentProgress[currentProgress.length - 1]);
      // Only render if step appears <= currentIdx
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
    if (vm.next) {
      const nextWrap = document.createElement("div");
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

    // 4. Show all checks
    if (vm.others.length > 0) {
      const detailsAll = document.createElement("details");
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
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = text;
      pre.appendChild(code);
      wrap.appendChild(pre);
      const btn = document.createElement("button");
      btn.textContent = "Copy";
      btn.addEventListener("click", () => copyWithFallback(text, code));
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
}

async function startCheck() {
  errorMessage = "";
  const url = inputValue.trim();
  if (!url) {
    errorMessage = "That doesn't look like a public GitHub repo. Try https://github.com/owner/repo.";
    render();
    return;
  }
  state = "working";
  currentProgress = [];
  lastResult = null;
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
    let gotResultOrError = false;
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
          gotResultOrError = true;
          lastResult = data;
          state = "result";
          render();
        } else if (eventName === "error") {
          gotResultOrError = true;
          errorMessage = data.message || "The check could not finish. Please try again in a minute.";
          state = "empty";
          render();
        }
      }
    }
    if (!gotResultOrError) {
      // dropped connection
      errorMessage = "The connection dropped. Please try again.";
      state = "empty";
      render();
    }
  } catch (e) {
    errorMessage = "The connection dropped. Please try again.";
    state = "empty";
    render();
  }
}

// initial render
render();
