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

  const rv = recordView(lastRecord);

  const lede = document.createElement("p");
  lede.className = "proof-result-lede";
  lede.textContent = rv
    ? "You do not have to trust this page. You can check this result in two ways."
    : "You do not have to trust this page. You can run the same check yourself.";
  inner.appendChild(lede);

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

  function addWayTitle(text: string, parent: HTMLElement): void {
    const title = document.createElement("h3");
    title.className = "proof-way-title";
    title.textContent = text;
    parent.appendChild(title);
  }

  function addNote(text: string, parent: HTMLElement): void {
    const note = document.createElement("p");
    note.className = "small muted";
    note.textContent = text;
    parent.appendChild(note);
  }

  addWayTitle(rv ? "1. Run the same check" : "Run the same check", left);
  addNote(`This result came from yokoten ${vm.evidence.version} at commit ${vm.evidence.shortCommit}.`, left);
  if (vm.evidence.doctorCommand) {
    addCodeBlockWithCopy(vm.evidence.doctorCommand, left);
  }
  if (vm.evidence.checkCommand) {
    addCodeBlockWithCopy(vm.evidence.checkCommand, left);
    addNote("Run this one in a clean home folder: on your own machine, check also looks for your own private marks, which this page never had.", left);
  }

  addWayTitle(rv ? "2. See if this result changed" : "Public record", right);
  if (rv) {
    addNote(`Download the result file and run this command. Its hash must match the hash recorded ${formatRecordTime(rv.recordedAt)}.`, right);
    const hashP = document.createElement("p");
    hashP.className = "mono proof-hash";
    hashP.textContent = rv.sha256;
    right.appendChild(hashP);
    const dlBtn = document.createElement("button");
    dlBtn.textContent = "Download the result";
    dlBtn.className = "button-quiet proof-download";
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
    right.appendChild(dlBtn);
    addCodeBlockWithCopy(rv.verifyCommand, right);
    if (rv.rekorUrl || rv.solanaUrl) {
      addNote("The same hash is in these public records:", right);
      const linksP = document.createElement("p");
      linksP.className = "proof-links";
      if (rv.rekorUrl) linksP.appendChild(createLink(rv.rekorUrl, "Rekor entry"));
      if (rv.solanaUrl) linksP.appendChild(createLink(rv.solanaUrl, "Solana devnet memo"));
      right.appendChild(linksP);
    }
    if (rv.solanaUrl) {
      addNote("Devnet is a test network. It can be reset, and it holds no real money.", right);
    }
    if (rv.message) {
      const msgP = document.createElement("p");
      msgP.textContent = rv.message;
      right.appendChild(msgP);
    }
  } else {
    addNote("No public record is available for this result.", right);
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
