"""Brand Brain endpoints (multipart intake + rules read/update)."""
from __future__ import annotations

import base64
import json

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app.api.deps import current_company
from app.config import settings
from app.database import get_db
from app.models import Company
from app.schemas.brand_brain import (
    BrandBrainOut,
    BrandRuleCreate,
    BrandRuleOut,
    BrandRuleUpdate,
    BrandRulesListResponse,
    GuidelineFileOut,
)
from app.services import brand_brain_service, ollama_service
from app.utils.security import sanitize_filename
from app.utils.validators import (
    DocumentValidationError,
    ExtractedDocument,
    validate_guideline_document,
)

router = APIRouter(prefix="/brand-brain", tags=["brand_brain"])

MAX_DOC_BYTES = 20 * 1024 * 1024
MAX_FILES = 10


def file_results(
    extracted: list[ExtractedDocument],
    payloads: list[tuple[str, bytes]],
    uploads: list[UploadFile],
) -> list[GuidelineFileOut]:
    """Describe ingested files for the response (real uploads + meta-only)."""
    upload_types = {u.filename or "": u.content_type for u in uploads}
    results: list[GuidelineFileOut] = []
    for (name, data), doc in zip(payloads, extracted):
        results.append(
            GuidelineFileOut(
                filename=sanitize_filename(name),
                size_bytes=len(data),
                extracted_chars=len(doc.text or ""),
                kind=doc.kind,  # type: ignore[arg-type]
                ok=doc.ok,
                note=doc.note or ("from file metadata" if name not in upload_types else ""),
            )
        )
    return results


# ---------------------------------------------------------------------------
# Intake (multipart). Accepts rules text and/or PDF/TXT/DOCX files.
# ---------------------------------------------------------------------------

@router.post("")
def upload_brand_brain(
    db: Session = Depends(get_db),
    company: Company = Depends(current_company),
    rules_text: str | None = Form(default=None, max_length=200_000),
    guidelines_text: str | None = Form(default=None, max_length=200_000),
    rules: str | None = Form(default=None, max_length=400_000),
    files_meta: str | None = Form(default=None, max_length=200_000),
    files: list[UploadFile] | None = File(default=None),
):
    """POST /brand-brain — ingest brand guidelines (text and/or documents).

    Accepts multipart fields:
    - `rules_text` OR `guidelines_text` (alias): the raw rules text.
    - `rules`: optional JSON array of hand-built rules from the frontend.
    - `files`: real uploaded PDF/TXT/DOCX binaries.
    - `files_meta`: optional JSON array [{name, size, type, content?}] describing
      files; when a base64/text `content` is present it is ingested as text.
    Extra fields (company_name, industry, website) are accepted and ignored.

    All original material is stored verbatim and versioned. AI structuring
    runs later; nothing here invents rules.
    """
    rules_text = (rules_text or guidelines_text or "").strip()

    # Real multipart binaries first (they are the source of truth).
    files = files or []
    if len(files) > MAX_FILES:
        raise HTTPException(
            status_code=422,
            detail={"error": "too_many_files", "message": f"Maximum {MAX_FILES} files per intake."},
        )

    extracted, payloads = [], []
    for upload in files:
        data = upload.file.read()
        filename = upload.filename or ""
        try:
            doc = validate_guideline_document(
                data=data, filename=filename,
                content_type=upload.content_type or "application/octet-stream",
                max_bytes=MAX_DOC_BYTES,
            )
        except DocumentValidationError as exc:
            raise HTTPException(
                status_code=422,
                detail={"error": "invalid_document", "message": str(exc)},
            )
        extracted.append(doc)
        payloads.append((filename, data))

    # Metadata-only uploads: ingest any embedded text contents verbatimly.
    meta_items: list[dict] = []
    if files_meta:
        try:
            parsed_meta = json.loads(files_meta)
            meta_items = parsed_meta if isinstance(parsed_meta, list) else [parsed_meta]
        except (ValueError, TypeError):
            meta_items = []
    for item in meta_items:
        if not isinstance(item, dict):
            continue
        content = item.get("content")
        if isinstance(content, str) and content.strip():
            # base64 content support (data:... or raw base64 of a text file)
            body = content
            if item.get("type") not in (None, "text/plain", "") and content.startswith("data:"):
                try:
                    body = base64.b64decode(content.split(",", 1)[-1]).decode(
                        "utf-8", errors="replace"
                    )
                except Exception:
                    body = content
            elif content and not content.isprintable() is False:
                pass  # keep as-is
            doc = ExtractedDocument(kind="txt", text=body.strip(), ok=True, note="from files_meta")
            extracted.append(doc)
            payloads.append((item.get("name") or "meta.txt", b""))

    # Frontend-built rules (JSON array of {category, requirement, severity, source_text})
    created_rules = 0
    if rules:
        try:
            parsed_rules = json.loads(rules)
            parsed_rules = parsed_rules if isinstance(parsed_rules, list) else [parsed_rules]
        except (ValueError, TypeError):
            parsed_rules = []
        for r in parsed_rules:
            if not isinstance(r, dict):
                continue
            requirement = str(r.get("requirement") or r.get("description") or "").strip()
            if not requirement:
                continue
            brand_brain_service.add_manual_rule(
                db, company,
                category=str(r.get("category") or "general")[:60],
                requirement=requirement[:4000],
                severity=(r.get("severity") or "major")[:20],
                source_text=str(r.get("source_text") or requirement)[:8000],
            )
            created_rules += 1

    if not rules_text and not extracted and not created_rules and not payloads:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "nothing_provided",
                "message": "Send at least one of: rules_text/guidelines_text, files, or rules.",
            },
        )

    brand_brain_service.append_intake(
        db, company,
        rules_text=rules_text,
        documents=extracted,
        file_payloads=payloads,
    )
    # Only commit when something got appended (manual rules are committed together).
    db.commit()

    brain = brand_brain_service.get_or_create_brain(db, company)
    return _brain_response(db, company, files=file_results(extracted, payloads, files)) | {
        "job_id": str(brain.id),
        "status": "completed",
    }


