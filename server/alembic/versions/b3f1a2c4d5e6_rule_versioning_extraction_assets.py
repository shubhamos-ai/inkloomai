"""rule versioning, extraction runs, assets, job retry metadata

Revision ID: b3f1a2c4d5e6
Revises: a77fc3c33808
Create Date: 2026-11-11 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b3f1a2c4d5e6"
down_revision: Union[str, Sequence[str], None] = "a77fc3c33808"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ---- analysis_jobs: retry/backoff + worker ownership ----------------
    op.add_column("analysis_jobs", sa.Column("error_code", sa.String(length=40), nullable=True))
    op.add_column("analysis_jobs", sa.Column("next_attempt_at", sa.DateTime(), nullable=True))
    op.add_column("analysis_jobs", sa.Column("locked_by", sa.String(length=120), nullable=True))
    op.create_index(
        op.f("ix_analysis_jobs_next_attempt_at"), "analysis_jobs", ["next_attempt_at"], unique=False
    )

    # ---- brand_rules: version + extraction provenance -------------------
    op.add_column(
        "brand_rules",
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column("brand_rules", sa.Column("extraction_run_id", sa.Uuid(), nullable=True))
    op.create_index(
        op.f("ix_brand_rules_extraction_run_id"),
        "brand_rules",
        ["extraction_run_id"],
        unique=False,
    )

    # ---- extraction_runs ------------------------------------------------
    op.create_table(
        "extraction_runs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("brain_id", sa.Uuid(), nullable=False),
        sa.Column("created_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("max_attempts", sa.Integer(), nullable=False),
        sa.Column("source_version", sa.Integer(), nullable=False),
        sa.Column("source_chars", sa.Integer(), nullable=False),
        sa.Column("model", sa.String(length=120), nullable=False),
        sa.Column("proposed_rules", sa.JSON(), nullable=True),
        sa.Column("rejected_rules", sa.JSON(), nullable=True),
        sa.Column("warnings", sa.JSON(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("error_code", sa.String(length=40), nullable=True),
        sa.Column("queued_at", sa.DateTime(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("heartbeat_at", sa.DateTime(), nullable=True),
        sa.Column("next_attempt_at", sa.DateTime(), nullable=True),
        sa.Column("committed_at", sa.DateTime(), nullable=True),
        sa.Column("committed_rule_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["brain_id"], ["brand_brains.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_extraction_runs_company_id"), "extraction_runs", ["company_id"])
    op.create_index(op.f("ix_extraction_runs_brain_id"), "extraction_runs", ["brain_id"])
    op.create_index(op.f("ix_extraction_runs_status"), "extraction_runs", ["status"])

    # ---- brand_rule_versions -------------------------------------------
    op.create_table(
        "brand_rule_versions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("rule_id", sa.Uuid(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("change_type", sa.String(length=30), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("changed_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("extraction_run_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["rule_id"], ["brand_rules.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["changed_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["extraction_run_id"], ["extraction_runs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_brand_rule_versions_company_id"), "brand_rule_versions", ["company_id"]
    )
    op.create_index(op.f("ix_brand_rule_versions_rule_id"), "brand_rule_versions", ["rule_id"])

    # ---- assets ---------------------------------------------------------
    op.create_table(
        "assets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("analysis_id", sa.Uuid(), nullable=True),
        sa.Column("brain_id", sa.Uuid(), nullable=True),
        sa.Column("kind", sa.String(length=30), nullable=False),
        sa.Column("storage_backend", sa.String(length=10), nullable=False),
        sa.Column("object_key", sa.String(length=700), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=120), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("checksum_sha256", sa.String(length=64), nullable=False),
        sa.Column("preview_key", sa.String(length=700), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["analysis_id"], ["analyses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["brain_id"], ["brand_brains.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_assets_company_id"), "assets", ["company_id"])
    op.create_index(op.f("ix_assets_analysis_id"), "assets", ["analysis_id"])
    op.create_index(op.f("ix_assets_brain_id"), "assets", ["brain_id"])
    op.create_index(op.f("ix_assets_kind"), "assets", ["kind"])
    op.create_index(op.f("ix_assets_object_key"), "assets", ["object_key"])

    # ---- brand_rules.extraction_run_id FK ------------------------------
    # SQLite cannot add a foreign key to an existing table; the column is
    # still indexed and used by the ORM. PostgreSQL gets the real constraint.
    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        op.create_foreign_key(
            "fk_brand_rules_extraction_run_id",
            "brand_rules",
            "extraction_runs",
            ["extraction_run_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "sqlite":
        op.drop_constraint("fk_brand_rules_extraction_run_id", "brand_rules", type_="foreignkey")

    op.drop_index(op.f("ix_assets_object_key"), table_name="assets")
    op.drop_index(op.f("ix_assets_kind"), table_name="assets")
    op.drop_index(op.f("ix_assets_brain_id"), table_name="assets")
    op.drop_index(op.f("ix_assets_analysis_id"), table_name="assets")
    op.drop_index(op.f("ix_assets_company_id"), table_name="assets")
    op.drop_table("assets")

    op.drop_index(op.f("ix_brand_rule_versions_rule_id"), table_name="brand_rule_versions")
    op.drop_index(op.f("ix_brand_rule_versions_company_id"), table_name="brand_rule_versions")
    op.drop_table("brand_rule_versions")

    op.drop_index(op.f("ix_extraction_runs_status"), table_name="extraction_runs")
    op.drop_index(op.f("ix_extraction_runs_brain_id"), table_name="extraction_runs")
    op.drop_index(op.f("ix_extraction_runs_company_id"), table_name="extraction_runs")
    op.drop_table("extraction_runs")

    op.drop_index(op.f("ix_brand_rules_extraction_run_id"), table_name="brand_rules")
    op.drop_column("brand_rules", "extraction_run_id")
    op.drop_column("brand_rules", "version")

    op.drop_index(op.f("ix_analysis_jobs_next_attempt_at"), table_name="analysis_jobs")
    op.drop_column("analysis_jobs", "locked_by")
    op.drop_column("analysis_jobs", "next_attempt_at")
    op.drop_column("analysis_jobs", "error_code")
