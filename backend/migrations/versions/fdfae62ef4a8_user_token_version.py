"""user token_version

발급해 둔 토큰을 한 번에 무효로 만드는 번호. 비밀번호를 바꾸면 올라간다.
기존 행에는 0 을 채운다 — server_default 가 없으면 NOT NULL 이 실패한다.

Revision ID: fdfae62ef4a8
Revises: 2912b4be2683
Create Date: 2026-09-28 10:27:34.160134
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fdfae62ef4a8'
down_revision: str | None = '2912b4be2683'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(
            # server_default 는 기존 행을 채우기 위한 것이다. 앞으로 만들어지는
            # 행은 모델의 default=0 이 넣는다
            sa.Column("token_version", sa.Integer(), nullable=False, server_default="0")
        )


def downgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("token_version")
