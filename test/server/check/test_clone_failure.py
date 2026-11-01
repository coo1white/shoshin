import io
import pytest
from check import sandbox_run
from check.github_check import RepoRefused


class FakeProcess:
    def __init__(self, returncode):
        self.stdout = io.StringIO("")
        self.stderr = io.StringIO("")
        self.returncode = returncode

    def wait(self):
        return self.returncode


class FakeSandbox:
    def __init__(self, clone):
        self.clone = clone
        self.is_ended = False

    def exec(self, *args, **kwargs):
        if "clone" in args:
            return self.clone()
        return FakeProcess(0)

    def terminate(self):
        self.is_ended = True


def run_with(monkeypatch, clone):
    sandbox = FakeSandbox(clone)
    monkeypatch.setattr(sandbox_run.modal.App, "lookup", lambda *a, **k: object())
    monkeypatch.setattr(sandbox_run.modal.Sandbox, "create", lambda *a, **k: sandbox)
    with pytest.raises(RepoRefused, match="could not be copied in time"):
        sandbox_run.run_in_sandbox("owner", "repo")
    return sandbox


def test_failed_clone_says_it_may_be_too_big(monkeypatch):
    sandbox = run_with(monkeypatch, lambda: FakeProcess(1))
    assert sandbox.is_ended


def test_clone_that_raises_says_it_may_be_too_big(monkeypatch):
    def raise_timeout():
        raise TimeoutError("clone ran out of time")

    sandbox = run_with(monkeypatch, raise_timeout)
    assert sandbox.is_ended
