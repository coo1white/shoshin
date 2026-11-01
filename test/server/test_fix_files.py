import pytest
from fixes.select_files import (
    is_fix_path,
    select_fix_paths,
    is_private_path,
    fill_owner,
    merge_this_project,
    choose_muse_paths,
    cap_files,
)

ALLOWED = [
    "AGENTS.md",
    "CHANGELOG.md",
    ".github/CODEOWNERS",
    ".github/dependabot.yml",
    ".github/pull_request_template.md",
    ".github/SECURITY.md",
]

# is_fix_path
def test_is_fix_path_allowed():
    for p in ALLOWED:
        assert is_fix_path(p) is True
    assert is_fix_path(".github/ISSUE_TEMPLATE/task.yml") is True

def test_is_fix_path_false_cases():
    assert is_fix_path(".github/ISSUE_TEMPLATE/a/b.yml") is False
    assert is_fix_path(".yokoten/x") is False
    assert is_fix_path(".githooks/pre-commit") is False
    assert is_fix_path(".github/workflows/pr.yml") is False
    assert is_fix_path("../AGENTS.md") is False
    assert is_fix_path("yokoten.json") is False

# select_fix_paths
def test_select_fix_paths_order_kept():
    new_paths = [".github/SECURITY.md", "AGENTS.md", "CHANGELOG.md"]
    out = select_fix_paths(new_paths, [])
    assert out == [".github/SECURITY.md", "AGENTS.md", "CHANGELOG.md"]

def test_select_fix_paths_drop_security_case_difference():
    # Docs/Security.md should drop .github/SECURITY.md
    new_paths = [".github/SECURITY.md", "AGENTS.md"]
    tracked = ["Docs/Security.md"]
    out = select_fix_paths(new_paths, tracked)
    assert ".github/SECURITY.md" not in out
    assert "AGENTS.md" in out

def test_select_fix_paths_drop_security_variants():
    for tracked in [["security.md"], ["docs/security.md"], [".github/security.md"]]:
        out = select_fix_paths([".github/SECURITY.md"], tracked)
        assert out == []

def test_select_fix_paths_drop_codeowners():
    for tracked in [["codeowners"], ["docs/codeowners"], ["CODEOWNERS"], ["Docs/Codeowners"]]:
        out = select_fix_paths([".github/CODEOWNERS"], tracked)
        assert out == [], f"tracked={tracked}"

def test_select_fix_paths_drop_dependabot():
    out = select_fix_paths([".github/dependabot.yml"], [".github/dependabot.yaml"])
    assert out == []
    # .yml itself should not drop
    out2 = select_fix_paths([".github/dependabot.yml"], [".github/dependabot.yml"])
    # code checks only .yaml variant, so this should remain
    assert out2 == [".github/dependabot.yml"]

def test_select_fix_paths_drop_pull_request_template():
    # direct files
    for t in ["pull_request_template.md", "docs/pull_request_template.md", ".github/pull_request_template.md"]:
        out = select_fix_paths([".github/pull_request_template.md"], [t])
        assert out == [], t
    # directory variant in subfolder
    out = select_fix_paths([".github/pull_request_template.md"], [".github/PULL_REQUEST_TEMPLATE/a.md"])
    assert out == []
    for prefix in ["pull_request_template/", "docs/pull_request_template/", ".github/pull_request_template/"]:
        out = select_fix_paths([".github/pull_request_template.md"], [prefix + "a.md"])
        assert out == []

def test_select_fix_paths_drop_changelog_variants():
    # CHANGES.md and NEWS drop CHANGELOG.md
    out = select_fix_paths(["CHANGELOG.md"], ["CHANGES.md"])
    assert out == []
    out = select_fix_paths(["CHANGELOG.md"], ["NEWS"])
    assert out == []
    # case differences also
    out = select_fix_paths(["CHANGELOG.md"], ["changes.md"])
    assert out == []
    out = select_fix_paths(["CHANGELOG.md"], ["History"])
    assert out == []

def test_select_fix_paths_docs_changes_does_not_drop():
    out = select_fix_paths(["CHANGELOG.md"], ["docs/CHANGES.md"])
    assert out == ["CHANGELOG.md"]

# is_private_path
def test_is_private_path_true_cases():
    assert is_private_path(".env") is True
    assert is_private_path(".env.local") is True
    assert is_private_path("a/server.pem") is True
    assert is_private_path("a.key") is True
    assert is_private_path("id_rsa") is True
    assert is_private_path("my-keypair-1.json") is True
    # also nested
    assert is_private_path("x/.env") is True
    assert is_private_path("foo/my-keypair-1.json") is True

def test_is_private_path_false_cases():
    assert is_private_path("README.md") is False
    assert is_private_path("keys.md") is False

