"""add signup consent columns

Revision ID: 4c994fd93e95
Revises: d0cc3727972c
Create Date: 2026-09-28 16:15:10.830662
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
import app.core.db


# revision identifiers, used by Alembic.
revision: str = '4c994fd93e95'
down_revision: str | None = 'd0cc3727972c'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('terms_agreed_at', app.core.db.UtcDateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('privacy_agreed_at', app.core.db.UtcDateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('terms_version', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('age_confirmed_at', app.core.db.UtcDateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('marketing_agreed_at', app.core.db.UtcDateTime(timezone=True), nullable=True))



def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('marketing_agreed_at')
        batch_op.drop_column('age_confirmed_at')
        batch_op.drop_column('terms_version')
        batch_op.drop_column('privacy_agreed_at')
        batch_op.drop_column('terms_agreed_at')

