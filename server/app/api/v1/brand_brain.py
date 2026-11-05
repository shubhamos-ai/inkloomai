"""Brand Brain endpoints (multipart intake + rules read/update)."""
from __future__ import annotations

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
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
from app.utils.validators import DocumentValidationError, validate_guideline_document

router = APIRouter(prefix="/brand-brain", tags=["brand_brain"])

MAX_DOC_BYTES = 20 * 1024 * 1024
MAX_FILES = 10


# ---------------------------------------------------------------------------
# Intake (multipart). Accepts rules text and/or PDF/TXT/DOCX files.
# ---------------------------------------------------------------------------

@router.post("")
def upload_brand_brain(
    db: Session = Depends(get_db),
    company: Company = Depends(current_company),
    rules_text: str | None = Form(default=None, max_length=200_000),
    files: list[UploadFile] | None = File(default=None),
):
    """POST /brand-brain — ingest brand guidelines (text and/or documents).

    All original material is stored verbatim and versioned. AI structuring
    runs later via brand_brain_service.extract_structured_rules() (hook ready);
    nothing here invents rules.
    """
    if not rules_text and not files:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "nothing_provided",
                "message": "Send at least one of: rules_text or guideline files.",
            },
        )
    files = files or []
    if len(files) > MAX_FILES:
        raise HTTPException(
            status_code=422,
            detail={"error": "too_many_files", "message": f"Maximum {MAX_FILES} files per intake."},
        )

    extracted, payloads, file_results = [], [], []
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
        file_results.append(
            GuidelineFileOut(
                filename=sanitize_filename(filename),
                size_bytes=len(data),
                extracted_chars=len(doc.text or ""),
                kind=doc.kind,  # type: ignore[arg-type]
                ok=doc.ok,
                note=doc.note,
            )
        )

    brand_brain_service.append_intake(
        db, company,
        rules_text=rules_text or "",
        documents=extracted,
        file_payloads=payloads,
    )
    db.commit()

    brain = brand_brain_service.get_or_create_brain(db, company)
    return _brain_response(db, company, files=file_results)


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


@router.put("/rules", response_model=BrandRuleOut)
def update_rule(
    payload: BrandRuleUpdate,
    db: Session = Depends(get_db),
    company: Company = Depends(current_company),
):
    """PUT /brand-brain/rules — authorised partial update.

    `source_text` is immutable: original wording is preserved by design. Pass
    either rule_id in the JSON body (spec shape) — the payload binding keeps the
    frontend contract simple.
    """
    rule_id = payload.rule_id
    if rule_id is None:
        raise HTTPException(
            status_code=422,
            detail={"error": "rule_id_required", "message": "rule_id is required in the request body."},
        )
    rule = brand_brain_service.update_rule(
        db, company, rule_id,
        fields={
            "category": payload.category, "requirement": payload.requirement,
            "severity": payload.severity, "enabled": payload.enabled,
        },
    )
    if rule is None:
        raise HTTPException(
            status_code=404, detail={"error": "not_found", "message": "Rule not found for this company."}
        )
    db.commit()
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
