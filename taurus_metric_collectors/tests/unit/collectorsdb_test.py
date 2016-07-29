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

import unittest2 as unittest

from mock import Mock, patch
import sqlalchemy
import sqlalchemy.exc

from taurus_metric_collectors import collectorsdb, logging_support



def setUpModule():
  logging_support.LoggingSupport.initTestApp()



@patch("taurus_metric_collectors.collectorsdb.sqlalchemy", autospec=True)
class CollectorsdbTestCase(unittest.TestCase):
  def testEngineFactorySingletonPattern(self, sqlalchemyMock):

    # Explicitly spec out sqlalchemy.create_engine()
    firstCall = Mock(spec_set=sqlalchemy.engine.base.Engine)
    sqlalchemyMock.create_engine.side_effect = [firstCall]

    # Call collectorsdb.engineFactory()
    engine = collectorsdb.engineFactory()
    self.assertIs(engine, firstCall)

    # Call collectorsdb.engineFactory() again and assert singleton
    engine2 = collectorsdb.engineFactory()
    self.assertIs(engine2, firstCall)
    self.assertEqual(sqlalchemyMock.create_engine.call_count, 1)

    # Call collectorsdb.engineFactory() in different process, assert raises
    # assertion error
    with patch("taurus_metric_collectors.collectorsdb.os.getpid",
               return_value=collectorsdb._EngineSingleton._pid + 1,
               autospec=True):
      with self.assertRaises(AssertionError):
        collectorsdb.engineFactory()



if __name__ == "__main__":
  unittest.main()
