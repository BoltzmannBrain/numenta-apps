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
unit tests for
taurus_metric_collectors.common_services.metric_maintenance_agent
"""

# Disable warning "access to protected member"
# pylint: disable=W0212

from __future__ import print_function


import copy
from mock import Mock, patch
import unittest

from nta.utils.test_utils import config_test_utils

import taurus_metric_collectors
import taurus_metric_collectors.common_services.metric_maintenance_agent as \
       agent
from taurus_metric_collectors import delete_companies



class MetricMaintenanceAgentTestCase(unittest.TestCase):


  def testParseArgs(self):
    self.assertIsNone(agent._parseArgs([]))


  def testParseArgsHelp(self):
    with self.assertRaises(SystemExit) as assertContext:
      agent._parseArgs(["--help"])

    self.assertEqual(assertContext.exception.code, 0)


  def testParseArgsUnexpectedOption(self):
    with self.assertRaises(SystemExit) as assertContext:
      agent._parseArgs(["--zz"])

    self.assertEqual(assertContext.exception.code, 2)


  def testParseArgsUnexpectedPositionalArg(self):
    with self.assertRaises(SystemExit) as assertContext:
      agent._parseArgs(["1"])

    self.assertEqual(assertContext.exception.code, 2)


  @patch("taurus_metric_collectors.common_services.metric_maintenance_agent"
         ".time.sleep", autospec=True)
  @patch("taurus_metric_collectors.common_services.metric_maintenance_agent"
         "._promoteReadyMetricsToModels", autospec=True)
  @patch("taurus_metric_collectors.common_services.metric_maintenance_agent"
         "._purgeDeprecatedCompanies", autospec=True)
  @patch("taurus_metric_collectors.common_services.metric_maintenance_agent"
         "._parseArgs", autospec=True)
  def testMainSkipsAndReturns0InHotStandbyMode(self,
                                               _parseArgsMock,
                                               purgeDeprecatedCompaniesMock,
                                               promoteReadyMetricsToModelsMock,
                                               timeSleepMock):

    configPatch = config_test_utils.ConfigAttributePatch(
      configName=taurus_metric_collectors.config.CONFIG_NAME,
      baseConfigDir=taurus_metric_collectors.config.CONFIG_DIR,
      values=[
        ("metric_maintenance_agent", "opmode",
         taurus_metric_collectors.config.OP_MODE_HOT_STANDBY)
      ])

    timeSleepMock.side_effect = AssertionError("Unexpected time.sleep() call")

    with configPatch:
      returnCode = agent.main()

    self.assertEqual(returnCode, 0)

    self.assertEqual(purgeDeprecatedCompaniesMock.call_count, 0)
    self.assertEqual(promoteReadyMetricsToModelsMock.call_count, 0)


  @patch("taurus_metric_collectors.common_services.metric_maintenance_agent"
         ".time.sleep", autospec=True)
  @patch("taurus_metric_collectors.common_services.metric_maintenance_agent"
         "._promoteReadyMetricsToModels", autospec=True)
  @patch("taurus_metric_collectors.common_services.metric_maintenance_agent"
         "._purgeDeprecatedCompanies", autospec=True)
  @patch("taurus_metric_collectors.common_services.metric_maintenance_agent"
         "._parseArgs", autospec=True)
  def testMainInActiveMode(self,
                           _parseArgsMock,
                           purgeDeprecatedCompaniesMock,
                           promoteReadyMetricsToModelsMock,
                           timeSleepMock):

    configPatch = config_test_utils.ConfigAttributePatch(
      configName=taurus_metric_collectors.config.CONFIG_NAME,
      baseConfigDir=taurus_metric_collectors.config.CONFIG_DIR,
      values=[
        ("metric_maintenance_agent", "opmode",
         taurus_metric_collectors.config.OP_MODE_ACTIVE)
      ])

    class ExitFromMain(Exception):
      pass

    timeSleepMock.side_effect = [None, ExitFromMain]

    with configPatch:
      with self.assertRaises(ExitFromMain):
        agent.main()

    self.assertEqual(purgeDeprecatedCompaniesMock.call_count, 1)
    self.assertEqual(promoteReadyMetricsToModelsMock.call_count, 2)
    self.assertEqual(timeSleepMock.call_count, 2)


  @patch("taurus_metric_collectors.common_services.metric_maintenance_agent"
         ".time.sleep", autospec=True)
  @patch("taurus_metric_collectors.common_services.metric_maintenance_agent"
         "._promoteReadyMetricsToModels", autospec=True)
  @patch("taurus_metric_collectors.common_services.metric_maintenance_agent"
         "._purgeDeprecatedCompanies", autospec=True)
  @patch("taurus_metric_collectors.common_services.metric_maintenance_agent"
         "._parseArgs", autospec=True)
  def testMainHandlesKeyboardInterruptReturns0(self,
                                               _parseArgsMock,
                                               purgeDeprecatedCompaniesMock,
                                               promoteReadyMetricsToModelsMock,
                                               timeSleepMock):

    configPatch = config_test_utils.ConfigAttributePatch(
      configName=taurus_metric_collectors.config.CONFIG_NAME,
      baseConfigDir=taurus_metric_collectors.config.CONFIG_DIR,
      values=[
        ("metric_maintenance_agent", "opmode",
         taurus_metric_collectors.config.OP_MODE_ACTIVE)
      ])

    timeSleepMock.side_effect = KeyboardInterrupt

    with configPatch:
      returnCode = agent.main()

    self.assertEqual(returnCode, 0)
    self.assertEqual(purgeDeprecatedCompaniesMock.call_count, 1)
    self.assertEqual(promoteReadyMetricsToModelsMock.call_count, 1)
    self.assertEqual(timeSleepMock.call_count, 1)


  def testFilterMetricsReadyForPromotion(self):

    # Emulate result of metric_utils.getMetricsConfiguration()
    metricsConfig = {
      "3M": {
        "metrics": {
          "READY1.MMM.SUFFIX": {
          },
          "READY2.MMM.SUFFIX": {
          },
          "NOTREADY1.MMM.ALREADY_MONITORED": {
          },
          "NOTREADY2.MMM.NOT_ENOUGH_DATA": {
          }
        }
      },
      "ACE Ltd": {
        "metrics": {
          "READY1.ACE.SUFFIX": {
          }
        }
      }
    }

    # Emulate result of metric_utils.getAllCustomMetrics()
    allCustomMetrics = [
      dict(
        name="READY1.MMM.SUFFIX",
        status=agent._METRIC_STATUS_UNMONITORED,
        last_rowid=agent._NUM_METRIC_DATA_ROWS_THRESHOLD
      ),
      dict(
        name="READY2.MMM.SUFFIX",
        status=agent._METRIC_STATUS_UNMONITORED,
        last_rowid=agent._NUM_METRIC_DATA_ROWS_THRESHOLD + 1
      ),
      dict(
        name="READY1.ACE.SUFFIX",
        status=agent._METRIC_STATUS_UNMONITORED,
        last_rowid=agent._NUM_METRIC_DATA_ROWS_THRESHOLD * 2
      ),

      dict(
        name="NOTREADY1.MMM.ALREADY_MONITORED",
        status=agent._METRIC_STATUS_ACTIVE,
        last_rowid=agent._NUM_METRIC_DATA_ROWS_THRESHOLD + 1
      ),
      dict(
        name="NOTREADY2.MMM.NOT_ENOUGH_DATA",
        status=agent._METRIC_STATUS_UNMONITORED,
        last_rowid=agent._NUM_METRIC_DATA_ROWS_THRESHOLD - 1
      ),
      dict(
        name="NOTREADY2.ACE.NOT_IN_METRICS_CONFIG",
        status=agent._METRIC_STATUS_UNMONITORED,
        last_rowid=agent._NUM_METRIC_DATA_ROWS_THRESHOLD + 1
      )
    ]

    readyMetricNames = agent._filterMetricsReadyForPromotion(
      metricsConfig=metricsConfig,
      allCustomMetrics=allCustomMetrics)

    expected = [
      "READY1.MMM.SUFFIX",
      "READY2.MMM.SUFFIX",
      "READY1.ACE.SUFFIX"
    ]

    self.assertItemsEqual(expected, readyMetricNames)


  def testFilterMetricsReadyForPromotionWithNoneReady(self):

    # Emulate result of metric_utils.getMetricsConfiguration()
    metricsConfig = {
      "3M": {
        "metrics": {
          "NOTREADY1.MMM.ALREADY_MONITORED": {
          },
          "NOTREADY2.MMM.NOT_ENOUGH_DATA": {
          }
        }
      }
    }


    # Emulate result of metric_utils.getAllCustomMetrics()
    allCustomMetrics = [
      dict(
        name="NOTREADY1.MMM.ALREADY_MONITORED",
        status=agent._METRIC_STATUS_ACTIVE,
        last_rowid=agent._NUM_METRIC_DATA_ROWS_THRESHOLD + 1
      ),
      dict(
        name="NOTREADY2.MMM.NOT_ENOUGH_DATA",
        status=agent._METRIC_STATUS_UNMONITORED,
        last_rowid=agent._NUM_METRIC_DATA_ROWS_THRESHOLD - 1
      ),
      dict(
        name="NOTREADY2.ACE.NOT_IN_METRICS_CONFIG",
        status=agent._METRIC_STATUS_UNMONITORED,
        last_rowid=agent._NUM_METRIC_DATA_ROWS_THRESHOLD + 1
      )
    ]

    readyMetricNames = agent._filterMetricsReadyForPromotion(
      metricsConfig=metricsConfig,
      allCustomMetrics=allCustomMetrics)

    expected = []

    self.assertItemsEqual(expected, readyMetricNames)


  @patch("taurus_metric_collectors.metric_utils.getMetricsConfiguration",
         autospec=True)
  @patch("taurus_metric_collectors.metric_utils.getAllCustomMetrics",
         autospec=True)
  @patch("taurus_metric_collectors.metric_utils.createAllModels",
         autospec=True)
  def testPromoteReadyMetricsToModels(self,
                                      createAllModelsMock,
                                      getAllCustomMetricsMock,
                                      getMetricsConfigurationMock):

    # Emulate result of metric_utils.getMetricsConfiguration()
    metricsConfig = {
      "3M": {
        "metrics": {
          "READY1.MMM.SUFFIX": {
          },
          "READY2.MMM.SUFFIX": {
          },
          "NOTREADY1.MMM.ALREADY_MONITORED": {
          },
          "NOTREADY2.MMM.NOT_ENOUGH_DATA": {
          }
        }
      },
      "ACE Ltd": {
        "metrics": {
          "READY1.ACE.SUFFIX": {
          }
        }
      }
    }

    getMetricsConfigurationMock.return_value = copy.deepcopy(metricsConfig)

    # Emulate result of metric_utils.getAllCustomMetrics()
    allCustomMetrics = [
      dict(
        name="READY1.MMM.SUFFIX",
        status=agent._METRIC_STATUS_UNMONITORED,
        last_rowid=agent._NUM_METRIC_DATA_ROWS_THRESHOLD
      ),
      dict(
        name="READY2.MMM.SUFFIX",
        status=agent._METRIC_STATUS_UNMONITORED,
        last_rowid=agent._NUM_METRIC_DATA_ROWS_THRESHOLD + 1
      ),
      dict(
        name="READY1.ACE.SUFFIX",
        status=agent._METRIC_STATUS_UNMONITORED,
        last_rowid=agent._NUM_METRIC_DATA_ROWS_THRESHOLD * 2
      ),

      dict(
        name="NOTREADY1.MMM.ALREADY_MONITORED",
        status=agent._METRIC_STATUS_ACTIVE,
        last_rowid=agent._NUM_METRIC_DATA_ROWS_THRESHOLD + 1
      ),
      dict(
        name="NOTREADY2.MMM.NOT_ENOUGH_DATA",
        status=agent._METRIC_STATUS_UNMONITORED,
        last_rowid=agent._NUM_METRIC_DATA_ROWS_THRESHOLD - 1
      ),
      dict(
        name="NOTREADY2.ACE.NOT_IN_METRICS_CONFIG",
        status=agent._METRIC_STATUS_UNMONITORED,
        last_rowid=agent._NUM_METRIC_DATA_ROWS_THRESHOLD + 1
      )
    ]

    getAllCustomMetricsMock.return_value = copy.deepcopy(allCustomMetrics)

    # Execute
    agent._promoteReadyMetricsToModels()

    # Validate

    self.assertEqual(createAllModelsMock.call_count, 1)

    expected = [
      "READY1.MMM.SUFFIX",
      "READY2.MMM.SUFFIX",
      "READY1.ACE.SUFFIX"
    ]

    self.assertItemsEqual(expected,
                          createAllModelsMock.call_args[1]["onlyMetricNames"])


  @patch("taurus_metric_collectors.metric_utils.getMetricsConfiguration",
         autospec=True)
  @patch("taurus_metric_collectors.metric_utils.getAllCustomMetrics",
         autospec=True)
  @patch("taurus_metric_collectors.metric_utils.createAllModels",
         autospec=True)
  def testPromoteReadyMetricsToModelsWithNoneReady(self,
                                                   createAllModelsMock,
                                                   getAllCustomMetricsMock,
                                                   getMetricsConfigurationMock):

    # Emulate result of metric_utils.getMetricsConfiguration()
    metricsConfig = {
      "3M": {
        "metrics": {
          "NOTREADY1.MMM.ALREADY_MONITORED": {
          },
          "NOTREADY2.MMM.NOT_ENOUGH_DATA": {
          }
        }
      }
    }

    getMetricsConfigurationMock.return_value = copy.deepcopy(metricsConfig)

    # Emulate result of metric_utils.getAllCustomMetrics()
    allCustomMetrics = [
      dict(
        name="NOTREADY1.MMM.ALREADY_MONITORED",
        status=agent._METRIC_STATUS_ACTIVE,
        last_rowid=agent._NUM_METRIC_DATA_ROWS_THRESHOLD + 1
      ),
      dict(
        name="NOTREADY2.MMM.NOT_ENOUGH_DATA",
        status=agent._METRIC_STATUS_UNMONITORED,
        last_rowid=agent._NUM_METRIC_DATA_ROWS_THRESHOLD - 1
      ),
      dict(
        name="NOTREADY2.ACE.NOT_IN_METRICS_CONFIG",
        status=agent._METRIC_STATUS_UNMONITORED,
        last_rowid=agent._NUM_METRIC_DATA_ROWS_THRESHOLD + 1
      )
    ]

    getAllCustomMetricsMock.return_value = copy.deepcopy(allCustomMetrics)

    # Execute
    agent._promoteReadyMetricsToModels()

    # Validate
    self.assertEqual(createAllModelsMock.call_count, 0)


  @patch("taurus_metric_collectors.common_services.metric_maintenance_agent"
         ".collectorsdb.engineFactory", autospec=True)
  def testQueryCachedCompanySymbols(self, engineFactoryMock):
    rows = [
      Mock(symbol="foo"),
      Mock(symbol="bar"),
    ]
    engineFactoryMock.return_value.execute.return_value.fetchall.return_value \
      = rows

    symbols = agent._queryCachedCompanySymbols()

    self.assertItemsEqual(["foo", "bar"], symbols)


  @patch("taurus_metric_collectors.common_services.metric_maintenance_agent"
         ".collectorsdb.engineFactory", autospec=True)
  def testQueryCachedCompanySymbolsWithNothingCached(self, engineFactoryMock):
    engineFactoryMock.return_value.execute.return_value.fetchall.return_value \
      = []

    symbols = agent._queryCachedCompanySymbols()

    self.assertSequenceEqual([], symbols)


  @patch("taurus_metric_collectors.metric_utils.getAllMetricSecurities",
         autospec=True)
  @patch("taurus_metric_collectors.common_services.metric_maintenance_agent"
         "._queryCachedCompanySymbols", autospec=True)
  @patch("taurus_metric_collectors.common_services.metric_maintenance_agent"
         ".delete_companies.deleteCompanies",
         spec_set=delete_companies.deleteCompanies)
  def testPurgeDeprecatedCompanies(self,  # pylint: disable=R0201
                                   deleteCompaniesMock,
                                   queryCachedCompanySymbolsMock,
                                   getAllMetricSecuritiesMock):
    getAllMetricSecuritiesMock.return_value = [
      ("IBM", "exg"),
      ("T", "exg")
    ]

    queryCachedCompanySymbolsMock.return_value = set(["IBM", "T", "FOO", "BAR"])

    # Execute
    agent._purgeDeprecatedCompanies()

    # Validate
    deleteCompaniesMock.assert_called_once_with(
      tickerSymbols=set(["FOO", "BAR"]),
      engineServer=agent._TAURUS_HTM_SERVER,
      engineApiKey=agent._TAURUS_API_KEY,
      warnAboutDestructiveAction=False
    )


  @patch("taurus_metric_collectors.metric_utils.getAllMetricSecurities",
         autospec=True)
  @patch("taurus_metric_collectors.common_services.metric_maintenance_agent"
         "._queryCachedCompanySymbols", autospec=True)
  @patch("taurus_metric_collectors.common_services.metric_maintenance_agent"
         ".delete_companies.deleteCompanies",
         spec_set=delete_companies.deleteCompanies)
  def testPurgeDeprecatedCompaniesWithNoneDeprecated(
      self,
      deleteCompaniesMock,
      queryCachedCompanySymbolsMock,
      getAllMetricSecuritiesMock):

    getAllMetricSecuritiesMock.return_value = [
      ("IBM", "exg"),
      ("T", "exg")
    ]

    queryCachedCompanySymbolsMock.return_value = set(["IBM", "T"])

    # Execute
    agent._purgeDeprecatedCompanies()

    # Validate
    self.assertEqual(deleteCompaniesMock.call_count, 0)



if __name__ == "__main__":
  unittest.main()
