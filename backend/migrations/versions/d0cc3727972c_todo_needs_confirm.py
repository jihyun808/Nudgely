"""todo needs_confirm

반복 계획으로 서버가 미리 만든 묶음 표시. 기존 행은 0(확인 불필요).

Revision ID: d0cc3727972c
Revises: fdfae62ef4a8
Create Date: 2026-09-28 14:06:21.023154
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd0cc3727972c'
down_revision: str | None = 'fdfae62ef4a8'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("todos", schema=None) as batch_op:
        # server_default 는 기존 행을 채우기 위한 것이다
        batch_op.add_column(
            sa.Column("needs_confirm", sa.Boolean(), nullable=False, server_default=sa.false())
        )


def downgrade() -> None:
    with op.batch_alter_table("todos", schema=None) as batch_op:
        batch_op.drop_column("needs_confirm")
