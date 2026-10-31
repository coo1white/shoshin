import datetime
import logging
import os
import time

from .document import document_hash, make_document, memo_text, record_key

logger = logging.getLogger(__name__)


class RecordFailed(Exception):
    pass


def write_record(result, store=None, now=time.time, rekor=None, solana=None, environ=os.environ) -> dict | None:
    # default imports here to avoid circular at import time for callers that patch
    if rekor is None:
        from .rekor import write_entry as rekor
    if solana is None:
        from .solana import write_memo as solana
    try:
        if not isinstance(result, dict):
            return None
        owner = result.get("owner")
        repo = result.get("repo")
        commit = result.get("commit")
        version = result.get("yokoten_version")
        if not owner or not repo or not commit or not version:
            return None
        owner = str(owner)
        repo = str(repo)
        commit = str(commit)
        version = str(version)

        key = record_key(owner, repo, commit, version)
        if store is not None:
            try:
                existing = store.get(key, None)
            except Exception as e:
                logger.error(type(e).__name__)
                existing = None
            if isinstance(existing, dict) and existing.get("rekor") is not None:
                return existing

        # recorded_at
        try:
            ts = now()
        except Exception:
            ts = time.time()
        try:
            recorded_at = datetime.datetime.fromtimestamp(ts, tz=datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        except Exception:
            recorded_at = "1970-01-01T00:00:00Z"

        document = make_document(result, recorded_at)
        sha256 = document_hash(document)
        memo = memo_text(owner, repo, commit, version, sha256)

        rekor_result = None
        solana_result = None

        rekor_pem = environ.get("REKOR_SIGNING_KEY") if hasattr(environ, "get") else None
        solana_seed = environ.get("SOLANA_DEVNET_SEED") if hasattr(environ, "get") else None

        if rekor_pem:
            try:
                # turn back \n sequences
                pem_str = rekor_pem.replace("\\n", "\n")
                if pem_str:
                    rekor_result = rekor(document, pem_str)
            except Exception as e:
                logger.error(type(e).__name__)
                rekor_result = None

        if solana_seed:
            try:
                seed_hex = solana_seed.strip()
                if seed_hex:
                    solana_result = solana(memo, seed_hex)
            except Exception as e:
                logger.error(type(e).__name__)
                solana_result = None

        record = {
            "sha256": sha256,
            "recorded_at": recorded_at,
            "document": document.decode("utf-8"),
            "rekor": rekor_result,
            "solana": solana_result,
        }

        if rekor_result is not None or solana_result is not None:
            if store is not None:
                try:
                    store.put(key, record)
                except Exception as e:
                    logger.error(type(e).__name__)

        return record
    except Exception as e:
        logger.error(type(e).__name__)
        return None
