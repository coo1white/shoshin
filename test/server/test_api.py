import json
import hashlib
import time
from fastapi.testclient import TestClient
from app import create_api, GENERIC_ERROR, BAD_URL_MSG, NO_FIXES, RateLimiter
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
        "fix_files": [{"path": "AGENTS.md", "content": "x"}],
        "muse_facts": {"secret": 1},
        "too_big": True,
    }

# ---------------------------------------------------------------------------
# helpers for RateLimiter tests
# ---------------------------------------------------------------------------
class DictStore:
    def __init__(self):
        self.d = {}
    def get(self, key, default=0):
        return self.d.get(key, default)
    def put(self, key, value):
        self.d[key] = value

class FakeClock:
    def __init__(self, t):
        self.t = t
    def __call__(self):
        return self.t
    def advance(self, secs):
        self.t += secs

# ---------------------------------------------------------------------------
# existing behaviour tests (kept)
# ---------------------------------------------------------------------------
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

# ---------------------------------------------------------------------------
# default_branch now comes from run's branch (replaced old public-based tests)
# ---------------------------------------------------------------------------
def test_result_holds_default_branch_from_run():
    def fake_public(owner, repo):
        pass
    def fake_run(owner, repo, on_progress=None):
        r = _base_result(owner, repo)
        r["branch"] = "develop"
        return r
    api = create_api(run=fake_run, public=fake_public, make_fixes=lambda r: {"files": [], "summary": "", "muse": "ok"})
    client = TestClient(api)
    resp = client.post("/api/check", json={"url": "https://github.com/owner/repo"})
    events = parse_sse(resp.text)
    result = [e for e in events if e[0] == "result"][0][1]
    assert result["default_branch"] == "develop"

def test_result_default_branch_null_when_absent():
    def fake_public(owner, repo):
        pass
    def fake_run(owner, repo, on_progress=None):
        r = _base_result(owner, repo)
        # no branch key
        assert "branch" not in r
        return r
    api = create_api(run=fake_run, public=fake_public, make_fixes=lambda r: {"files": [], "summary": "", "muse": "ok"})
    client = TestClient(api)
    resp = client.post("/api/check", json={"url": "https://github.com/owner/repo"})
    events = parse_sse(resp.text)
    result = [e for e in events if e[0] == "result"][0][1]
    assert "default_branch" in result
    assert result["default_branch"] is None

def test_NO_FIXES_has_claude_import():
    assert "claude_import" in NO_FIXES
    assert NO_FIXES["claude_import"] is None

# ---------------------------------------------------------------------------
# RateLimiter with dict-backed fake store and fake clock
# ---------------------------------------------------------------------------
def test_rate_limiter_hourly_allow_10_then_ip():
    store = DictStore()
    clock = FakeClock(0)
    limiter = RateLimiter(store, now=clock)
    ip = "192.0.2.1"
    for i in range(10):
        assert limiter.allow(ip) == "ok", f"call {i+1} should be ok"
    assert limiter.allow(ip) == "ip"

def test_rate_limiter_another_ip_still_allowed():
    store = DictStore()
    clock = FakeClock(0)
    limiter = RateLimiter(store, now=clock)
    ip1 = "192.0.2.1"
    ip2 = "192.0.2.2"
    for _ in range(10):
        limiter.allow(ip1)
    assert limiter.allow(ip1) == "ip"
    # different IP should still be allowed (hourly per-IP)
    assert limiter.allow(ip2) == "ok"

def test_rate_limiter_new_hour_allows_first_ip_again():
    store = DictStore()
    clock = FakeClock(0)
    limiter = RateLimiter(store, now=clock)
    ip = "192.0.2.1"
    for _ in range(10):
        assert limiter.allow(ip) == "ok"
    assert limiter.allow(ip) == "ip"
    # advance to next hour
    clock.advance(3600)
    assert limiter.allow(ip) == "ok"

