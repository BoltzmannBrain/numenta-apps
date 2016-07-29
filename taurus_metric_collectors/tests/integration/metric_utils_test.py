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

"""
Integration tests for taurus_metric_collectors.metric_utils
"""

from datetime import datetime
import logging
import os
import random
import requests
import time
import unittest

from mock import patch
import pytz

from taurus_metric_collectors import collectorsdb, metric_utils
from taurus_metric_collectors.collectorsdb import schema



class MetricUtilsTestCase(unittest.TestCase):


  def testCreateAllModels(self):

    host = os.environ.get("TAURUS_HTM_SERVER", "127.0.0.1")
    apikey = os.environ.get("TAURUS_APIKEY", "taurus")

    # Resize metrics down to a much smaller random sample of the original
    # so as to not overload the system under test.  We need only to test that
    # everything returned goes through the right channels.

    metricsConfig = {
      key:value
      for (key, value)
      in random.sample(metric_utils.getMetricsConfiguration().items(), 3)
    }

    expectedMetricNames = []

    for resVal in metricsConfig.itervalues():
      for metricName in resVal["metrics"]:
        expectedMetricNames.append(metricName)

        self.addCleanup(requests.delete,
                        "https://%s/_metrics/custom/%s" % (host, metricName),
                        auth=(apikey, ""),
                        verify=False)

    self.assertGreater(len(expectedMetricNames), 0)

    with patch("taurus_metric_collectors.metric_utils.getMetricsConfiguration",
               return_value=metricsConfig,
               spec_set=metric_utils.getMetricsConfiguration):
      createdModels = metric_utils.createAllModels(host, apikey)

    self.assertEqual(len(createdModels), len(expectedMetricNames))

    for model in createdModels:
      remoteModel = metric_utils.getOneModel(host, apikey, model["uid"])
      self.assertIn(remoteModel["name"], expectedMetricNames)
      # Verify that the model is either in "ACTIVE" or the transient
      # "PENDNG DATA" or "CREATE PENDING" states
      self.assertIn(remoteModel["status"], [1, 2, 8])


  def testEmittedSampleDatetime(self):
    key = "bogus-test-key"

    # Establish initial sample datetime

    result = metric_utils.establishLastEmittedSampleDatetime(key, 300)

    # Cleanup
    self.addCleanup(
      collectorsdb.engineFactory().execute,
      schema.emittedSampleTracker.delete().where(  # pylint: disable=E1120
        (schema.emittedSampleTracker.c.key == key)
      )
    )

    self.assertIsInstance(result, datetime)

    # Update latest emitted sample datetime to now

    now = datetime.utcnow().replace(microsecond=0)
    metric_utils.updateLastEmittedSampleDatetime(key, now)

    # Verify that it was updated

    lastEmittedSample = metric_utils.queryLastEmittedSampleDatetime(key)

    self.assertEqual(now, lastEmittedSample)
    self.assertLess(result, lastEmittedSample)


  def testEmittedNonMetricSequence(self):
    key = "bogus-test-key"

    metric_utils.updateLastEmittedNonMetricSequence(key, 1)

    # Cleanup
    self.addCleanup(
      collectorsdb.engineFactory().execute,
      schema.emittedNonMetricTracker.delete().where(  # pylint: disable=E1120
        (schema.emittedNonMetricTracker.c.key == key)
      )
    )

    lastEmittedSample = metric_utils.queryLastEmittedNonMetricSequence(key)

    self.assertEqual(1, lastEmittedSample)


  def testMetricDataBatchWrite(self):

    # Note: This test assumes that there is a running Taurus instance ready to
    # receive and process inbound custom metric data.  In the deployed
    # environment $TAURUS_HTM_SERVER and $TAURUS_APIKEY must be set.  Otherwise
    # default values will be assumed.

    host = os.environ.get("TAURUS_HTM_SERVER", "127.0.0.1")
    apikey = os.environ.get("TAURUS_APIKEY", "taurus")

    metricName = "bogus-test-metric"

    log = logging.getLogger(__name__)

    utcLocalizedEpoch = (
      pytz.timezone("UTC").localize(datetime.utcfromtimestamp(0)))

    now = datetime.now(pytz.timezone("UTC"))

    # Send metric data in batches, and for test purposes making sure to exceed
    # the max batch size to force the batch to be chunked

    with metric_utils.metricDataBatchWrite(log=log) as putSample:
      # pylint: disable=W0212
      for x in xrange(metric_utils._METRIC_DATA_BATCH_WRITE_SIZE + 1):
        ts = ((now - utcLocalizedEpoch).total_seconds()
              - metric_utils._METRIC_DATA_BATCH_WRITE_SIZE
              + 1
              + x)
        putSample(metricName=metricName,
                  value=x,
                  epochTimestamp=ts)

    self.addCleanup(requests.delete,
                    "https://%s/_metrics/custom/%s" % (host, metricName),
                    auth=(apikey, ""),
                    verify=False)

    attempt = 0
    found = False
    while not found:
      result = requests.get("https://%s/_metrics/custom" % host,
                            auth=(apikey, ""),
                            verify=False)

      models = result.json()

      for model in models:
        if model["name"] == metricName:
          # Quick check to make sure the data made its way through
          result = requests.get("https://%s/_models/%s" % (host, model["uid"]),
                                auth=(apikey, ""),
                                verify=False)

          # pylint: disable=W0212
          if (result.json()[0]["last_rowid"] ==
              metric_utils._METRIC_DATA_BATCH_WRITE_SIZE + 1):
            found = True
            break

      else:
        if attempt == 30:
          self.fail(
            "Not all metric data samples made it through after 30 seconds")
        else:
          time.sleep(1)
          attempt += 1
          continue



if __name__ == "__main__":
  unittest.main()
