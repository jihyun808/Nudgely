"""device_tokens

푸시를 받을 기기. FCM 등록 토큰이 기본키다 — 같은 기기에서 계정을 바꿔
로그인하면 소유자만 옮겨가고, 이전 사용자에게 가던 푸시가 따라가지 않는다.

Revision ID: 841f40f72666
Revises: 9ff1b5179f2c
Create Date: 2026-09-26 13:57:35.827510
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

import app.core.db

# revision identifiers, used by Alembic.
revision: str = '841f40f72666'
down_revision: str | None = '9ff1b5179f2c'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "device_tokens",
        sa.Column("token", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("platform", sa.String(), nullable=False),
        sa.Column("created_at", app.core.db.UtcDateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", app.core.db.UtcDateTime(timezone=True), nullable=False),
        # 탈퇴하면 등록도 함께 사라진다
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("token"),
    )
    with op.batch_alter_table("device_tokens", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_device_tokens_user_id"), ["user_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("device_tokens", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_device_tokens_user_id"))
    op.drop_table("device_tokens")
