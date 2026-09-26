"""notification goal_id ref, drop link_to

Revision ID: 9ff1b5179f2c
Revises: 806a7aba0b5c
Create Date: 2026-09-26 13:21:08.295179
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9ff1b5179f2c'
down_revision: str | None = '806a7aba0b5c'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# 이름 없는 제약은 downgrade 에서 떼어낼 수 없어 직접 붙인다
FK_NAME = "fk_notifications_goal_id"


def upgrade() -> None:
    with op.batch_alter_table("notifications", schema=None) as batch_op:
        batch_op.add_column(sa.Column('goal_id', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('ref', sa.String(), nullable=True))
        batch_op.create_index(batch_op.f('ix_notifications_goal_id'), ['goal_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_notifications_ref'), ['ref'], unique=False)
        batch_op.create_foreign_key(FK_NAME, "goals", ["goal_id"], ["id"], ondelete="CASCADE")
        # 알림은 이제 이동하지 않는다. 누르면 앱이 열리는 것까지가 역할이다
        batch_op.drop_column("link_to")


def downgrade() -> None:
    with op.batch_alter_table("notifications", schema=None) as batch_op:
        batch_op.add_column(sa.Column("link_to", sa.VARCHAR(), nullable=True))
        batch_op.drop_constraint(FK_NAME, type_="foreignkey")
        batch_op.drop_index(batch_op.f("ix_notifications_ref"))
        batch_op.drop_index(batch_op.f("ix_notifications_goal_id"))
        batch_op.drop_column("ref")
        batch_op.drop_column("goal_id")
