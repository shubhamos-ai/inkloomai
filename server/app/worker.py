"""Inkloom AI background worker.

Run with:  python -m app.worker
(managed via `uv run worker` or systemd/foreman in production)

- One job at a time: only one heavy vision inference runs at any moment.
- Recovers stale 'processing' jobs left behind by crashes.
- Survives restarts: the queue lives in SQLite, not in process memory.
"""
from __future__ import annotations

import signal
import sys
import time

from app.config import ensure_storage_dirs, settings


def main() -> None:
    ensure_storage_dirs()
    from sqlalchemy import text

    from app.database import SessionLocal, engine
    from app.services import job_service

    # Make sure the schema exists before starting recovery/claims.
    with engine.begin() as conn:
        conn.execute(text("SELECT 1"))

    stop = False

    def handle_sigterm(_sig, _frame):
        nonlocal stop
        stop = True

    # Finish the current job, then exit — no half-written reports.
    signal.signal(signal.SIGTERM, handle_sigterm)
    signal.signal(signal.SIGINT, handle_sigterm)

    print(
        f"[inkloom-worker] started (poll={settings.WORKER_POLL_INTERVAL_SECONDS}s, "
        f"stale_after={settings.STALE_JOB_AFTER_SECONDS}s)",
        flush=True,
    )

    with SessionLocal() as db:
        recovered = job_service.recover_stale_jobs(db)
        if recovered.get("stale_found"):
            print(f"[inkloom-worker] startup recovery: {recovered}", flush=True)

        from app.services import extraction_service
        recovered_ext = extraction_service.recover_stale_extractions(db)
        if recovered_ext.get("stale_found"):
            print(f"[inkloom-worker] startup extraction recovery: {recovered_ext}", flush=True)

    from app.services import extraction_service

    while not stop:
        try:
            processed_analysis = job_service.worker_loop_once()
            processed_extraction = extraction_service.worker_loop_once()
            processed = processed_analysis or processed_extraction
        except Exception as exc:  # noqa: BLE001
            print(f"[inkloom-worker] loop error (continuing): {exc}", flush=True)
            processed = False
        if not processed:
            time.sleep(settings.WORKER_POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    sys.exit(main())
