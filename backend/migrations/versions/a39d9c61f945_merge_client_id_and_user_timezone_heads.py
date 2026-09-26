"""merge client_id and user timezone heads

Revision ID: a39d9c61f945
Revises: b1c2d3e4f5a6, e61c2a60abbf
Create Date: 2026-09-17 19:29:17.306254
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a39d9c61f945'
down_revision: str | None = ('b1c2d3e4f5a6', 'e61c2a60abbf')
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
