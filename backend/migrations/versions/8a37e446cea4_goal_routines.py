"""goal routines

Revision ID: 8a37e446cea4
Revises: 96bcdf7ab99e
Create Date: 2026-09-26 11:50:21.606473
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

from app.core.db import UtcDateTime


# revision identifiers, used by Alembic.
revision: str = "8a37e446cea4"
down_revision: str | None = "96bcdf7ab99e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "goal_routines",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("goal_id", sa.String(), nullable=False),
        sa.Column("content", sa.String(), nullable=False),
        sa.Column("tag", sa.String(), nullable=True),
        sa.Column("progress_delta", sa.Integer(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("weekdays", sa.String(), nullable=True),
        sa.Column("order", sa.Integer(), nullable=False),
        sa.Column("created_at", UtcDateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["goal_id"], ["goals.id"], name="fk_goal_routines_goal_id", ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_goal_routines_goal_id"), "goal_routines", ["goal_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_goal_routines_goal_id"), table_name="goal_routines")
    op.drop_table("goal_routines")
