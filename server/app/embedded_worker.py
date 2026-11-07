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
    from app.services import job_service

    print(
        f"[inkloom-embedded-worker] started (poll="
        f"{settings.WORKER_POLL_INTERVAL_SECONDS}s, stale_after="
        f"{settings.STALE_JOB_AFTER_SECONDS}s)",
        flush=True,
    )
    while True:
        try:
            # worker_loop_once() already recovers stale jobs, claims one job and
            # runs the pipeline; it returns True when a job was processed.
            processed = job_service.worker_loop_once()
        except Exception as exc:  # noqa: BLE001 — never kill the thread
            print(f"[inkloom-embedded-worker] loop error (continuing): {exc}", flush=True)
            processed = False
        if not processed:
            time.sleep(settings.WORKER_POLL_INTERVAL_SECONDS)


def start_embedded_worker() -> None:
    """Start the worker loop in a daemon thread if enabled via env.

    Safe to call unconditionally from app startup.
    """
    if not settings.RUN_EMBEDDED_WORKER:
        return
    thread = threading.Thread(target=_loop, name="inkloom-embedded-worker", daemon=True)
    thread.start()
