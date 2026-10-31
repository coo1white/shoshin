export function renderWorking({ repoName, progress }: { repoName: string; progress: string[] }): HTMLDivElement {
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
  const titleSpan = document.createElement("span");
  titleSpan.className = "terminal-title";
  titleSpan.textContent = repoName;
  terminalHead.appendChild(titleSpan);
  const runningSpan = document.createElement("span");
  runningSpan.className = "terminal-aside";
  runningSpan.textContent = "RUNNING";
  terminalHead.appendChild(runningSpan);
  terminalWindow.appendChild(terminalHead);
  const terminalBody = document.createElement("div");
  terminalBody.className = "terminal-body";
  terminalBody.setAttribute("role", "status");
  const steps: Array<[string, string]> = [
    ["reading", "Reading the repo's details"],
    ["copying", "Copying the public files"],
    ["checking", "Running yokoten, with the network cut"],
    ["muse", "Muse writes the project section"],
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
      mark = "✓ done";
    } else if (i === effectiveLast) {
      state = "is-now";
      mark = "● now";
    } else {
      state = "is-wait";
      mark = "· wait";
    }
    if (isMuse && lastStep === "checking") {
      state = "is-wait";
      mark = "· wait";
    }
    const row = document.createElement("div");
    row.className = "terminal-row " + state;
    const symbolSpan = document.createElement("span");
    symbolSpan.textContent = mark;
    const labelSpan = document.createElement("span");
    labelSpan.textContent = label;
    row.appendChild(symbolSpan);
    row.appendChild(labelSpan);
    terminalBody.appendChild(row);
  }
  terminalWindow.appendChild(terminalBody);
  return terminalWindow;
}
