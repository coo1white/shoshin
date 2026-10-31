// @ts-check

/** GitHub accepted a 6,000-character link and failed from 7,000, measured 2026-10-31. */
export const MAX_GITHUB_LINK = 6000;

/**
 * @param {string} path
 * @returns {boolean}
 */
export function isSafePath(path) {
  if (typeof path !== "string") return false;
  if (path.length === 0) return false;
  if (path.includes("\\")) return false;
  for (let i = 0; i < path.length; i++) {
    const c = path.charCodeAt(i);
    if (c <= 0x1f || c === 0x7f) return false;
  }
  const parts = path.split("/");
  for (const p of parts) {
    if (p === "" || p === "." || p === "..") return false;
  }
  return true;
}

/**
 * @param {string} owner
 * @param {string} repo
 * @param {string|null} branch
 * @param {string} path
 * @param {string|null} content
 * @returns {string}
 */
export function newFileLink(owner, repo, branch, path, content) {
  const b = branch == null ? "main" : branch;
  const encodedBranch = b.split("/").map(encodeURIComponent).join("/");
  let href =
    "https://github.com/" +
    encodeURIComponent(owner) +
    "/" +
    encodeURIComponent(repo) +
    "/new/" +
    encodedBranch +
    "?filename=" +
    encodeURIComponent(path);
  if (content != null) {
    href += "&value=" + encodeURIComponent(content);
  }
  return href;
}

/**
 * @param {string} owner
 * @param {string} repo
 * @param {string|null} branch
 * @param {{path:string, content:string}} file
 * @returns {{kind:string, href:string}}
 */
export function fileLinkPlan(owner, repo, branch, file) {
  const filled = newFileLink(owner, repo, branch, file.path, file.content);
  if (filled.length <= MAX_GITHUB_LINK) {
    return { kind: "filled", href: filled };
  }
  const href = newFileLink(owner, repo, branch, file.path, null);
  return { kind: "copy first", href };
}

/**
 * @param {{path:string, content:string}[]} files
 * @returns {string}
 */
export function buildPatch(files) {
  const safe = files.filter((f) => isSafePath(f.path));
  if (safe.length === 0) return "";
  let out = "";
  for (let i = 0; i < safe.length; i++) {
    const f = safe[i];
    const path = f.path;
    const content = f.content;
    out += `diff --git a/${path} b/${path}\n`;
    out += `new file mode 100644\n`;
    out += `--- /dev/null\n`;
    out += `+++ b/${path}\n`;
    if (content === "") {
      // only first four lines, no hunk
    } else {
      const endsWithNewline = content.endsWith("\n");
      let lines = content.split("\n");
      if (endsWithNewline) {
        lines.pop();
      }
      out += `@@ -0,0 +1,${lines.length} @@\n`;
      for (const line of lines) {
        out += `+${line}\n`;
      }
      if (!endsWithNewline) {
        out += "\\ No newline at end of file\n";
      }
    }
  }
  return out;
}

/**
 * @param {{path:string, content:string}[]} files
 * @returns {{first: {path:string,content:string,source?:string}|null, rest: {path:string,content:string,source?:string}[]}}
 */
export function orderFiles(files) {
  const safe = files.filter((f) => isSafePath(f.path));
  if (safe.length === 0) return { first: null, rest: [] };
  let firstIdx = safe.findIndex((f) => f.path === "AGENTS.md");
  if (firstIdx === -1) firstIdx = 0;
  const first = safe[firstIdx];
  const rest = safe.filter((_, idx) => idx !== firstIdx);
  return { first, rest };
}

/**
 * @param {{files:{path:string}[], muse:string}} fixes
 * @returns {string}
 */
export function fixMessage(fixes) {
  if (fixes.muse === "failed") {
    return "Muse could not write the project section this time. Please fill in the section called This project yourself.";
  }
  if (!fixes.files || fixes.files.length === 0) {
    return "yokoten has no files to add to this repo.";
  }
  return "";
}

export const PATCH_COMMANDS = [
  "git switch -c yokoten-doctor-fixes",
  "git apply --index yokoten-doctor.patch",
  'git commit -m "docs: add agent rules from yokoten doctor"',
  "git push -u origin yokoten-doctor-fixes",
  "gh pr create --fill",
].join("\n");
