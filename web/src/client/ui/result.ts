import { createLink, renderRichText, appendLabeledSection } from "./dom.ts";
import type { CheckResult, FixesPayload, ViewModel } from "../types.ts";

export function renderResultHeader({ lastResult, vm, lastFixes }: { lastResult: CheckResult; vm: ViewModel; lastFixes: FixesPayload | null }): HTMLDivElement {
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
        const range = document.createRange();
        range.selectNodeContents(fakeCode);
        const sel = window.getSelection();
        if (sel) { sel.removeAllRanges(); sel.addRange(range); }
        btn.textContent = "Press Ctrl+C to copy";
      });
    } else {
      const range = document.createRange();
      range.selectNodeContents(fakeCode);
      const sel = window.getSelection();
      if (sel) { sel.removeAllRanges(); sel.addRange(range); }
      copyLinkBtn.textContent = "Press Ctrl+C to copy";
    }
  });
  repoNameRow.appendChild(copyLinkBtn);
  term.appendChild(repoNameRow);

  const scoreLine = document.createElement("p");
  scoreLine.className = "score-line";
  scoreLine.textContent = vm.score.text;
  term.appendChild(scoreLine);

  const prog = document.createElement("progress");
  prog.max = vm.score.total;
  prog.value = vm.score.done;
  prog.setAttribute("aria-label", vm.score.text);
  term.appendChild(prog);

  if (lastFixes && lastFixes.summary && lastFixes.summary.trim() !== "") {
    const sumP = document.createElement("p");
    sumP.textContent = lastFixes.summary;
    term.appendChild(sumP);
    const small = document.createElement("p");
    small.className = "small muted";
    small.textContent = "Summary by Muse.";
    term.appendChild(small);
  }

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

  return term;
}
