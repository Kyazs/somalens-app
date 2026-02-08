"""add user profile fields

Revision ID: a1b2c3d4e5f6
Revises: 24ec57640eb0
Create Date: 2026-02-09 02:00:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '24ec57640eb0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('user', sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), server_default='User', nullable=False))
    op.add_column('user', sa.Column('age', sa.Integer(), nullable=True))
    op.add_column('user', sa.Column('gender', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.create_index(op.f('ix_user_name'), 'user', ['name'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_user_name'), table_name='user')
    op.drop_column('user', 'gender')
    op.drop_column('user', 'age')
    op.drop_column('user', 'name')
