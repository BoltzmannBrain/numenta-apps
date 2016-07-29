# ----------------------------------------------------------------------
# Numenta Platform for Intelligent Computing (NuPIC)
# Copyright (C) 2015, Numenta, Inc.  Unless you have purchased from
# Numenta, Inc. a separate commercial license for this software code, the
# following terms and conditions apply:
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero Public License version 3 as
# published by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
# See the GNU Affero Public License for more details.
#
# You should have received a copy of the GNU Affero Public License
# along with this program.  If not, see http://www.gnu.org/licenses.
#
# http://numenta.org/licenses/
# ----------------------------------------------------------------------

"""fix DATETIME and TIMESTAMP defaults

Revision ID: 3b26d099594d
Revises: 2f1ee984f978
Create Date: 2016-05-11 17:04:36.725605
"""

from alembic import op
import sqlalchemy as sa


# Revision identifiers, used by Alembic. Do not change.
revision = '3b26d099594d'
down_revision = '2f1ee984f978'



def upgrade():
    """Fix server defaults for DATETIME columns, because
    0 ("0000-00-00 00:00:00") is deprecated as default for those colum types
    as of mysql 5.7.8, and will fail with mysql installed with default config.
    """
    op.alter_column("annotation", "created",
                    server_default=None,
                    existing_type=sa.DATETIME,
                    existing_nullable=False)

    op.alter_column("instance_status_history", "timestamp",
                    server_default=None,
                    existing_type=sa.DATETIME,
                    existing_nullable=False)



def downgrade():
    raise NotImplementedError("Rollback is not supported.")
