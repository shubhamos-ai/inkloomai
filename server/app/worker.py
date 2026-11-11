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

    from app.services import extraction_service

    with SessionLocal() as db:
        recovered = job_service.recover_stale_jobs(db)
        recovered_ext = extraction_service.recover_stale_extractions(db)
        if recovered.get("stale_found") or recovered_ext.get("stale_found"):
            print(
                f"[inkloom-worker] startup recovery: analysis={recovered} "
                f"extraction={recovered_ext}",
                flush=True,
            )

    # A standalone worker can only run vision jobs when it shares the upload
    # store with the API (S3-compatible storage). Extraction runs only need
    # the database, so they are always processed.
    include_analysis = settings.worker_can_process_analysis
    print(
        f"[inkloom-worker] analysis_jobs={'enabled' if include_analysis else 'disabled'} "
        f"(storage={settings.storage_backend_name})",
        flush=True,
    )

    while not stop:
        try:
            processed = job_service.worker_loop_once(include_analysis=include_analysis)
        except Exception as exc:  # noqa: BLE001
            print(f"[inkloom-worker] loop error (continuing): {exc}", flush=True)
            processed = False
        if not processed:
            time.sleep(settings.WORKER_POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    sys.exit(main())
