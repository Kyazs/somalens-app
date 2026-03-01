"""Add medical_conditions to measurement

Revision ID: f7a8b9c0d1e2
Revises: bc35073fd37a
Create Date: 2026-03-01T21:25:00+08:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7a8b9c0d1e2'
down_revision: Union[str, Sequence[str], None] = 'bc35073fd37a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('measurement', sa.Column('medical_conditions', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('measurement', 'medical_conditions')
