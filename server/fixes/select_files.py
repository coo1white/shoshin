import fnmatch

ALLOWED_FIX = {
    "AGENTS.md",
    "CHANGELOG.md",
    ".github/CODEOWNERS",
    ".github/dependabot.yml",
    ".github/pull_request_template.md",
    ".github/SECURITY.md",
}


def is_fix_path(path: str) -> bool:
    if not isinstance(path, str) or not path:
        return False
    if ".." in path.split("/"):
        return False
    if path in ALLOWED_FIX:
        return True
    prefix = ".github/ISSUE_TEMPLATE/"
    if path.startswith(prefix):
        rest = path[len(prefix):]
        if not rest:
            return False
        if "/" in rest:
            return False
        return True
    return False


def is_private_path(path: str) -> bool:
    if not isinstance(path, str):
        return False
    name = path.rsplit("/", 1)[-1]
    if name.startswith(".env"):
        return True
    if fnmatch.fnmatch(name, "*.pem"):
        return True
    if fnmatch.fnmatch(name, "*.key"):
        return True
    if name.startswith("id_"):
        return True
    if fnmatch.fnmatch(name, "*keypair*.json"):
        return True
    return False


def fill_owner(content: str, owner: str) -> str:
    if not isinstance(content, str):
        return content
    return content.replace("@YOUR_GITHUB_HANDLE", f"@{owner}")


def merge_this_project(agents_md: str, section: str) -> str:
    if agents_md is None:
        agents_md = ""
    if section is None:
        section = ""
    lines = agents_md.splitlines()
    idx = None
    for i, line in enumerate(lines):
        if line == "## This project":
            idx = i
            break
    if idx is not None:
        prefix = "\n".join(lines[: idx + 1])
        return prefix + "\n\n" + section + "\n"
    else:
        if agents_md == "":
            return "## This project\n\n" + section + "\n"
        stripped = agents_md.rstrip("\n")
        return stripped + "\n\n## This project\n\n" + section + "\n"


def select_fix_paths(new_paths, tracked_paths) -> list:
    if new_paths is None:
        new_paths = []
    if tracked_paths is None:
        tracked_paths = []
    kept = [p for p in new_paths if is_fix_path(p)]
    tracked_lower = [t.lower() for t in tracked_paths if isinstance(t, str)]
    tracked_set = set(tracked_lower)
    changelog_drop = False
    allowed_roots = {"changes", "history", "changelog", "news"}
    for t in tracked_paths:
        if not isinstance(t, str):
            continue
        if "/" in t:
            continue
        name = t.rsplit("/", 1)[-1]
        if "." in name:
            base = name.rsplit(".", 1)[0]
        else:
            base = name
        if base.lower() in allowed_roots:
            changelog_drop = True
            break
    result = []
    for p in kept:
        drop = False
        low = p.lower()
        if p == ".github/SECURITY.md":
            if "security.md" in tracked_set or "docs/security.md" in tracked_set or ".github/security.md" in tracked_set:
                drop = True
        elif p == ".github/CODEOWNERS":
            if "codeowners" in tracked_set or "docs/codeowners" in tracked_set:
                drop = True
        elif p == ".github/dependabot.yml":
            if ".github/dependabot.yaml" in tracked_set:
                drop = True
        elif p == ".github/pull_request_template.md":
            if "pull_request_template.md" in tracked_set or "docs/pull_request_template.md" in tracked_set or ".github/pull_request_template.md" in tracked_set:
                drop = True
            else:
                for tl in tracked_lower:
                    if tl.startswith("pull_request_template/") or tl.startswith("docs/pull_request_template/") or tl.startswith(".github/pull_request_template/"):
                        drop = True
                        break
        elif p == "CHANGELOG.md":
            if changelog_drop:
                drop = True
        if not drop:
            result.append(p)
    return result


def choose_muse_paths(tracked, findings) -> list:
    if not tracked:
        return []
    if findings is None:
        findings = []
    tracked_set = set(tracked)
    # files named by findings, except layout
    finding_files = set()
    for f in findings:
        if not isinstance(f, dict):
            continue
        if f.get("id") == "layout":
            continue
        fp = f.get("file")
        if isinstance(fp, str) and fp:
            finding_files.add(fp)
    result = []
    def maybe_add(p):
        if p not in tracked_set:
            return
        if is_private_path(p):
            return
        if p in finding_files:
            return
        if p not in result:
            result.append(p)
    # first root file whose name starts with readme without case
    readme_first = None
    for t in tracked:
        if not isinstance(t, str):
            continue
        if "/" in t:
            continue
        name = t.rsplit("/", 1)[-1]
        if name.lower().startswith("readme"):
            readme_first = t
            break
    if readme_first:
        maybe_add(readme_first)
    for name in ["AGENTS.md", "CLAUDE.md", "package.json", "pyproject.toml", "Cargo.toml", "go.mod", "foundry.toml", "Anchor.toml", "Makefile"]:
        maybe_add(name)
    # .github/workflows/*.yml and *.yaml directly in that folder
    for t in tracked:
        if not isinstance(t, str):
            continue
        if not t.startswith(".github/workflows/"):
            continue
        rest = t[len(".github/workflows/"):]
        if "/" in rest:
            continue
        low = rest.lower()
        if low.endswith(".yml") or low.endswith(".yaml"):
            maybe_add(t)
    maybe_add(".github/CODEOWNERS")
    maybe_add("CHANGELOG.md")
    return result


def cap_files(read_files, total_limit) -> dict:
    if not read_files:
        return {}
    out = {}
    total = 0
    for k, v in read_files.items():
        if not isinstance(v, str):
            v = str(v) if v is not None else ""
        b = v.encode("utf-8")
        if total + len(b) <= total_limit:
            out[k] = v
            total += len(b)
        else:
            remaining = total_limit - total
            if remaining <= 0:
                break
            cut = b[:remaining].decode("utf-8", errors="ignore")
            out[k] = cut
            break
    return out
