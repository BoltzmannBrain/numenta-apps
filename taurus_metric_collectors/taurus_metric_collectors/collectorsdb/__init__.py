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

import logging
import multiprocessing
import optparse
import random
import os
import threading


import sqlalchemy

from nta.utils import sqlalchemy_utils
from nta.utils.config import Config

import taurus_metric_collectors
from taurus_metric_collectors.collectorsdb import schema
from taurus_metric_collectors.collectorsdb.migrate import migrate
from taurus_metric_collectors import logging_support



# Retry decorator for mysql transient errors
retryOnTransientErrors = sqlalchemy_utils.retryOnTransientErrors



_DSN_FORMAT = ("mysql://%(user)s:%(password)s@%(host)s:%(port)s/%(db)s?"
               "charset=%(charset)s")



_REPOSITORY_OPTIONS = dict(
  charset=schema.MYSQL_CHARSET
)



class CollectorsDbConfig(Config):
  """ Metric Collectors SQL DB Configuration """

  CONFIG_NAME = "collectors-sqldb.conf"

  CONFIG_DIR = taurus_metric_collectors.CONF_DIR


  def __init__(self, mode=Config.MODE_LOGICAL):
    super(CollectorsDbConfig, self).__init__(self.CONFIG_NAME,
                                             self.CONFIG_DIR,
                                             mode=mode)



def _getRepoParams():
  """
  :returns: a dict of repository parameters for substitutions in _DSN_FORMAT
  """
  repoParams = dict(CollectorsDbConfig().items("repository"))
  if not repoParams["host"] or not repoParams["user"]:
    raise ValueError("Missing host and/or user value from collectors-sqldb "
                     "config: %s", repoParams)
  repoParams.update(_REPOSITORY_OPTIONS)
  return repoParams




def getDSN():
  return _DSN_FORMAT % _getRepoParams()



class _EngineSingleton(object):


  _mpMutex = multiprocessing.Lock()
  _pid = None
  _threadMutex = None
  _engine = None


  @classmethod
  def getEngine(cls):
    pid = os.getpid()

    with cls._mpMutex:
      if cls._pid is None:
        cls._threadMutex = threading.Lock()
        cls._pid = pid
      else:
        # NOTE: we've experienced race condition hangs when the non-empty
        # _EngineSingleton was cloned via multiprocessing forking. Resetting
        # and/or `cls._engine.dispose()` didn't alleviate this problem.
        assert cls._pid == pid, "collectorsdb engine factory is not fork-safe"

    with cls._threadMutex:
      if cls._engine is None:
        cls._engine = sqlalchemy.create_engine(getDSN())

    return cls._engine


  @classmethod
  def reset(cls):
    """ Reset internal engine and pid references. For use by tests only!
    """
    with cls._mpMutex:
      if cls._pid is not None:
        # NOTE: we've experienced race condition hangs when the non-empty
        # _EngineSingleton was cloned via multiprocessing forking. Resetting
        # and/or `cls._engine.dispose()` didn't alleviate this problem.
        assert cls._pid == os.getpid(), (
          "collectorsdb engine factory is not fork-safe")
        cls._pid = None

        with cls._threadMutex:
          cls._engine = None
          cls._threadMutex = None



def engineFactory():
  """
  :returns: SQLAlchemy engine object
  :rtype: sqlalchemy.engine.Engine
  """
  return _EngineSingleton.getEngine()



def resetEngineSingleton():
  """ Reset engine singleton. For use by tests only!
  """
  _EngineSingleton.reset()



def getUnaffiliatedEngine():
  """
  :returns: sqlalchemy Engine that's unaffiliated with any database
  :rtype: sqlalchemy.engine.Engine
  """
  dsn = "mysql://%(user)s:%(password)s@%(host)s:%(port)s" % _getRepoParams()
  return sqlalchemy.create_engine(dsn)



def resetCollectorsdbMain():
  """ Setuptools console script entry point for resetting collectorsdb (
  taurus_collectors database).
  :returns: 0 if reset was completed successfully; 1 if user doesn't confirm the
    request
  """
  logging_support.LoggingSupport.initTool()

  # Enable sqlalchemy engine logging at INFO level for more granular progress
  # report during migration.
  logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)


  repoParams = _getRepoParams()

  helpString = (
    "%%prog [--suppress-prompt-and-obliterate-database]\n\n"
    "WARNING: PERMANENT DATA LOSS! Obliterate/reset collectorsdb sql "
    "database %(db)s on server %(host)s." % repoParams)

  parser = optparse.OptionParser(helpString)

  parser.add_option(
    "--suppress-prompt-and-obliterate-database",
    action="store_true",
    default=False,
    dest="suppressPrompt",
    help=("Suppresses confirmation prompt and proceedes with this "
          "DESTRUCTIVE operation. This option is intended for scripting. "
          "[default: %default]"))

  options, remainingArgs = parser.parse_args()
  if remainingArgs:
    parser.error("Unexpected remaining args: %r" % (remainingArgs,))

  if options.suppressPrompt:
    return reset(suppressPromptAndObliterateDatabase=True)
  else:
    return reset()



def reset(offline=False, **kwargs):
  """ Reset the taurus_collectors database; upon successful completion, the
  necessary tables are created, but the tables are not populated

  :param offline: False to execute SQL commands; True to just dump SQL commands
    to stdout for offline mode or debugging
  :param bool suppressPromptAndObliterateDatabase: kwarg only! When passed with
    the value of True, proceeds to drop the taurus_collectors database without
    prompting. Without this arg or if it's False, will prompt the user via
    terminal and expect a specific string to be entered
  :returns: 0 if reset was completed successfully; 1 if user doesn't confirm the
    request
  """
  repoParams = _getRepoParams()

  promptAvoidanceArgName = "suppressPromptAndObliterateDatabase"

  if not kwargs.get(promptAvoidanceArgName):
    expectedAnswer = "Yes-%s" % (random.randint(1, 30),)

    answer = raw_input(
      "Attention!  You are about to do something irreversible, and potentially"
      " dangerous.\n"
      "\n"
      "To back out immediately without making any changes, feel free to type "
      "anything but \"%s\" in the prompt below, and press return.\n"
      "\n"
      "Should you choose to continue, the DATABASE \"%s\" on \"%s\" will be "
      "PERMANENTLY DELETED.  If you do not wish to \n"
      "see this message again, you can pass %s=True as a kwarg to the "
      "collectorsdb.reset() function.\n"
      "\n"
      "Are you sure you want to continue? " % (
        expectedAnswer, repoParams["db"], repoParams["host"],
        promptAvoidanceArgName))

    if answer.strip() != expectedAnswer:
      print "Aborting - Wise choice, my friend. Bye."
      return 1

  resetDatabaseSQL = (
    "DROP DATABASE IF EXISTS %(database)s; "
    "CREATE DATABASE %(database)s;" % {"database": repoParams["db"]})
  statements = [s.strip() for s in resetDatabaseSQL.split(";") if s.strip()]

  e = getUnaffiliatedEngine()
  try:
    for s in statements:
      e.execute(s)
  finally:
    e.dispose()

  migrate(offline=offline)

  return 0
