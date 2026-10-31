import json
from fastapi.testclient import TestClient
from app import create_api, GENERIC_ERROR, BAD_URL_MSG, NO_FIXES
from github_check import RepoRefused
from repo_url import BadRepoUrl

def parse_sse(text):
    events = []
    raw_blocks = [b for b in text.split("\n\n") if b.strip()]
    for block in raw_blocks:
        name = None
        data = None
        for line in block.splitlines():
            if line.startswith("event:"):
                name = line[len("event:"):].strip()
            elif line.startswith("data:"):
                data = line[len("data:"):].strip()
        if name:
            try:
                j = json.loads(data) if data else {}
            except Exception:
                j = {}
            events.append((name, j))
    return events

def _base_result(owner="owner", repo="repo"):
    return {
        "owner": owner,
        "repo": repo,
        "commit": "abc123def4567890",
        "yokoten_version": "1.0.0",
        "about": "about text",
        "rerun": {"doctor": "yokoten doctor", "check": "yokoten check"},
        "doctor": {"done": 2, "total": 5, "next": {"id": "a", "title": "t"}, "steps": [], "install_only": []},
        "check": {"findings": []},
        # these should be stripped from result event
        "fix_files": [{"path": "AGENTS.md", "content": "x"}],
        "muse_facts": {"secret": 1},
        "too_big": True,
    }

def test_event_order_good_run():
    def fake_public(owner, repo):
        pass
    def fake_run(owner, repo, on_progress=None):
        if on_progress:
            on_progress("copying")
            on_progress("checking")
        return _base_result(owner, repo)
    def fake_make_fixes(res):
        return {"files": [], "summary": "", "muse": "ok"}
    api = create_api(run=fake_run, public=fake_public, make_fixes=fake_make_fixes)
    client = TestClient(api)
    resp = client.post("/api/check", json={"url": "https://github.com/owner/repo"})
    assert resp.status_code == 200
    events = parse_sse(resp.text)
    assert events[0] == ("progress", {"step": "reading"})
    assert events[1] == ("progress", {"step": "copying"})
    assert events[2] == ("progress", {"step": "checking"})
    assert events[3][0] == "result"
    assert events[4][0] == "fixes"
    assert len(events) == 5
    # result then fixes order
    assert events[3][0] == "result"
    assert events[4][0] == "fixes"

def test_bad_url_gives_one_error_after_progress():
    def fake_public(owner, repo):
        raise BadRepoUrl(BAD_URL_MSG)
    def fake_run(owner, repo, on_progress=None):
        raise AssertionError("should not be called")
    api = create_api(run=fake_run, public=fake_public, make_fixes=lambda r: NO_FIXES)
    client = TestClient(api)
    resp = client.post("/api/check", json={"url": "https://example.com/not-github"})
    events = parse_sse(resp.text)
    assert events[0] == ("progress", {"step": "reading"})
    assert len(events) == 2
    assert events[1][0] == "error"
    assert events[1][1]["message"] == BAD_URL_MSG

def test_unexpected_exception_gives_fixed_message():
    def fake_public(owner, repo):
        pass
    def fake_run(owner, repo, on_progress=None):
        raise RuntimeError("secret internal boom")
    api = create_api(run=fake_run, public=fake_public, make_fixes=lambda r: NO_FIXES)
    client = TestClient(api)
    resp = client.post("/api/check", json={"url": "https://github.com/owner/repo"})
    events = parse_sse(resp.text)
    assert events[0][0] == "progress"
    error_events = [e for e in events if e[0] == "error"]
    assert len(error_events) == 1
    assert error_events[0][1]["message"] == GENERIC_ERROR
    assert "secret internal boom" not in error_events[0][1]["message"]

def test_secrets_drops_layout_and_extra_fields():
    def fake_public(owner, repo):
        pass
    findings = [
        {"id": "layout", "what": "should be dropped", "file": "a", "line": 1, "grade": "high", "why": "w", "fix": "f", "extra": "drop me"},
        {"id": "secret", "what": "found", "file": "b", "line": 2, "grade": "high", "why": "w2", "fix": "f2", "extra": "drop me", "another": 123},
    ]
    def fake_run(owner, repo, on_progress=None):
        return {
            "owner": owner,
            "repo": repo,
            "commit": "abc",
            "yokoten_version": "1.0",
            "about": "",
            "rerun": {},
            "doctor": {},
            "check": {"findings": findings},
        }
    api = create_api(run=fake_run, public=fake_public, make_fixes=lambda r: {"files": [], "summary": "", "muse": "ok"})
    client = TestClient(api)
    resp = client.post("/api/check", json={"url": "https://github.com/owner/repo"})
    events = parse_sse(resp.text)
    result_events = [e for e in events if e[0] == "result"]
    assert len(result_events) == 1
    payload = result_events[0][1]
    secrets = payload["secrets"]
    assert len(secrets) == 1
    assert secrets[0]["id"] == "secret"
    assert all(s["id"] != "layout" for s in secrets)
    allowed = {"id", "what", "file", "line", "grade", "why", "fix"}
    for s in secrets:
        assert set(s.keys()) == allowed
        assert "extra" not in s
        assert "another" not in s

