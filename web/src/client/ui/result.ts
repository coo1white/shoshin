import { createLink, renderRichText, appendLabeledSection } from "./dom.ts";
import { secretFolders, toSentence } from "../view.ts";
import type { CheckResult, FixesPayload, ViewModel } from "../types.ts";

function makeTerminalWindow(titleLeft: string, titleRight: string): { wrap: HTMLElement; body: HTMLElement } {
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
  t1.textContent = titleLeft;
  head.appendChild(t1);
  const t2 = document.createElement("span");
  t2.textContent = titleRight;
  head.appendChild(t2);
  fig.appendChild(head);
  const body = document.createElement("div");
  body.className = "terminal-body";
  fig.appendChild(body);
  return { wrap: fig, body };
}

export function renderResultHero({ lastResult, vm, lastFixes }: { lastResult: CheckResult; vm: ViewModel; lastFixes: FixesPayload | null }): HTMLElement {
  const section = document.createElement("section");
  section.className = "result-hero";
  section.id = "result-panel";

  const actions = document.createElement("div");
  actions.className = "result-actions";
  const checkAnother = document.createElement("a");
  checkAnother.href = "/";
  checkAnother.textContent = "Check another repo";
  actions.appendChild(checkAnother);
  const checkAgain = document.createElement("a");
  checkAgain.textContent = "Check again";
  checkAgain.href = `/?repo=${encodeURIComponent(lastResult.owner + "/" + lastResult.repo)}`;
  if (window.location.pathname === "/") {
    checkAgain.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = checkAgain.href;
      window.location.reload();
    });
  }
  actions.appendChild(checkAgain);
  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.textContent = "Copy link to this result";
  const currentUrl = window.location.href;
  copyBtn.addEventListener("click", () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(currentUrl).then(() => {
        copyBtn.textContent = "Copied";
        setTimeout(() => { copyBtn.textContent = "Copy link to this result"; }, 2000);
      }).catch(() => {
        copyBtn.textContent = "Press Ctrl+C to copy";
      });
    } else {
      copyBtn.textContent = "Press Ctrl+C to copy";
    }
  });
  actions.appendChild(copyBtn);
  section.appendChild(actions);

  const left = document.createElement("div");
  left.className = "result-hero-left";

  const meta = document.createElement("p");
  meta.className = "result-meta";
  const shortCommit = vm.evidence.shortCommit || "";
  const ver = vm.evidence.version || "";
  meta.textContent = `${shortCommit} \u00b7 yokoten ${ver}`;
  left.appendChild(meta);

  const h1 = document.createElement("h1");
  h1.className = "result-repo";
  h1.appendChild(document.createTextNode(`${lastResult.owner}/`));
  h1.appendChild(document.createElement("wbr"));
  h1.appendChild(document.createTextNode(`${lastResult.repo}`));
  left.appendChild(h1);

  if (lastFixes && lastFixes.summary && lastFixes.summary.trim() !== "") {
    const sumP = document.createElement("p");
    sumP.className = "result-summary";
    sumP.textContent = lastFixes.summary;
    left.appendChild(sumP);
    const small = document.createElement("p");
    small.className = "result-summary-note";
    small.textContent = "Summary by Muse.";
    left.appendChild(small);
  }

  const scoreWrap = document.createElement("div");
  scoreWrap.className = "score";
  const big = document.createElement("p");
  big.className = "score-big";
  const total = vm.score.total;
  const done = vm.score.done;
  big.textContent = `${done} `;
  const span = document.createElement("span");
  span.textContent = `of ${total} file checks`;
  big.appendChild(span);
  scoreWrap.appendChild(big);

  const bar = document.createElement("div");
  bar.className = "score-bar";
  bar.setAttribute("role", "img");
  bar.setAttribute("aria-label", vm.score.text);
  const segCount = vm.score.total || 0;
  bar.style.setProperty("--seg-count", String(segCount || 1));
  let afterDone: number | null = null;
  let afterTotal: number | null = null;
  let hasAfter = false;
  if (lastFixes && lastFixes.after && typeof lastFixes.after.done === "number" && typeof lastFixes.after.total === "number") {
    if (lastFixes.after.done > done) {
      hasAfter = true;
      afterDone = lastFixes.after.done;
      afterTotal = lastFixes.after.total;
    }
  }
  for (let i = 0; i < segCount; i++) {
    const seg = document.createElement("span");
    seg.className = "score-seg";
    if (i < done) seg.classList.add("is-done");
    else if (hasAfter && afterDone != null && i < afterDone) seg.classList.add("is-after");
    else seg.classList.add("is-open");
    bar.appendChild(seg);
  }
  scoreWrap.appendChild(bar);
  if (hasAfter && afterDone != null && afterTotal != null) {
    const afterP = document.createElement("p");
    afterP.className = "score-after";
    afterP.textContent = `${afterDone} of ${afterTotal} with the files below.`;
    scoreWrap.appendChild(afterP);
  }
  left.appendChild(scoreWrap);

  if (vm.next) {
    const nextWrap = document.createElement("div");
    nextWrap.className = "next-step";
    const label = document.createElement("p");
    label.className = "next-label";
    label.textContent = "Next step";
    nextWrap.appendChild(label);
    const h2 = document.createElement("h2");
    h2.className = "next-title";
    h2.textContent = vm.next.title;
    nextWrap.appendChild(h2);
    if (vm.next.why) {
      const whyP = document.createElement("p");
      whyP.className = "next-why";
      whyP.textContent = toSentence(vm.next.why);
      nextWrap.appendChild(whyP);
    }
    const fixLink = document.createElement("a");
    fixLink.href = "#fix";
    fixLink.textContent = "Fix it";
    fixLink.className = "button-primary";
    nextWrap.appendChild(fixLink);
    left.appendChild(nextWrap);
  } else if (!vm.next && vm.installOnly.length === 0) {
    const doneP = document.createElement("p");
    doneP.className = "every-done";
    doneP.textContent = "Every file check is done.";
    left.appendChild(doneP);
  }

  const right = document.createElement("div");
  right.className = "result-hero-right";
  const steps = (lastResult.summary as { steps?: { id: string; title: string; mark: string }[] } | undefined)?.steps ?? [];
  const term = makeTerminalWindow("DOCTOR", `${total} CHECKS`);
  for (const s of steps) {
    const row = document.createElement("div");
    row.className = "terminal-row";
    const markSpan = document.createElement("span");
    const titleSpan = document.createElement("span");
    titleSpan.textContent = s.title;
    if (s.mark === "done") {
      row.classList.add("is-done");
      markSpan.textContent = "\u2713 done";
    } else if (s.mark === "next") {
      row.classList.add("is-next");
      markSpan.textContent = "\u25cf next";
    } else {
      row.classList.add("is-todo");
      markSpan.textContent = "\u25cf to do";
    }
    row.appendChild(markSpan);
    row.appendChild(titleSpan);
    term.body.appendChild(row);
  }
  right.appendChild(term.wrap);

  section.appendChild(left);
  section.appendChild(right);

  const detailsAll = document.createElement("details");
  detailsAll.setAttribute("data-key", "show-all-checks");
  detailsAll.className = "show-all-checks";
  const sumAll = document.createElement("summary");
  sumAll.textContent = "Show all checks";
  detailsAll.appendChild(sumAll);
  for (const st of vm.others) {
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
  }
  section.appendChild(detailsAll);

  return section;
}

