import { formatRecordTime } from "../view.ts";
import { recordView } from "../fixes.ts";
import { createLink, addCopyButton } from "./dom.ts";
import type { CheckResult, ViewModel } from "../types.ts";

export function renderProofSection({ vm, lastResult, lastRecord }: { vm: ViewModel; lastResult: CheckResult; lastRecord: unknown }): HTMLElement {
  const section = document.createElement("section");
  section.className = "section-band";
  const inner = document.createElement("div");
  inner.className = "proof-inner";
  section.appendChild(inner);

  const label = document.createElement("p");
  label.className = "section-label";
  const num = document.createElement("span");
  num.textContent = "04 \u00b7";
  label.appendChild(num);
  label.appendChild(document.createTextNode(" Proof"));
  inner.appendChild(label);

  const h2 = document.createElement("h2");
  h2.className = "section-title";
  h2.textContent = "Check it yourself";
  inner.appendChild(h2);

  const grid = document.createElement("div");
  grid.className = "proof-grid";
  inner.appendChild(grid);

  const left = document.createElement("div");
  left.className = "proof-left";
  grid.appendChild(left);

  const right = document.createElement("div");
  right.className = "proof-right";
  grid.appendChild(right);

  function addCodeBlockWithCopy(text: string, parent: HTMLElement): void {
    const wrap = document.createElement("div");
    wrap.className = "code-wrap code-wrap--outside";
    const pre = document.createElement("pre");
    pre.className = "pre-dark";
    const code = document.createElement("code");
    code.textContent = text;
    pre.appendChild(code);
    wrap.appendChild(pre);
    const btn = addCopyButton("Copy", text, code);
    wrap.appendChild(btn);
    parent.appendChild(wrap);
  }

  const checkedBy = document.createElement("p");
  checkedBy.className = "small muted";
  checkedBy.textContent = `Checked by yokoten ${vm.evidence.version} at commit ${vm.evidence.shortCommit}.`;
  left.appendChild(checkedBy);

  const rv = recordView(lastRecord);
  if (rv) {
    const timeStr = formatRecordTime(rv.recordedAt);
    const recordedLine = document.createElement("p");
    recordedLine.className = "small proof-hash-label";
    recordedLine.textContent = `Result hash, recorded ${timeStr}`;
    left.appendChild(recordedLine);
    const hashP = document.createElement("p");
    hashP.className = "mono proof-hash";
    hashP.textContent = rv.sha256;
    left.appendChild(hashP);
    const linksP = document.createElement("p");
    linksP.className = "proof-links";
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
    const dlLink = document.createElement("a");
    dlLink.href = "#";
    dlLink.textContent = "Download the result";
    dlLink.addEventListener("click", (e) => {
      e.preventDefault();
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
    if (rv.rekorUrl || rv.solanaUrl) linksP.appendChild(document.createTextNode(" "));
    linksP.appendChild(dlLink);
    left.appendChild(linksP);
    if (rv.solanaUrl) {
      const devnetNote = document.createElement("p");
      devnetNote.className = "small muted";
      devnetNote.textContent = "Devnet is a test network. It can be reset, and it holds no real money.";
      left.appendChild(devnetNote);
    }
    const detailsCompare = document.createElement("details");
    detailsCompare.setAttribute("data-key", "compare-hash");
    const sumCompare = document.createElement("summary");
    sumCompare.textContent = "Compare the hash";
    detailsCompare.appendChild(sumCompare);
    const dlDesc = document.createElement("p");
    dlDesc.className = "small";
    dlDesc.textContent = "Download the result file and compare its hash:";
    detailsCompare.appendChild(dlDesc);
    const hashP2 = document.createElement("p");
    hashP2.className = "mono";
    hashP2.textContent = rv.sha256;
    detailsCompare.appendChild(hashP2);
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
    verifyWrap.className = "code-wrap code-wrap--outside";
    const preV = document.createElement("pre");
    preV.className = "pre-dark";
    const codeV = document.createElement("code");
    codeV.textContent = rv.verifyCommand;
    preV.appendChild(codeV);
    verifyWrap.appendChild(preV);
    const copyV = addCopyButton("Copy", rv.verifyCommand, codeV);
    verifyWrap.appendChild(copyV);
    detailsCompare.appendChild(verifyWrap);
    left.appendChild(detailsCompare);
    if (rv.message) {
      const msgP = document.createElement("p");
      msgP.textContent = rv.message;
      left.appendChild(msgP);
    }
  } else {
    const detailsCompare = document.createElement("details");
    detailsCompare.setAttribute("data-key", "compare-hash");
    const sumCompare = document.createElement("summary");
    sumCompare.textContent = "Compare the hash";
    detailsCompare.appendChild(sumCompare);
    const noRec = document.createElement("p");
    noRec.className = "small muted";
    noRec.textContent = "No public record is available for this result.";
    detailsCompare.appendChild(noRec);
    left.appendChild(detailsCompare);
  }

  if (vm.evidence.doctorCommand) {
    addCodeBlockWithCopy(vm.evidence.doctorCommand, right);
  }
  if (vm.evidence.checkCommand) {
    addCodeBlockWithCopy(vm.evidence.checkCommand, right);
    const note = document.createElement("p");
    note.className = "small muted";
    note.textContent = "Run this one in a clean home folder: on your own machine, check also looks for your own private marks, which this page never had.";
    right.appendChild(note);
  }

  const footer = document.createElement("div");
  footer.className = "proof-footer";
  if (lastResult.about) {
    const aboutP = document.createElement("p");
    aboutP.className = "small";
    aboutP.textContent = lastResult.about as string;
    footer.appendChild(aboutP);
  }
  const closingP = document.createElement("p");
  const codeNpx = document.createElement("code");
  codeNpx.textContent = "npx yokoten";
  closingP.appendChild(codeNpx);
  closingP.appendChild(document.createTextNode(" "));
  const yokLink = createLink("https://yokoten.app/", "yokoten.app");
  closingP.appendChild(yokLink);
  footer.appendChild(closingP);
  inner.appendChild(footer);

  return section;
}
