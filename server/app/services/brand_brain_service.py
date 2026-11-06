"""Brand Brain service.

Intake today: persists the company's ORIGINAL material verbatim (text and
files), snapshots uploads, and lets the company hand-maintain structured rules
with provenance (`source_text` per rule).

Tomorrow: `extract_structured_rules()` is the AI hook — once the Vision SLM /
text model is connected it converts original material into BrandRule rows
while keeping each rule's exact source wording. It never invents rules.
"""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import BrandBrain, BrandRule, Company
from app.schemas.brand_brain import BrandRuleOut
from app.services import storage_service
from app.utils.validators import ExtractedDocument, validate_guideline_document

MAX_TEXT_CHARS = 200_000


def get_or_create_brain(db: Session, company: Company) -> BrandBrain:
    brain = db.scalar(select(BrandBrain).where(BrandBrain.company_id == company.id))
    if brain is None:
        # Rows are created only through upload; an empty placeholder is safe:
        # original_rules_text is required at the DB level, so store "" default
        # and flip extraction_status to 'pending'.
        brain = BrandBrain(company_id=company.id, original_rules_text="")
        db.add(brain)
        db.flush()
    return brain


def append_intake(
    db: Session,
    company: Company,
    *,
    rules_text: str = "",
    documents: list[ExtractedDocument] | None = None,
    file_payloads: list[tuple[str, bytes]] | None = None,
) -> BrandBrain:
    """Append a new intake 'session' to the company's Brand Brain.

    - rules_text is added verbatim, separated by a version marker.
    - document bytes are written to storage and referenced.
    - extracted text (PDF/DOCX) is appended as *snapshot material*.
    """
    documents = documents or []
    file_payloads = file_payloads or []
    brain = get_or_create_brain(db, company)
    brain.version += 1

    chunks: list[str] = [f"=== Version {brain.version} ==="]

    if rules_text.strip():
        chunks.append(rules_text.strip())

    for (name, data), doc in zip(file_payloads, documents):
        if data:
            rel = storage_service.write_guideline_file(
                company.id, brain.id, brain.version,
                data=data, original_name=name, kind=doc.kind,
            )
            brain.file_count += 1
            brain.files_dir = str(
                storage_service.abs_path_for(rel).parent.relative_to(
                    storage_service.abs_path_for("brand_guidelines").parent
                )
            )
        if doc.text:
            chunks.append(f'--- extracted from "{name}" ---\n{doc.text}')

    addition = "\n\n".join(chunks)
    if addition.strip():
        original = f"{brain.original_rules_text}\n\n{addition}" if brain.original_rules_text else addition
        brain.original_rules_text = original[:MAX_TEXT_CHARS]
    brain.extraction_status = "manual"

    db.flush()
    return brain


def _next_code(db: Session, company_id: uuid.UUID) -> str:
    count = len(
        db.scalars(select(BrandRule.code).where(BrandRule.company_id == company_id)).all()
    )
    return f"BR{(count + 1):03d}"


def add_manual_rule(
    db: Session, company: Company, *, category: str, requirement: str,
    severity: str, source_text: str,
) -> BrandRule:
    brain = get_or_create_brain(db, company)
    rule = BrandRule(
        company_id=company.id,
        brain_id=brain.id,
        code=_next_code(db, company.id),
        category=category.strip().lower().replace(" ", "_")[:60] or "general",
        requirement=requirement.strip(),
        severity=severity,
        # Provenance: the company's own wording, untouched.
        source_text=source_text.strip() or requirement.strip(),
        source_type="manual",
    )
    db.add(rule)
    db.flush()
    return rule


def update_rule(
    db: Session, company: Company, rule_id: uuid.UUID, *, fields: dict
) -> BrandRule | None:
    """Authorised partial update. source_text is never modified here."""
    rule = db.get(BrandRule, rule_id)
    if rule is None or rule.company_id != company.id:  # company isolation
        return None
    for key in ("category", "requirement", "severity", "enabled"):
        if key in fields and fields[key] is not None:
            setattr(rule, key, fields[key])
    db.flush()
    return rule


def rules_for(db: Session, company: Company) -> list[BrandRule]:
    return list(
        db.scalars(
            select(BrandRule)
            .where(BrandRule.company_id == company.id)
            .order_by(BrandRule.code)
        ).all()
    )


def rule_to_out(rule: BrandRule) -> dict:
    return BrandRuleOut.model_validate(rule, from_attributes=True).model_dump(mode="json")


def enabled_rules_as_dicts(db: Session, company: Company) -> tuple[str, list[dict]]:
    """Rules asserted for the analysis pipeline (deterministic order = code)."""
    rules = [
        r
        for r in rules_for(db, company)
        if r.enabled
    ]
    return (
        "manual",
        [
            {
                "id": str(r.id),
                "code": r.code,
                "category": r.category,
                "requirement": r.requirement,
                "severity": r.severity,
                "source_text": r.source_text,
            }
            for r in rules
        ],
    )
