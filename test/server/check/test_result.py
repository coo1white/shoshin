import json
import pathlib
import pytest
from check.result import summarize

FIXTURE = pathlib.Path("test/fixtures/doctor-files-0.2.0.json")

def load_fixture():
    if FIXTURE.exists():
        return json.loads(FIXTURE.read_text())
    return None

def test_fixture_counts():
    data = load_fixture()
    if data is None:
        pytest.skip("fixture missing")
    out = summarize(data)
    # done counts only files source with mark done
    files_steps = [s for s in data.get("steps", []) if s.get("source") == "files"]
    assert out["total"] == len(files_steps)
    assert out["done"] == sum(1 for s in files_steps if s.get("mark") == "done")
    # each step has required keys
    for st in out["steps"]:
        assert "id" in st and "title" in st and "mark" in st and "how" in st and "why" in st

def test_next_points_at_files():
    data = load_fixture()
    if data is None:
        pytest.skip("fixture missing")
    out = summarize(data)
    if out["next"] is not None:
        assert out["next"]["id"] not in (None, "")

def test_not_now_keeps_reason():
    doctor = {
        "steps": [
            {"id": "a", "title": "A", "mark": "done", "how": "h", "why": "w", "source": "files"},
            {"id": "b", "title": "B", "mark": "not now", "how": "h", "why": "w", "source": "files", "reason": "later"},
        ],
        "findings": [],
        "next": {},
    }
    out = summarize(doctor)
    assert out["done"] == 1
    assert out["total"] == 2
    b = next(s for s in out["steps"] if s["id"] == "b")
    assert b["reason"] == "later"
    # next should be None because only remaining is not now
    assert out["next"] is None

def test_unknown_mark():
    doctor = {
        "steps": [
            {"id": "a", "title": "A", "mark": "weird", "how": "h", "why": "w", "source": "files"},
        ],
        "findings": [],
        "next": {},
    }
    out = summarize(doctor)
    assert out["steps"][0]["mark"] == "unknown"

def test_next_points_at_non_files():
    doctor = {
        "steps": [
            {"id": "tool-hook", "title": "Hook", "mark": "next", "how": "h", "why": "w", "source": "other"},
            {"id": "a", "title": "A", "mark": "to do", "how": "h", "why": "w", "source": "files"},
            {"id": "b", "title": "B", "mark": "to do", "how": "h", "why": "w", "source": "files"},
        ],
        "findings": [],
        "next": {"id": "tool-hook"},
    }
    out = summarize(doctor)
    # next points at non-files, so fallback to first files not done/not now
    assert out["next"]["id"] == "a"

def test_findings_lookup():
    doctor = {
        "steps": [
            {"id": "a", "title": "A", "mark": "to do", "how": "h", "why": "w", "source": "files"},
            {"id": "b", "title": "B", "mark": "to do", "how": "h", "why": "w", "source": "files"},
        ],
        "findings": [
            {"id": "a", "what": "bad", "why": "because", "fix": "do x", "docs": "http://x"},
            {"id": "other", "what": "ignore", "why": "y", "fix": "z"},
        ],
        "next": {"id": "a"},
    }
    out = summarize(doctor)
    a = next(s for s in out["steps"] if s["id"] == "a")
    b = next(s for s in out["steps"] if s["id"] == "b")
    assert a["what"] == "bad"
    assert a["fix"] == "do x"
    assert a["docs"] == "http://x"
    assert "what" not in b

def test_install_only_not_chosen():
    doctor = {
        "steps": [
            {"id": "runtime", "title": "R", "mark": "to do", "how": "h", "why": "w", "source": "files"},
            {"id": "a", "title": "A", "mark": "to do", "how": "h", "why": "w", "source": "files"},
        ],
        "findings": [],
        "next": {},
    }
    out = summarize(doctor)
    assert out["next"]["id"] == "a"

def test_install_only_when_alone():
    doctor = {
        "steps": [
            {"id": "a", "title": "A", "mark": "done", "how": "h", "why": "w", "source": "files"},
            {"id": "runtime", "title": "R", "mark": "to do", "how": "h", "why": "w", "source": "files"},
        ],
        "findings": [],
        "next": {},
    }
    out = summarize(doctor)
    assert out["next"]["id"] == "runtime"