def test_rate_limiter_daily_301st_is_day():
    store = DictStore()
    clock = FakeClock(1000)  # same day, same hour bucket but daily counts across IPs
    limiter = RateLimiter(store, now=clock)
    # 300 calls from varying IPs should be ok, 301st is day
    for i in range(300):
        res = limiter.allow(f"192.0.2.{10 + i % 50}")
        # hourly limit is 10 per IP, so we must spread IPs to avoid hitting hourly before daily
        # use 50 distinct IPs cycling: each IP gets 6 calls (300/50=6) <10, so only daily matters
        assert res == "ok", f"daily call {i+1} should be ok got {res}"
    # 301st from any IP should be day
    assert limiter.allow("192.0.2.3") == "day"
    assert limiter.allow("192.0.2.1") == "day"

def test_rate_limiter_new_day_allows_again():
    store = DictStore()
    clock = FakeClock(0)
    limiter = RateLimiter(store, now=clock)
    for i in range(300):
        limiter.allow(f"192.0.2.{70 + i % 50}")
    assert limiter.allow("192.0.2.3") == "day"
    clock.advance(86400)
    assert limiter.allow("192.0.2.3") == "ok"

def test_rate_limiter_refused_call_counts_nothing():
    store = DictStore()
    clock = FakeClock(0)
    limiter = RateLimiter(store, now=clock)
    ip = "192.0.2.1"
    for _ in range(10):
        limiter.allow(ip)
    day_key = f"limit:day:{int(clock()/86400)}"
    hour_key_suffix = f":{int(clock()/3600)}"
    # capture counts before refused
    day_before = store.get(day_key, 0)
    # find hour key for ip
    ip_hash = hashlib.sha256(ip.encode("utf-8")).hexdigest()[:16]
    hour_key = f"limit:ip:{ip_hash}:{int(clock()/3600)}"
    hour_before = store.get(hour_key, 0)
    assert limiter.allow(ip) == "ip"
    assert store.get(day_key, 0) == day_before
    assert store.get(hour_key, 0) == hour_before
    # also daily refused should not increment
    # fill to daily limit
    store2 = DictStore()
    clock2 = FakeClock(0)
    limiter2 = RateLimiter(store2, now=clock2)
    for i in range(300):
        limiter2.allow(f"192.0.2.{130 + i % 50}")
    day_key2 = f"limit:day:{int(clock2()/86400)}"
    day_before2 = store2.get(day_key2, 0)
    assert limiter2.allow("192.0.2.3") == "day"
    assert store2.get(day_key2, 0) == day_before2

def test_rate_limiter_store_get_raises_gives_ok():
    class BadGetStore:
        def get(self, k, default=0):
            raise RuntimeError("get boom")
        def put(self, k, v):
            raise AssertionError("should not be called")
    limiter = RateLimiter(BadGetStore(), now=lambda: 0)
    assert limiter.allow("192.0.2.1") == "ok"

def test_rate_limiter_store_put_raises_gives_ok():
    class BadPutStore:
        def get(self, k, default=0):
            return 0
        def put(self, k, v):
            raise RuntimeError("put boom")
    limiter = RateLimiter(BadPutStore(), now=lambda: 0)
    assert limiter.allow("192.0.2.1") == "ok"

def test_rate_limiter_no_stored_key_or_value_holds_raw_ip():
    store = DictStore()
    clock = FakeClock(0)
    limiter = RateLimiter(store, now=clock)
    raw_ip = "192.0.2.4"
    limiter.allow(raw_ip)
    limiter.allow(raw_ip)
    for k, v in store.d.items():
        assert raw_ip not in k, f"raw IP found in key {k}"
        assert raw_ip not in str(v), f"raw IP found in value {v} for key {k}"
    # also check value types are ints
    for v in store.d.values():
        assert isinstance(v, int)

