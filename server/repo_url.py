import re
from urllib.parse import urlparse


class BadRepoUrl(ValueError):
    pass


_OWNER_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$")
_REPO_RE = re.compile(r"^[A-Za-z0-9._-]{1,100}$")

_MSG = "That doesn't look like a public GitHub repo. Try https://github.com/owner/repo."


def parse_repo_url(text: str) -> tuple[str, str]:
    s = text.strip() if isinstance(text, str) else ""
    if not s:
        raise BadRepoUrl(_MSG)

    # reject spaces inside (e.g. "o r/x")
    if " " in s or "\t" in s or "\n" in s:
        raise BadRepoUrl(_MSG)

    path: str | None = None

    if "://" in s:
        try:
            u = urlparse(s)
        except Exception:
            raise BadRepoUrl(_MSG)
        if u.scheme not in ("http", "https"):
            raise BadRepoUrl(_MSG)
        host = (u.hostname or "").lower()
        if host != "github.com":
            raise BadRepoUrl(_MSG)
        path = u.path or ""
        # reject query/fragments that might hide extra data? allow but ignore
        # path already stripped of query/fragment by urlparse
    elif s.lower().startswith("github.com/"):
        # no scheme form
        path = "/" + s[len("github.com/"):]
        # if it contained spaces it was already rejected
        # ensure no host trick with userinfo
        if "@" in path or "://" in path:
            raise BadRepoUrl(_MSG)
    else:
        # owner/repo form
        # must not look like a URL with host
        if "/" not in s:
            raise BadRepoUrl(_MSG)
        path = "/" + s

    # Normalise path: remove trailing/leading slashes, then split
    p = path.strip("/")
    if not p:
        raise BadRepoUrl(_MSG)

    # Remove any query/fragment remnants if present from the no-scheme branch
    # (urlparse not used there)
    for sep in ("?", "#"):
        if sep in p:
            p = p.split(sep, 1)[0]

    parts = p.split("/")

    # Handle /tree/<branch> suffix: accept owner/repo/tree/... 
    if len(parts) >= 3 and parts[2] == "tree":
        if len(parts) < 4 or not parts[3]:
            raise BadRepoUrl(_MSG)
        owner_raw = parts[0]
        repo_raw = parts[1]
    else:
        if len(parts) != 2:
            raise BadRepoUrl(_MSG)
        owner_raw = parts[0]
        repo_raw = parts[1]

    # Strip .git suffix from repo if present
    if repo_raw.lower().endswith(".git") and len(repo_raw) > 4:
        repo_candidate = repo_raw[:-4]
        # ensure not empty after stripping and no extra dot handling needed
        # keep candidate even if it was exactly ".git" -> will fail validation
        # but we only strip when length >4 so ".git" stays to be rejected
        repo_raw = repo_candidate
    elif repo_raw.lower() == ".git":
        raise BadRepoUrl(_MSG)

    owner = owner_raw
    repo = repo_raw

    if not _OWNER_RE.match(owner):
        raise BadRepoUrl(_MSG)
    if not _REPO_RE.match(repo) or repo in (".", ".."):
        raise BadRepoUrl(_MSG)

    return owner, repo
