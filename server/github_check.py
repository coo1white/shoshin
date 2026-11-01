import json
import urllib.request
import urllib.error


class RepoRefused(Exception):
    pass


def check_public(owner: str, repo: str) -> dict:
    url = f"https://api.github.com/repos/{owner}/{repo}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "yokoten-check",
            "Accept": "application/vnd.github+json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise RepoRefused("That repo was not found or is private.") from e
        if e.code == 403 or e.code == 429:
            return {"default_branch": None, "size_kb": None}
        raise RepoRefused("GitHub could not be reached. Please try again.") from e
    except urllib.error.URLError as e:
        raise RepoRefused("GitHub could not be reached. Please try again.") from e
    except Exception as e:
        # Any other error is treated as unreachable
        if isinstance(e, RepoRefused):
            raise
        raise RepoRefused("GitHub could not be reached. Please try again.") from e

    if data.get("private") is True:
        raise RepoRefused("That repo is private.")

    size = data.get("size")
    if not isinstance(size, int):
        raise RepoRefused("GitHub did not say how big this repo is. Please try again.")
    # size is KB, and it counts the full history. The sandbox clones one commit, under a time limit.
    if size > 15728640:
        raise RepoRefused("This repo is over 15 GB, too big to check here.")

    return {
        "default_branch": data.get("default_branch"),
        "size_kb": size,
    }
