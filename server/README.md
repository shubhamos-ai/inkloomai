# Inkloom AI — Backend

AI-powered advertising compliance & brand-governance platform. This is the **backend** (the
frontend lives in a sibling `client/` folder and calls `https://inkoom-model.shubhamos.com/api/v1`).

Current pipeline mode is **mock** and clearly labels every report with `is_mock: true` —
no fake AI results are ever produced. Once the Vision SLM (planned: `gemma3:4b` via Ollama)
finishes downloading, flip two env vars (see [Connecting the Vision SLM](#12-connecting-the-vision-slm)).

```
server/
├── app/
│   ├── main.py                  # FastAPI app, CORS, rate limit, error envelope
│   ├── config.py                # env-driven settings (.env)
│   ├── database.py              # engine/session; SQLite now, Postgres-ready
│   ├── models/                  # SQLAlchemy ORM (UUID PKs everywhere)
│   ├── schemas/                 # Pydantic request/response + report contract
│   ├── api/v1/                  # health, onboarding, brand_brain, analysis
│   ├── services/                # storage, jobs, analysis, ollama, brand brain
│   ├── engine/                  # vision / ocr / compliance / scoring engines
│   ├── worker.py                # restart-safe background worker
│   └── utils/                   # security, validators, rate limiter
├── alembic/                     # migrations (initial schema committed)
├── storage/                     # uploads/, brand_guidelines/, reports/
├── tests/                       # 33 automated tests
├── requirements.txt
└── .env.example                 # placeholders only — never real secrets
```

---

## 1. Installation

```bash
cd server
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## 2. Environment variables

```bash
cp .env.example .env
# Dev auth token (one line):
.venv/bin/python - <<'EOF'
import secrets, re, pathlib
p = pathlib.Path('.env'); t = p.read_text()
p.write_text(re.sub(r'^DEV_AUTH_TOKEN=.*$', 'DEV_AUTH_TOKEN=' + secrets.token_urlsafe(32), t, flags=re.M))
EOF
```

| Variable | Purpose | Default |
|---|---|---|
| `DEBUG` | Verbose errors (off in prod) | `true` |
| `DATABASE_URL` | SQLite locally / Postgres in prod | `sqlite:///./data/inkloom.db` |
| `STORAGE_DIR` | File tree root | `./storage` |
| `MAX_UPLOAD_SIZE_MB` | Image + doc size cap | `15` |
| `DEV_AUTH_TOKEN` | Shared dev bearer token (DEV MODE only) | set your own |
| `DISABLE_DEV_AUTH` | Kill-switch for dev auth | `false` |
| `CORS_ORIGINS` | Exact production origin | `https://inkoom-ai.shubhamos.com` |
| `CORS_EXTRA_ORIGINS` | Local dev origins (comma list) | empty |
| `RATE_LIMIT_PER_MINUTE` | Per-IP request cap | `120` |
| `OLLAMA_BASE_URL` | Local Ollama only — never tunnel this | `http://127.0.0.1:11434` |
| `OLLAMA_VISION_MODEL` | Vision SLM tag (empty until model ready) | empty |
| `PIPELINE_MODE` | `mock` \| `ai` | `mock` |
| `STALE_JOB_AFTER_SECONDS` | Crash-recovery threshold | `300` |
| `MAX_JOB_ATTEMPTS` | Survivable retries | `3` |

Dev auth mode is explicitly development-only: the company API key issued at onboarding
(`Authorization: Bearer ik_dev_…`) is the real credential; the shared `DEV_AUTH_TOKEN`
+ `X-Company-ID` header is for local integration. A browser-supplied company id is never
proof of ownership — the token is. Production sessions/tokens simply replace
`app/api/deps.py::resolve_context` (single interface point).

## 3. Database setup & migrations

```bash
.venv/bin/alembic upgrade head       # apply migrations
```

Schema: `users`, `companies`, `brand_brains`, `brand_rules`, `analyses`, `analysis_jobs`
(all UUID PKs, UTC timestamps, FK'd by company). Postgres migration is a URL change:
`DATABASE_URL=postgresql://user:pass@host:5432/inkloom` then re-run `alembic upgrade head`.

**Persistence guarantees**: never in-memory; analyses, rules, files survive restarts;
uploads are versioned under generated IDs (never file overwrite, never person names);
reports live in the DB as validated JSON plus an optional export file in `storage/reports/`.

## 4. Start the API server (bind to localhost only!)

```bash
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## 5. Start the worker (separate terminal)

```bash
.venv/bin/python -m app.worker
```

- Claims one queued job at a time → only one heavy inference runs at a time.
- At most one active analysis per company (enforced at submission).
- Persists `progress` + `current_stage` to the DB after each stage.
- Recovering: jobs orphaned by a crash are requeued (or failed after MAX_JOB_ATTEMPTS).
- Survives restarts; the queue lives in SQLite.

## 6. Cloudflare Tunnel

```bash
cloudflared tunnel create inkloom-model
# config: local service = http://127.0.0.1:8000, hostname = inkoom-model.shubhamos.com
cloudflared tunnel route dns inkloom-model inkoom-model.shubhamos.com
cloudflared tunnel run inkloom-model
```

> The tunnel provides connectivity, NOT authentication — auth is the API key layer in
> `app/api/deps.py`. Never route Ollama (port 11434) or the DB through the tunnel.

## 7–9. Endpoints, auth, request formats

Base URL: `http://127.0.0.1:8000/api/v1` (prod: `https://inkoom-model.shubhamos.com/api/v1`)

All protected endpoints require `Authorization: Bearer <token>` (company API key from
onboarding; errors are `401` otherwise. Foreign-company object ids return `404`, never 403,
to avoid existence leaks).

| Method | Path | Auth | Body |
|---|---|---|---|
| GET | `/health` | none | — |
| POST | `/onboarding` | none | JSON |
| GET | `/onboarding/check` | token | — |
| POST | `/brand-brain` | token | multipart (`rules_text` and/or `files[]` PDF/TXT/DOCX) |
| GET | `/brand-brain` | token | — |
| GET | `/brand-brain/rules` | token | — |
| POST | `/brand-brain/rules` | token | JSON (manual rule) |
| PUT | `/brand-brain/rules` | token | JSON (`rule_id` + fields; `source_text` never editable) |
| POST | `/brand-brain/extract` | token | — (AI hook) |
| POST | `/analysis` | token | multipart, field `file` (image) |
| GET | `/analysis/history?page&limit&status` | token | — |
| GET | `/analysis/{id}/status` | token | — |
| GET | `/analysis/{id}` | token | report or `409 analysis_not_completed` |
| GET | `/analysis/{id}/image` | token | the stored upload |
| POST | `/analysis/{id}/cancel` | token | queued only |

### curl — health

```bash
curl http://127.0.0.1:8000/api/v1/health
# {"status":"online","service":"Inkloom AI","version":"1.0.0","database":"connected",
#  "ollama_status":"not_configured","vision_model":null,"pipeline_mode":"mock"}
```

### curl — onboarding

```bash
curl -s -X POST http://127.0.0.1:8000/api/v1/onboarding \
  -H 'Content-Type: application/json' \
  -d '{"name":"User Name","company_name":"Company Name","industry":"Technology",
       "website":"https://example.com","email":"user@example.com"}'
# {"user_id":"...","company_id":"...","access_token":"ik_dev_...", "token_type":"bearer",
#  "auth_mode":"dev","message":"Store the access token now — it is shown only once."}
```

Export the token for later calls (the key is hashed at rest and cannot be re-retrieved):

```bash
TOKEN=ik_dev_xxx
```

### curl — brand brain intake / read / rules

```bash
# Text + a guideline file (TXT, PDF, DOCX all accepted; validation reads real bytes)
curl -s -X POST http://127.0.0.1:8000/api/v1/brand-brain \
  -H "Authorization: Bearer $TOKEN" \
  -F 'rules_text=The logo stays top-right. Headlines end with a period.' \
  -F 'files=@brand-guidelines.pdf;type=application/pdf'

# Current brain snapshot (rule counts, extraction status, ollama status)
curl -s http://127.0.0.1:8000/api/v1/brand-brain -H "Authorization: Bearer $TOKEN"

# Structured rules (ids, category, severity, requirement, source wording, enabled)
curl -s http://127.0.0.1:8000/api/v1/brand-brain/rules -H "Authorization: Bearer $TOKEN"

# Hand-add a rule (rule codes BR001… are assigned by the server)
curl -s -X POST http://127.0.0.1:8000/api/v1/brand-brain/rules \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"category":"logo","requirement":"Keep logo in the top-right corner.",
       "severity":"critical","source_text":"The logo must remain top-right at all times."}'

# Update a rule (PUT; source_text is immutable by design)
curl -s -X PUT http://127.0.0.1:8000/api/v1/brand-brain/rules \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"rule_id":"<rule-uuid>","severity":"minor","enabled":false}'
```

### curl — analysis (submit → poll → report)

```bash
# POST creates the persistent record + queue job and returns immediately (202):
curl -s -X POST http://127.0.0.1:8000/api/v1/analysis \
  -H "Authorization: Bearer $TOKEN" \
  -F 'file=@ad.png;type=image/png'
# {"analysis_id":"...","status":"queued","message":"Advertisement queued for analysis"}

# GET status — poll this every ~1.5s while status is queued|processing
curl -s http://127.0.0.1:8000/api/v1/analysis/<id>/status -H "Authorization: Bearer $TOKEN"
# {"analysis_id":"...","status":"processing","progress":45,"current_stage":"Checking brand policies"}

# GET the full report (409 + `analysis_not_completed` until status == completed)
curl -s http://127.0.0.1:8000/api/v1/analysis/<id> -H "Authorization: Bearer $TOKEN"

# History (newest first, paginated)
curl -s "http://127.0.0.1:8000/api/v1/analysis/history?page=1&limit=10" -H "Authorization: Bearer $TOKEN"

# Cancel a queued analysis / fetch the stored image
curl -s -X POST http://127.0.0.1:8000/api/v1/analysis/<id>/cancel -H "Authorization: Bearer $TOKEN"
curl -s -o ad.png http://127.0.0.1:8000/api/v1/analysis/<id>/image -H "Authorization: Bearer $TOKEN"
```

Upload validation: images only (`PNG/JPEG/WebP` verified by **actual bytes**, not extension),
≤15 MB, 64–8000 px per side; `.docx/.pdf/.txt` validated by real parsing. Invalid → `422`.

## 10. Error response format

```json
{"detail": {"error": "machine_readable_code", "message": "Human-readable sentence."}}
```

Codes: `missing_auth`, `invalid_token`, `unknown_company`, `company_id_required` (dev mode),
`analysis_in_progress` (409), `analysis_not_completed` (409), `invalid_image`,
`invalid_document`, `nothing_provided`, `too_many_files`, `rate_limited` (429 + `Retry-After`),
`validation_error` (422), `internal_error` (500, never leaks paths/stack traces in prod).

## 11. Frontend polling guidance

```js
async function waitForReport(token, analysisId, {onTick} = {}) {
  while (true) {
    const s = await fetch(`${API}/analysis/${analysisId}/status`,
      {headers: {Authorization: `Bearer ${token}`}}).then(r => r.json());
    onTick?.(s);                                  // progress bar: s.progress, s.current_stage
    if (s.status === 'completed')                break;
    if (s.status === 'failed' || s.status === 'cancelled') throw new Error(s.current_stage);
    await new Promise(r => setTimeout(r, 1500)); // ~1.5s; a full mock run takes <5s
  }
  return fetch(`${API}/analysis/${analysisId}`, {headers: {Authorization: `Bearer ${token}`}})
         .then(r => { if (r.status === 409) throw new Error('not ready'); return r.json(); });
}
```

Rules: poll status only (never the report endpoint in a loop); stop after ~10 minutes;
treat 401 as re-onboarding needed; mock reports carry `analysis_metadata.is_mock === true`
and `overall_status: "inconclusive"` with `compliance_score: null`.

## 12. Connecting the Vision SLM

1. Confirm the model is pulled: `ollama list` (gemma3:4b works; any vision-capable tag works too,
   e.g. `qwen3-vl:2b`).
2. In `server/.env` set:

   ```
   OLLAMA_VISION_MODEL=gemma3:4b
   PIPELINE_MODE=ai
   ```

3. Restart the worker. `GET /health` flips `ollama_status` to `ready` with `vision_model: gemma3:4b`.
4. Real runs now produce vision observations + OCR + per-rule verdicts scored by the
   deterministic scoring engine (`engine/scoring_engine.py`): deductions by severity
   (critical 30 / major 18 / minor 10 / info 4), ≥0.5 confidence required, and
   score ≥90 → `passed`, ≥60 → `needs_revision`, else `critical_failure`.

If Ollama or the model is missing at inference time, the pipeline degrades to a clearly
labelled inconclusive mock draft (`is_mock: true`) — it never fabricates findings.

**Behaviour notes (tested with `gemma3:4b`):**
- OCR: until a dedicated OCR engine is installed, the `vision_transcription` source feeds
  compliance with real text the SLM transcribed from the image (`analysis_metadata.ocr_source`).
- Vision inference on CPU takes ~20–40s per call; a full run is typically 1–2 minutes.
- Model JSON is normalised defensively: rule-id variants (`br-002`, uuids) are matched,
  bad severities/states/confidences degrade to safe defaults, unknown/missing findings are
  recorded honestly as `inconclusive`, and one retry is made when a run returns no findings.
- Scoring stays deterministic Python regardless of model output (see scoring_engine).

## 13. Tests

```bash
.venv/bin/python -m pytest tests -q     # 33 passed
```

Covers: health, onboarding, auth (api-key + dev + rejection), brand-brain intake + files,
rule CRUD/serve preservation, image validation (forged bytes, oversize, tiny, wrong type),
job creation, status polling, mock completion, history pagination/filtering, company
isolation (endpoints, files, rules), queue cancellation, and stale-job recovery.