def test_url_over_300_chars_refused_and_not_echoed():
    def fake_public(owner, repo):
        raise AssertionError("should not be called")
    def fake_run(owner, repo, on_progress=None):
        raise AssertionError("should not be called")
    long_url = "https://github.com/" + "a" * 290
    assert len(long_url) > 300
    api = create_api(run=fake_run, public=fake_public, make_fixes=lambda r: NO_FIXES)
    client = TestClient(api)
    resp = client.post("/api/check", json={"url": long_url})
    events = parse_sse(resp.text)
    assert len(events) == 1
    assert events[0][0] == "error"
    assert events[0][1]["message"] == BAD_URL_MSG
    assert long_url not in resp.text
    assert long_url not in events[0][1]["message"]

def test_private_repo_RepoRefused_sends_own_message():
    msg = "This repo is private or not found."
    def fake_public(owner, repo):
        raise RepoRefused(msg)
    def fake_run(owner, repo, on_progress=None):
        raise AssertionError("should not be called")
    api = create_api(run=fake_run, public=fake_public, make_fixes=lambda r: NO_FIXES)
    client = TestClient(api)
    resp = client.post("/api/check", json={"url": "https://github.com/owner/private"})
    events = parse_sse(resp.text)
    assert events[0] == ("progress", {"step": "reading"})
    assert len(events) == 2
    assert events[1][0] == "error"
    assert events[1][1]["message"] == msg

def test_make_fixes_raising_gives_no_fixes_no_error():
    def fake_public(owner, repo):
        pass
    def fake_run(owner, repo, on_progress=None):
        return _base_result(owner, repo)
    def failing_make_fixes(res):
        raise RuntimeError("make_fixes boom")
    api = create_api(run=fake_run, public=fake_public, make_fixes=failing_make_fixes)
    client = TestClient(api)
    resp = client.post("/api/check", json={"url": "https://github.com/owner/repo"})
    events = parse_sse(resp.text)
    # should still have result then fixes with NO_FIXES, no error event
    assert any(e[0]=="result" for e in events)
    assert not any(e[0]=="error" for e in events)
    fixes_events = [e for e in events if e[0]=="fixes"]
    assert len(fixes_events)==1
    assert fixes_events[0][1]==NO_FIXES

def test_result_holds_no_fix_files_muse_facts_too_big():
    def fake_public(owner, repo):
        pass
    def fake_run(owner, repo, on_progress=None):
        return _base_result(owner, repo)
    api = create_api(run=fake_run, public=fake_public, make_fixes=lambda r: {"files": [], "summary": "", "muse": "ok"})
    client = TestClient(api)
    resp = client.post("/api/check", json={"url": "https://github.com/owner/repo"})
    events = parse_sse(resp.text)
    result = [e for e in events if e[0]=="result"][0][1]
    assert "fix_files" not in result
    assert "muse_facts" not in result
    assert "too_big" not in result

def test_fixes_event_carries_what_make_fixes_returned():
    def fake_public(owner, repo):
        pass
    def fake_run(owner, repo, on_progress=None):
        return _base_result(owner, repo)
    expected = {"files": [{"path": "AGENTS.md", "content": "hi", "source": "yokoten"}], "summary": "hi", "muse": "ok"}
    api = create_api(run=fake_run, public=fake_public, make_fixes=lambda r: expected)
    client = TestClient(api)
    resp = client.post("/api/check", json={"url": "https://github.com/owner/repo"})
    events = parse_sse(resp.text)
    fixes = [e for e in events if e[0]=="fixes"][0][1]
    assert fixes == expected

def test_make_fixes_not_called_when_run_fails():
    def fake_public(owner, repo):
        pass
    called=[]
    def fake_run(owner, repo, on_progress=None):
        raise RuntimeError("run fails")
    def fake_make_fixes(res):
        called.append(1)
        return {"files": [], "summary": "", "muse": "ok"}
    api = create_api(run=fake_run, public=fake_public, make_fixes=fake_make_fixes)
    client = TestClient(api)
    resp = client.post("/api/check", json={"url": "https://github.com/owner/repo"})
    events = parse_sse(resp.text)
    assert called == []
    assert any(e[0]=="error" for e in events)
    assert not any(e[0]=="fixes" for e in events)

def test_result_holds_default_branch_from_public():
    def fake_public(owner, repo):
        return {"default_branch": "develop", "other": "ignore"}
    def fake_run(owner, repo, on_progress=None):
        return _base_result(owner, repo)
    api = create_api(run=fake_run, public=fake_public, make_fixes=lambda r: {"files": [], "summary": "", "muse": "ok"})
    client = TestClient(api)
    resp = client.post("/api/check", json={"url": "https://github.com/owner/repo"})
    events = parse_sse(resp.text)
    result = [e for e in events if e[0] == "result"][0][1]
    assert result["default_branch"] == "develop"

def test_result_default_branch_null_when_public_returns_none():
    def fake_public(owner, repo):
        return None
    def fake_run(owner, repo, on_progress=None):
        return _base_result(owner, repo)
    api = create_api(run=fake_run, public=fake_public, make_fixes=lambda r: {"files": [], "summary": "", "muse": "ok"})
    client = TestClient(api)
    resp = client.post("/api/check", json={"url": "https://github.com/owner/repo"})
    events = parse_sse(resp.text)
    result = [e for e in events if e[0] == "result"][0][1]
    assert "default_branch" in result
    assert result["default_branch"] is None
