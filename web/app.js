// @ts-check
const API = "https://yokoten-doctor--yokoten-doctor-fastapi-app.us-east.modal.run";

import { PROGRESS, viewModel, repoFromInput, repoFromQuery } from "./view.js";
import { renderStartPanel } from "./ui/start.js";
import { renderResultHeader } from "./ui/result.js";
import { renderFixSection } from "./ui/fix.js";
import { renderProofSection, renderFooter } from "./ui/proof.js";
import { captureDetailsState, restoreDetailsState } from "./ui/dom.js";

const appEl = document.getElementById("app");

let state = "empty";
let currentProgress = [];
let lastResult = null;
let errorMessage = "";
let inputValue = "";
let lastFixes = null;
let isWaitingForFixes = false;
let hasChecked = false;
let lastRecord = null;
let hasScrolledForResult = false;

/** @type {Set<string>} */
let openDetailsKeys = new Set();

const _staticInput = document.getElementById("repo-input");
if (_staticInput && typeof _staticInput.value === "string" && _staticInput.value) {
  inputValue = _staticInput.value;
}

function markFixesLost() {
  if (lastResult && lastFixes == null) {
    lastFixes = { files: [], summary: "", muse: "lost" };
    isWaitingForFixes = false;
    render();
  }
}

function maybeUpdateUrl(inputText) {
  const repo = repoFromInput(inputText);
  if (repo) {
    const next = "?repo=" + encodeURIComponent(repo);
    try {
      history.replaceState(null, "", next);
    } catch {}
  }
}

function scrollResultIntoView() {
  const el = document.getElementById("result-panel");
  if (!el) return;
  const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const behavior = prefersReduced ? "auto" : "smooth";
  try {
    el.scrollIntoView({ behavior, block: "start" });
  } catch {}
}

function render() {
  if (appEl) captureDetailsState(appEl, openDetailsKeys);
  if (!appEl) return;
  while (appEl.firstChild) appEl.removeChild(appEl.firstChild);

  const h1 = document.createElement("h1");
  h1.textContent = "Is your repo ready for AI agents?";
  appEl.appendChild(h1);

  const startPanel = renderStartPanel({
    state,
    inputValue,
    onInput: (v) => { inputValue = v; },
    onSubmit: () => startCheck(),
  });
  appEl.appendChild(startPanel);

  if (errorMessage) {
    const err = document.createElement("p");
    err.setAttribute("role", "alert");
    err.textContent = errorMessage;
    err.className = "error-box";
    appEl.appendChild(err);
  }

  if (state === "working") {
    const progWrap = document.createElement("div");
    progWrap.className = "panel";
    const title = document.createElement("h2");
    title.textContent = "Checking…";
    progWrap.appendChild(title);
    const stepsOrder = ["reading", "copying", "checking"];
    stepsOrder.forEach((step) => {
      const idx = stepsOrder.indexOf(step);
      const currentIdx = stepsOrder.indexOf(currentProgress[currentProgress.length - 1]);
      if (currentProgress.length === 0) return;
      if (idx > currentIdx) return;
      const p = document.createElement("p");
      p.className = "progress-item";
      const prefix = idx < currentIdx ? "✓ " : "";
      p.textContent = prefix + (PROGRESS[step] || step);
      progWrap.appendChild(p);
    });
    appEl.appendChild(progWrap);
  }

  if (state === "result" && lastResult) {
    const vm = viewModel(lastResult);
    const term = renderResultHeader({ lastResult, vm, lastFixes });
    const fixSection = renderFixSection({ vm, lastFixes, isWaitingForFixes, lastResult });
    term.appendChild(fixSection);
    const proof = renderProofSection({ vm, lastResult, lastRecord });
    term.appendChild(proof);
    appEl.appendChild(term);
  }

  const footer = renderFooter();
  appEl.appendChild(footer);
  restoreDetailsState(appEl, openDetailsKeys);
  if (errorMessage && hasChecked) {
    const inputEl = document.getElementById("repo-input");
    if (inputEl) inputEl.focus();
  }
}

async function startCheck() {
  errorMessage = "";
  const url = inputValue.trim();
  if (!url) {
    errorMessage = "That doesn't look like a public GitHub repo. Try https://github.com/owner/repo.";
    hasChecked = true;
    state = "empty";
    render();
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
  hasChecked = true;
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
      let idx;
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
        let data = null;
        try { data = JSON.parse(dataStr); } catch { data = {}; }
        if (eventName === "progress") {
          const step = data.step;
          if (step) { currentProgress.push(step); render(); }
        } else if (eventName === "result") {
          hasResultOrError = true;
          lastResult = data;
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
          lastFixes = data;
          isWaitingForFixes = false;
          render();
        } else if (eventName === "record") {
          lastRecord = data;
          render();
        } else if (eventName === "error") {
          hasResultOrError = true;
          errorMessage = data.message || "The check could not finish. Please try again in a minute.";
          state = "empty";
          render();
        }
      }
    }
    if (!hasResultOrError) {
      errorMessage = "The connection dropped. Please try again.";
      state = "empty";
      render();
    } else {
      markFixesLost();
    }
  } catch (e) {
    if (lastResult) { markFixesLost(); return; }
    errorMessage = "The connection dropped. Please try again.";
    state = "empty";
    render();
  }
}

render();

try {
  const fromQ = repoFromQuery(window.location.search);
  if (fromQ) {
    const full = "https://github.com/" + fromQ;
    inputValue = full;
    const el = document.getElementById("repo-input");
    if (el) el.value = full;
    startCheck();
  }
} catch {}
