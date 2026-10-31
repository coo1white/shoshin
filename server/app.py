import hashlib
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
from fixes.build import build_fixes

import modal
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

logger = logging.getLogger(__name__)

ALLOWED_ORIGINS = ["https://doctor.yokoten.app", "http://localhost:8000"]
GENERIC_ERROR = "The check could not finish. Please try again in a minute."
BAD_URL_MSG = "That doesn't look like a public GitHub repo. Try https://github.com/owner/repo."
NO_FIXES = {"files": [], "summary": "", "muse": "failed", "claude_import": None}

HERE = pathlib.Path(__file__).parent

web_image = (
    modal.Image.debian_slim().pip_install("fastapi==0.162.0", "modal==1.6.3", "cryptography==50.0.2")
    .add_local_file(HERE / "sandbox_run.py", f"/root/sandbox_run.py")
    .add_local_file(HERE / "github_check.py", f"/root/github_check.py")
    .add_local_file(HERE / "repo_url.py", f"/root/repo_url.py")
    .add_local_file(HERE / "result.py", f"/root/result.py")
    .add_local_dir(HERE / "fixes", "/root/fixes")
    .add_local_dir(HERE / "record", "/root/record")
)
app = modal.App("yokoten-doctor")


class RateLimiter:
    HOURLY_LIMIT_PER_IP = 10
    DAILY_LIMIT_TOTAL = 300

    def __init__(self, store, now=time.time):
        self.store = store
        self.now = now

    def allow(self, client_ip) -> str:
        try:
            now_val = self.now()
            day_num = int(now_val // 86400)
            hour_num = int(now_val // 3600)
            day_key = f"limit:day:{day_num}"
            day_count = self.store.get(day_key, 0)
            if day_count is None:
                day_count = 0
            if day_count >= self.DAILY_LIMIT_TOTAL:
                return "day"
            ip_hash = hashlib.sha256(client_ip.encode("utf-8")).hexdigest()[:16]
            hour_key = f"limit:ip:{ip_hash}:{hour_num}"
            ip_count = self.store.get(hour_key, 0)
            if ip_count is None:
                ip_count = 0
            if ip_count >= self.HOURLY_LIMIT_PER_IP:
                return "ip"
            try:
                self.store.put(day_key, day_count + 1)
            except Exception:
                raise
            try:
                self.store.put(hour_key, ip_count + 1)
            except Exception:
                raise
            return "ok"
        except Exception as e:
            logger.error(type(e).__name__)
            return "ok"


def open_cache():
    try:
        return modal.Dict.from_name("yokoten-doctor-cache", create_if_missing=True)
    except Exception:
        return None


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


def build_result_event(res) -> dict:
    payload = build_result(res)
    payload["default_branch"] = res.get("branch") if isinstance(res, dict) else None
    return payload


def create_api(run: Callable = run_in_sandbox, public: Callable = _check_public_default, make_fixes=None, limiter=None, write_public_record=None):  # type: ignore
    if make_fixes is None:
        def _default_make_fixes(result):
            cache = open_cache()
            return build_fixes(result, cache=cache)
        make_fixes = _default_make_fixes

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
            except (BadRepoUrl, RepoRefused) as e:
                yield sse_event("error", {"message": str(e)})
                return
            except Exception:
                logger.exception("check failed reading")
                yield sse_event("error", {"message": GENERIC_ERROR})
                return

            if limiter is not None:
                try:
                    client_ip = request.client.host if request.client else ""
                except Exception:
                    client_ip = ""
                decision = limiter.allow(client_ip)
                if decision == "ip":
                    yield sse_event("error", {"message": "You have run 10 checks this hour. Please try again later. You can also run it yourself: npx yokoten"})
                    return
                if decision == "day":
                    yield sse_event("error", {"message": "This page has reached its limit for today. Please try again tomorrow. You can also run it yourself: npx yokoten"})
                    return

            try:
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
                    try:
                        output = make_fixes(res)
                        q.put(("fixes", output))
                    except Exception as e:
                        logger.error(type(e).__name__)
                        q.put(("fixes", NO_FIXES))
                    if write_public_record is not None:
                        try:
                            payload_out = build_result_event(res)
                            rec = write_public_record(payload_out)
                            q.put(("record", rec))
                        except Exception as e:
                            logger.error(type(e).__name__)
                            q.put(("record", None))
                except (BadRepoUrl, RepoRefused) as e:
                    q.put(("error_known", str(e)))
                except Exception:
                    logger.exception("sandbox run failed")
                    q.put(("error_generic", GENERIC_ERROR))

            t = threading.Thread(target=worker, daemon=True)
            t.start()

            start = time.monotonic()
            result_sent = False
            fixes_sent = False
            while True:
                elapsed = time.monotonic() - start
                remaining = 170 - elapsed
                if remaining <= 0:
                    if not result_sent:
                        yield sse_event("error", {"message": GENERIC_ERROR})
                    elif result_sent and not fixes_sent:
                        yield sse_event("fixes", NO_FIXES)
                    return
                try:
                    item = q.get(timeout=remaining)
                except queue.Empty:
                    if not result_sent:
                        yield sse_event("error", {"message": GENERIC_ERROR})
                    elif result_sent and not fixes_sent:
                        yield sse_event("fixes", NO_FIXES)
                    return
                kind = item[0]
                if kind == "progress":
                    yield sse_event("progress", {"step": item[1]})
                elif kind == "done":
                    try:
                        payload_out = build_result_event(item[1])
                        yield sse_event("result", payload_out)
                    except Exception:
                        logger.exception("building result failed")
                        yield sse_event("error", {"message": GENERIC_ERROR})
                        return
                    result_sent = True
                elif kind == "fixes":
                    yield sse_event("fixes", item[1])
                    fixes_sent = True
                    if write_public_record is None:
                        return
                elif kind == "record":
                    if item[1] is not None:
                        yield sse_event("record", item[1])
                    return
                elif kind == "error_known":
                    yield sse_event("error", {"message": item[1]})
                    return
                elif kind == "error_generic":
                    yield sse_event("error", {"message": item[1]})
                    return

        return StreamingResponse(gen(), media_type="text/event-stream")

    return api


@app.function(image=web_image, timeout=180, max_containers=3, secrets=[modal.Secret.from_name("yokoten-doctor-baseten"), modal.Secret.from_name("yokoten-doctor-record")])
@modal.concurrent(max_inputs=10)
@modal.asgi_app()
def fastapi_app():
    cache = open_cache()
    limiter = None
    if cache is not None:
        try:
            limiter = RateLimiter(cache)
        except Exception:
            limiter = None
    def _write_public_record(result):
        from record.write import write_record
        return write_record(result, store=open_cache())
    return create_api(limiter=limiter, write_public_record=_write_public_record)
