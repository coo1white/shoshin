// @ts-check

/** @type {Record<string,string>} */
export const PROGRESS = {
  reading: "Reading the repo's details…",
  copying: "Copying the public files into a throwaway sandbox…",
  checking: "yokoten is checking, with the network off…",
};

/**
 * @param {string} mark
 * @param {string|undefined} reason
 * @returns {string}
 */
export function markLabel(mark, reason) {
  if (mark === "done") return "done";
  if (mark === "to do" || mark === "next") return "to do";
  if (mark === "not now") {
    if (reason) return `skipped on purpose: ${reason}`;
    return "skipped on purpose";
  }
  if (mark === "can't check") return "can't tell from the web";
  return "unknown";
}

/**
 * @param {any} result
 * @returns {{headline:string, next:any, others:any[], installOnly:any[], secretGroups:any[], secretCount:number, evidence:any}}
 */
export function viewModel(result) {
  const summary = result.summary || {};
  const done = summary.done ?? 0;
  const total = summary.total ?? 0;
  const nextRaw = summary.next || null;
  const steps = summary.steps || [];
  const installOnlyRaw = summary.install_only || summary.installOnly || [];

  let headline = `done ${done} of ${total} file checks`;
  let next = null;
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
  // Also consider next id to exclude
  const nextId = next ? next.id : null;

  const others = [];
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

  const rawSecrets = result.secrets || [];
  const secretCount = rawSecrets.length;
  const groupsMap = new Map();
  for (const s of rawSecrets) {
    const id = s.id;
    const place = s.file ? (s.line != null && s.line !== "" ? `${s.file}:${s.line}` : s.file) : (s.line != null && s.line !== "" ? `:${s.line}` : "");
    // alternative: if no file, still handle
    // spec: file:line strings, file alone when there is no line
    if (!groupsMap.has(id)) {
      groupsMap.set(id, {
        what: s.what,
        why: s.why,
        fix: s.fix,
        places: [place],
      });
    } else {
      groupsMap.get(id).places.push(place);
    }
  }
  const secretGroups = Array.from(groupsMap.values());

  const version = result.yokoten_version || result.version || "";
  const commit = result.commit || "";
  const shortCommit = commit ? commit.slice(0, 7) : "";
  const rerun = result.rerun || {};
  const doctorCommand = rerun.doctor || "";
  const checkCommand = rerun.check || "";

  return {
    headline,
    next,
    others,
    installOnly,
    secretGroups,
    secretCount,
    evidence: {
      version,
      commit,
      shortCommit,
      doctorCommand,
      checkCommand,
    },
  };
}
