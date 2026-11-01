import pathlib
from pathlib import Path


def test_requirements_exists_and_lists_modal():
    repo_root = Path(__file__).resolve().parents[2]
    req_path = repo_root / "server" / "requirements.txt"
    assert req_path.exists(), f"missing {req_path}"
    content = req_path.read_text(encoding="utf-8")
    assert "modal" in content


def test_web_image_versions_match_requirements():
    req = pathlib.Path('server/requirements.txt').read_text()
    app = pathlib.Path('server/app.py').read_text()
    for line in req.strip().splitlines():
        if not line.strip():
            continue
        pkg, ver = line.split('==')
        assert f'{pkg}=={ver}' in app, f'{pkg}=={ver} not in server/app.py web_image'


def test_web_image_holds_every_server_package():
    # A deploy once left out modules, and the tests here could not see it.
    app = pathlib.Path('server/app.py').read_text()
    packages = [p.name for p in pathlib.Path('server').iterdir() if (p / '__init__.py').exists()]
    assert sorted(packages) == ['check', 'fixes', 'record']
    for name in packages:
        assert f'.add_local_dir(HERE / "{name}", "/root/{name}")' in app, f'{name} not in web_image'
