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

"""Integration test for htmengine.runtime.metric_garbage_collector
"""

from datetime import datetime, timedelta
import unittest
import uuid

from nta.utils.logging_support_raw import LoggingSupport


import htmengine
from htmengine.test_utils import repository_test_utils
import htmengine.repository
from htmengine.runtime import metric_garbage_collector



def setUpModule():
  LoggingSupport.initTestApp()



class MetricGarbageCollectorTestCase(unittest.TestCase):


  def testPurgeOldMetricData(self):


    gcThresholdDays = 90

    now = datetime.utcnow().replace(microsecond=0)

    uid1 = uuid.uuid1().hex

    oldRows = [
      dict(
        value=1.0,
        timestamp=now - timedelta(days=gcThresholdDays + 1),
      ),

      dict(
        value=2.0,
        timestamp=now - timedelta(days=gcThresholdDays + 2),
      ),
    ]

    youngRows = [
      dict(
        value=3.0,
        timestamp=now,
      ),

      dict(
        value=4.0,
        timestamp=now - timedelta(days=gcThresholdDays - 1),
      ),

      dict(
        value=5.0,
        timestamp=now - timedelta(days=gcThresholdDays - 2),
      ),
    ]

    allRows = oldRows + youngRows

    # Use a temporary database
    with repository_test_utils.HtmengineManagedTempRepository("metric_gc"):
      engine = htmengine.repository.engineFactory(config=htmengine.APP_CONFIG)

      # Add the dummy metric rows
      allData = [(row["value"], row["timestamp"]) for row in allRows]
      with engine.connect() as conn:  # pylint: disable=E1101
        htmengine.repository.addMetric(conn, uid=uid1)
        insertedObjects = htmengine.repository.addMetricData(conn,
                                                             metricId=uid1,
                                                             data=allData)
        numInserted = len(insertedObjects)


      self.assertEqual(numInserted, len(allRows))

      # Execute
      numDeleted = metric_garbage_collector.purgeOldMetricDataRows(
        gcThresholdDays)

      # Verify

      self.assertEqual(numDeleted, len(oldRows))

      # Verify that only the old tweets got purged
      with engine.connect() as conn:  # pylint: disable=E1101
        remainingRows = htmengine.repository.getMetricData(conn).fetchall()

      self.assertEqual(len(remainingRows), len(youngRows))

      self.assertItemsEqual(
        [(row["value"], row["timestamp"]) for row in youngRows],
        [(row.metric_value, row.timestamp) for row in remainingRows])  # pylint: disable=E1101
