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

"""Test utilities for collectorsdb"""

import functools
import uuid

from nta.utils.test_utils.config_test_utils import ConfigAttributePatch

from taurus_metric_collectors import collectorsdb
from taurus_metric_collectors.collectorsdb import CollectorsDbConfig



class ManagedTempRepository(object):
  """Context manager and function decorator that on entry patches the
  respository database name with a unique temp name and creates a temp
  repository; then drops the repository database on exit.

  This effectively redirects repository object transactions to the
  temporary database while in scope of ManagedTempRepository.

  NOTE: this affects repository access in the currently-executing process and
  its descendant processes; it has no impact on processes started externally or
  processes started without inherititing the environment variables of the
  current process.

  Sorry, but there is no class decorator capability provided at this time.

  Context Manager Example::

      with ManagedTempRepository(clientLabel=self.__class__.__name__) as repoCM:
        print repoCM.tempDatabaseName
        <do test logic>

  Function Decorator Example::

      @ManagedTempRepository(clientLabel="testSomething", kw="tempRepoPatch")
      def testSomething(self, tempRepoPatch):
        print tempRepoPatch.tempDatabaseName
        <do test logic>

  """
  REPO_CONFIG_NAME = CollectorsDbConfig.CONFIG_NAME
  REPO_BASE_CONFIG_DIR = CollectorsDbConfig.CONFIG_DIR
  REPO_SECTION_NAME = "repository"
  REPO_DATABASE_ATTR_NAME = "db"


  def __init__(self, clientLabel, kw=None):
    """
    clientLabel: this *relatively short* string will be used to construct the
      temporary database name. It shouldn't contain any characters that would
      make it inappropriate for a database name (no spaces, etc.)
    kw: name of keyword argument to add to the decorated function(s). Its value
      will be a reference to this instance of ManagedTempRepository. Ignored
      when this instance is used as context manager. Defaults to kw=None to
      avoid having it added to the keyword args.
    """
    self._kw = kw

    self._unaffiliatedEngine = collectorsdb.getUnaffiliatedEngine()

    dbNameFromConfig = CollectorsDbConfig().get(self.REPO_SECTION_NAME,
                                                self.REPO_DATABASE_ATTR_NAME)
    self.tempDatabaseName = "{original}_{label}_{uid}".format(
      original=dbNameFromConfig,
      label=clientLabel,
      uid=uuid.uuid1().hex)

    # Create a Config patch to override the Repository database name
    self._configPatch = ConfigAttributePatch(
      self.REPO_CONFIG_NAME,
      self.REPO_BASE_CONFIG_DIR,
      values=((self.REPO_SECTION_NAME, self.REPO_DATABASE_ATTR_NAME,
               self.tempDatabaseName),))
    self._configPatchApplied = False

    self._attemptedToCreateDatabase = False


  def __enter__(self):
    self.start()
    return self


  def __exit__(self, *args):
    self.stop()
    return False


  def __call__(self, f):
    """ Implement the function decorator """

    @functools.wraps(f)
    def applyTempRepositoryPatch(*args, **kwargs):
      self.start()
      try:
        if self._kw is not None:
          kwargs[self._kw] = self
        return f(*args, **kwargs)
      finally:
        self.stop()

    return applyTempRepositoryPatch


  def start(self):
    # Removes possible left over cached engine
    # (needed if non-patched engine is run prior)
    collectorsdb.resetEngineSingleton()

    # Override the Repository database name
    try:
      self._configPatch.start()
      self._configPatchApplied = True

      # Now create the temporary repository database
      self._attemptedToCreateDatabase = True
      collectorsdb.reset(suppressPromptAndObliterateDatabase=True)

      # Verify that the temporary repository database got created
      numDbFound = self._unaffiliatedEngine.execute(
        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.SCHEMATA WHERE "
        "`SCHEMA_NAME` = '{db}'".format(db=self.tempDatabaseName)).scalar()
      assert numDbFound == 1, (
        "Temp repo db={db} not found (numFound={numFound})".format(
          db=self.tempDatabaseName,
          numFound=numDbFound))
    except:
      # Attempt to clean up
      self.stop()

      raise


  def stop(self):
    try:
      if self._attemptedToCreateDatabase:
        self._attemptedToCreateDatabase = False
        # Drop the temporary repository database, if any
        self._unaffiliatedEngine.execute(
          "DROP DATABASE IF EXISTS {db}".format(db=self.tempDatabaseName))
    finally:
      if self._configPatchApplied:
        self._configPatch.stop()

      collectorsdb.resetEngineSingleton()

      # Dispose of the unaffiliated engine's connection pool
      self._unaffiliatedEngine.dispose()
