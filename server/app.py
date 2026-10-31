import json
import logging
import pathlib
import queue
import threading
import time
from typing import Callable

from sandbox_run import run_in_sandbox
from github_check import RepoRefused
from github_check import check_public as _check_public_default
from repo_url import BadRepoUrl
from repo_url import parse_repo_url as _parse_repo_url_default
from result import summarize as _summarize_default

import modal
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

logger = logging.getLogger(__name__)

ALLOWED_ORIGINS = ["https://doctor.yokoten.app", "http://localhost:8000"]
GENERIC_ERROR = "The check could not finish. Please try again in a minute."
BAD_URL_MSG = "That doesn't look like a public GitHub repo. Try https://github.com/owner/repo."

HERE = pathlib.Path(__file__).parent

web_image = (
    modal.Image.debian_slim().pip_install("fastapi", "modal")
    .add_local_file(HERE / "sandbox_run.py", f"/root/sandbox_run.py")
    .add_local_file(HERE / "github_check.py", f"/root/github_check.py")
    .add_local_file(HERE / "repo_url.py", f"/root/repo_url.py")
    .add_local_file(HERE / "result.py", f"/root/result.py")
)
app = modal.App("yokoten-doctor")


def build_result(res) -> dict:
    doctor = res.get("doctor", {})
    check_data = res.get("check", {})
    summary = _summarize_default(doctor)
    findings = []
    if isinstance(check_data, dict):
        findings = check_data.get("findings", []) or []
    secrets = []
    allowed = {"id", "what", "file", "line", "grade", "why", "fix"}
    for f in findings:
        if not isinstance(f, dict):
            continue
        if f.get("id") == "layout":
            continue
        secrets.append({k: f.get(k) for k in allowed})
    return {
        "owner": res.get("owner"),
        "repo": res.get("repo"),
        "commit": res.get("commit"),
        "yokoten_version": res.get("yokoten_version"),
        "about": res.get("about", ""),
        "rerun": res.get("rerun"),
        "summary": summary,
        "secrets": secrets,
    }


def create_api(run: Callable = run_in_sandbox, public: Callable = _check_public_default):  # type: ignore
    api = FastAPI()

    api.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
        allow_credentials=False,
    )

    @api.get("/api/health")
    def health():
        return {"ok": True}

    @api.post("/api/check")
    async def check(request: Request):
        body_bytes = await request.body()

        def sse_event(name: str, data: dict):
            return f"event: {name}\ndata: {json.dumps(data)}\n\n"

        def error_generator(message: str):
            def gen():
                yield sse_event("error", {"message": message})
            return StreamingResponse(gen(), media_type="text/event-stream")

        if len(body_bytes) > 2048:
            return error_generator(BAD_URL_MSG)

        try:
            payload = json.loads(body_bytes.decode("utf-8") if body_bytes else "{}")
        except Exception:
            return error_generator(BAD_URL_MSG)

        url_val = payload.get("url") if isinstance(payload, dict) else None
        if not isinstance(url_val, str):
            url_val = ""
        if len(url_val) > 300:
            return error_generator(BAD_URL_MSG)

        def gen():
            yield sse_event("progress", {"step": "reading"})
            try:
                owner, repo = _parse_repo_url_default(url_val)
                public(owner, repo)
            except (BadRepoUrl, RepoRefused) as e:
                yield sse_event("error", {"message": str(e)})
                return
            except Exception:
                logger.exception("check failed reading")
                yield sse_event("error", {"message": GENERIC_ERROR})
                return

            q: queue.Queue = queue.Queue()

            def on_progress(step: str):
                try:
                    q.put(("progress", step))
                except Exception:
                    pass

            def worker():
                try:
                    res = run(owner, repo, on_progress=on_progress)  # type: ignore
                    q.put(("done", res))
                except (BadRepoUrl, RepoRefused) as e:
                    q.put(("error_known", str(e)))
                except Exception:
                    logger.exception("sandbox run failed")
                    q.put(("error_generic", GENERIC_ERROR))

            t = threading.Thread(target=worker, daemon=True)
            t.start()

            start = time.monotonic()
            while True:
                elapsed = time.monotonic() - start
                remaining = 170 - elapsed
                if remaining <= 0:
                    yield sse_event("error", {"message": GENERIC_ERROR})
                    return
                try:
                    item = q.get(timeout=remaining)
                except queue.Empty:
                    yield sse_event("error", {"message": GENERIC_ERROR})
                    return
                kind = item[0]
                if kind == "progress":
                    yield sse_event("progress", {"step": item[1]})
                elif kind == "done":
                    try:
                        payload_out = build_result(item[1])
                        yield sse_event("result", payload_out)
                    except Exception:
                        logger.exception("building result failed")
                        yield sse_event("error", {"message": GENERIC_ERROR})
                    return
                elif kind == "error_known":
                    yield sse_event("error", {"message": item[1]})
                    return
                elif kind == "error_generic":
                    yield sse_event("error", {"message": item[1]})
                    return

        return StreamingResponse(gen(), media_type="text/event-stream")

    return api


@app.function(image=web_image, timeout=180)
@modal.asgi_app()
def fastapi_app():
    return create_api()
