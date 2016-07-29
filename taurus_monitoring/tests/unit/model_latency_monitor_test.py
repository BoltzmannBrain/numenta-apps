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
Unittest of taurus_monitoring/latency_monitor/model_latency_monitor.py
"""
import datetime
from mock import Mock, patch
import pickle
import unittest
import os

import pytz

from nta.utils.test_utils import patch_helpers

from taurus_monitoring.latency_monitor.model_latency_monitor import (
  isOutsideMarketHours,
  LatencyMonitorError,
  main,
  ModelLatencyChecker
)

# Absolute path to directory in which test.conf configuration file may be found
_CONF_DIR = os.path.dirname(os.path.abspath(__file__))
_TEST_CONF_FILEPATH = os.path.join(_CONF_DIR, "test.conf")

# See data/model_latency_monitor_metric_data_util.py for additional details
_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

_LOCALS = {}
execfile(os.path.join(_DATA_DIR, "models.py"), {}, _LOCALS)
MODELS = _LOCALS["MODELS"]

# See data/model_latency_monitor_metric_data_util.py for additional details
# re: generating new data
METRIC_DATA_BY_ID = {
  model["uid"]: pickle.load(
    open(os.path.join(_DATA_DIR, model["name"] + "-data.pickle"), "r"))
  for model in MODELS
}



class ModelLatencyCheckerTest(unittest.TestCase):

  # Mock command line arguments, specifying test config file and bogus
  # metric data table name
  @patch_helpers.patchCLIArgs("taurus-model-latency-monitor",
                              "--monitorConfPath",
                              _TEST_CONF_FILEPATH,
                              "--metricDataTable",
                              "taurus.metric_data.test")
  # Prevent Taurus HTTP API calls
  @patch("requests.get", autospec=True)
  # Prevent boto dynamodb API calls
  @patch("boto.dynamodb2", autospec=True)
  @patch("taurus_monitoring.latency_monitor.model_latency_monitor.Table",
         autospec=True)
  # Fix datetime.datetime.now() to known time relative to cached metric data
  @patch_helpers.patchNow(
    pytz.timezone("UTC").localize(
      datetime.datetime(2015, 11, 2, 20, 41, 0, 0)))
  # Disable pylint warning re: unused botoDynamoDB2Mock argument
  # pylint: disable=W0613
  def testCheckAllSendsNotification(self, tableMock, botoDynamoDB2Mock,
      requestsGetMock):

    # Mock API to return pre-defined models in lieu of making an API call to
    # a live taurus models HTTP endpoint
    requestsGetMock.return_value = Mock(status_code=200,
                                        json=Mock(return_value=MODELS))

    # Mock boto dynamodb queries by returning locally cached metric data.
    # See data/*-data.pickle
    # Disable pylint warning about unused, and improperly named arguments
    # pylint: disable=W0613,C0103
    def query2SideEffect(uid__eq, timestamp__gte):
      return METRIC_DATA_BY_ID[uid__eq]

    tableMock.return_value = (
      Mock(query_2=Mock(side_effect=query2SideEffect,
                        __name__=str(id(query2SideEffect))))
    )

    with self.assertRaises(LatencyMonitorError) as exc:
      ModelLatencyChecker().checkAllModelLatency()

    self.assertEqual(
      exc.exception.message,
      "The following models have exceeded the acceptable threshold for time si"
      "nce last timestamp in taurus.metric_data.test DynamoDB table:\n    Late"
      "ncyMonitorErrorParams(model_name=TWITTER.TWEET.HANDLE.SPG.VOLUME, model"
      "_uid=0021c2d17c0a4eb4965b6cb315c1d2e9, threshold=32548.9007552 seconds,"
      " last_timestamp=2015-11-01 16:12:53+00:00)\n    LatencyMonitorErrorPara"
      "ms(model_name=XIGNITE.TRI.VOLUME, model_uid=00261089e61b4af1a1e4b3d0c06"
      "aa84a, threshold=32889.8983336 seconds, last_timestamp=2015-10-30 19:55"
      ":00+00:00)\n    LatencyMonitorErrorParams(model_name=XIGNITE.BK.CLOSING"
      "PRICE, model_uid=018662cc75b14860b72319d92883c896, threshold=32889.8983"
      "336 seconds, last_timestamp=2015-10-30 19:55:00+00:00)")


  # Mock command line arguments, specifying test config file and bogus
  # metric data table name
  @patch_helpers.patchCLIArgs("taurus-model-latency-monitor",
                              "--monitorConfPath",
                              _TEST_CONF_FILEPATH,
                              "--metricDataTable",
                              "taurus.metric_data.test")
  # Prevent Taurus HTTP API calls
  @patch("requests.get", autospec=True)
  # Prevent boto dynamodb API calls
  @patch("boto.dynamodb2", autospec=True)
  @patch("taurus_monitoring.latency_monitor.model_latency_monitor.Table",
         autospec=True)
  # Fix datetime.datetime.now() to known holiday
  @patch_helpers.patchNow(
    pytz.timezone("UTC").localize(datetime.datetime(2015, 1, 1, 18, 0, 0, 0)))
  # Disable pylint warning re: unused botoDynamoDB2Mock argument
  # pylint: disable=W0613
  def testMarketHolidays(self, tableMock, botoDynamoDB2Mock, requestsGetMock):

    # Mock API to return pre-defined models in lieu of making an API call to
    # a live taurus models HTTP endpoint
    requestsGetMock.return_value = Mock(status_code=200,
                                        json=Mock(return_value=MODELS))

    # Mock boto dynamodb queries by returning locally cached metric data.
    # See data/*-data.pickle
    # Disable pylint warning about unused, and improperly named arguments
    # pylint: disable=W0613,C0103
    def query2SideEffect(uid__eq, timestamp__gte):
      return METRIC_DATA_BY_ID[uid__eq]

    tableMock.return_value = (
      Mock(query_2=Mock(side_effect=query2SideEffect,
                        __name__=str(id(query2SideEffect))))
    )

    # This should not raise an exception
    with patch("taurus_monitoring.latency_monitor.model_latency_monitor.isOuts"
               "ideMarketHours",
               Mock(wraps=isOutsideMarketHours)) as isOutsideMarketHoursMock:
      ModelLatencyChecker().checkAllModelLatency()

    self.assertTrue(isOutsideMarketHoursMock.called)

    # Now, check to see if we attempted to query dynamodb
    stockModelUIDs = [model["uid"] for model in MODELS]

    for (_, kwargs) in tableMock.return_value.query_2.call_args_list:
      for uid in stockModelUIDs:
        if kwargs["uid__eq"] == uid:
          self.fail("Dynamodb was queried for a stock model after hours")


  # Mock command line arguments, specifying test config file and bogus
  # metric data table name
  @patch_helpers.patchCLIArgs("taurus-model-latency-monitor",
                              "--monitorConfPath",
                              _TEST_CONF_FILEPATH,
                              "--metricDataTable",
                              "taurus.metric_data.test")
  # Prevent Taurus HTTP API calls
  @patch("requests.get", autospec=True)
  # Prevent boto dynamodb API calls
  @patch("boto.dynamodb2", autospec=True)
  @patch("taurus_monitoring.latency_monitor.model_latency_monitor.Table",
         autospec=True)
  # Fix datetime.datetime.now() to known holiday
  @patch_helpers.patchNow(
    pytz.timezone("UTC").localize(datetime.datetime(2015, 1, 2, 23, 0, 0, 0)))
  # Disable pylint warning re: unused botoDynamoDB2Mock argument
  # pylint: disable=W0613
  def testMarketHours(self, tableMock, botoDynamoDB2Mock, requestsGetMock):

    # Mock API to return pre-defined models in lieu of making an API call to
    # a live taurus models HTTP endpoint
    requestsGetMock.return_value = Mock(status_code=200,
                                        json=Mock(return_value=MODELS))

    # Mock boto dynamodb queries by returning locally cached metric data.
    # See data/*-data.pickle
    # Disable pylint warning about unused, and improperly named arguments
    # pylint: disable=W0613,C0103
    def query2SideEffect(uid__eq, timestamp__gte):
      return METRIC_DATA_BY_ID[uid__eq]

    tableMock.return_value = (
      Mock(query_2=Mock(side_effect=query2SideEffect,
                        __name__=str(id(query2SideEffect))))
    )

    # This should not raise an exception
    with patch("taurus_monitoring.latency_monitor.model_latency_monitor.isOuts"
               "ideMarketHours",
               Mock(wraps=isOutsideMarketHours)) as isOutsideMarketHoursMock:
      ModelLatencyChecker().checkAllModelLatency()

    self.assertTrue(isOutsideMarketHoursMock.called)

    # Now, check to see if we attempted to query dynamodb
    stockModelUIDs = [model["uid"] for model in MODELS]

    for (_, kwargs) in tableMock.return_value.query_2.call_args_list:
      for uid in stockModelUIDs:
        if kwargs["uid__eq"] == uid:
          self.fail("Dynamodb was queried for a stock model after hours")


  # Mock command line arguments, specifying test config file and bogus
  # metric data table name
  @patch_helpers.patchCLIArgs("taurus-model-latency-monitor",
                              "--monitorConfPath",
                              _TEST_CONF_FILEPATH,
                              "--metricDataTable",
                              "taurus.metric_data.test")
  # Prevent Taurus HTTP API calls
  @patch("requests.get", autospec=True)
  # Disable pylint warning re: unused botoDynamoDB2Mock argument
  # pylint: disable=W0613
  def testCheckAllModelLatencyGracefullyHandlesAPIFailure(self,
      requestsGetMock):

    # Mock API to return 500 status in lieu of making an API call to a live
    # taurus models HTTP endpoint
    requestsGetMock.return_value = Mock(status_code=500)

    with self.assertRaises(LatencyMonitorError) as exc:
      ModelLatencyChecker().checkAllModelLatency()

    self.assertIn(
      ("Unable to query Taurus API for active models: Unexpected HTTP response"
       " status (500) from taurusModelsUrl"),
      exc.exception.message)


  # Mock command line arguments, specifying test config file and bogus
  # metric data table name
  @patch_helpers.patchCLIArgs("taurus-model-latency-monitor",
                              "--monitorConfPath",
                              _TEST_CONF_FILEPATH,
                              "--metricDataTable",
                              "taurus.metric_data.test")
  # Prevent Taurus HTTP API calls
  @patch("requests.get", autospec=True)
  # Prevent boto dynamodb API calls
  @patch("boto.dynamodb2", autospec=True)
  @patch("taurus_monitoring.latency_monitor.model_latency_monitor.Table",
         autospec=True)
  # Fix datetime.datetime.now() to known time relative to cached metric data
  @patch_helpers.patchNow(
    pytz.timezone("UTC").localize(
      datetime.datetime(2015, 11, 2, 20, 41, 0, 0)))
  # Disable pylint warning re: unused botoDynamoDB2Mock argument
  # pylint: disable=W0613
  def testCheckAllModelLatencyGracefullyHandlesNoMetricData(self, tableMock,
      botoDynamoDB2Mock, requestsGetMock):

    # Mock API to return pre-defined models in lieu of making an API call to
    # a live taurus models HTTP endpoint
    requestsGetMock.return_value = Mock(status_code=200,
                                        json=Mock(return_value=MODELS))

    # Mock boto dynamodb queries by returning locally cached metric data.
    # See data/*-data.pickle
    # Disable pylint warning about unused, and improperly named arguments
    # pylint: disable=W0613,C0103
    def query2SideEffect(uid__eq, timestamp__gte):
      return []

    tableMock.return_value = (
      Mock(query_2=Mock(side_effect=query2SideEffect,
                        __name__=str(id(query2SideEffect))))
    )

    with self.assertRaises(LatencyMonitorError) as exc:
      ModelLatencyChecker().checkAllModelLatency()

    self.assertEqual(
      exc.exception.message,
      "The following models have exceeded the acceptable threshold for time si"
      "nce last timestamp in taurus.metric_data.test DynamoDB table:\n    Late"
      "ncyMonitorErrorParams(model_name=TWITTER.TWEET.HANDLE.SPG.VOLUME, model"
      "_uid=0021c2d17c0a4eb4965b6cb315c1d2e9, threshold=None seconds, last_tim"
      "estamp=None)\n    LatencyMonitorErrorParams(model_name=XIGNITE.TRI.VOLU"
      "ME, model_uid=00261089e61b4af1a1e4b3d0c06aa84a, threshold=None seconds,"
      " last_timestamp=None)\n    LatencyMonitorErrorParams(model_name=XIGNITE"
      ".BK.CLOSINGPRICE, model_uid=018662cc75b14860b72319d92883c896, threshold"
      "=None seconds, last_timestamp=None)")


  # Mock command line arguments, specifying test config file and ommitting
  # metric data table name
  @patch_helpers.patchCLIArgs("taurus-model-latency-monitor",
                              "--monitorConfPath",
                              _TEST_CONF_FILEPATH)
  def testMissingMetricDataTableArgRaisesParserError(self):

    # Assert that not specifying a required --metricDataTable option will
    # result in a parser error, and consequently a sys.exit(), as indicated by
    # the SystemExit exception
    with self.assertRaises(SystemExit):
      ModelLatencyChecker().checkAllModelLatency()


  # Mock command line arguments, omitting config file and specifying bogus
  # metric data table name
  @patch_helpers.patchCLIArgs("taurus-model-latency-monitor",
                              "--metricDataTable",
                              "taurus.metric_data.test")
  def testMissingMonitorConfPathArgRaisesParserError(self):

    # Assert that not specifying a required --monitorConfPath option will
    # result in a parser error, and consequently a sys.exit(), as indicated by
    # the SystemExit exception
    with self.assertRaises(SystemExit):
      ModelLatencyChecker().checkAllModelLatency()


  # Prevent ModelLatencyChecker from actually being instantiated
  @patch("taurus_monitoring.latency_monitor.model_latency_monitor"
         ".ModelLatencyChecker", autospec=True)
  # Disable "method could be a function" pylint warning
  # pylint: disable=R0201
  def testMain(self, modelLatencyCheckerMock):
    main()
    modelLatencyCheckerMock.assert_called_once_with()
    modelLatencyCheckerMock.return_value.checkAll.assert_called_once_with()


  # Mock command line arguments, specifying bogus config file and metric data
  # table name
  @patch_helpers.patchCLIArgs("taurus-model-latency-monitor",
                              "--monitorConfPath",
                              _TEST_CONF_FILEPATH,
                              "--metricDataTable",
                              "taurus.metric_data.test")
  def testRegisterCheckRegisteredOnlyCheckAllModelLatency(self):
    modelLatencyChecker = ModelLatencyChecker()
    self.assertEqual(len(modelLatencyChecker.checks), 1)
    self.assertSetEqual(set(fn.func_name for fn in modelLatencyChecker.checks),
                        set(["checkAllModelLatency"]))



if __name__ == "__main__":
  # TODO: Remove (or retain) this pending resolution of
  # "PROPOSAL: setup.py test runner"
  unittest.main()