# ---------------------------------------------------------------------------
# Status / retrieval
# ---------------------------------------------------------------------------

@router.get("")
def get_brand_brain(db: Session = Depends(get_db), company: Company = Depends(current_company)):
    """GET /brand-brain — the company's current Brand Brain snapshot."""
    return _brain_response(db, company)


def _brain_response(db: Session, company: Company, files=None):
    brain = brand_brain_service.get_or_create_brain(db, company)
    rules = brand_brain_service.rules_for(db, company)
    out = {
        "company_id": str(company.id),
        "version": brain.version,
        "original_rules_text": brain.original_rules_text,
        "structured_rules": brain.structured_rules,
        "file_count": brain.file_count,
        "extraction_status": brain.extraction_status,
        "updated_at": brain.updated_at.isoformat() + "Z",
        "rule_count": len(rules),
        "enabled_rule_count": sum(1 for r in rules if r.enabled),
        "ollama_status": ollama_service.check_status()["status"],
    }
    if files is not None:
        out["processed_files"] = [f for f in files]
    return out


# ---------------------------------------------------------------------------
# Structured rules
# ---------------------------------------------------------------------------

@router.get("/rules", response_model=BrandRulesListResponse)
def list_rules(db: Session = Depends(get_db), company: Company = Depends(current_company)):
    rules = brand_brain_service.rules_for(db, company)
    brain = brand_brain_service.get_or_create_brain(db, company)
    return BrandRulesListResponse(
        company_id=str(company.id),
        brain_version=brain.version,
        count=len(rules),
        rules=[BrandRuleOut.model_validate(r, from_attributes=True) for r in rules],
    )


@router.post("/rules", response_model=BrandRuleOut)
def create_rule(
    payload: BrandRuleCreate,
    db: Session = Depends(get_db),
    company: Company = Depends(current_company),
):
    """POST /brand-brain/rules — hand-add a rule (source_type='manual')."""
    rule = brand_brain_service.add_manual_rule(
        db, company,
        category=payload.category,
        requirement=payload.requirement,
        severity=payload.severity,
        source_text=payload.source_text,
    )
    db.commit()
    return rule


