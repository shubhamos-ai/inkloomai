# Inkloom AI — Round 3 Deliverables

**Project:** Inkloom AI — AI Advertising Compliance & Brand Governance
**Round:** 3
**Last verified:** 2026-11-11
**Production frontend:** <https://inkloom-frontend-rwy2.onrender.com>
**Production backend:** <https://inkloom-backend-yw07.onrender.com>
**Latest commit:** `bd97cc7`

---

## A. Implementation Summary

Round 3 delivers the three commitments from Round 2 plus the reliability work needed to
keep them honest in production.

### 1. AI brand-rule extraction and a versioned audit trail

- Brand guidelines can be pasted as text or uploaded as PDF / DOCX / TXT / MD.
- Extraction is staged, not destructive:
  1. `POST /brand-brain/extract` creates an `ExtractionRun` and queues the work.
  2. The worker proposes rules with `source_quote`, category, severity and rationale.
  3. A human reviews/edits the proposal in the Brand Brain UI.
  4. `POST /brand-brain/extract/{run_id}/commit` persists `BrandRule` rows and a
     `BrandRuleVersion` snapshot.
- Every rule change (create/update/delete) writes a version snapshot, so the audit trail
  is append-only and queryable through `GET /brand-brain/rules/{rule_id}/versions`.
- Rule codes are collision-safe; existing rules are never silently overwritten.

### 2. Real authentication and multi-tenancy

- Email + password accounts with hashed passwords (`bcrypt`) and opaque session tokens
  (`il_sess_…`) stored only as SHA-256 hashes server-side.
- Two equivalent auth transports:
  - `Authorization: Bearer <token>` — existing clients and localStorage sessions.
  - HttpOnly session cookie + double-submit `X-CSRF-Token` — browser sessions.
- Every protected endpoint resolves the caller to exactly one company; `X-Company-ID` is
  validated against ownership, so a browser-supplied company id is never proof of access.
- `/login` and `/register` deep-link into the single onboarding flow.
- Logout now invalidates the server-side session and clears cookies from Sidebar,
  MobileNav and Settings.
- The frontend no longer fabricates a synthetic `il_sess_…` token when the backend is
  unreachable; a real error is shown instead.

### 3. Durable storage and a queue-backed analysis pipeline

- `analysis_jobs` is the durable queue. Jobs carry `status`, `attempts`,
  `next_attempt_at`, `locked_by`, `error_code` and `error_message`.
- Workers claim jobs with a lease, honour backoff, and recover stale locks.
- Provider failures are classified:
  - `ProviderMisconfigured` — no usable vision provider; retryable after configuration.
  - `ProviderUnavailable` — timeout/outage; retried with exponential backoff.
  - No failure is ever converted into a fake “completed” report.
- Uploads are recorded as `Asset` rows with content type, size, checksum and preview
  metadata. Previews are generated once and served through authenticated endpoints.
- Storage is pluggable: local disk or any S3-compatible store (AWS S3, Cloudflare R2,
  MinIO). With S3 configured, a standalone worker can read the same uploads as the web
  service.
- `RUN_EMBEDDED_WORKER=auto` runs the queue inside the API process when storage is local,
  and leaves draining to a dedicated worker when S3 is configured.

### 4. Reliability and demo experience

- `/health` is fast by default (database + configuration only). Provider probes only run
  with `?deep=true`, so Render health checks and the frontend wake-ping never block on a
  slow AI provider.
- The “AI Server Offline” false alarm was traced to two production issues and fixed:
  - `DATABASE_URL` pointed at MongoDB while the app is SQLAlchemy/Postgres.
  - Render’s bare `postgresql://` URL resolved to an uninstalled `psycopg` v3 driver.
- Onboarding now has a **Use Demo** button that fills the exact supplied VELORA company
  profile and 8,927-character brand guidelines text.
- The health probe allows 15 seconds for a Render cold start, and the banner copy now
  distinguishes “connecting” from a real outage.

---

## B. Changed Files

### Backend