def test_next_explicit_files():
    doctor = {
        "steps": [
            {"id": "a", "title": "A", "mark": "to do", "how": "h", "why": "w", "source": "files"},
            {"id": "b", "title": "B", "mark": "to do", "how": "h", "why": "w", "source": "files"},
        ],
        "findings": [],
        "next": {"id": "b"},
    }
    out = summarize(doctor)
    assert out["next"]["id"] == "b"

# Tests for 1 and 2: install_only field and next never install-only while other files step open

def test_install_only_field_includes_all_install_only_not_done():
    doctor = {
        "steps": [
            {"id": "tool-hook", "title": "Hook", "mark": "to do", "how": "h", "why": "w", "source": "files"},
            {"id": "runtime", "title": "Runtime", "mark": "done", "how": "h", "why": "w", "source": "files"},
            {"id": "sandbox", "title": "Sandbox", "mark": "next", "how": "h", "why": "w", "source": "files"},
            {"id": "a", "title": "A", "mark": "to do", "how": "h", "why": "w", "source": "files"},
        ],
        "findings": [],
        "next": {},
    }
    out = summarize(doctor)
    assert "install_only" in out
    ids = [s["id"] for s in out["install_only"]]
    assert "tool-hook" in ids
    assert "sandbox" in ids
    assert "runtime" not in ids
    assert "a" not in ids

def test_install_only_empty_when_all_done():
    doctor = {
        "steps": [
            {"id": "tool-hook", "title": "Hook", "mark": "done", "how": "h", "why": "w", "source": "files"},
            {"id": "a", "title": "A", "mark": "done", "how": "h", "why": "w", "source": "files"},
        ],
        "findings": [],
        "next": {},
    }
    out = summarize(doctor)
    assert out["install_only"] == []

def test_next_never_install_only_even_when_next_id_names_install_only():
    doctor = {
        "steps": [
            {"id": "tool-hook", "title": "Hook", "mark": "next", "how": "h", "why": "w", "source": "files"},
            {"id": "a", "title": "A", "mark": "to do", "how": "h", "why": "w", "source": "files"},
            {"id": "b", "title": "B", "mark": "to do", "how": "h", "why": "w", "source": "files"},
        ],
        "findings": [],
        "next": {"id": "tool-hook"},
    }
    out = summarize(doctor)
    assert out["next"] is not None
    assert out["next"]["id"] == "a"
    assert out["next"]["id"] not in ("tool-hook", "runtime", "sandbox")

def test_next_id_done_is_not_open():
    doctor = {
        "steps": [
            {"id": "a", "title": "A", "mark": "done", "how": "h", "why": "w", "source": "files"},
            {"id": "b", "title": "B", "mark": "to do", "how": "h", "why": "w", "source": "files"},
            {"id": "c", "title": "C", "mark": "to do", "how": "h", "why": "w", "source": "files"},
        ],
        "findings": [],
        "next": {"id": "a"},
    }
    out = summarize(doctor)
    # next.id is done, so not open -> fallback to first open non-install-only
    assert out["next"]["id"] == "b"

def test_next_prefers_first_open_non_install_only():
    doctor = {
        "steps": [
            {"id": "runtime", "title": "R", "mark": "to do", "how": "h", "why": "w", "source": "files"},
            {"id": "a", "title": "A", "mark": "not now", "how": "h", "why": "w", "source": "files", "reason": "later"},
            {"id": "b", "title": "B", "mark": "to do", "how": "h", "why": "w", "source": "files"},
            {"id": "sandbox", "title": "S", "mark": "to do", "how": "h", "why": "w", "source": "files"},
        ],
        "findings": [],
        "next": {},
    }
    out = summarize(doctor)
    assert out["next"]["id"] == "b"

def test_fixture_next_is_not_tool_hook():
    data = load_fixture()
    if data is None:
        pytest.skip("fixture missing")
    # fixture has top-level next.id == tool-hook but other files steps are open
    assert data.get("next", {}).get("id") == "tool-hook"
    out = summarize(data)
    assert out["next"] is not None
    assert out["next"]["id"] != "tool-hook"
    # install_only should contain tool-hook because its mark is not done
    assert any(s["id"] == "tool-hook" for s in out["install_only"])
    # next must be first open non-install-only files step
    for s in out["steps"]:
        if s["id"] == out["next"]["id"]:
            assert s["mark"] not in ("done", "not now")
            assert s["id"] not in ("tool-hook", "runtime", "sandbox")
            break
