#!/usr/bin/env python
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

"""Perform database migration."""

import logging
import optparse
import os
import sys

import alembic
import alembic.config
import pkg_resources

from taurus_metric_collectors import logging_support


def migrate(version="head", offline=False):
  """
  :param offline: False to execute SQL commands; True to just dump SQL commands
    to stdout for offline mode or debugging
  """
  alembicConfig = alembic.config.Config(
    pkg_resources.resource_filename(
      __name__,
      os.path.join("migrations", "alembic.ini")))

  alembic.command.upgrade(alembicConfig, version, sql=offline)



if __name__ == "__main__":
  logging_support.LoggingSupport.initTool()

  # Enable sqlalchemy engine logging at INFO level for more granular progress
  # report during migration.
  logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)

  parser = optparse.OptionParser()
  parser.add_option("--version", default="head")
  parser.add_option(
      "--offline",
      action="store_true",
      default=False,
      dest="offline",
      help=("Use this flag to dump sql commands to stdout instead of executing "
            "them."))
  options, _ = parser.parse_args()

  migrate(version=options.version, offline=options.offline)