# ---------------------------------------------------------------------------
# API with limiter that refuses
# ---------------------------------------------------------------------------
def test_api_limiter_refuses_ip():
    public_calls = []
    run_calls = []
    def fake_public(o, r):
        public_calls.append((o, r))
    def fake_run(o, r, on_progress=None):
        run_calls.append((o, r))
        return _base_result(o, r)
    class RefuseIP:
        def allow(self, ip):
            return "ip"
    api = create_api(run=fake_run, public=fake_public, make_fixes=lambda r: {"files": [], "summary": "", "muse": "ok"}, limiter=RefuseIP())
    client = TestClient(api)
    resp = client.post("/api/check", json={"url": "https://github.com/owner/repo"})
    events = parse_sse(resp.text)
    assert events[0] == ("progress", {"step": "reading"})
    assert len(events) == 2
    assert events[1][0] == "error"
    assert events[1][1]["message"] == "You have run 10 checks this hour. Please try again later. You can also run it yourself: npx yokoten"
    assert public_calls == []
    assert run_calls == []

def test_api_limiter_refuses_day():
    public_calls = []
    run_calls = []
    def fake_public(o, r):
        public_calls.append(1)
    def fake_run(o, r, on_progress=None):
        run_calls.append(1)
        return _base_result(o, r)
    class RefuseDay:
        def allow(self, ip):
            return "day"
    api = create_api(run=fake_run, public=fake_public, make_fixes=lambda r: {"files": [], "summary": "", "muse": "ok"}, limiter=RefuseDay())
    client = TestClient(api)
    resp = client.post("/api/check", json={"url": "https://github.com/owner/repo"})
    events = parse_sse(resp.text)
    assert events[0] == ("progress", {"step": "reading"})
    assert len(events) == 2
    assert events[1][0] == "error"
    assert events[1][1]["message"] == "This page has reached its limit for today. Please try again tomorrow. You can also run it yourself: npx yokoten"
    assert public_calls == []
    assert run_calls == []

def test_api_bad_url_does_not_touch_limiter():
    touches = []
    class CountingLimiter:
        def allow(self, ip):
            touches.append(ip)
            return "ok"
    def fake_public(o, r):
        raise AssertionError("should not be called")
    def fake_run(o, r, on_progress=None):
        raise AssertionError("should not be called")
    api = create_api(run=fake_run, public=fake_public, make_fixes=lambda r: NO_FIXES, limiter=CountingLimiter())
    client = TestClient(api)
    long_url = "https://github.com/" + "a" * 290
    assert len(long_url) > 300
    resp = client.post("/api/check", json={"url": long_url})
    events = parse_sse(resp.text)
    assert events[0][0] == "error"
    assert touches == []
    # also invalid json / missing url
    touches.clear()
    resp2 = client.post("/api/check", content=b"not json", headers={"Content-Type": "application/json"})
    events2 = parse_sse(resp2.text)
    assert events2[0][0] == "error"
    assert touches == []

def test_api_spoofed_x_forwarded_for_does_not_change_address():
    seen = []
    class RecordingLimiter:
        def allow(self, ip):
            seen.append(ip)
            return "ok"
    def fake_public(o, r):
        pass
    def fake_run(o, r, on_progress=None):
        return _base_result(o, r)
    api = create_api(run=fake_run, public=fake_public, make_fixes=lambda r: {"files": [], "summary": "", "muse": "ok"}, limiter=RecordingLimiter())
    client = TestClient(api)
    resp = client.post("/api/check", json={"url": "https://github.com/owner/repo"}, headers={"X-Forwarded-For": "192.0.2.3"})
    events = parse_sse(resp.text)
    assert any(e[0]=="result" for e in events)
    assert len(seen) == 1
    assert seen[0] != "192.0.2.3"
    # the address passed is testclient host, typically testclient
    assert "192.0.2.3" not in seen[0]