| File | Change |
| --- | --- |
| `server/app/config.py` | DB URL normalisation, S3/worker/extraction/auth/cookie settings |
| `server/app/database.py` | Engine/session helpers used by the queue and health check |
| `server/app/models/asset.py` | New `Asset` model for uploaded creatives |
| `server/app/models/extraction_run.py` | New `ExtractionRun` model |
| `server/app/models/brand_rule_version.py` | New `BrandRuleVersion` snapshot model |
| `server/app/models/brand_rule.py` | Added `version`, `extraction_run_id` |
| `server/app/models/analysis_job.py` | Added `error_code`, `next_attempt_at`, `locked_by` |
| `server/app/models/__init__.py` | Register new models |
| `server/alembic/versions/b3f1a2c4d5e6_rule_versioning_extraction_assets.py` | Round 3 migration |
| `server/alembic/versions/c7d8e9f0a1b2_widen_brand_rule_source_type.py` | Widen `source_type` to match the ORM (head) |
| `server/alembic/env.py` | Import new models for autogenerate |
| `server/app/api/deps.py` | Bearer + cookie auth, CSRF enforcement, company ownership checks |
| `server/app/api/v1/auth.py` | Register/login/logout cookies, `/me` PATCH |
| `server/app/api/v1/health.py` | Fast default health, `?deep=true` provider probes |
| `server/app/api/v1/analysis.py` | Retry, assets, preview, image token auth |
| `server/app/api/v1/brand_brain.py` | Extraction runs, retry, delete rule, versions |
| `server/app/engine/vision_engine.py` | Raises `ProviderError` instead of placeholder output |
| `server/app/engine/extraction_engine.py` | Structured rule extraction engine |
| `server/app/services/analysis_service.py` | Retry-aware failures, asset recording, previews, batched compliance evaluation |
| `server/app/services/json_utils.py` | Salvages complete objects from truncated model JSON |
| `server/tests/test_compliance_batching.py` | Regression tests for batching, salvage, transient retries |
| `server/app/services/job_service.py` | Lease/backoff/retry/recovery |
| `server/app/services/storage_service.py` | Local + S3-compatible storage backends |
| `server/app/services/asset_service.py` | Asset metadata and preview helpers |
| `server/app/services/extraction_service.py` | Extraction run orchestration |
| `server/app/services/brand_brain_service.py` | Rule CRUD, version snapshots, asset intake |
| `server/app/services/nim_vision_service.py` | Optional model override, truncation salvage |
| `server/app/services/ollama_service.py` | Optional model override, truncation salvage |
| `server/app/worker.py` | Extraction recovery + configurable analysis processing |
| `server/app/embedded_worker.py` | Respects `run_embedded_worker` |
| `server/app/main.py` | Lifespan worker startup, validation error envelope |
| `server/tests/test_health.py` | Fast/deep health contract |
| `server/.env.example` | Full environment reference |
| `render.yaml` | `RUN_EMBEDDED_WORKER=auto`, cookie settings, optional worker |

### Frontend

| File | Change |
| --- | --- |
| `src/lib/demoPresets.ts` | Exact VELORA demo company + guidelines preset |
| `src/components/onboarding/StepNewCompany.tsx` | “Use Demo” button and form fill |
| `src/components/onboarding/StepAuth.tsx` | Honours `/login` and `/register` mode after mount |
| `src/app/onboarding/page.tsx` | Reads `?mode=`, removed synthetic session fallback |
| `src/app/login/page.tsx` | `/login` deep link |
| `src/app/register/page.tsx` | `/register` deep link |
| `src/lib/api.ts` | `credentials: 'include'`, CSRF header, 15s health timeout |
| `src/components/layout/Sidebar.tsx` | Backend logout |
| `src/components/layout/MobileNav.tsx` | Backend logout |
| `src/components/dashboard/SettingsContent.tsx` | Backend logout |
| `src/components/ui/BackendStatusBanner.tsx` | Clearer connecting/outage copy |

---

## C. Architecture

```
Browser (Next.js 15 / React 18)
  │  HTTPS, Bearer token OR HttpOnly cookie + X-CSRF-Token
  ▼
FastAPI (Render web service, uvicorn)
  ├─ /api/v1/auth          accounts, sessions, cookies
  ├─ /api/v1/onboarding    company creation
  ├─ /api/v1/brand-brain   rules, extraction runs, versions
  ├─ /api/v1/analysis      upload, queue, status, reports, assets
  ├─ /api/v1/dashboard     aggregate stats
  └─ /api/v1/health        fast liveness (+ ?deep=true)
        │
        ├─ SQLAlchemy ──► PostgreSQL (Render) or SQLite (local)
        │
        ├─ StorageService ──► S3-compatible store  OR  local disk
        │
        └─ Worker loop (embedded or `python -m app.worker`)
              ├─ claims analysis_jobs with lease + backoff
              ├─ runs vision provider (NVIDIA NIM / Ollama)
              ├─ runs extraction provider (NVIDIA NIM / Ollama)
              └─ writes reports, assets, previews, extraction runs
```

