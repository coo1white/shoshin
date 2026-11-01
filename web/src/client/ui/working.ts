import { createPanel } from "./dom.ts";

export function renderWorking({ repoName, progress }: { repoName: string; progress: string[] }): HTMLDivElement {
  const { panel, body, asideEl } = createPanel(repoName, "Running");
  if (asideEl) asideEl.className = "panel-live";
  body.classList.add("work-list");
  body.setAttribute("role", "status");
  const steps: Array<[string, string]> = [
    ["reading", "Looking up the repo"],
    ["copying", "Copying the public files"],
    ["checking", "Running yokoten with the network off"],
    ["muse", "Muse is writing the project section"],
  ];
  const lastStep = progress.length > 0 ? progress[progress.length - 1] : null;
  const stepOrder = steps.map(([id]) => id);
  const lastIndex = lastStep ? stepOrder.indexOf(lastStep) : -1;
  const effectiveLast = lastIndex === -1 ? 0 : lastIndex;
  for (let i = 0; i < steps.length; i++) {
    const [id, label] = steps[i];
    const isMuse = id === "muse";
    let state: string;
    let mark: string;
    if (i < effectiveLast) {
      state = "is-done";
      mark = "done";
    } else if (i === effectiveLast) {
      state = "is-now";
      mark = "now";
    } else {
      state = "is-wait";
      mark = "soon";
    }
    if (isMuse && lastStep === "checking") {
      state = "is-wait";
      mark = "soon";
    }
    const row = document.createElement("div");
    row.className = "work-row " + state;
    const markSpan = document.createElement("span");
    markSpan.textContent = mark;
    const labelSpan = document.createElement("span");
    labelSpan.textContent = label;
    row.appendChild(markSpan);
    row.appendChild(labelSpan);
    body.appendChild(row);
  }
  return panel;
}
