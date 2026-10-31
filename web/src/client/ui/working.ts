import { PROGRESS } from "../view.ts";

export function renderWorking({ repoName, progress }: { repoName: string; progress: string[] }): HTMLDivElement {
  const container = document.createElement("div");
  container.className = "checking-layout";
  const copy = document.createElement("div");
  copy.className = "checking-copy";
  const pChecking = document.createElement("p");
  pChecking.className = "checking-copy-label";
  pChecking.textContent = "Checking";
  copy.appendChild(pChecking);
  const h1 = document.createElement("h1");
  h1.className = "checking-copy-title";
  h1.textContent = repoName;
  copy.appendChild(h1);
  const pIntro = document.createElement("p");
  pIntro.className = "checking-copy-sub";
  pIntro.textContent = "The result comes first. Muse's files follow.";
  copy.appendChild(pIntro);
  container.appendChild(copy);
  const terminalWindow = document.createElement("div");
  terminalWindow.className = "terminal-window";
  const terminalHead = document.createElement("div");
  terminalHead.className = "terminal-head";
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement("span");
    dot.className = "terminal-dot";
    dot.setAttribute("aria-hidden", "true");
    terminalHead.appendChild(dot);
  }
  const sandboxSpan = document.createElement("span");
  sandboxSpan.className = "terminal-title";
  sandboxSpan.textContent = "SANDBOX";
  terminalHead.appendChild(sandboxSpan);
  const runningSpan = document.createElement("span");
  runningSpan.className = "terminal-aside";
  runningSpan.textContent = "RUNNING";
  terminalHead.appendChild(runningSpan);
  terminalWindow.appendChild(terminalHead);
  const terminalBody = document.createElement("div");
  terminalBody.className = "terminal-body";
  terminalBody.setAttribute("role", "status");
  const stepsOrder: string[] = ["reading", "copying", "checking"];
  const labels: Record<string, string> = {
    reading: PROGRESS.reading ?? "Reading the repo's details…",
    copying: PROGRESS.copying ?? "Copying the public files into a throwaway sandbox…",
    checking: PROGRESS.checking ?? "yokoten is checking, with the network off…",
  };
  const displayLabels: Record<string, string> = {
    reading: "Reading the repo's details",
    copying: "Copying the public files",
    checking: "Running yokoten, with the network cut",
  };
  const lastStep = progress.length > 0 ? progress[progress.length - 1] : null;
  const lastIndex = lastStep ? stepsOrder.indexOf(lastStep) : -1;
  for (let i = 0; i < stepsOrder.length; i++) {
    const step = stepsOrder[i];
    let state: string;
    if (lastIndex === -1) state = i === 0 ? "is-next" : "is-todo";
    else if (i < lastIndex) state = "is-done";
    else if (i === lastIndex) state = "is-next";
    else state = "is-todo";
    const row = document.createElement("div");
    row.className = "terminal-row " + state;
    const symbolSpan = document.createElement("span");
    const labelSpan = document.createElement("span");
    if (state === "is-done") symbolSpan.textContent = "✓ done";
    else if (state === "is-next") symbolSpan.textContent = "● next";
    else symbolSpan.textContent = "● to do";
    labelSpan.textContent = displayLabels[step] ?? labels[step];
    row.appendChild(symbolSpan);
    row.appendChild(labelSpan);
    terminalBody.appendChild(row);
  }
  const museRow = document.createElement("div");
  museRow.className = "terminal-row is-todo";
  const museSymbol = document.createElement("span");
  museSymbol.textContent = "● to do";
  const museLabel = document.createElement("span");
  museLabel.textContent = "Muse writes the project section";
  museRow.appendChild(museSymbol);
  museRow.appendChild(museLabel);
  terminalBody.appendChild(museRow);
  terminalWindow.appendChild(terminalBody);
  container.appendChild(terminalWindow);
  return container;
}
