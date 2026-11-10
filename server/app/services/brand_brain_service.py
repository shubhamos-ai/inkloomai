"""Brand Brain service.

Intake persists the company's ORIGINAL material verbatim (text and files),
snapshots uploads into durable storage, and lets the company maintain
structured rules with provenance (`source_text` per rule).

Every rule mutation writes an immutable `brand_rule_versions` snapshot.
AI extraction proposals live in `extraction_runs` until a human commits them.
"""
from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import BrandBrain, BrandRule, BrandRuleVersion, Company
from app.schemas.brand_brain import BrandRuleOut
from app.services import asset_service, storage_service
from app.utils.validators import ExtractedDocument

MAX_TEXT_CHARS = 200_000


def get_or_create_brain(db: Session, company: Company) -> BrandBrain:
    brain = db.scalar(select(BrandBrain).where(BrandBrain.company_id == company.id))
    if brain is None:
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
    - document bytes are written to durable storage and indexed as Assets.
    - extracted text (PDF/DOCX) is appended as snapshot material.
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
                company.id,
                brain.id,
                brain.version,
                data=data,
                original_name=name,
                kind=doc.kind,
                content_type=_content_type_for(doc.kind),
            )
            brain.file_count += 1
            brain.files_dir = f"brand_guidelines/{company.id}/{brain.id}/v{brain.version}"
            asset_service.record_asset(
                db,
                company_id=company.id,
                brain_id=brain.id,
                kind="guideline",
                object_key=rel,
                original_filename=name,
                content_type=_content_type_for(doc.kind),
                data=data,
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


def _content_type_for(kind: str) -> str:
    return {
        "pdf": "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "txt": "text/plain",
    }.get(kind, "application/octet-stream")


def _next_code(db: Session, company_id: uuid.UUID) -> str:
    """Allocate the next BR### code without collisions after deletes."""
    codes = db.scalars(
        select(BrandRule.code).where(BrandRule.company_id == company_id)
    ).all()
    highest = 0
    for code in codes:
        if code and code.startswith("BR"):
            try:
                highest = max(highest, int(code[2:]))
            except ValueError:
                continue
    return f"BR{highest + 1:03d}"


def snapshot_rule(rule: BrandRule) -> dict:
    return {
        "id": str(rule.id),
        "code": rule.code,
        "category": rule.category,
        "requirement": rule.requirement,
        "severity": rule.severity,
        "source_text": rule.source_text,
        "source_type": rule.source_type,
        "enabled": rule.enabled,
        "version": rule.version,
        "extraction_run_id": str(rule.extraction_run_id) if rule.extraction_run_id else None,
    }


def record_version(
    db: Session,
    company_id: uuid.UUID,
    rule: BrandRule,
    *,
    change_type: str,
    user_id: Optional[uuid.UUID] = None,
    extraction_run_id: Optional[uuid.UUID] = None,
) -> BrandRuleVersion:
    version = BrandRuleVersion(
        company_id=company_id,
        rule_id=rule.id,
        version=rule.version,
        change_type=change_type,
        snapshot=snapshot_rule(rule),
        changed_by_user_id=user_id,
        extraction_run_id=extraction_run_id or rule.extraction_run_id,
    )
    db.add(version)
    return version


def create_rule(
    db: Session,
    company: Company,
    *,
    category: str,
    requirement: str,
    severity: str,
    source_text: str,
    source_type: str = "manual",
    extraction_run_id: Optional[uuid.UUID] = None,
    user_id: Optional[uuid.UUID] = None,
    change_type: str = "created",
) -> BrandRule:
    brain = get_or_create_brain(db, company)
    rule = BrandRule(
        company_id=company.id,
        brain_id=brain.id,
        code=_next_code(db, company.id),
        category=category.strip().lower().replace(" ", "_")[:60] or "general",
        requirement=requirement.strip(),
        severity=severity,
        source_text=source_text.strip() or requirement.strip(),
        source_type=source_type[:80],
        extraction_run_id=extraction_run_id,
        version=1,
    )
    db.add(rule)
    db.flush()
    record_version(
        db,
        company.id,
        rule,
        change_type=change_type,
        user_id=user_id,
        extraction_run_id=extraction_run_id,
    )
    return rule


def add_manual_rule(
    db: Session,
    company: Company,
    *,
    category: str,
    requirement: str,
    severity: str,
    source_text: str,
    user_id: Optional[uuid.UUID] = None,
) -> BrandRule:
    return create_rule(
        db,
        company,
        category=category,
        requirement=requirement,
        severity=severity,
        source_text=source_text,
        source_type="manual",
        user_id=user_id,
    )


def update_rule(
    db: Session,
    company: Company,
    rule_id: uuid.UUID,
    *,
    fields: dict,
    user_id: Optional[uuid.UUID] = None,
) -> BrandRule | None:
    """Authorised partial update. source_text is never modified here."""
    rule = db.get(BrandRule, rule_id)
    if rule is None or rule.company_id != company.id:  # company isolation
        return None
    changed = False
    for key in ("category", "requirement", "severity", "enabled"):
        if key in fields and fields[key] is not None and getattr(rule, key) != fields[key]:
            setattr(rule, key, fields[key])
            changed = True
    if changed:
        rule.version += 1
        record_version(db, company.id, rule, change_type="updated", user_id=user_id)
    db.flush()
    return rule


def delete_rule(
    db: Session,
    company: Company,
    rule_id: uuid.UUID,
    *,
    user_id: Optional[uuid.UUID] = None,
) -> bool:
    """Delete a rule after writing a final history snapshot."""
    rule = db.get(BrandRule, rule_id)
    if rule is None or rule.company_id != company.id:
        return False
    record_version(db, company.id, rule, change_type="deleted", user_id=user_id)
    db.delete(rule)
    db.flush()
    return True


def rules_for(db: Session, company: Company) -> list[BrandRule]:
    return list(
        db.scalars(
            select(BrandRule)
            .where(BrandRule.company_id == company.id)
            .order_by(BrandRule.code)
        ).all()
    )


def versions_for(
    db: Session, company: Company, *, rule_id: Optional[uuid.UUID] = None, limit: int = 100
) -> list[BrandRuleVersion]:
    query = select(BrandRuleVersion).where(BrandRuleVersion.company_id == company.id)
    if rule_id is not None:
        query = query.where(BrandRuleVersion.rule_id == rule_id)
    return list(
        db.scalars(
            query.order_by(BrandRuleVersion.created_at.desc()).limit(max(1, min(limit, 500)))
        ).all()
    )


def rule_to_out(rule: BrandRule) -> dict:
    return BrandRuleOut.model_validate(rule, from_attributes=True).model_dump(mode="json")


def enabled_rules_as_dicts(db: Session, company: Company) -> tuple[str, list[dict]]:
    """Rules asserted for the analysis pipeline (deterministic order = code)."""
    rules = [r for r in rules_for(db, company) if r.enabled]
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