### Request lifecycle (analysis)

1. `POST /analysis` validates and stores the upload through `StorageService`, writes an
   `Asset` row, and enqueues an `AnalysisJob`.
2. A worker claims the job atomically (`status=processing`, `locked_by`, lease).
3. The vision engine returns observations or raises a classified provider error.
4. The compliance/scoring engine evaluates observations against active `BrandRule` rows.
5. The report is persisted and the job becomes `completed`; failures set `error_code`,
   increment `attempts`, and schedule `next_attempt_at` with exponential backoff.
6. The frontend polls `GET /analysis/{id}/status` and then loads the report/assets.

### Why the queue is in the database

Round 3 needs durable retries without adding Redis/RQ/Celery to a free-tier deployment.
`analysis_jobs` already lives next to the data it protects, and SQL row locking is enough
for the expected concurrency. The interface (`claim_job`, `complete_job`, `retry_job`) is
small, so moving to a broker later is a service-layer change, not an API change.

---

## D. API Reference

Base URL: `https://inkloom-backend-yw07.onrender.com/api/v1`

Auth: `Authorization: Bearer <session_token>` **or** the HttpOnly session cookie. Cookie
sessions must send `X-CSRF-Token` on `POST`/`PUT`/`PATCH`/`DELETE`. Company-scoped calls
may send `X-Company-ID`.

### Health

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/health` | Fast: status, database, provider, storage, worker |
| `GET` | `/health?deep=true` | Adds live provider reachability probes |

### Auth

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/auth/register` | `{email, password, name?}` → session + cookies |
| `POST` | `/auth/login` | `{email, password}` → session + cookies |
| `GET` | `/auth/me` | Current user + owned companies |
| `PATCH` | `/auth/me` | `{name}` |
| `POST` | `/auth/logout` | Invalidates session, clears cookies |

### Onboarding

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/onboarding` | Create a company for the session user |
| `GET` | `/onboarding/check` | Whether the user already has a workspace |

### Brand Brain

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/brand-brain` | Brand brain summary |
| `POST` | `/brand-brain` | Multimodal intake (text + PDF/DOCX/TXT/MD) |
| `GET` | `/brand-brain/rules` | List active rules |
| `POST` | `/brand-brain/rules` | Create a rule (writes a version) |
| `PUT` | `/brand-brain/rules` | Batch replace/update rules |
| `DELETE` | `/brand-brain/rules/{rule_id}` | Delete a rule (writes a version) |
| `GET` | `/brand-brain/rules/{rule_id}/versions` | Rule audit trail |
| `GET` | `/brand-brain/versions` | Brand-brain version history |
| `POST` | `/brand-brain/extract` | Start an extraction run |
| `GET` | `/brand-brain/extract/runs` | List extraction runs |
| `GET` | `/brand-brain/extract/latest` | Latest run |
| `GET` | `/brand-brain/extract/{run_id}` | Run detail + proposed rules |
| `POST` | `/brand-brain/extract/{run_id}/commit` | Persist reviewed rules |
| `POST` | `/brand-brain/extract/{run_id}/retry` | Retry a failed run |

### Analysis

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/analysis` | Upload a creative and enqueue a job |
| `GET` | `/analysis/history` | Paginated history |
| `GET` | `/analysis/{id}` | Full report |
| `GET` | `/analysis/{id}/status` | Queue/progress status |
| `GET` | `/analysis/{id}/image` | Original image (bearer or `?token=`) |
| `GET` | `/analysis/{id}/preview` | Generated preview (bearer or `?token=`) |
| `GET` | `/analysis/{id}/assets` | Asset metadata |
| `POST` | `/analysis/{id}/retry` | Manual retry after a failure |
| `POST` | `/analysis/{id}/cancel` | Cancel a queued/running job |

### Dashboard

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/dashboard` | Aggregate stats for the active company |

---

## E. Database

### Engine and migrations

