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
Unit tests for taurus_metric_collectors.delete_companies
"""

# Disable warning "access to protected member" and "method could be a function"
# pylint: disable=W0212,R0201


import time
import unittest
import uuid

import mock
from mock import ANY, Mock, patch


from nta.utils.test_utils import time_test_utils
from nta.utils import prompt_utils

from taurus_metric_collectors import delete_companies



class DeleteCompaniesTestCase(unittest.TestCase):


  @patch("taurus_metric_collectors.collectorsdb.engineFactory",
         autospec=True)
  @patch("taurus_metric_collectors.delete_companies"
         "._flushTaurusEngineMetricDataPath",
         spec_set=delete_companies._flushTaurusEngineMetricDataPath)
  @patch("taurus_metric_collectors.metric_utils.getAllMetricSecurities",
         autospec=True)
  @patch("taurus_metric_collectors.metric_utils.getAllCustomMetrics",
         autospec=True)
  @patch("taurus_metric_collectors.metric_utils.deleteMetric",
         autospec=True)
  def testDeleteCompanies(self,
                          deleteMetricMock,
                          getAllCustomMetricsMock,
                          getAllMetricSecuritiesMock,
                          _flushTaurusEngineMetricDataPathMock,
                          engineFactoryMock):
    negatives = set([
      "TWITTER.TWEET.HANDLE.ZZZ.VOLUME",
      "XIGNITE.ZZZ.CLOSINGPRICE",
      "XIGNITE.FOOBARZZZ.CLOSINGPRICE",
      "XIGNITE.ZZZFOOBAR.CLOSINGPRICE",
      "XIGNITE.FOOBAR.ZZZ.VOLUME",
      "XIGNITE.NEWS.FOOBAR.ZZZ.VOLUME",
      "FOOBAR.VOLUME",
      ".FOOBAR.CLOSINGPRICE",
      "XIGNITE.FOOBAR.",
      "FOOBARCLOSINGPRICE",
    ])

    positives = set([
      "XIGNITE.FOOBAR.CLOSINGPRICE",
      "XIGNITE.FOOBAR.VOLUME",
      "TWITTER.TWEET.HANDLE.FOOBAR.VOLUME",
      "XIGNITE.NEWS.FOOBAR.VOLUME",
      "XIGNITE.DOLITTLE.VOLUME",
    ])

    # Patch getAllCustomMetrics to return all negatives and positives
    getAllCustomMetricsMock.return_value = [
      {"uid": uuid.uuid1().hex, "name": metric}
      for metric in negatives.union(positives)
    ]

    # Simulate xitgnite_security found for first symbol, but not the second one.
    engineFactoryMock.return_value.begin.return_value.__enter__.return_value \
      .execute.side_effect = [Mock(rowcount=1), Mock(rowcount=0)]

    getAllMetricSecuritiesMock.return_value = [
      ("IBM", "exg"),
      ("T", "exg")
    ]

    # Execute the function under test
    delete_companies.deleteCompanies(
      tickerSymbols=("FOOBAR", "DOLITTLE"),
      engineServer="host",
      engineApiKey="apikey",
      warnAboutDestructiveAction=False)

    # Verify that deleteMetric was called only on the positives
    expectedDeleteMetricCalls = [
      mock.call(host="host", apiKey="apikey", metricName=metric)
      for metric in positives
    ]

    self.maxDiff = None
    self.assertItemsEqual(deleteMetricMock.call_args_list,
                          expectedDeleteMetricCalls)

    self.assertEqual(engineFactoryMock.return_value.begin.return_value
                     .__enter__.return_value.execute.call_count, 2)



  @patch("taurus_metric_collectors.delete_companies.collectorsdb.engineFactory",
         autospec=True)
  @patch("taurus_metric_collectors.delete_companies"
         "._flushTaurusEngineMetricDataPath",
         spec_set=delete_companies._flushTaurusEngineMetricDataPath)
  @patch("taurus_metric_collectors.delete_companies"
         "._warnAboutDestructiveAction",
         spec_set=delete_companies._warnAboutDestructiveAction)
  @patch("taurus_metric_collectors.metric_utils.getAllMetricSecurities",
         autospec=True)
  @patch("taurus_metric_collectors.metric_utils.getAllCustomMetrics",
         autospec=True)
  @patch("taurus_metric_collectors.metric_utils.deleteMetric",
         autospec=True)
  def testDeleteCompaniesWithWarningConfirmation(
      self,
      deleteMetricMock,
      getAllCustomMetricsMock,
      getAllMetricSecuritiesMock,
      warnAboutDestructiveActionMock,
      _flushTaurusEngineMetricDataPathMock,
      engineFactoryMock):

    negatives = set([
      "TWITTER.TWEET.HANDLE.ZZZ.VOLUME",
    ])

    positives = set([
      "XIGNITE.FOOBAR.CLOSINGPRICE",
    ])

    # Patch getAllCustomMetrics to return all negatives and positives
    getAllCustomMetricsMock.return_value = [
      {"uid": uuid.uuid1().hex, "name": metric}
      for metric in negatives.union(positives)
    ]

    engineFactoryMock.return_value.begin.return_value.__enter__.return_value \
      .execute.return_value.rowcount = 1

    getAllMetricSecuritiesMock.return_value = [
      ("IBM", "exg"),
      ("T", "exg")
    ]

    # Execute the function under test with default warnAboutDestructiveAction
    delete_companies.deleteCompanies(
      tickerSymbols=("FOOBAR", "DOLITTLE"),
      engineServer="host",
      engineApiKey="apikey")

    # Verify that _warnAboutDestructiveAction was called
    self.assertEqual(warnAboutDestructiveActionMock.call_count, 1)

    # Verify that deleteMetric was called only on the positives
    expectedDeleteMetricCalls = [
      mock.call(host="host", apiKey="apikey", metricName=metric)
      for metric in positives
    ]

    self.maxDiff = None
    self.assertItemsEqual(deleteMetricMock.call_args_list,
                          expectedDeleteMetricCalls)

    self.assertEqual(engineFactoryMock.return_value.begin.return_value
                     .__enter__.return_value.execute.call_count, 1)


  @patch("taurus_metric_collectors.delete_companies"
         "._warnAboutDestructiveAction",
         spec_set=delete_companies._warnAboutDestructiveAction)
  def testDeleteCompaniesWithWarningRejection(self,
                                              warnAboutDestructiveActionMock):

    warnAboutDestructiveActionMock.side_effect = (
      delete_companies.UserAbortedOperation)

    # Execute the function under test with default warnAboutDestructiveAction
    with self.assertRaises(delete_companies.UserAbortedOperation):
      delete_companies.deleteCompanies(
        tickerSymbols=("FOOBAR", "DOLITTLE"),
        engineServer="host",
        engineApiKey="apikey")

    # Verify that _warnAboutDestructiveAction was called
    self.assertEqual(warnAboutDestructiveActionMock.call_count, 1)


  @patch("taurus_metric_collectors.delete_companies"
         "._warnAboutDestructiveAction",
         spec_set=delete_companies._warnAboutDestructiveAction)
  def testDeleteCompaniesWithWarningTimeout(self,
                                            warnAboutDestructiveActionMock):

    warnAboutDestructiveActionMock.side_effect = (
      delete_companies.WarningPromptTimeout)

    # Execute the function under test with default warnAboutDestructiveAction
    with self.assertRaises(delete_companies.WarningPromptTimeout):
      delete_companies.deleteCompanies(
        tickerSymbols=("FOOBAR", "DOLITTLE"),
        engineServer="host",
        engineApiKey="apikey")

    # Verify that _warnAboutDestructiveAction was called
    self.assertEqual(warnAboutDestructiveActionMock.call_count, 1)


  @patch("taurus_metric_collectors.delete_companies"
         "._waitForFlusherAndGarbageCollect",
         spec_set=delete_companies._waitForFlusherAndGarbageCollect)
  @patch("taurus_metric_collectors.metric_utils.metricDataBatchWrite",
         autospec=True)
  def testFlushTaurusEngineMetricDataPath(self,
                                          metricDataBatchWriteMock,
                                          waitForFlusherAndGarbageCollectMock):

    delete_companies._flushTaurusEngineMetricDataPath(
      engineServer="host",
      engineApiKey="apikey")

    # Verity putSample called
    self.assertEqual(metricDataBatchWriteMock.return_value.__enter__ \
                     .return_value.call_count, 1)

    # Verify _waitForFlusherAndGarbageCollect call
    waitForFlusherAndGarbageCollectMock.assert_called_once_with(
      engineServer="host",
      engineApiKey="apikey",
      flusherMetricName=ANY)


  @patch("time.sleep", autospec=True)
  @patch("taurus_metric_collectors.metric_utils.getAllCustomMetrics",
         autospec=True)
  @patch("taurus_metric_collectors.metric_utils.deleteMetric",
         autospec=True)
  def testWaitForFlusherAndGarbageCollect(self,
                                          deleteMetricMock,
                                          getAllCustomMetricsMock,
                                          _timeSleepMock):
    oldFlusherMetricName = (
      delete_companies._DATA_PATH_FLUSHER_METRIC_PREFIX + "0")

    flusherMetricName = (
      delete_companies._DATA_PATH_FLUSHER_METRIC_PREFIX + "1")

    getAllCustomMetricsResultGroups = [
      [
        {"name": "XIGNITE.FOOBAR.CLOSINGPRICE"}
      ],

      [
        {"name": "XIGNITE.FOOBAR.CLOSINGPRICE"},

        {"name": oldFlusherMetricName}
      ],

      [
        {"name": "XIGNITE.FOOBAR.CLOSINGPRICE"},

        {"name": flusherMetricName}
      ],
    ]

    # Patch getAllCustomMetrics to return all negatives and positives
    getAllCustomMetricsMock.side_effect = iter(getAllCustomMetricsResultGroups)

    # Execute
    delete_companies._waitForFlusherAndGarbageCollect(
      engineServer="host",
      engineApiKey="apikey",
      flusherMetricName=flusherMetricName)

    # Validate

    self.assertEqual(getAllCustomMetricsMock.call_count,
                     len(getAllCustomMetricsResultGroups))

    expectedDeleteMetricCalls = [
      mock.call(host="host", apiKey="apikey", metricName=oldFlusherMetricName),
      mock.call(host="host", apiKey="apikey", metricName=flusherMetricName)
    ]

    self.assertSequenceEqual(deleteMetricMock.mock_calls,
                             expectedDeleteMetricCalls)


  @patch("time.sleep", autospec=True)
  @patch("time.time", autospec=True)
  @patch("taurus_metric_collectors.metric_utils.getAllCustomMetrics",
         autospec=True)
  def testWaitForFlusherAndGarbageCollectWithFlusherNotFound(
      self,
      getAllCustomMetricsMock,
      timeMock,
      sleepMock):

    time_test_utils.configureTimeAndSleepMocks(timeMock, sleepMock)

    flusherMetricName = (
      delete_companies._DATA_PATH_FLUSHER_METRIC_PREFIX + "1")


    # Patch getAllCustomMetrics to return all negatives and positives
    getAllCustomMetricsMock.return_value = [
      {"name": "XIGNITE.FOOBAR.CLOSINGPRICE"}
    ]

    # Execute and validate
    with self.assertRaises(delete_companies.FlusherMetricNotFound):
      delete_companies._waitForFlusherAndGarbageCollect(
        engineServer="host",
        engineApiKey="apikey",
        flusherMetricName=flusherMetricName)


  @patch("taurus_metric_collectors.delete_companies.prompt_utils"
         ".promptWithTimeout", autospec=True)
  @patch("taurus_metric_collectors.delete_companies.random.randint",
         autospec=True)
  def testWarnAboutDestructiveActionConfirmed(self, randintMock,
                                              promptWithTimeoutMock):
    randintMock.return_value = 1
    promptWithTimeoutMock.return_value = "Yes-1"

    delete_companies._warnAboutDestructiveAction(timeout=10,
                                                 tickerSymbols="FOO",
                                                 engineServer="host")

    promptWithTimeoutMock.assert_called_once_with(promptText=ANY,
                                                  timeout=10)


  @patch("taurus_metric_collectors.delete_companies.prompt_utils"
         ".promptWithTimeout", autospec=True)
  def testWarnAboutDestructiveActionRejected(self, promptWithTimeoutMock):
    # NOTE: rejection can be anything other than the expected input of
    # "Yes-<randint>"
    promptWithTimeoutMock.return_value = "No"

    with self.assertRaises(delete_companies.UserAbortedOperation):
      delete_companies._warnAboutDestructiveAction(timeout=10,
                                                   tickerSymbols="FOO",
                                                   engineServer="host")


  @patch("taurus_metric_collectors.delete_companies.prompt_utils"
         ".promptWithTimeout", autospec=True)
  def testWarnAboutDestructiveActionTimedOut(self, promptWithTimeoutMock):

    # NOTE: py.test by default captures console output and patches console input
    # such that raw_input fails. Although not ideal, we have to patch
    # raw_input with something else that blocks and will be interrupted by
    # SIGINT.
    promptWithTimeoutMock.side_effect = prompt_utils.PromptTimeout

    with self.assertRaises(delete_companies.WarningPromptTimeout):
      delete_companies._warnAboutDestructiveAction(timeout=0.001,
                                                   tickerSymbols="FOO",
                                                   engineServer="host")



if __name__ == "__main__":
  unittest.main()