# ---------------------------------------------------------------------------
# recorder tests (step 8)
# ---------------------------------------------------------------------------
def test_recorder_good_run_ends_result_fixes_record_and_gets_same_object():
    def fake_public(o, r):
        pass
    def fake_run(o, r, on_progress=None):
        return _base_result(o, r)
    seen = []
    def fake_recorder(payload):
        seen.append(payload)
        return {"sha256": "abc", "url": "https://search.sigstore.dev/?logIndex=1"}
    api = create_api(run=fake_run, public=fake_public, make_fixes=lambda r: {"files": [], "summary": "", "muse": "ok"}, write_public_record=fake_recorder)
    client = TestClient(api)
    resp = client.post("/api/check", json={"url": "https://github.com/owner/repo"})
    events = parse_sse(resp.text)
    assert [e[0] for e in events] == ["progress", "result", "fixes", "record"]
    # recorder gets same object sent in result
    result_payload = [e for e in events if e[0]=="result"][0][1]
    assert seen[0] == result_payload
    assert events[-1][0] == "record"
    assert events[-1][1]["sha256"] == "abc"

def test_recorder_returning_none_gives_no_record_event_and_ends_quickly():
    def fake_public(o, r):
        pass
    def fake_run(o, r, on_progress=None):
        return _base_result(o, r)
    def fake_recorder(payload):
        return None
    api = create_api(run=fake_run, public=fake_public, make_fixes=lambda r: {"files": [], "summary": "", "muse": "ok"}, write_public_record=fake_recorder)
    client = TestClient(api)
    start = time.time()
    resp = client.post("/api/check", json={"url": "https://github.com/owner/repo"})
    elapsed = time.time() - start
    events = parse_sse(resp.text)
    assert not any(e[0]=="record" for e in events)
    assert [e[0] for e in events] == ["progress", "result", "fixes"]
    assert elapsed < 5, f"took too long: {elapsed}"

def test_recorder_raising_gives_no_record_and_no_error():
    def fake_public(o, r):
        pass
    def fake_run(o, r, on_progress=None):
        return _base_result(o, r)
    def fake_recorder(payload):
        raise RuntimeError("recorder boom SECRET")
    api = create_api(run=fake_run, public=fake_public, make_fixes=lambda r: {"files": [], "summary": "", "muse": "ok"}, write_public_record=fake_recorder)
    client = TestClient(api)
    resp = client.post("/api/check", json={"url": "https://github.com/owner/repo"})
    events = parse_sse(resp.text)
    assert not any(e[0]=="record" for e in events)
    assert not any(e[0]=="error" for e in events)
    assert [e[0] for e in events] == ["progress", "result", "fixes"]

def test_no_recorder_means_stream_ends_at_fixes():
    def fake_public(o, r):
        pass
    def fake_run(o, r, on_progress=None):
        return _base_result(o, r)
    api = create_api(run=fake_run, public=fake_public, make_fixes=lambda r: {"files": [], "summary": "", "muse": "ok"}, write_public_record=None)
    client = TestClient(api)
    resp = client.post("/api/check", json={"url": "https://github.com/owner/repo"})
    events = parse_sse(resp.text)
    assert [e[0] for e in events] == ["progress", "result", "fixes"]
    assert not any(e[0]=="record" for e in events)

def test_run_failing_never_calls_recorder():
    def fake_public(o, r):
        pass
    called = []
    def fake_run(o, r, on_progress=None):
        raise RuntimeError("run fail")
    def fake_recorder(payload):
        called.append(1)
        return {"sha256": "x"}
    api = create_api(run=fake_run, public=fake_public, make_fixes=lambda r: {"files": [], "summary": "", "muse": "ok"}, write_public_record=fake_recorder)
    client = TestClient(api)
    resp = client.post("/api/check", json={"url": "https://github.com/owner/repo"})
    events = parse_sse(resp.text)
    assert called == []
    assert any(e[0]=="error" for e in events)
    assert not any(e[0]=="record" for e in events)
