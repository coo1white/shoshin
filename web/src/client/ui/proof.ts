import { formatRecordTime } from "../view.ts";
import { recordView } from "../fixes.ts";
import { createLink, addCopyButton } from "./dom.ts";
import type { CheckResult, ViewModel } from "../types.ts";

export function renderProofSection({ vm, lastResult, lastRecord }: { vm: ViewModel; lastResult: CheckResult; lastRecord: unknown }): HTMLDivElement {
  const checkYourself = document.createElement("div");
  checkYourself.className = "check-yourself";
  const hCheck = document.createElement("h3");
  hCheck.textContent = "Check it yourself";
  checkYourself.appendChild(hCheck);
  const checkedBy = document.createElement("p");
  checkedBy.className = "small";
  checkedBy.textContent = `Checked by yokoten ${vm.evidence.version} at commit ${vm.evidence.shortCommit}.`;
  checkYourself.appendChild(checkedBy);

  function addCodeBlockWithCopy(text: string): HTMLDivElement {
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

  if (lastResult.about) {
    const aboutP = document.createElement("p");
    aboutP.className = "small";
    aboutP.textContent = lastResult.about as string;
    checkYourself.appendChild(aboutP);
  }
  const closingP = document.createElement("p");
  const codeNpx = document.createElement("code");
  codeNpx.textContent = "npx yokoten";
  closingP.appendChild(codeNpx);
  closingP.appendChild(document.createTextNode(" "));
  const yokLink = createLink("https://yokoten.app/", "https://yokoten.app/");
  closingP.appendChild(yokLink);
  checkYourself.appendChild(closingP);

  return checkYourself;
}
