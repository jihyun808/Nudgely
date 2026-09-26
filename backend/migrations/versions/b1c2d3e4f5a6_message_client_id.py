"""messages.client_id (재시도 멱등키)

Revision ID: b1c2d3e4f5a6
Revises: ae4b093a481d
Create Date: 2026-09-16 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b1c2d3e4f5a6"
down_revision: str | None = "ae4b093a481d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # SQLite 는 ALTER 가 제한적이라 batch_alter_table 로 감싼다.
    with op.batch_alter_table("messages", schema=None) as batch_op:
        batch_op.add_column(sa.Column("client_id", sa.String(), nullable=True))
        batch_op.create_unique_constraint("uq_messages_goal_client", ["goal_id", "client_id"])


def downgrade() -> None:
    with op.batch_alter_table("messages", schema=None) as batch_op:
        batch_op.drop_constraint("uq_messages_goal_client", type_="unique")
        batch_op.drop_column("client_id")
