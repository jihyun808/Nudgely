"""release emails of deleted users

이미 탈퇴한 계정들이 붙들고 있던 이메일 자리를 비켜 준다.
email 이 unique 라, 그대로 두면 그 사람이 돌아와도 같은 주소로 다시 가입할 수
없다("이미 사용 중인 이메일"). 앞으로의 탈퇴는 delete_me 가 직접 비켜 준다.

스키마 변경이 아니라 데이터 정리다.

Revision ID: 2912b4be2683
Revises: 841f40f72666
Create Date: 2026-09-28 10:14:22.108371
"""

from collections.abc import Sequence

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '2912b4be2683'
down_revision: str | None = '841f40f72666'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # app.models.user.released_email 과 같은 형식이어야 한다
    op.execute(
        """
        UPDATE users
           SET email = 'deleted+' || id || '@nudgely.invalid'
         WHERE deleted_at IS NOT NULL
           AND email NOT LIKE 'deleted+%@nudgely.invalid'
        """
    )


def downgrade() -> None:
    # 원래 주소를 어디에도 남기지 않았으므로 되돌릴 수 없다.
    # (되돌리려고 빈 값을 넣으면 unique 제약에 걸려 더 망가진다)
    pass
