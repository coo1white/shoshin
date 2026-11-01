import { formatRecordTime } from "../view.ts";
import { recordView } from "../fixes.ts";
import { createLink, addCopyButton } from "./dom.ts";
import type { ViewModel } from "../types.ts";

export function renderProofSection({ vm, lastRecord }: { vm: ViewModel; lastRecord: unknown }): HTMLElement {
  const section = document.createElement("section");
  section.className = "band";
  const inner = document.createElement("div");
  inner.className = "band-inner";
  section.appendChild(inner);

  const label = document.createElement("p");
  label.className = "section-label";
  label.textContent = "Verify";
  inner.appendChild(label);

  const rv = recordView(lastRecord);

  const h2 = document.createElement("h2");
  h2.className = "section-title";
  const rekorUrl = rv?.rekorUrl;
  h2.textContent = rekorUrl ? "This result is on record" : "No public record for this result";
  inner.appendChild(h2);

  const lede = document.createElement("p");
  lede.className = "proof-result-lede";
  if (rv && rekorUrl) {
    const isBoth = !!rv.solanaUrl;
    const prefix = isBoth
      ? "A fingerprint of this result (its SHA-256 hash) has been in two public records since "
      : "A fingerprint of this result (its SHA-256 hash) has been in a public record since ";
    lede.appendChild(document.createTextNode(prefix));
    const timeSpan = document.createElement("span");
    timeSpan.className = "proof-time";
    timeSpan.textContent = formatRecordTime(rv.recordedAt);
    lede.appendChild(timeSpan);
    lede.appendChild(document.createTextNode(". Nothing to do here, unless you want to check it yourself."));
  } else {
    lede.textContent = "The public record couldn't be written this time. The check still ran, and you can run it yourself.";
  }
  inner.appendChild(lede);

  const details = document.createElement("details");
  details.className = "proof-fold";
  details.setAttribute("data-key", "proof-check");
  const summary = document.createElement("summary");
  summary.textContent = "Check it yourself";
  details.appendChild(summary);

  const steps = document.createElement("div");
  steps.className = "proof-steps";
  details.appendChild(steps);

  function addCommand(title: string, text: string, parent: HTMLElement): void {
    const fig = document.createElement("figure"); fig.className = "proof-code";
    const head = document.createElement("div"); head.className = "proof-code-head";
    const name = document.createElement("span"); name.textContent = title; head.appendChild(name);
    const pre = document.createElement("pre"); const code = document.createElement("code");
    code.textContent = text; pre.appendChild(code);
    head.appendChild(addCopyButton("Copy", text, code));
    fig.appendChild(head); fig.appendChild(pre); parent.appendChild(fig);
  }

  const step1 = document.createElement("section");
  step1.className = "proof-step";
  steps.appendChild(step1);
  const way1 = document.createElement("h3");
  way1.className = "proof-way-title";
  way1.textContent = "Run the same check";
  step1.appendChild(way1);
  const note1 = document.createElement("p");
  note1.className = "small muted";
  note1.textContent = `This result came from yokoten ${vm.evidence.version} at commit ${vm.evidence.shortCommit}.`;
  step1.appendChild(note1);
  if (vm.evidence.doctorCommand) {
    addCommand("Clone and check", vm.evidence.doctorCommand, step1);
  }
  if (vm.evidence.checkCommand) {
    addCommand("From a clean home folder", vm.evidence.checkCommand, step1);
    const note2 = document.createElement("p");
    note2.className = "small muted";
    note2.textContent = "Run this one from a clean home folder. On your own machine, check also looks for your private marks, which this page never had.";
    step1.appendChild(note2);
  }

  if (rv && rekorUrl) {
    const step2 = document.createElement("section");
    step2.className = "proof-step";
    steps.appendChild(step2);
    const way2 = document.createElement("h3");
    way2.className = "proof-way-title";
    way2.textContent = "Confirm the record";
    step2.appendChild(way2);
    const note3 = document.createElement("p");
    note3.className = "small muted";
    note3.appendChild(document.createTextNode("Download the result and hash it. The hash has to match the one recorded "));
    const timeSpan2 = document.createElement("span");
    timeSpan2.className = "proof-time";
    timeSpan2.textContent = formatRecordTime(rv.recordedAt);
    note3.appendChild(timeSpan2);
    note3.appendChild(document.createTextNode("."));
    step2.appendChild(note3);
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
    step2.appendChild(dlBtn);
    addCommand("Hash the file", rv.verifyCommand, step2);
    const dl = document.createElement("dl");
    dl.className = "proof-record";
    const dtHash = document.createElement("dt");
    dtHash.textContent = "Recorded hash";
    dl.appendChild(dtHash);
    const ddHash = document.createElement("dd");
    ddHash.className = "proof-hash";
    ddHash.textContent = rv.sha256;
    dl.appendChild(ddHash);
    const dtRec = document.createElement("dt");
    dtRec.textContent = rv.solanaUrl ? "Public records" : "Public record";
    dl.appendChild(dtRec);
    const ddRec = document.createElement("dd");
    const linksP = document.createElement("p");
    linksP.className = "proof-links";
    linksP.appendChild(createLink(rekorUrl, "Sigstore Rekor entry"));
    if (rv.solanaUrl) linksP.appendChild(createLink(rv.solanaUrl, "Solana devnet memo"));
    ddRec.appendChild(linksP);
    dl.appendChild(ddRec);
    step2.appendChild(dl);
    const lastNote = document.createElement("p");
    lastNote.className = "small muted";
    if (rv.solanaUrl) {
      lastNote.textContent = "Devnet is a test network. It can be reset, and nothing on it has real value.";
    } else {
      lastNote.textContent = rv.message;
    }
    step2.appendChild(lastNote);
  }

  inner.appendChild(details);

  return section;
}