- Local: SQLite at `server/data/inkloom.db` (WAL, foreign keys on).
- Production: Render PostgreSQL.
- Migrations: Alembic. Current head: `c7d8e9f0a1b2`.
- Render build command runs `alembic upgrade head` before the service starts.

### Tables

| Table | Purpose |
| --- | --- |
| `users` | Accounts (email, hashed password, name) |
| `auth_sessions` | Hashed session tokens with expiry |
| `companies` | Tenant workspaces, owner user |
| `brand_brains` | One per company; guideline text and metadata |
| `brand_rules` | Active compliance rules (`version`, `extraction_run_id`) |
| `brand_rule_versions` | Append-only snapshots of every rule change |
| `extraction_runs` | Staged AI extraction proposals and status |
| `analyses` | One row per compliance analysis |
| `analysis_jobs` | Durable queue: status, attempts, backoff, lease |
| `assets` | Uploaded files, previews, checksums, dimensions |
| `alembic_version` | Migration head |

### Key invariants

- Every tenant-owned row is scoped by `company_id`; ownership is checked before access.
- A `BrandRule` change always writes a `BrandRuleVersion`.
- An `AnalysisJob` can only be claimed while `next_attempt_at <= now`.
- A failed provider call never produces a completed analysis.

---

## F. Environment Reference

Full template: `server/.env.example`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///…/data/inkloom.db` | SQLAlchemy URL; `postgresql://` is normalised to psycopg2; MongoDB is rejected |
| `DEBUG` | `true` | Dev CORS/localhost, cookie Secure default |
| `STORAGE_BACKEND` | `auto` | `auto` / `s3` / `local` |
| `STORAGE_DIR` | `server/storage` | Local upload root |
| `S3_BUCKET` | empty | Enables S3 when set with credentials |
| `S3_ENDPOINT_URL` | empty | R2/MinIO endpoint |
| `S3_REGION` | `auto` | S3 region |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | empty | S3 credentials (secret) |
| `S3_PREFIX` | `inkloom` | Object key prefix |
| `STORAGE_CACHE_DIR` | `server/.storage-cache` | Local materialisation for Pillow |
| `MAX_UPLOAD_SIZE_MB` | `15` | Upload limit |
| `VISION_PROVIDER` | `nvidia_nim` | `nvidia_nim` / `ollama` / `mock` |
| `NVIDIA_API_KEY` | empty | NVIDIA NIM key (secret) |
| `NVIDIA_VISION_MODEL` | `meta/llama-3.2-90b-vision-instruct` | Vision model |
| `OLLAMA_BASE_URL` / `OLLAMA_VISION_MODEL` | local | Local dev provider |
| `PIPELINE_MODE` | `ai` | `ai` or explicitly labelled `mock` |
| `EXTRACTION_PROVIDER` | `auto` | `auto` / `nvidia_nim` / `ollama` |
| `EXTRACTION_MODEL` | `nvidia/nemotron-3.5-lightning-30b-a3b` | Fast non-reasoning text model; hidden thinking is disabled automatically for reasoning-tuned tags |
| `EXTRACTION_MAX_RULES` | `80` | Proposal cap per run |
| `EXTRACTION_MAX_RULES_PER_CATEGORY` | `12` | Per-category cap for balanced coverage |
| `EXTRACTION_MAX_CHARS` | `60000` | Guideline read cap |
| `EXTRACTION_MAX_TOKENS` | `8192` | Completion budget; 80 rules need ~6–7k tokens |
| `EXTRACTION_TIMEOUT_SECONDS` | `180` | Extraction timeout (full guideline documents take 60–120s) |
| `RUN_EMBEDDED_WORKER` | `auto` | Embedded queue loop |
| `WORKER_ALLOW_LOCAL_ANALYSIS` | `false` | Standalone worker with local disk |
| `WORKER_POLL_INTERVAL_SECONDS` | `1.0` | Claim poll interval |
| `STALE_JOB_AFTER_SECONDS` | `300` | Lease recovery window |
| `MAX_JOB_ATTEMPTS` | `3` | Retry cap |
| `JOB_BACKOFF_BASE_SECONDS` | `10` | Backoff base |
| `JOB_BACKOFF_MAX_SECONDS` | `300` | Backoff cap |
| `SESSION_LIFETIME_DAYS` | `30` | Session expiry |
| `SESSION_COOKIE_NAME` | `inkloom_session` | HttpOnly cookie |
| `CSRF_COOKIE_NAME` | `inkloom_csrf` | Readable CSRF cookie |
| `COOKIE_SECURE` | auto | Secure cookies |
| `COOKIE_SAMESITE` | `lax` | `lax` / `none` / `strict` |
| `COOKIE_DOMAIN` | empty | Cookie domain override |
| `CORS_ORIGINS` | production domains | Exact allowed origins |
| `CORS_EXTRA_ORIGINS` | empty | Additional origins |
| `RATE_LIMIT_PER_MINUTE` | `120` | General rate limit |
| `AUTH_RATE_LIMIT_PER_MINUTE` | `10` | Login/register rate limit |
| `DEV_AUTH_TOKEN` / `DISABLE_DEV_AUTH` | empty / `false` | Local integration only |

