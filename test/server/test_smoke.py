from pathlib import Path


def test_requirements_exists_and_lists_modal():
    repo_root = Path(__file__).resolve().parents[2]
    req_path = repo_root / "server" / "requirements.txt"
    assert req_path.exists(), f"missing {req_path}"
    content = req_path.read_text(encoding="utf-8")
    assert "modal" in content