export function renderPrivateSection({ vm }: { vm: ViewModel }): HTMLElement | null {
  if (!vm.secretCount || vm.secretCount === 0) return null;
  const section = document.createElement("section");
  section.className = "section-split private-section";
  const left = document.createElement("div");
  const label = document.createElement("p");
  label.className = "section-label";
  const num = document.createElement("span");
  num.textContent = "03 \u00b7";
  label.appendChild(num);
  label.appendChild(document.createTextNode(" Worth a look"));
  left.appendChild(label);
  const h2 = document.createElement("h2");
  h2.className = "section-title";
  if (vm.secretCount === 1) h2.textContent = "1 thing looks private";
  else h2.textContent = `${vm.secretCount} things look private`;
  left.appendChild(h2);
  const note = document.createElement("p");
  note.className = "muted";
  note.textContent = "Some may be public on purpose. You decide.";
  left.appendChild(note);
  const allPlaces = vm.secretGroups.flatMap((g) => g.places);
  const folders = secretFolders(allPlaces);
  const ul = document.createElement("ul");
  ul.className = "folder-list";
  for (const f of folders) {
    const li = document.createElement("li");
    const leftSpan = document.createElement("span");
    leftSpan.textContent = f.folder;
    const rightSpan = document.createElement("span");
    rightSpan.textContent = String(f.count);
    li.appendChild(leftSpan);
    li.appendChild(rightSpan);
    ul.appendChild(li);
  }
  left.appendChild(ul);
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
  left.appendChild(details);
  section.appendChild(left);
  return section;
}
