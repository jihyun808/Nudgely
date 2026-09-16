"""add user_settings.timezone

Revision ID: e61c2a60abbf
Revises: ae4b093a481d
Create Date: 2026-09-16 15:00:27.889007
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e61c2a60abbf'
down_revision: str | None = 'ae4b093a481d'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # server_default 가 없으면 기존 행 때문에 NOT NULL 추가가 실패한다.
    with op.batch_alter_table("user_settings", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("timezone", sa.String(), nullable=False, server_default="Asia/Seoul")
        )


def downgrade() -> None:
    with op.batch_alter_table("user_settings", schema=None) as batch_op:
        batch_op.drop_column("timezone")