# fill_owner
def test_fill_owner():
    assert fill_owner("hello @YOUR_GITHUB_HANDLE world", "octocat") == "hello @octocat world"
    assert fill_owner("no handle", "octocat") == "no handle"
    assert fill_owner("@YOUR_GITHUB_HANDLE and @YOUR_GITHUB_HANDLE", "a") == "@a and @a"

# merge_this_project
def test_merge_this_project_with_heading():
    agents = "# Core Rules\nDo stuff\n\n## This project\n\nold section\n"
    section = "### Build\nmake build"
    out = merge_this_project(agents, section)
    assert out.startswith("# Core Rules\nDo stuff\n\n## This project")
    assert "old section" not in out
    assert section in out
    # core rules unchanged
    assert out.split("## This project")[0] == "# Core Rules\nDo stuff\n\n"

def test_merge_this_project_with_text_after_heading_removed():
    agents = "intro\n## This project\nold\nmore old\nnext heading? not relevant"
    sec = "new content"
    out = merge_this_project(agents, sec)
    assert out == "intro\n## This project\n\nnew content\n"
    assert "old" not in out

def test_merge_this_project_without_heading():
    agents = "# Core Rules\nline1"
    sec = "### Test\ntodo"
    out = merge_this_project(agents, sec)
    assert out == "# Core Rules\nline1\n\n## This project\n\n### Test\ntodo\n"

def test_merge_this_project_without_heading_empty():
    out = merge_this_project("", "sec")
    assert out == "## This project\n\nsec\n"

def test_merge_this_project_core_rules_unchanged():
    core = "# Rules\n- be nice"
    agents = core + "\n\n## This project\nold"
    out = merge_this_project(agents, "new")
    assert out.startswith(core + "\n\n## This project")

# choose_muse_paths
def test_choose_muse_paths_order():
    tracked = ["README.md", "AGENTS.md", "CLAUDE.md", "package.json", ".github/workflows/ci.yml", ".github/CODEOWNERS", "CHANGELOG.md"]
    out = choose_muse_paths(tracked, [])
    # readme first, then AGENTS.md, CLAUDE.md, package.json, workflow, codeowners, changelog
    assert out[0] == "README.md"
    # check relative order of the known sequence
    assert out.index("AGENTS.md") < out.index("CLAUDE.md") < out.index("package.json")
    assert out.index("package.json") < out.index(".github/workflows/ci.yml")
    assert out.index(".github/workflows/ci.yml") < out.index(".github/CODEOWNERS")
    assert out.index(".github/CODEOWNERS") < out.index("CHANGELOG.md")

def test_choose_muse_paths_lowercase_readme():
    tracked = ["readme.md", "AGENTS.md"]
    out = choose_muse_paths(tracked, [])
    assert out[0] == "readme.md"

def test_choose_muse_paths_only_tracked():
    tracked = ["AGENTS.md"]
    out = choose_muse_paths(tracked, [])
    # package.json not tracked, should not appear
    assert "package.json" not in out
    assert out == ["AGENTS.md"]

def test_choose_muse_paths_private_left_out():
    tracked = ["AGENTS.md", ".env", "a/server.pem"]
    out = choose_muse_paths(tracked, [])
    assert ".env" not in out
    assert "a/server.pem" not in out

def test_choose_muse_paths_finding_file_left_out():
    tracked = ["AGENTS.md", "package.json", "README.md"]
    findings = [{"id": "secret", "file": "package.json"}]
    out = choose_muse_paths(tracked, findings)
    assert "package.json" not in out
    assert "AGENTS.md" in out

def test_choose_muse_paths_layout_finding_leaves_it_in():
    tracked = ["AGENTS.md", "package.json"]
    findings = [{"id": "layout", "file": "package.json"}]
    out = choose_muse_paths(tracked, findings)
    assert "package.json" in out

def test_choose_muse_paths_workflow_subfolder_left_out():
    tracked = ["AGENTS.md", ".github/workflows/sub/a.yml", ".github/workflows/ci.yml"]
    out = choose_muse_paths(tracked, [])
    assert ".github/workflows/sub/a.yml" not in out
    assert ".github/workflows/ci.yml" in out

# cap_files
def test_cap_files_under_limit():
    files = {"a": "hello", "b": "world"}
    out = cap_files(files, 100)
    assert out == files

def test_cap_files_cut_in_last_file():
    files = {"a": "hello", "b": "world!!!!"}
    # hello is 5 bytes, limit 8 => b gets 3 bytes "wor"
    out = cap_files(files, 8)
    assert out["a"] == "hello"
    assert out["b"] == "wor"

def test_cap_files_files_after_limit_left_out():
    files = {"a": "hello", "b": "world", "c": "!!!"}
    out = cap_files(files, 5)
    assert "a" in out
    assert "b" not in out
    assert "c" not in out

