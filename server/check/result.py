KNOWN_MARKS = {"done", "to do", "next", "can't check", "not now"}
INSTALL_ONLY_IDS = {"tool-hook", "runtime", "sandbox", "ci", "titles"}


def summarize(doctor: dict) -> dict:
    steps_in = doctor.get("steps", []) or []
    findings_in = doctor.get("findings", []) or []
    next_obj = doctor.get("next", {}) if isinstance(doctor.get("next"), dict) else {}

    # Build findings lookup by id
    findings_by_id: dict[str, dict] = {}
    for f in findings_in:
        if isinstance(f, dict) and "id" in f:
            findings_by_id[f["id"]] = f

    # Filter to files source only
    files_steps = [s for s in steps_in if isinstance(s, dict) and s.get("source") == "files"]

    total = len(files_steps)
    done = 0
    result_steps: list[dict] = []

    for s in files_steps:
        mark = s.get("mark")
        if mark not in KNOWN_MARKS:
            mark = "unknown"
        if mark == "done":
            done += 1

        step_out: dict = {
            "id": s.get("id"),
            "title": s.get("title"),
            "mark": mark,
            "how": s.get("how"),
            "why": s.get("why"),
        }
        if mark == "not now" and "reason" in s:
            step_out["reason"] = s.get("reason")

        fid = s.get("id")
        finding = findings_by_id.get(fid)
        if finding is not None:
            if "what" in finding:
                step_out["what"] = finding.get("what")
            if "fix" in finding:
                step_out["fix"] = finding.get("fix")
            if "docs" in finding:
                step_out["docs"] = finding.get("docs")

        result_steps.append(step_out)

    install_only = [s for s in result_steps if s.get("id") in INSTALL_ONLY_IDS and s.get("mark") != "done"]

    # Determine next
    next_step = None
    next_id = next_obj.get("id") if isinstance(next_obj, dict) else None

    # If next.id names a files step that is open and not install-only, use it
    if next_id:
        candidate = next((x for x in result_steps if x["id"] == next_id), None)
        if candidate is not None and candidate["mark"] not in ("done", "not now") and candidate["id"] not in INSTALL_ONLY_IDS:
            next_step = candidate
        else:
            # fallback: first open files step that is not install-only, else first open install-only, else None
            candidates = [st for st in result_steps if st["mark"] not in ("done", "not now")]
            if candidates:
                non_install = [c for c in candidates if c["id"] not in INSTALL_ONLY_IDS]
                if non_install:
                    next_step = non_install[0]
                else:
                    next_step = candidates[0]
            else:
                next_step = None
    else:
        candidates = [st for st in result_steps if st["mark"] not in ("done", "not now")]
        if candidates:
            non_install = [c for c in candidates if c["id"] not in INSTALL_ONLY_IDS]
            if non_install:
                next_step = non_install[0]
            else:
                next_step = candidates[0]
        else:
            next_step = None

    return {
        "done": done,
        "total": total,
        "next": next_step,
        "steps": result_steps,
        "install_only": install_only,
    }
