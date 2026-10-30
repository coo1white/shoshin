import json
import sys

from repo_url import parse_repo_url
from github_check import check_public
from sandbox_run import run_in_sandbox
from result import summarize


def main():
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <url>", file=sys.stderr)
        sys.exit(2)
    url = sys.argv[1]
    owner, repo = parse_repo_url(url)
    check_public(owner, repo)
    result = run_in_sandbox(owner, repo)
    summary = summarize(result["doctor"])
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
