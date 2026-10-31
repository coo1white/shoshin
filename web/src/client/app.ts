const API = "https://yokoten-doctor--yokoten-doctor-fastapi-app.us-east.modal.run";

import { viewModel, repoFromInput, repoFromQuery } from "./view.ts";
import { renderResultHeader } from "./ui/result.ts";
import { renderFixSection } from "./ui/fix.ts";
import { renderProofSection } from "./ui/proof.ts";
import { captureDetailsState, restoreDetailsState } from "./ui/dom.ts";
import { renderWorking } from "./ui/working.ts";
import type { CheckResult, FixesPayload, RecordPayload } from "./types.ts";

const appEl = document.getElementById("app") as HTMLElement | null;
const landingEl = document.getElementById("landing") as HTMLElement | null;
const checkForm = document.getElementById("check-form") as HTMLFormElement | null;
const repoInput = document.getElementById("repo-input") as HTMLInputElement | null;
const checkError = document.getElementById("check-error") as HTMLParagraphElement | null;

let state: "empty" | "working" | "result" = "empty";
let currentProgress: string[] = [];
let lastResult: CheckResult | null = null;
let lastFixes: FixesPayload | null = null;
let isWaitingForFixes = false;
let lastRecord: RecordPayload | null = null;
let hasScrolledForResult = false;

const openDetailsKeys = new Set<string>();

function markFixesLost(): void {
  if (lastResult && lastFixes == null) {
    lastFixes = { files: [], summary: "", muse: "lost" };
    isWaitingForFixes = false;
    render();
  }
}

function maybeUpdateUrl(inputText: string): void {
  const repo = repoFromInput(inputText);
  if (repo) {
    const next = "?repo=" + encodeURIComponent(repo);
    try {
      history.replaceState(null, "", next);
    } catch {}
  }
}

function scrollResultIntoView(): void {
  const el = document.getElementById("result-panel");
  if (!el) return;
  const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const behavior: ScrollBehavior = prefersReduced ? "auto" : "smooth";
  try {
    el.scrollIntoView({ behavior, block: "start" });
  } catch {}
}

function updateVisibility(): void {
  if (state === "empty") {
    if (landingEl) landingEl.hidden = false;
    if (appEl) appEl.hidden = true;
  } else {
    if (landingEl) landingEl.hidden = true;
    if (appEl) appEl.hidden = false;
  }
}

function showError(message: string): void {
  if (checkError) {
    checkError.textContent = message;
    checkError.hidden = false;
  }
  if (repoInput) repoInput.focus();
}

function clearError(): void {
  if (checkError) {
    checkError.textContent = "";
    checkError.hidden = true;
  }
}

function render(): void {
  if (appEl) captureDetailsState(appEl, openDetailsKeys);
  if (!appEl) return;
  while (appEl.firstChild) appEl.removeChild(appEl.firstChild);

  updateVisibility();

  if (state === "working") {
    const rawUrl = repoInput ? repoInput.value.trim() : "";
    const repoName = repoFromInput(rawUrl) ?? (rawUrl || "");
    const working = renderWorking({ repoName, progress: currentProgress });
    appEl.appendChild(working);
  }

  if (state === "result" && lastResult) {
    const vm = viewModel(lastResult);
    const checkAnother = document.createElement("a");
    checkAnother.href = "./";
    checkAnother.textContent = "Check another repo";
    checkAnother.className = "check-another";
    appEl.appendChild(checkAnother);
    const term = renderResultHeader({ lastResult, vm, lastFixes });
    const fixSection = renderFixSection({ vm, lastFixes, isWaitingForFixes, lastResult });
    term.appendChild(fixSection);
    const proof = renderProofSection({ vm, lastResult, lastRecord });
    term.appendChild(proof);
    appEl.appendChild(term);
  }

  restoreDetailsState(appEl, openDetailsKeys);
}

async function startCheck(): Promise<void> {
  clearError();
  const url = repoInput ? repoInput.value.trim() : "";
  if (!url) {
    const msg = "That doesn't look like a public GitHub repo. Try https://github.com/owner/repo.";
    state = "empty";
    render();
    showError(msg);
    return;
  }
  maybeUpdateUrl(url);
  state = "working";
  currentProgress = [];
  lastResult = null;
  lastFixes = null;
  lastRecord = null;
  isWaitingForFixes = false;
  hasScrolledForResult = false;
  openDetailsKeys.clear();
  render();

  try {
    const resp = await fetch(API + "/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!resp.ok && !resp.body) throw new Error("network");
    const reader = resp.body ? resp.body.getReader() : null;
    if (!reader) throw new Error("no body");
    const decoder = new TextDecoder();
    let buffer = "";
    let hasResultOrError = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (!raw.trim()) continue;
        let eventName = "";
        let dataStr = "";
        const lines = raw.split("\n");
        for (const line of lines) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          else if (line.startsWith("data:")) dataStr = line.slice(5).trim();
        }
        if (!eventName) continue;
        let data: unknown = null;
        try { data = JSON.parse(dataStr); } catch { data = {}; }
        if (eventName === "progress") {
          const d = data as Record<string, unknown>;
          const step = d.step as string | undefined;
          if (step) { currentProgress.push(step); render(); }
        } else if (eventName === "result") {
          hasResultOrError = true;
          lastResult = data as CheckResult;
          state = "result";
          isWaitingForFixes = true;
          render();
          if (!hasScrolledForResult) {
            hasScrolledForResult = true;
            requestAnimationFrame(() => {
              requestAnimationFrame(() => scrollResultIntoView());
            });
          }
        } else if (eventName === "fixes") {
          if (!lastResult) continue;
          lastFixes = data as FixesPayload;
          isWaitingForFixes = false;
          render();
        } else if (eventName === "record") {
          lastRecord = data as RecordPayload;
          render();
        } else if (eventName === "error") {
          hasResultOrError = true;
          const d = data as Record<string, unknown>;
          const msg = typeof d.message === "string" ? d.message : "The check could not finish. Please try again in a minute.";
          state = "empty";
          render();
          showError(msg);
        }
      }
    }
    if (!hasResultOrError) {
      const msg = "The connection dropped. Please try again.";
      state = "empty";
      render();
      showError(msg);
    } else {
      markFixesLost();
    }
  } catch (_e) {
    if (lastResult) { markFixesLost(); return; }
    const msg = "The connection dropped. Please try again.";
    state = "empty";
    render();
    showError(msg);
  }
}

if (checkForm) {
  checkForm.addEventListener("submit", (e) => {
    e.preventDefault();
    void startCheck();
  });
}

render();

try {
  const fromQ = repoFromQuery(window.location.search);
  if (fromQ) {
    const full = "https://github.com/" + fromQ;
    if (repoInput) repoInput.value = full;
    void startCheck();
  }
} catch {}
