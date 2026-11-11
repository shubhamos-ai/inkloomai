"""Embedded analysis worker — runs inside the web service process.

Render.com cannot mount one persistent disk across several services, so a
standalone background worker (python -m app.worker) cannot read the uploaded
images written by the API process. On Render we therefore run the same job
loop in a daemon thread inside the API service (RUN_EMBEDDED_WORKER=true).

Locally the standalone worker remains the recommended setup; this module is
a no-op unless RUN_EMBEDDED_WORKER is enabled.
"""
from __future__ import annotations

import threading
import time

from app.config import settings


def _loop() -> None:
    from app.database import SessionLocal
    from app.services import job_service

    iteration = 0
    print(
        f"[inkloom-embedded-worker] started (poll="
        f"{settings.WORKER_POLL_INTERVAL_SECONDS}s, stale_after="
        f"{settings.STALE_JOB_AFTER_SECONDS}s)",
        flush=True,
    )
    while True:
        try:
            # Recover orphaned jobs periodically (every ~60s with a 1s poll).
            if iteration % 60 == 0:
                with SessionLocal() as db:
                    job_service.recover_stale_jobs(db)
                    from app.services import extraction_service
                    extraction_service.recover_stale_extractions(db)

            from app.services import extraction_service
            processed_analysis = job_service.worker_loop_once()
            processed_extraction = extraction_service.worker_loop_once()
            processed = processed_analysis or processed_extraction
        except Exception as exc:  # noqa: BLE001 — never kill the thread
            print(f"[inkloom-embedded-worker] loop error (continuing): {exc}", flush=True)
            processed = False
        iteration += 1
        if not processed:
            time.sleep(settings.WORKER_POLL_INTERVAL_SECONDS)


def start_embedded_worker() -> None:
    """Start the worker loop in a daemon thread if enabled via env.

    Safe to call unconditionally from app startup.
    """
    if not settings.run_embedded_worker:
        return
    thread = threading.Thread(target=_loop, name="inkloom-embedded-worker", daemon=True)
    thread.start()