def test_cap_files_cut_inside_multibyte_does_not_raise():
    files = {"a": "ééé"}  # each é is 2 bytes in utf-8 => 6 bytes total
    # limit 3 cuts inside second character's bytes
    out = cap_files(files, 3)
    # should not raise, decode with ignore => should return "é" (2 bytes) or maybe "é" + partial ignored
    assert "a" in out
    # ensure no exception and result is valid string
    assert isinstance(out["a"], str)
    # Cutting 3 bytes from "\xc3\xa9\xc3\xa9\xc3\xa9" -> first 2 bytes is "é", third byte is incomplete and ignored
    assert out["a"] == "é"

import io
import json as _json
from check.sandbox_run import _score_after_fixes

class _FakeProc:
    def __init__(self, stdout, stderr, rc):
        self.stdout = io.BytesIO(stdout.encode("utf-8") if isinstance(stdout, str) else stdout)
        self.stderr = io.BytesIO(stderr.encode("utf-8") if isinstance(stderr, str) else stderr)
        self.returncode = rc
    def wait(self):
        return self.returncode

class _FakeSb:
    def __init__(self, outs):
        self.calls = []
        self._outs = list(outs)
        self._idx = 0
    def exec(self, *args, **kwargs):
        self.calls.append(args)
        if self._idx < len(self._outs):
            out = self._outs[self._idx]
        else:
            out = ("", "", 0)
        self._idx += 1
        stdout, stderr, rc = out
        return _FakeProc(stdout, stderr, rc)

def test_score_after_fixes_clean_has_x_and_anchored_e():
    selected = ["AGENTS.md", ".github/CODEOWNERS"]
    doctor_json = _json.dumps({"steps": [{"id": "a", "source": "files", "mark": "done"}, {"id": "b", "source": "files", "mark": "to do"}], "findings": [], "next": {}})
    sb = _FakeSb([("", "", 0), ("", "", 0), (doctor_json, "", 0)])
    out = _score_after_fixes(sb, selected, [])
    assert out == {"done": 1, "total": 2}
    clean_call = None
    for c in sb.calls:
        if "clean" in c:
            clean_call = c
            break
    assert clean_call is not None
    combined = " ".join(clean_call)
    assert "-fdqx" in combined or "-x" in combined
    for p in selected:
        assert "-e" in clean_call
        assert f"/{p}" in clean_call

def test_score_after_fixes_good_run_returns_score():
    selected = ["AGENTS.md"]
    doctor_json = _json.dumps({"steps": [{"id": "a", "source": "files", "mark": "done"}], "findings": [], "next": {}})
    sb = _FakeSb([("", "", 0), ("", "", 0), (doctor_json, "", 0)])
    out = _score_after_fixes(sb, selected, [])
    assert out == {"done": 1, "total": 1}

def test_score_after_fixes_bad_json_returns_none():
    selected = ["AGENTS.md"]
    sb = _FakeSb([("", "", 0), ("", "", 0), ("not json", "", 0)])
    out = _score_after_fixes(sb, selected, [])
    assert out is None

def test_score_after_fixes_bad_exit_code_returns_none():
    selected = ["AGENTS.md"]
    sb = _FakeSb([("", "", 0), ("", "", 0), ("{}", "", 2)])
    out = _score_after_fixes(sb, selected, [])
    assert out is None

def test_score_after_fixes_exception_returns_none():
    class BadSb:
        def exec(self, *a, **kw):
            raise RuntimeError("boom")
    out = _score_after_fixes(BadSb(), ["AGENTS.md"], [])
    assert out is None

def test_score_after_fixes_empty_selected_runs_nothing():
    class NoCallSb:
        def __init__(self):
            self.calls = []
        def exec(self, *a, **kw):
            self.calls.append(a)
            raise AssertionError("should not be called")
    sb = NoCallSb()
    out = _score_after_fixes(sb, [], [])
    assert out is None
    assert sb.calls == []

def test_score_after_fixes_checkout_failed_returns_none():
    selected = ["AGENTS.md"]
    sb = _FakeSb([("", "", 1)])
    out = _score_after_fixes(sb, selected, [])
    assert out is None
    assert not any("doctor" in c for c in sb.calls)

def test_score_after_fixes_clean_failed_returns_none():
    selected = ["AGENTS.md"]
    sb = _FakeSb([("", "", 0), ("", "", 1)])
    out = _score_after_fixes(sb, selected, [])
    assert out is None
    assert not any("doctor" in c for c in sb.calls)

def test_score_after_fixes_codeowners_write_failed_returns_none():
    selected = ["AGENTS.md"]
    fix_files = [{"path": ".github/CODEOWNERS", "content": "* @octocat"}]
    sb = _FakeSb([("", "", 0), ("", "", 0), ("", "", 1)])
    out = _score_after_fixes(sb, selected, fix_files)
    assert out is None
    assert not any("doctor" in c for c in sb.calls)
