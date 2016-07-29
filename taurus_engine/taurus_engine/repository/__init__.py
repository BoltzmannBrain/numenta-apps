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

import argparse
import sys

from sqlalchemy import create_engine

from nta.utils import sqlalchemy_utils

from taurus_engine import config
from taurus_engine import logging_support
from taurus_engine.repository import schema
from taurus_engine.repository.migrate import migrate
import htmengine.repository
from htmengine.repository import (addMetric,
                                  addMetricData,
                                  deleteMetric,
                                  deleteModel,
                                  getCustomMetricByName,
                                  getCustomMetrics,
                                  getInstances,
                                  getInstanceStatusHistory,
                                  getAllMetrics,
                                  getAllMetricsForServer,
                                  getAllModels,
                                  getMetric,
                                  getMetricWithSharedLock,
                                  getMetricWithUpdateLock,
                                  getMetricCountForServer,
                                  getMetricData,
                                  getMetricDataCount,
                                  getProcessedMetricDataCount,
                                  getMetricDataWithRawAnomalyScoresTail,
                                  getMetricIdsSortedByDisplayValue,
                                  getMetricStats,
                                  getUnprocessedModelDataCount,
                                  listMetricIDsForInstance,
                                  saveMetricInstanceStatus,
                                  setMetricCollectorError,
                                  setMetricLastTimestamp,
                                  setMetricStatus,
                                  updateMetricColumns,
                                  updateMetricColumnsForRefStatus,
                                  updateMetricDataColumns,
                                  lockOperationExclusive,
                                  OperationLock)



retryOnTransientErrors = sqlalchemy_utils.retryOnTransientErrors



def getDSN():
  return htmengine.repository.getDSN(config)



def getUnaffiliatedEngine():
  return htmengine.repository.getUnaffiliatedEngine(config)



def getDbDSN():
  return htmengine.repository.getDbDSN(config)


def engineFactory(reset=False):
  """SQLAlchemy engine factory method

  See http://docs.sqlalchemy.org/en/rel_0_9/core/connections.html

  :param reset: Force a new engine instance.  By default, the same instance is
    reused when possible.
  :returns: SQLAlchemy engine object
  :rtype: sqlalchemy.engine.Engine

  Usage::

      from taurus_engine import repository
      engine = repository.engineFactory()
  """
  return htmengine.repository.engineFactory(config, reset)



def resetDatabaseConsoleScriptEntryPoint():
  """ Setuptools console script entry point for resetting Taurus Engine's
  database.

  :returns: 0 if reset was completed successfully; 1 if user doesn't confirm the
    request
  """
  logging_support.LoggingSupport.initTool()

  parser = argparse.ArgumentParser(
    description=(
      "WARNING: PERMANENT DATA LOSS! Obliterate/reset Taurus Engine's sql "
      "database {db} on server {host}.").format(
        **dict(config.items("repository")))
  )

  parser.add_argument(
    "--suppress-prompt-and-continue-with-deletion",
    action="store_true",
    dest="suppressPrompt",
    help=("Suppresses confirmation prompt and proceedes with this "
          "DESTRUCTIVE operation. This option is intended for scripting."))

  args = parser.parse_args()

  if args.suppressPrompt:
    return reset(suppressPromptAndContinueWithDeletion=True)
  else:
    return reset()



def reset(offline=False, **kwargs):
  """
  Reset the taurus database; upon successful completion, the necessary schema
  are created, but the tables are not populated

  :param offline: False to execute SQL commands; True to just dump SQL commands
    to stdout for offline mode or debugging
  :param bool suppressPromptAndContinueWithDeletion: kwarg only! When passed
    with the value of True, proceeds to drop the Taurus Engine database without
    prompting. Without this arg or if it's False, will prompt the user via
    terminal and expect a specific string to be entered

  :returns: 0 if reset was completed successfully; 1 if user doesn't confirm the
    request
  """
  # Make sure we have the latest version of configuration
  config.loadConfig()
  dbName = config.get("repository", "db")
  dbHost = config.get("repository", "host")

  if not kwargs.get("suppressPromptAndContinueWithDeletion"):
    answer = raw_input(
      "\n"
      "Attention!  You are about to do something irreversible, and potentially"
      " dangerous.\n"
      "\n"
      "To back out immediately without making any changes, feel free to type "
      "anything but \"Yes\" in the prompt below, and press return.\n"
      "\n"
      "Should you choose to continue, the database \"%s\" on \"%s\" will be"
      "permanently deleted.\n"
      "\n"
      "Are you sure you want to continue? " % (dbName, dbHost))

    if answer.strip() != "Yes":
      print "Wise choice, my friend.  Bye."
      return 1

  resetDatabaseSQL = (
    "DROP DATABASE IF EXISTS %(database)s; "
    "CREATE DATABASE %(database)s;" % {"database": dbName})
  statements = resetDatabaseSQL.split(";")

  engine = getUnaffiliatedEngine()
  with engine.connect() as connection:
    for s in statements:
      if s.strip():
        connection.execute(s)

  migrate(offline=offline)

  return 0

