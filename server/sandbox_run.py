import json

import modal

YOKOTEN_VERSION = "0.2.0"

image = (
    modal.Image.from_registry("node:22-slim")
    .apt_install("git", "ca-certificates")
    .run_commands(f"npm install -g yokoten@{YOKOTEN_VERSION}")
)


class SandboxFailed(Exception):
    pass


def _read_process(proc):
    stdout = proc.stdout.read()
    stderr = proc.stderr.read()
    proc.wait()
    if isinstance(stdout, bytes):
        stdout = stdout.decode("utf-8", errors="replace")
    if isinstance(stderr, bytes):
        stderr = stderr.decode("utf-8", errors="replace")
    return stdout, stderr, proc.returncode


def run_in_sandbox(owner: str, repo: str, on_progress=None) -> dict:
    app = modal.App.lookup("yokoten-doctor", create_if_missing=True)
    sb = modal.Sandbox.create(
        app=app,
        image=image,
        timeout=120,
        cpu=1.0,
        memory=1024,
        env={
            "HOME": "/tmp/home",
            "TMPDIR": "/tmp/work",
            "TEMP": "/tmp/work",
            "TMP": "/tmp/work",
            "GIT_TERMINAL_PROMPT": "0",
        },
        outbound_domain_allowlist=["github.com", "*.github.com", "*.githubusercontent.com"],
        outbound_cidr_allowlist=[],
    )
    try:
        # 2. mkdir
        p = sb.exec("mkdir", "-p", "/tmp/home", "/tmp/work", timeout=10)
        _, _, rc = _read_process(p)
        if rc != 0:
            raise SandboxFailed("Could not prepare sandbox.")

        if on_progress is not None:
            try:
                on_progress("copying")
            except Exception:
                pass

        # 3. clone
        clone_url = f"https://github.com/{owner}/{repo}.git"
        p = sb.exec(
            "git",
            "-c",
            "core.hooksPath=/dev/null",
            "clone",
            "--depth",
            "1",
            "--no-recurse-submodules",
            "--quiet",
            clone_url,
            "/tmp/repo",
            timeout=60,
        )
        _, stderr, rc = _read_process(p)
        if rc != 0:
            raise SandboxFailed(f"Could not clone repo: {stderr.strip()}")

        # 4. commit
        p = sb.exec("git", "-C", "/tmp/repo", "rev-parse", "HEAD", timeout=10)
        stdout, stderr, rc = _read_process(p)
        if rc != 0:
            raise SandboxFailed(f"Could not read commit: {stderr.strip()}")
        commit = stdout.strip()

        # 5. cut network
        try:
            sb._experimental_set_outbound_network_policy(
                outbound_domain_allowlist=[],
                outbound_cidr_allowlist=[],
            )
        except Exception as e:
            raise SandboxFailed("Could not lock down network before running checks.") from e

        if on_progress is not None:
            try:
                on_progress("checking")
            except Exception:
                pass

        # about: description from installed package
        about = ""
        try:
            p = sb.exec(
                "node",
                "-p",
                "require('/usr/local/lib/node_modules/yokoten/package.json').description",
                timeout=10,
            )
            stdout_a, _, rc_a = _read_process(p)
            if rc_a == 0:
                about = stdout_a.strip()
                # node -p prints with newline; ensure string
                if about is None:
                    about = ""
            else:
                about = ""
        except Exception:
            about = ""

        # 6. run yokoten doctor and check (no shell, workdir via env -C)
        p = sb.exec(
            "env",
            "-C",
            "/tmp/repo",
            "yokoten",
            "doctor",
            "--files",
            "--json",
            timeout=30,
        )
        stdout_d, stderr_d, rc_d = _read_process(p)
        if rc_d not in (0, 1):
            raise SandboxFailed(f"yokoten doctor failed: {stderr_d.strip()}")
        try:
            doctor = json.loads(stdout_d)
        except Exception as e:
            raise SandboxFailed(f"Could not parse doctor output: {e}") from e

        p = sb.exec(
            "env",
            "-C",
            "/tmp/repo",
            "yokoten",
            "check",
            "--json",
            timeout=30,
        )
        stdout_c, stderr_c, rc_c = _read_process(p)
        if rc_c not in (0, 1):
            raise SandboxFailed(f"yokoten check failed: {stderr_c.strip()}")
        try:
            check = json.loads(stdout_c)
        except Exception as e:
            raise SandboxFailed(f"Could not parse check output: {e}") from e

        yokoten_version = doctor.get("version", YOKOTEN_VERSION)

        rerun = {
            "doctor": (
                f"git clone https://github.com/{owner}/{repo} && "
                f"cd {repo} && "
                f"git checkout {commit} && "
                f"npx yokoten@{yokoten_version} doctor --files --json"
            ),
            "check": f'HOME="$(mktemp -d)" npx yokoten@{yokoten_version} check --json',
        }

        return {
            "owner": owner,
            "repo": repo,
            "commit": commit,
            "yokoten_version": yokoten_version,
            "about": about,
            "doctor": doctor,
            "check": check,
            "rerun": rerun,
        }
    finally:
        try:
            sb.terminate()
        except Exception:
            pass
