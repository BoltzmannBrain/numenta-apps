"""Monitor dispatcher

Revision ID: 247aa1a6a0c3
Revises: b6bac808f77
Create Date: 2015-10-15 08:41:45.168130

"""

# revision identifiers, used by Alembic.
revision = '247aa1a6a0c3'
down_revision = 'b6bac808f77'

from alembic import op
import sqlalchemy as sa


def upgrade():
  op.create_table('monitor_dispatcher',
  sa.Column('checkFn', sa.String(length=80), nullable=False, primary_key=True),
  sa.Column('excType', sa.String(length=80), nullable=False, primary_key=True),
  sa.Column('excValueDigest', sa.BINARY(length=20), nullable=True, primary_key=True),
  sa.Column('timestamp', sa.DATETIME(), nullable=False),
  sa.Column('excValue', sa.Text(), nullable=True)
  )
  op.create_index('timestamp_index', 'monitor_dispatcher', ['timestamp'], unique=False)


def downgrade():
  raise NotImplementedError("Rollback is not supported.")

