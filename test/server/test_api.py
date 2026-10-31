import json

from fastapi.testclient import TestClient
from app import create_api, GENERIC_ERROR, BAD_URL_MSG
from github_check import RepoRefused
from repo_url import BadRepoUrl


def parse_sse(text):
    events = []
    # split on double newline
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


def test_event_order_good_run():
    def fake_public(owner, repo):
        pass

    def fake_run(owner, repo, on_progress=None):
        if on_progress:
            on_progress("copying")
            on_progress("checking")
        return {
            "owner": owner,
            "repo": repo,
            "commit": "abc123def4567890",
            "yokoten_version": "1.0.0",
            "about": "about text",
            "rerun": {"doctor": "yokoten doctor", "check": "yokoten check"},
            "doctor": {"done": 2, "total": 5, "next": {"id": "a", "title": "t"}, "steps": [], "install_only": []},
            "check": {"findings": []},
        }

    api = create_api(run=fake_run, public=fake_public)
    client = TestClient(api)
    resp = client.post("/api/check", json={"url": "https://github.com/owner/repo"})
    assert resp.status_code == 200
    events = parse_sse(resp.text)
    # progress reading, copying, checking, then result
    assert events[0] == ("progress", {"step": "reading"})
    assert events[1] == ("progress", {"step": "copying"})
    assert events[2] == ("progress", {"step": "checking"})
    assert events[3][0] == "result"
    assert len(events) == 4


def test_bad_url_gives_one_error_after_progress():
    def fake_public(owner, repo):
        raise BadRepoUrl(BAD_URL_MSG)

    def fake_run(owner, repo, on_progress=None):
        raise AssertionError("should not be called")

    api = create_api(run=fake_run, public=fake_public)
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

    api = create_api(run=fake_run, public=fake_public)
    client = TestClient(api)
    resp = client.post("/api/check", json={"url": "https://github.com/owner/repo"})
    events = parse_sse(resp.text)
    # first is progress reading
    assert events[0][0] == "progress"
    # last is error with generic message, not leaked text
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

    api = create_api(run=fake_run, public=fake_public)
    client = TestClient(api)
    resp = client.post("/api/check", json={"url": "https://github.com/owner/repo"})
    events = parse_sse(resp.text)
    result_events = [e for e in events if e[0] == "result"]
    assert len(result_events) == 1
    payload = result_events[0][1]
    secrets = payload["secrets"]
    assert len(secrets) == 1
    assert secrets[0]["id"] == "secret"
    # no layout
    assert all(s["id"] != "layout" for s in secrets)
    # no extra fields
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
    api = create_api(run=fake_run, public=fake_public)
    client = TestClient(api)
    resp = client.post("/api/check", json={"url": long_url})
    events = parse_sse(resp.text)
    # should be single error with BAD_URL_MSG, not echo the long url
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

    api = create_api(run=fake_run, public=fake_public)
    client = TestClient(api)
    resp = client.post("/api/check", json={"url": "https://github.com/owner/private"})
    events = parse_sse(resp.text)
    assert events[0] == ("progress", {"step": "reading"})
    assert len(events) == 2
    assert events[1][0] == "error"
    assert events[1][1]["message"] == msg
