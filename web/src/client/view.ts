export const PROGRESS: Record<string, string> = {
  reading: "Reading the repo's details…",
  copying: "Copying the public files into a throwaway sandbox…",
  checking: "yokoten is checking, with the network off…",
};

export function splitCode(text: string): { text: string; isCode: boolean }[] {
  if (typeof text !== "string") return [{ text: String(text), isCode: false }];
  const out: { text: string; isCode: boolean }[] = [];
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf("`", i);
    if (start === -1) {
      out.push({ text: text.slice(i), isCode: false });
      break;
    }
    const end = text.indexOf("`", start + 1);
    if (end === -1) {
      out.push({ text: text.slice(i), isCode: false });
      break;
    }
    if (start > i) out.push({ text: text.slice(i, start), isCode: false });
    out.push({ text: text.slice(start + 1, end), isCode: true });
    i = end + 1;
  }
  return out;
}

export function formatRecordTime(iso: string): string {
  if (typeof iso !== "string") return iso;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number): string => String(n).padStart(2, "0");
  const y = d.getUTCFullYear();
  const m = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const h = pad(d.getUTCHours());
  const min = pad(d.getUTCMinutes());
  return `${y}-${m}-${day} ${h}:${min} UTC`;
}

function isValidRepoPart(part: string): boolean {
  if (part.length === 0) return false;
  if (part === "." || part === "..") return false;
  return /^[A-Za-z0-9._-]+$/.test(part);
}

function isValidRepo(owner: string, repo: string): boolean {
  return isValidRepoPart(owner) && isValidRepoPart(repo);
}

export function repoFromInput(text: string): string | null {
  if (typeof text !== "string") return null;
  let t = text.trim();
  if (!t) return null;
  const prefixRe = /^https:\/\/github\.com\//i;
  if (prefixRe.test(t)) {
    t = t.replace(prefixRe, "");
    t = t.replace(/\/+$/, "");
    if (t.toLowerCase().endsWith(".git")) t = t.slice(0, -4);
    const parts = t.split("/").filter((p) => p.length > 0);
    if (parts.length !== 2) return null;
    const [owner, repo] = parts;
    if (!isValidRepo(owner, repo)) return null;
    return `${owner}/${repo}`;
  }
  if (t.includes(" ") || t.includes("://")) return null;
  const cleaned = t.replace(/\/+$/, "");
  const parts = cleaned.split("/");
  if (parts.length !== 2) return null;
  const [owner, repo] = parts;
  let r = repo;
  if (r.toLowerCase().endsWith(".git")) r = r.slice(0, -4);
  if (!isValidRepo(owner, r)) return null;
  return `${owner}/${r}`;
}

export function repoFromQuery(search: string): string | null {
  if (typeof search !== "string") return null;
  let s = search;
  if (s.startsWith("?")) s = s.slice(1);
  const params = new URLSearchParams(s);
  const v = params.get("repo");
  if (!v) return null;
  const t = v.trim();
  const parts = t.split("/");
  if (parts.length !== 2) return null;
  const [owner, repo] = parts;
  if (!isValidRepo(owner, repo)) return null;
  return `${owner}/${repo}`;
}

export function markLabel(mark: string, reason: string | undefined): string {
  if (mark === "done") return "done";
  if (mark === "to do" || mark === "next") return "to do";
  if (mark === "not now") {
    if (reason) return `skipped on purpose: ${reason}`;
    return "skipped on purpose";
  }
  if (mark === "can't check") return "can't tell from the web";
  return "unknown";
}

import type { CheckResult, ViewModel, Rerun } from "./types.ts";

export function viewModel(result: CheckResult): ViewModel {
  const summary = (result.summary ?? {}) as NonNullable<CheckResult["summary"]>;
  const done = summary.done ?? 0;
  const total = summary.total ?? 0;
  const nextRaw = summary.next ?? null;
  const steps = summary.steps ?? [];
  const installOnlyRaw = summary.install_only ?? summary.installOnly ?? [];

  const scoreText = `${done} of ${total} file checks are done`;
  let headline = `done ${done} of ${total} file checks`;
  let next: ViewModel["next"] = null;
  if (nextRaw) {
    headline += ` \u00b7 next: ${nextRaw.title}`;
    next = {
      title: nextRaw.title,
      id: nextRaw.id,
      what: nextRaw.what,
      why: nextRaw.why,
      fix: nextRaw.fix,
      how: nextRaw.how,
      docs: nextRaw.docs,
    };
  }

  const installOnlyIds = new Set(installOnlyRaw.map((s) => s.id));
  const nextId = next ? next.id : null;

  const others: ViewModel["others"] = [];
  for (const s of steps) {
    if (nextId && s.id === nextId) continue;
    if (installOnlyIds.has(s.id)) continue;
    const label = markLabel(s.mark, s.reason);
    others.push({
      id: s.id,
      title: s.title,
      mark: s.mark,
      how: s.how,
      why: s.why,
      what: s.what,
      fix: s.fix,
      docs: s.docs,
      reason: s.reason,
      label,
    });
  }

  const installOnly = installOnlyRaw.map((s) => ({
    id: s.id,
    title: s.title,
    mark: s.mark,
    how: s.how,
    why: s.why,
    what: s.what,
    fix: s.fix,
    docs: s.docs,
    reason: s.reason,
  }));

  const rawSecrets = result.secrets ?? [];
  const secretCount = rawSecrets.length;
  const groupsMap = new Map<string, { what?: string; why?: string; fix?: string; places: string[] }>();
  for (const s of rawSecrets) {
    const id = s.id;
    const filePart = s.file ?? "";
    const linePart = s.line != null && s.line !== "" ? String(s.line) : "";
    let place = "";
    if (filePart && linePart) place = `${filePart}:${linePart}`;
    else if (filePart) place = filePart;
    else if (linePart) place = `:${linePart}`;
    else place = "";
    if (!groupsMap.has(id)) {
      groupsMap.set(id, {
        what: s.what,
        why: s.why,
        fix: s.fix,
        places: [place],
      });
    } else {
      const g = groupsMap.get(id);
      if (g) g.places.push(place);
    }
  }
  const secretGroups = Array.from(groupsMap.values());

  const version = (result.yokoten_version as string | undefined) ?? (result.version as string | undefined) ?? "";
  const commit = (result.commit as string | undefined) ?? "";
  const shortCommit = commit ? commit.slice(0, 7) : "";
  const rerun = (result.rerun as Rerun | undefined) ?? {};
  const doctorCommand = rerun.doctor ?? "";
  const checkCommand = rerun.check ?? "";

  return {
    headline,
    score: { done, total, text: scoreText },
    next,
    others,
    installOnly,
    secretGroups,
    secretCount,
    evidence: { version, commit, shortCommit, doctorCommand, checkCommand },
  };
}
