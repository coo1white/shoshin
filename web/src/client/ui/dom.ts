import { splitCode } from "../view.ts";

export function createPanel(title: string, aside?: string): { panel: HTMLDivElement; body: HTMLDivElement; asideEl: HTMLSpanElement | null } {
  const panel = document.createElement("div");
  panel.className = "panel";
  const head = document.createElement("div");
  head.className = "panel-head";
  const titleEl = document.createElement("span");
  titleEl.textContent = title;
  head.appendChild(titleEl);
  let asideEl: HTMLSpanElement | null = null;
  if (aside) {
    asideEl = document.createElement("span");
    asideEl.textContent = aside;
    head.appendChild(asideEl);
  }
  panel.appendChild(head);
  const body = document.createElement("div");
  body.className = "panel-content";
  panel.appendChild(body);
  return { panel, body, asideEl };
}

export function safeUrl(href: string): string | null {
  if (typeof href !== "string") return null;
  if (href.startsWith("https://github.com/")) return href;
  if (href.startsWith("https://yokoten.app/")) return href;
  if (href.startsWith("https://")) return href;
  return null;
}

export function createLink(href: string, text: string): HTMLElement {
  const a = document.createElement("a");
  const safe = safeUrl(href);
  if (safe) {
    a.href = safe;
    a.textContent = text;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  } else {
    const span = document.createElement("span");
    span.textContent = text + " (" + href + ")";
    return span;
  }
  return a;
}

export function fallbackSelect(el: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

export function addCopyButton(label: string, text: string, codeEl: HTMLElement): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.className = "button-quiet";
  btn.type = "button";
  btn.addEventListener("click", () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => {
          btn.textContent = "Copied";
          setTimeout(() => {
            btn.textContent = label;
          }, 2000);
        },
        () => {
          fallbackSelect(codeEl);
          btn.textContent = "Press Ctrl+C to copy";
          const details = codeEl.closest("details");
          if (details) (details as HTMLDetailsElement).open = true;
        },
      ).catch(() => {
        fallbackSelect(codeEl);
        btn.textContent = "Press Ctrl+C to copy";
        const details = codeEl.closest("details");
        if (details) (details as HTMLDetailsElement).open = true;
      });
    } else {
      fallbackSelect(codeEl);
      btn.textContent = "Press Ctrl+C to copy";
      const details = codeEl.closest("details");
      if (details) (details as HTMLDetailsElement).open = true;
    }
  });
  return btn;
}

export function captureDetailsState(root: Element | null, openSet: Set<string>): void {
  if (!root) return;
  const detailsEls = root.querySelectorAll("details[data-key]");
  for (const d of detailsEls) {
    const key = d.getAttribute("data-key");
    if (!key) continue;
    if ((d as HTMLDetailsElement).open) openSet.add(key);
    else openSet.delete(key);
  }
}

export function restoreDetailsState(root: Element | null, openSet: Set<string>): void {
  if (!root) return;
  const detailsEls = root.querySelectorAll("details[data-key]");
  for (const d of detailsEls) {
    const key = d.getAttribute("data-key");
    if (!key) continue;
    if (openSet.has(key)) (d as HTMLDetailsElement).open = true;
  }
}

export function renderRichText(text: string | null | undefined, parent: HTMLElement): void {
  if (text == null || text === "") return;
  const parts = splitCode(text);
  for (const p of parts) {
    if (p.isCode) {
      const c = document.createElement("code");
      c.textContent = p.text;
      parent.appendChild(c);
    } else {
      parent.appendChild(document.createTextNode(p.text));
    }
  }
}

export function appendLabeledSection(parent: HTMLElement, labelText: string, value: string | null | undefined): void {
  if (value == null || value === "") return;
  const block = document.createElement("div");
  block.className = "field-block";
  const label = document.createElement("p");
  label.className = "field-label small muted";
  label.textContent = labelText;
  block.appendChild(label);
  const p = document.createElement("p");
  renderRichText(value, p);
  block.appendChild(p);
  parent.appendChild(block);
}
