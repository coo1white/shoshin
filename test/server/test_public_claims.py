import json
import re
from pathlib import Path

from check.result import INSTALL_ONLY_IDS

PAGES = [
    "web/src/pages/index.astro",
    "web/src/pages/about.astro",
    "web/src/data/agent-view.md",
]

WORD_TO_NUM = {
    "Two": 2,
    "Three": 3,
    "Four": 4,
    "Five": 5,
    "Six": 6,
}


def _read_text(path):
    return Path(path).read_text(encoding="utf-8")


def _get_total():
    data = json.loads(Path("test/fixtures/doctor-files-0.2.0.json").read_text(encoding="utf-8"))
    return len(data["steps"])


def test_tops_out_numbers_match_code():
    total = _get_total()
    assert total > 0
    assert INSTALL_ONLY_IDS is not None
    expected_a = total - len(INSTALL_ONLY_IDS)
    expected_b = total
    for page in PAGES:
        text = _read_text(page)
        for m in re.finditer(r"tops out at (\d+) of (\d+)", text):
            assert int(m.group(1)) == expected_a
            assert int(m.group(2)) == expected_b


def test_install_only_word_numbers_match_code():
    total = _get_total()
    assert total > 0
    assert INSTALL_ONLY_IDS is not None
    expected_num = len(INSTALL_ONLY_IDS)
    for page in PAGES:
        text = _read_text(page)
        for m in re.finditer(r"(Two|Three|Four|Five|Six) of the (\d+) checks", text):
            word = m.group(1)
            assert WORD_TO_NUM[word] == expected_num
            assert int(m.group(2)) == total


def test_hourly_and_daily_limits_match_code():
    app_text = _read_text("server/app.py")
    m_hourly = re.search(r"HOURLY_LIMIT_PER_IP\s*=\s*(\d+)", app_text)
    m_daily = re.search(r"DAILY_LIMIT_TOTAL\s*=\s*(\d+)", app_text)
    assert m_hourly is not None
    assert m_daily is not None
    hourly = int(m_hourly.group(1))
    daily = int(m_daily.group(1))
    for page in PAGES:
        text = _read_text(page)
        for m in re.finditer(r"(\d+) checks an hour", text):
            assert int(m.group(1)) == hourly
        for m in re.finditer(r"(\d+) a day", text):
            assert int(m.group(1)) == daily


def test_over_gb_matches_github_check():
    gh_text = _read_text("server/check/github_check.py")
    m = re.search(r"if size > (\d+)", gh_text)
    assert m is not None
    size_limit = int(m.group(1))
    for page in PAGES:
        text = _read_text(page)
        for mm in re.finditer(r"over (\d+) GB", text):
            gb = int(mm.group(1))
            assert gb * 1024 * 1024 == size_limit


def test_cache_for_hours_matches_build():
    build_text = _read_text("server/fixes/build.py")
    m = re.search(r"<\s*(\d+)\s*\*\s*3600", build_text)
    assert m is not None
    hours = int(m.group(1))
    for page in PAGES:
        text = _read_text(page)
        for mm in re.finditer(r"cache for (\d+) hours", text):
            assert int(mm.group(1)) == hours


def test_about_seconds_matches_app():
    app_text = _read_text("server/app.py")
    m = re.search(r"remaining\s*=\s*(\d+)\s*-\s*elapsed", app_text)
    assert m is not None
    seconds = int(m.group(1))
    for page in PAGES:
        text = _read_text(page)
        for mm in re.finditer(r"about (\d+) seconds", text):
            assert int(mm.group(1)) == seconds
