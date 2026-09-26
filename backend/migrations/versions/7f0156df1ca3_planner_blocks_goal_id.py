"""planner_blocks.goal_id

Revision ID: 7f0156df1ca3
Revises: a39d9c61f945
Create Date: 2026-09-20 04:18:58.849793
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7f0156df1ca3'
down_revision: str | None = 'a39d9c61f945'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# 이름 없는 제약은 downgrade 에서 떼어낼 수 없어 직접 붙인다
FK_NAME = "fk_planner_blocks_goal_id"


def upgrade() -> None:
    with op.batch_alter_table("planner_blocks", schema=None) as batch_op:
        batch_op.add_column(sa.Column("goal_id", sa.String(), nullable=True))
        batch_op.create_index(batch_op.f("ix_planner_blocks_goal_id"), ["goal_id"], unique=False)
        batch_op.create_foreign_key(FK_NAME, "goals", ["goal_id"], ["id"], ondelete="SET NULL")


def downgrade() -> None:
    with op.batch_alter_table("planner_blocks", schema=None) as batch_op:
        batch_op.drop_constraint(FK_NAME, type_="foreignkey")
        batch_op.drop_index(batch_op.f("ix_planner_blocks_goal_id"))
        batch_op.drop_column("goal_id")