Frontend:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_AI_API_URL` | Backend public URL baked at build time |
| `NEXT_PUBLIC_USE_MOCK` | Must be `false` in production |

---

## G. Testing Report

### Automated

```
cd server && .venv/bin/python -m pytest -q
59 passed, 3 warnings
```

- Covers health (fast + deep), auth, onboarding, brand brain, analysis lifecycle,
  tenant isolation, history, storage pathing, error contracts, large-rulebook
  batching, truncated-JSON salvage and transient provider retries.
- Alembic chain verified from an empty database:
  `9620a1694b6c → a77fc3c33808 → b3f1a2c4d5e6 → c7d8e9f0a1b2`.

### Production regression fixes found by live verification

| Symptom | Root cause | Fix |
| --- | --- | --- |
| Commit returned `500` | `brand_rules.source_type` was `varchar(30)` in the initial migration while the ORM declared `String(80)`; `ai_extraction:<uuid>` is 50 chars. SQLite does not enforce the limit, so tests passed. | Migration `c7d8e9f0a1b2` widens the column; production verified at `varchar(80)`. |
| 58-rule audit retried until failure | One compliance request for 58 rules exceeded the completion budget and returned truncated JSON; `parse_json_loose` raised `ValueError`. | Rules are evaluated in batches of 20, output budget is explicit, truncated JSON is salvaged, and only the affected batch degrades to inconclusive. |

**Live result after the fix:** a creative with deliberate prohibited claims was
audited against all **58** committed VELORA rules in **136s** across **3 batches**:
6 violations, 30 passed checks, 22 inconclusive. The report flagged
“CURES ACNE IN 3 DAYS” and “100% GUARANTEED RESULTS”.

### Frontend

```
npx tsc --noEmit        # 0 errors
npm run build           # 10 static routes generated successfully
```

### Live production verification (2026-11-11)

| Check | Result |
| --- | --- |
| `GET /api/v1/health` | `200`, ~0.37s, `database=connected`, `vision_status=configured`, `worker=embedded` |
| CORS preflight from frontend origin | `200` with `access-control-allow-origin` |
| Backend startup logs | `Application startup complete`, embedded worker started |
| Onboarding page | No “AI Server Offline” banner; `/api/v1/health` returns `200` |
| Registration | `POST /auth/register` → `201` |
| Login page deep link | `/login` → “Welcome back” |
| Register page deep link | `/register` → “Create your account” |
| **Use Demo** | Name `VELORA Skincare Laboratories`, industry text, guidelines length `8927` (exact match) |

> Note: `email-validator` rejects reserved TLDs such as `.test`. Use a normal domain when
> testing registration manually.

---

## H. Deployment Instructions

### Render services (current)

| Service | ID | URL |
| --- | --- | --- |
| Backend | `srv-dbnngou417fc73e8hdqg` | `https://inkloom-backend-yw07.onrender.com` |
| Frontend | `srv-dbnngou417fc73e8hdpg` | `https://inkloom-frontend-rwy2.onrender.com` |
| Postgres | `dpg-dbpplegae00c73c8opr0-a` | internal to Render |

Backend build: `pip install -r requirements.txt && alembic upgrade head`
Backend start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
Health check: `/api/v1/health`

### Repository note

Render auto-deploys from the **public** repository `shubhamos-ai/inkloomai`, while the
local `origin` remote is `shubhamos-ai/inkloomai-pvt`. Push to both (or re-link Render)
so commits trigger deploys:

```bash
git push origin main   # private
git push public main   # public — triggers Render
```

### Environment setup