@router.put("/rules")
def update_rules(
    payload: dict,
    db: Session = Depends(get_db),
    company: Company = Depends(current_company),
):
    """PUT /brand-brain/rules — authorised rule updates.

    Two accepted shapes:
    - {"rule_id": "<uuid>", ...fields}          -> single-rule update (spec);
      returns the updated rule object directly and 404 when not found.
    - {"rules": [{id|code|rule_id, enabled?,    -> batch updates;
                 category?, severity?, requirement?}], "rules_text"?}
      returns {"updated": [...], "skipped": [...], "count": n}.

    `source_text` is immutable: original wording is preserved by design.
    Rules are resolved by uuid or code; unknown/foreign batch rules are skipped.
    """
    rules_field = payload.get("rules")
    is_batch = isinstance(rules_field, list)
    entries = [r for r in rules_field if isinstance(r, dict)] if is_batch else [payload]

    def _extract_fields(entry: dict) -> dict:
        fields: dict = {}
        category = entry.get("category")
        if category is not None and str(category).strip():
            fields["category"] = str(category).strip()[:60]
        if "enabled" in entry:
            fields["enabled"] = bool(entry["enabled"])
        elif "isActive" in entry:
            fields["enabled"] = bool(entry["isActive"])
        if entry.get("severity"):
            fields["severity"] = str(entry["severity"]).strip()[:20]
        requirement = entry.get("requirement") or entry.get("description")
        if requirement and str(requirement).strip():
            fields["requirement"] = str(requirement).strip()[:4000]
        return fields

    if not is_batch:
        # ---- single-rule (spec) shape ---------------------------------
        rule = None
        for key in ("rule_id", "id", "uuid", "code"):
            value = payload.get(key)
            if value:
                rule = _find_rule(db, company, value)
                if rule:
                    break
        if rule is None:
            if not any(payload.get(k) for k in ("rule_id", "id", "uuid", "code")):
                raise HTTPException(
                    status_code=422,
                    detail={
                        "error": "rule_id_required",
                        "message": "rule_id is required in the request body.",
                    },
                )
            raise HTTPException(
                status_code=404,
                detail={"error": "not_found", "message": "Rule not found for this company."},
            )
        changed = brand_brain_service.update_rule(db, company, rule.id, fields=_extract_fields(payload))
        if changed is None:
            raise HTTPException(
                status_code=404,
                detail={"error": "not_found", "message": "Rule not found for this company."},
            )
        db.commit()
        return jsonable_encoder(BrandRuleOut.model_validate(rule, from_attributes=True))

    # ---- batch shape --------------------------------------------------
    updated, skipped = [], []
    for entry in entries:
        rule = None
        for key in ("id", "rule_id", "uuid", "code"):
            value = entry.get(key)
            if value:
                rule = _find_rule(db, company, value)
                if rule:
                    break
        if rule is None:
            skipped.append({k: entry[k] for k in ("id", "code", "rule_id") if k in entry})
            continue
        changed = brand_brain_service.update_rule(db, company, rule.id, fields=_extract_fields(entry))
        if changed is not None:
            updated.append(rule_to_out_dict(rule))

    # Optional rules text sync: append only when the text is genuinely new.
    rules_text = payload.get("rules_text")
    if isinstance(rules_text, str) and rules_text.strip():
        brain = brand_brain_service.get_or_create_brain(db, company)
        if rules_text.strip() not in (brain.original_rules_text or ""):
            brand_brain_service.append_intake(db, company, rules_text=rules_text)

    db.commit()
    return {"updated": updated, "skipped": skipped, "count": len(updated)}


def rule_to_out_dict(rule) -> dict:
    return jsonable_encoder(BrandRuleOut.model_validate(rule, from_attributes=True))


def _find_rule(db: Session, company: Company, key: str):
    """Resolve a rule by uuid, code, or 'rule_id' string for a company."""
    import uuid as _uuid

    from sqlalchemy import select

    from app.models import BrandRule

    key = str(key).strip()
    rule = None
    try:
        cid = _uuid.UUID(key)
        rule = db.scalar(
            select(BrandRule).where(BrandRule.id == cid, BrandRule.company_id == company.id)
        )
        if rule:
            return rule
    except ValueError:
        pass
    code = key.upper()
    rule = db.scalar(
        select(BrandRule).where(BrandRule.code == code, BrandRule.company_id == company.id)
    )
    return rule


# ---------------------------------------------------------------------------
# Future AI hook (documented, not wired until the model is available)
# ---------------------------------------------------------------------------

@router.post("/extract")
def trigger_extraction(db: Session = Depends(get_db), company: Company = Depends(current_company)):
    """
    Placeholder for AI-automated structuring of the brand brain.

    Once the vision/text model is connected this endpoint enqueues an
    extraction job that converts `original_rules_text` into BrandRule rows while
    copying each rule's exact `source_text`. Until then it reports honest state.
    """
    brain = brand_brain_service.get_or_create_brain(db, company)
    return {
        "company_id": str(company.id),
        "extraction_status": brain.extraction_status,
        "auto_extraction_available": False,
        "message": (
            "Automatic rule extraction will start once the Vision SLM is connected. "
            "Structured rules can be hand-managed via /rules meanwhile."
        ),
    }
