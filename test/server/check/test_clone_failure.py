import io
import pytest
from check import sandbox_run
from check.github_check import RepoRefused


class FakeProcess:
    def __init__(self, returncode, stdout=""):
        self.stdout = io.StringIO(stdout)
        self.stderr = io.StringIO("")
        self.returncode = returncode

    def wait(self):
        return self.returncode


class FakeSandbox:
    def __init__(self, steps):
        self.steps = steps
        self.is_ended = False

    def exec(self, *args, **kwargs):
        for name, step in self.steps.items():
            if name in args:
                return step()
        return FakeProcess(0)

    def _experimental_set_outbound_network_policy(self, **kwargs):
        pass

    def terminate(self):
        self.is_ended = True


def run_with(monkeypatch, steps, message):
    sandbox = FakeSandbox(steps)
    monkeypatch.setattr(sandbox_run.modal.App, "lookup", lambda *a, **k: object())
    monkeypatch.setattr(sandbox_run.modal.Sandbox, "create", lambda *a, **k: sandbox)
    with pytest.raises(RepoRefused, match=message):
        sandbox_run.run_in_sandbox("owner", "repo")
    return sandbox


def raise_timeout():
    raise TimeoutError("ran out of time")


def test_failed_clone_says_it_may_be_too_big(monkeypatch):
    sandbox = run_with(monkeypatch, {"clone": lambda: FakeProcess(1)}, "couldn't copy this repo in time")
    assert sandbox.is_ended


def test_clone_that_raises_says_it_may_be_too_big(monkeypatch):
    sandbox = run_with(monkeypatch, {"clone": raise_timeout}, "couldn't copy this repo in time")
    assert sandbox.is_ended


def test_failed_doctor_says_it_may_be_too_big(monkeypatch):
    sandbox = run_with(monkeypatch, {"doctor": lambda: FakeProcess(-1)}, "couldn't finish checking this repo in time")
    assert sandbox.is_ended


def test_failed_check_says_it_may_be_too_big(monkeypatch):
    steps = {"doctor": lambda: FakeProcess(0, "{}"), "check": lambda: FakeProcess(-1)}
    sandbox = run_with(monkeypatch, steps, "couldn't finish checking this repo in time")
    assert sandbox.is_ended


def test_check_that_raises_says_it_may_be_too_big(monkeypatch):
    steps = {"doctor": lambda: FakeProcess(0, "{}"), "check": raise_timeout}
    sandbox = run_with(monkeypatch, steps, "couldn't finish checking this repo in time")
    assert sandbox.is_ended
