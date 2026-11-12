"""widen brand_rules.source_type for extraction provenance

Revision ID: c7d8e9f0a1b2
Revises: b3f1a2c4d5e6
Create Date: 2026-11-12 17:05:00.000000

The ORM declares `source_type` as String(80), but the initial migration created
varchar(30). SQLite does not enforce the limit, so tests passed while PostgreSQL
rejected `ai_extraction:<uuid>` (50 chars) with StringDataRightTruncation.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c7d8e9f0a1b2"
down_revision: Union[str, Sequence[str], None] = "b3f1a2c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("brand_rules") as batch_op:
        batch_op.alter_column(
            "source_type",
            existing_type=sa.String(length=30),
            type_=sa.String(length=80),
            existing_nullable=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("brand_rules") as batch_op:
        batch_op.alter_column(
            "source_type",
            existing_type=sa.String(length=80),
            type_=sa.String(length=30),
            existing_nullable=False,
        )