1. Set `DATABASE_URL` to the Render Postgres **internal** connection string.
2. Set `NVIDIA_API_KEY`, `CORS_ORIGINS`, `CORS_EXTRA_ORIGINS`.
3. Keep `DEBUG=false`, `PIPELINE_MODE=ai`, `DISABLE_DEV_AUTH=true` in production.
4. For durable uploads, set `STORAGE_BACKEND=s3` plus `S3_*` credentials and either:
   - keep `RUN_EMBEDDED_WORKER=true` (single service), or
   - deploy the optional worker and set `RUN_EMBEDDED_WORKER=false`.

### Local

```bash
cd server
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m alembic upgrade head
.venv/bin/uvicorn app.main:app --reload
```

```bash
npm install --legacy-peer-deps
npm run dev
```

---

## I. Known Limitations

1. **Uploads are ephemeral on the current free Render backend.** No persistent disk is
   attached (`STORAGE_DIR=./storage`), so files survive a request but not a redeploy.
   Configure S3 to make them durable. The database itself is durable.
2. **The free Render Postgres expires on 2026-12-10.** Upgrade the plan or migrate the
   data before then.
3. **Free instances spin down after inactivity.** The first request can take 30–60s; the
   UI retries and shows a “connecting” state instead of a false outage.
4. **Background workers are a paid Render type.** The free deployment uses
   `RUN_EMBEDDED_WORKER=auto`; the optional worker block in `render.yaml` is commented out.
5. **The queue is SQL-backed, not a broker.** This is intentional for the free tier; it
   scales to modest concurrency, not high fan-out.
6. **Cookie sessions are same-site by default.** `SameSite=lax` works for
   `*.onrender.com`. A different registrable domain requires
   `COOKIE_SAMESITE=none` + `COOKIE_SECURE=true`.
7. **No email verification or password reset yet.** Accounts are created with
   email + password only.
8. **Extraction quality depends on the provider.** The staged review step exists so a
   human can correct proposals before they become enforceable rules.
9. **`mock` pipeline mode still exists for infrastructure tests**, but it must be set
   explicitly and is labelled; it is never a silent fallback.

---

## J. Submission Preparation

### Demo script

1. Open <https://inkloom-frontend-rwy2.onrender.com/onboarding>.
2. Register with a normal email domain (not `.test`).
3. Choose **Add organisation** → click **Use Demo**.
4. Show the prefilled VELORA name, industry and full guidelines text.
5. Click **Initialize Workspace** → land on the dashboard.
6. Open **Brand Brain** → start an extraction run → review proposed rules → commit.
7. Upload a creative on **Analyse** and show the queued → processing → completed flow.
8. Show rule version history and a report with severity, evidence quotes and remediation.
9. Sign out from the Sidebar; sign back in at `/login`.

### Talking points

- **Honest AI:** provider failures are retryable errors, never fake completed reports.
- **Human in the loop:** extraction proposes; the operator commits.
- **Auditability:** every rule change has a version snapshot and source quote.
- **Tenant isolation:** every query is scoped by verified company ownership.
- **Operational honesty:** health is fast and truthful; offline states are real.

### Pre-submission checklist

- [x] Backend tests pass (`59 passed`).
- [x] Frontend typecheck and production build pass.
- [x] Live health endpoint returns `200` with a connected database.
- [x] CORS allows the production frontend origin.
- [x] Registration, login and logout work end-to-end.
- [x] **Use Demo** fills the exact supplied VELORA content.
- [x] No secrets committed; Render key stored outside the repo.
- [ ] Configure S3 for durable uploads (required for persistence across deploys).
- [ ] Upgrade Postgres before the free instance expires (2026-12-10).

---

## Appendix: Single Render instance or two?

**Keep two services (current architecture).**

- Next.js needs a Node runtime; FastAPI needs Python. Render cannot run both native
  runtimes in one service.
- Combining them would require a Docker image with both runtimes or exporting the Next.js
  frontend as static files and mounting it inside FastAPI. Both add build complexity and
  lose Next.js server features.
- Two services also let the frontend and backend scale, deploy and roll back
  independently.
- The cost is two free instances and CORS/session configuration, which are already solved
  (CORS allow-list, cookie `SameSite=lax` for `*.onrender.com`, CSRF double-submit).

A single Docker service is only worth it if the deployment target charges per service and
the frontend can be a static export.
