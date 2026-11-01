import { formatRecordTime } from "../view.ts";
import { recordView } from "../fixes.ts";
import { createLink, addCopyButton } from "./dom.ts";
import type { CheckResult, ViewModel } from "../types.ts";

export function renderProofSection({ vm, lastResult, lastRecord }: { vm: ViewModel; lastResult: CheckResult; lastRecord: unknown }): HTMLElement {
  const section = document.createElement("section");
  section.className = "band";
  const inner = document.createElement("div");
  inner.className = "band-inner";
  section.appendChild(inner);

  const label = document.createElement("p");
  label.className = "section-label";
  label.textContent = "Verify";
  inner.appendChild(label);

  const h2 = document.createElement("h2");
  h2.className = "section-title";
  h2.textContent = "Check this result yourself";
  inner.appendChild(h2);

  const rv = recordView(lastRecord);

  const lede = document.createElement("p");
  lede.className = "proof-result-lede";
  lede.textContent = rv
    ? "You don't have to trust this page. There are two ways to check."
    : "You don't have to trust this page. You can run the same check yourself.";
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
    wrap.className = "code-wrap";
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
    addNote("Run this one from a clean home folder. On your own machine, check also looks for your private marks, which this page never had.", left);
  }

  addWayTitle(rv ? "2. Confirm the result hasn't changed" : "Public record", right);
  if (rv) {
    addNote(`Download the result and run this command. The hash has to match the one recorded ${formatRecordTime(rv.recordedAt)}.`, right);
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
    if (rv.rekorUrl && rv.solanaUrl) {
      addNote("The same hash is in two public records:", right);
      const linksP = document.createElement("p");
      linksP.className = "proof-links";
      linksP.appendChild(createLink(rv.rekorUrl, "Rekor entry"));
      linksP.appendChild(createLink(rv.solanaUrl, "Solana devnet memo"));
      right.appendChild(linksP);
    } else if (rv.rekorUrl || rv.solanaUrl) {
      addNote("The same hash is in this public record:", right);
      const linksP = document.createElement("p");
      linksP.className = "proof-links";
      if (rv.rekorUrl) linksP.appendChild(createLink(rv.rekorUrl, "Rekor entry"));
      if (rv.solanaUrl) linksP.appendChild(createLink(rv.solanaUrl, "Solana devnet memo"));
      right.appendChild(linksP);
    }
    if (rv.solanaUrl) {
      addNote("Devnet is a test network. It can be reset, and nothing on it has real value.", right);
    }
    if (rv.message) {
      const msgP = document.createElement("p");
      msgP.textContent = rv.message;
      right.appendChild(msgP);
    }
  } else {
    addNote("No public record exists for this result.", right);
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
