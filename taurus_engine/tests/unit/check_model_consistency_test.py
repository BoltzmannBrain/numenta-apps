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

"""Unit test for module taurus_engine.check_model_consistency"""


# Suppress pylint warnings concerning access to protected member
# pylint: disable=W0212

import copy
import json
import unittest

from mock import Mock, patch

from nta.utils.logging_support_raw import LoggingSupport

from htmengine.repository.queries import MetricStatus

from taurus_engine import check_model_consistency
from taurus_engine.runtime.dynamodb import dynamodb_service



def setUpModule():
  LoggingSupport.initTestApp()



# Parity between ACTIVE and dynamodb metrics; all metrics ACTIVE; no errors
_PERFECT_PARITY_ALL_ACTIVE = dict(
  # We only mock the properties used by the functions under test

  engineMetrics = [
    dict(
      uid="uid1",
      name="name1",
      server="server1",
      status=MetricStatus.ACTIVE,
      message=None,
      parameters=json.dumps(
        dict(
          metricSpec=dict(
            userInfo=dict(
              metricType="metricType1",
              metricTypeName="metricTypeName1",
              symbol="symbol1"))))
    ),


    dict(
      uid="uid2",
      name="name2",
      server="server2",
      status=MetricStatus.ACTIVE,
      message=None,
      parameters=json.dumps(
        dict(
          metricSpec=dict(
            userInfo=dict(
              metricType="metricType2",
              metricTypeName="metricTypeName2",
              symbol="symbol2"))))
    )
  ],


  dynamodbMetrics = [
    dict(
      uid="uid1",
      name="name1",
      display_name="server1",
      metricType="metricType1",
      metricTypeName="metricTypeName1",
      symbol="symbol1"
    ),

    dict(
      uid="uid2",
      name="name2",
      display_name="server2",
      metricType="metricType2",
      metricTypeName="metricTypeName2",
      symbol="symbol2"
    )
  ]

)



# Parity between ACTIVE metrics and dynamodb; one ERROR metric
_ACTIVE_PARITY_WITH_ONE_ERROR_METRIC = dict(
  # We only mock the properties used by the functions under test

  engineMetrics = [
    dict(
      uid="uid1",
      name="name1",
      server="server1",
      status=MetricStatus.ACTIVE,
      message=None,
      parameters=json.dumps(
        dict(
          metricSpec=dict(
            userInfo=dict(
              metricType="metricType1",
              metricTypeName="metricTypeName1",
              symbol="symbol1"))))
    ),


    dict(
      uid="uid2",
      name="name2",
      server="server2",
      status=MetricStatus.ERROR,
      message="error-message2",
      parameters=json.dumps(
        dict(
          metricSpec=dict(
            userInfo=dict(
              metricType="metricType2",
              metricTypeName="metricTypeName2",
              symbol="symbol2"))))
    )
  ],


  dynamodbMetrics = [
    dict(
      uid="uid1",
      name="name1",
      display_name="server1",
      metricType="metricType1",
      metricTypeName="metricTypeName1",
      symbol="symbol1"
    )
  ]

)



@patch("taurus_engine.check_model_consistency.logging_support",
       new=Mock(spec_set=check_model_consistency.logging_support))
class CheckModelConsitencyTestCase(unittest.TestCase):


  @patch("taurus_engine.check_model_consistency.checkAndReport", autospec=True)
  def testMainWithSuccess(self, checkAndReportMock):

    checkAndReportMock.return_value = 0

    self.assertEqual(check_model_consistency.main(args=[]), 0)


  @patch("taurus_engine.check_model_consistency.checkAndReport", autospec=True)
  def testMainWithErrorFromChecks(self, checkAndReportMock):

    checkAndReportMock.return_value = 1

    self.assertEqual(check_model_consistency.main(args=[]), 1)


  @patch("taurus_engine.check_model_consistency.checkAndReport", autospec=True)
  def testMainWithExceptionFromChecks(self, checkAndReportMock):

    class MyException(Exception):
      pass

    checkAndReportMock.side_effect = MyException

    with self.assertRaises(MyException):
      check_model_consistency.main(args=[])


  @patch("taurus_engine.check_model_consistency._parseArgs",
         autospec=True)
  @patch("taurus_engine.check_model_consistency.checkAndReport",
         autospec=True)
  def testMainSuppressesZeroCodeSystemExitFromParseArgs(self,
                                                        checkAndReportMock,
                                                        parseArgsMock):
    parseArgsMock.side_effect = SystemExit(0)

    self.assertEqual(check_model_consistency.main(args=[]), 0)

    self.assertEqual(checkAndReportMock.call_count, 0)


  @patch("taurus_engine.check_model_consistency._parseArgs",
         autospec=True)
  @patch("taurus_engine.check_model_consistency.checkAndReport",
         autospec=True)
  def testMainPassesNonZeroCodeSystemExitFromParseArgs(self,
                                                       checkAndReportMock,
                                                       parseArgsMock):
    exc = SystemExit(1)
    parseArgsMock.side_effect = exc

    with self.assertRaises(SystemExit) as excCtx:
      check_model_consistency.main(args=[])

    self.assertEqual(excCtx.exception.code, 1)

    self.assertEqual(checkAndReportMock.call_count, 0)


  @patch("taurus_engine.check_model_consistency.repository",
         autospec=True)
  @patch("taurus_engine.check_model_consistency._getMetricsFromDynamodb",
         autospec=True)
  @patch("taurus_engine.check_model_consistency._runAllChecks",
         autospec=True)
  @patch("taurus_engine.check_model_consistency.g_log",
         autospec=True)
  def testCheckAndReportWithoutErrorsAndWarnings(self,
                                                 logMock,
                                                 runAllChecksMock,
                                                 _getMetricsFromDynamodbMock,
                                                 _repositoryModuleMock,):

    runAllChecksMock.return_value = ((), ())

    result = check_model_consistency.checkAndReport(verbose=False,
                                                    warningsAsErrors=False)
    self.assertEqual(result, 0)
    self.assertEqual(logMock.handle.call_count, 0)

    # Check again with verbose and warningsAsErrors turned on
    result = check_model_consistency.checkAndReport(verbose=True,
                                                    warningsAsErrors=True)
    self.assertEqual(result, 0)

    logMock.info.assert_any_call("Warnings: 0")
    logMock.info.assert_any_call("Errors: 0")


  @patch("taurus_engine.check_model_consistency.repository",
         autospec=True)
  @patch("taurus_engine.check_model_consistency._getMetricsFromDynamodb",
         autospec=True)
  @patch("taurus_engine.check_model_consistency._runAllChecks",
         autospec=True)
  @patch("taurus_engine.check_model_consistency.g_log",
         autospec=True)
  def testCheckAndReportWithErrors(self,
                                   logMock,
                                   runAllChecksMock,
                                   _getMetricsFromDynamodbMock,
                                   _repositoryModuleMock,):

    warnings = ()
    errors = (("caption1", "details1"), ("caption2", "details2"))

    runAllChecksMock.return_value = (warnings, errors)

    result = check_model_consistency.checkAndReport(verbose=False,
                                                    warningsAsErrors=False)
    self.assertEqual(result, 1)

    logMock.error.assert_any_call("Errors: %s", 2)


  @patch("taurus_engine.check_model_consistency.repository",
         autospec=True)
  @patch("taurus_engine.check_model_consistency._getMetricsFromDynamodb",
         autospec=True)
  @patch("taurus_engine.check_model_consistency._runAllChecks",
         autospec=True)
  @patch("taurus_engine.check_model_consistency.g_log",
         autospec=True)
  def testCheckAndReportWithWarnings(self,
                                     logMock,
                                     runAllChecksMock,
                                     _getMetricsFromDynamodbMock,
                                     _repositoryModuleMock,):

    warnings = (("caption1", "details1"), ("caption2", "details2"))
    errors = ()

    runAllChecksMock.return_value = (warnings, errors)

    result = check_model_consistency.checkAndReport(verbose=False,
                                                    warningsAsErrors=False)
    self.assertEqual(result, 0)

    logMock.warn.assert_any_call("Warnings: %s", 2)


    # Check again with warningsAsErrors turned on
    result = check_model_consistency.checkAndReport(verbose=False,
                                                    warningsAsErrors=True)
    self.assertEqual(result, 1)


  def testRunAllChecksWithEmptyMetrics(self):
    result = check_model_consistency._runAllChecks(engineMetrics=(),
                                                   dynamodbMetrics=(),
                                                   verbose=False)
    self.assertEqual(result, ([], []))

    # Repeat with verbose=True
    result = check_model_consistency._runAllChecks(engineMetrics=(),
                                                   dynamodbMetrics=(),
                                                   verbose=True)
    self.assertEqual(result, ([], []))


  @patch("taurus_engine.check_model_consistency._checkFailedModels",
         autospec=True)
  @patch("taurus_engine.check_model_consistency._checkModelParity",
         autospec=True)
  @patch("taurus_engine.check_model_consistency._checkModelAttributeParity",
         autospec=True)
  def testRunAllChecksAggregatesErrorsAndWarnigs(self,
                                                 checkModelAttributeParity,
                                                 checkModelParityMock,
                                                 checkFailedModelssMock):

    checkModelAttributeParity.return_value = (
      [("w-caption1", "w-details1"), ("w-caption2", "w-details2")],
      [("e-caption1", "e-details1"), ("e-caption2", "e-details2")],
    )

    checkModelParityMock.return_value = (
      [("w-caption3", "w-details3"), ("w-caption4", "details4")],
      [("e-caption3", "e-details3"), ("e-caption4", "e-details4")],
    )

    checkFailedModelssMock.return_value = (
      [("w-caption5", "w-details5"), ("w-caption6", "w-details6")],
      [("e-caption5", "e-details5"), ("e-caption6", "e-details6")],
    )


    allExpectedWarnings = (
      checkModelAttributeParity.return_value[0] +
      checkModelParityMock.return_value[0] +
      checkFailedModelssMock.return_value[0]
    )

    allExpectedErrors = (
      checkModelAttributeParity.return_value[1] +
      checkModelParityMock.return_value[1] +
      checkFailedModelssMock.return_value[1]
    )

    warnings, errors = check_model_consistency._runAllChecks(engineMetrics=(),
                                                             dynamodbMetrics=(),
                                                             verbose=False)

    self.assertItemsEqual(warnings, allExpectedWarnings)
    self.assertItemsEqual(errors, allExpectedErrors)


  def testCheckModelAttributeParityWithoutErrors(self):

    result = check_model_consistency._checkModelAttributeParity(
      engineMetrics=_ACTIVE_PARITY_WITH_ONE_ERROR_METRIC["engineMetrics"],
      dynamodbMetrics=_ACTIVE_PARITY_WITH_ONE_ERROR_METRIC["dynamodbMetrics"],
      verbose=False)

    self.assertEqual(result, ([], []))

    result = check_model_consistency._checkModelAttributeParity(
      engineMetrics=_PERFECT_PARITY_ALL_ACTIVE["engineMetrics"],
      dynamodbMetrics=_PERFECT_PARITY_ALL_ACTIVE["dynamodbMetrics"],
      verbose=False)

    self.assertEqual(result, ([], []))


  def testCheckModelAttributeParityWithMismatches(self):
    engineMetrics = copy.deepcopy(_PERFECT_PARITY_ALL_ACTIVE["engineMetrics"])

    dynamodbMetrics = copy.deepcopy(
      _PERFECT_PARITY_ALL_ACTIVE["dynamodbMetrics"])


    dynamodbMetrics[0]["name"] = "eeename"
    dynamodbMetrics[0]["display_name"] = "eeedisplay_name"
    dynamodbMetrics[0]["metricType"] = "eeemetricType"
    dynamodbMetrics[0]["metricTypeName"] = "eeemetricTypeName"
    dynamodbMetrics[0]["symbol"] = "eeesymbol"


    warnings, errors = check_model_consistency._checkModelAttributeParity(
      engineMetrics=engineMetrics,
      dynamodbMetrics=dynamodbMetrics,
      verbose=False)

    self.assertEqual(warnings, [])
    self.assertEqual(len(errors), 1)


  def testCheckModelAttributeParityWithNameMismatch(self):
    engineMetrics = copy.deepcopy(_PERFECT_PARITY_ALL_ACTIVE["engineMetrics"])

    dynamodbMetrics = copy.deepcopy(
      _PERFECT_PARITY_ALL_ACTIVE["dynamodbMetrics"])

    dynamodbMetrics[0]["name"] = "eeename"

    warnings, errors = check_model_consistency._checkModelAttributeParity(
      engineMetrics=engineMetrics,
      dynamodbMetrics=dynamodbMetrics,
      verbose=False)

    self.assertEqual(warnings, [])
    self.assertEqual(len(errors), 1)


  def testCheckModelAttributeParityWithDisplayNameMismatch(self):
    engineMetrics = copy.deepcopy(_PERFECT_PARITY_ALL_ACTIVE["engineMetrics"])

    dynamodbMetrics = copy.deepcopy(
      _PERFECT_PARITY_ALL_ACTIVE["dynamodbMetrics"])

    dynamodbMetrics[0]["display_name"] = "eeedisplay_name"

    warnings, errors = check_model_consistency._checkModelAttributeParity(
      engineMetrics=engineMetrics,
      dynamodbMetrics=dynamodbMetrics,
      verbose=False)

    self.assertEqual(warnings, [])
    self.assertEqual(len(errors), 1)


  def testCheckModelAttributeParityWithMetricTypeMismatch(self):
    engineMetrics = copy.deepcopy(_PERFECT_PARITY_ALL_ACTIVE["engineMetrics"])

    dynamodbMetrics = copy.deepcopy(
      _PERFECT_PARITY_ALL_ACTIVE["dynamodbMetrics"])


    dynamodbMetrics[0]["metricType"] = "eeemetricType"

    warnings, errors = check_model_consistency._checkModelAttributeParity(
      engineMetrics=engineMetrics,
      dynamodbMetrics=dynamodbMetrics,
      verbose=False)

    self.assertEqual(warnings, [])
    self.assertEqual(len(errors), 1)


  def testCheckModelAttributeParityWithMetricTypeName(self):
    engineMetrics = copy.deepcopy(_PERFECT_PARITY_ALL_ACTIVE["engineMetrics"])

    dynamodbMetrics = copy.deepcopy(
      _PERFECT_PARITY_ALL_ACTIVE["dynamodbMetrics"])

    dynamodbMetrics[0]["metricTypeName"] = "eeemetricTypeName"

    warnings, errors = check_model_consistency._checkModelAttributeParity(
      engineMetrics=engineMetrics,
      dynamodbMetrics=dynamodbMetrics,
      verbose=False)

    self.assertEqual(warnings, [])
    self.assertEqual(len(errors), 1)


  def testCheckModelAttributeParityWithSymbolMismatch(self):
    engineMetrics = copy.deepcopy(_PERFECT_PARITY_ALL_ACTIVE["engineMetrics"])

    dynamodbMetrics = copy.deepcopy(
      _PERFECT_PARITY_ALL_ACTIVE["dynamodbMetrics"])

    dynamodbMetrics[0]["symbol"] = "eeesymbol"

    warnings, errors = check_model_consistency._checkModelAttributeParity(
      engineMetrics=engineMetrics,
      dynamodbMetrics=dynamodbMetrics,
      verbose=False)

    self.assertEqual(warnings, [])
    self.assertEqual(len(errors), 1)


  def testCheckModelParityWithoutErrors(self):

    result = check_model_consistency._checkModelParity(
      engineMetrics=_ACTIVE_PARITY_WITH_ONE_ERROR_METRIC["engineMetrics"],
      dynamodbMetrics=_ACTIVE_PARITY_WITH_ONE_ERROR_METRIC["dynamodbMetrics"],
      verbose=False)

    self.assertEqual(result, ([], []))


  def testCheckModelParityWithMoreInEngine(self):

    engineMetrics = [
      dict(
        uid="uid1",
        name="name1",
        server="server1",
        status=MetricStatus.ACTIVE,
        message=None,
        parameters=json.dumps(
          dict(
            metricSpec=dict(
              userInfo=dict(
                metricType="metricType1",
                metricTypeName="metricTypeName1",
                symbol="symbol1"))))
      ),


      dict(
        uid="uid2",
        name="name2",
        server="server2",
        status=MetricStatus.ACTIVE,
        message=None,
        parameters=json.dumps(
          dict(
            metricSpec=dict(
              userInfo=dict(
                metricType="metricType2",
                metricTypeName="metricTypeName2",
                symbol="symbol2"))))
      )
    ]


    dynamodbMetrics = [

      dict(
        uid="uid2",
        name="name2",
        display_name="server2",
        metricType="metricType2",
        metricTypeName="metricTypeName2",
        symbol="symbol2"
      )
    ]


    warnings, errors = check_model_consistency._checkModelParity(
      engineMetrics=engineMetrics,
      dynamodbMetrics=dynamodbMetrics,
      verbose=False)

    self.assertEqual(warnings, [])
    self.assertEqual(len(errors), 1)


  def testCheckModelParityWithMoreInDynamodb(self):

    engineMetrics = [
      dict(
        uid="uid1",
        name="name1",
        server="server1",
        status=MetricStatus.ACTIVE,
        message=None,
        parameters=json.dumps(
          dict(
            metricSpec=dict(
              userInfo=dict(
                metricType="metricType1",
                metricTypeName="metricTypeName1",
                symbol="symbol1"))))
      )
    ]


    dynamodbMetrics = [

      dict(
        uid="uid1",
        name="name1",
        display_name="server1",
        metricType="metricType1",
        metricTypeName="metricTypeName1",
        symbol="symbol1"
      ),

      dict(
        uid="uid2",
        name="name2",
        display_name="server2",
        metricType="metricType2",
        metricTypeName="metricTypeName2",
        symbol="symbol2"
      )
    ]


    warnings, errors = check_model_consistency._checkModelParity(
      engineMetrics=engineMetrics,
      dynamodbMetrics=dynamodbMetrics,
      verbose=False)

    self.assertEqual(warnings, [])
    self.assertEqual(len(errors), 1)


  def testCheckFailedModelsWithoutFailedModels(self):

    result = check_model_consistency._checkFailedModels(
      engineMetrics=_PERFECT_PARITY_ALL_ACTIVE["engineMetrics"],
      verbose=False)

    self.assertEqual(result, ([], []))

    # Repeat with verbose=True
    result = check_model_consistency._checkFailedModels(
      engineMetrics=_PERFECT_PARITY_ALL_ACTIVE["engineMetrics"],
      verbose=True)

    self.assertEqual(result, ([], []))


  def testCheckFailedModelsWithFailedModel(self):
    warnings, errors = check_model_consistency._checkFailedModels(
      engineMetrics=_ACTIVE_PARITY_WITH_ONE_ERROR_METRIC["engineMetrics"],
      verbose=False)

    self.assertEqual(len(warnings), 1)
    self.assertEqual(errors, [])


  @patch("taurus_engine.check_model_consistency"
         ".dynamodb_service.DynamoDBService.connectDynamoDB",
         spec_set=dynamodb_service.DynamoDBService.connectDynamoDB)
  @patch("taurus_engine.check_model_consistency"
         ".boto.dynamodb2.table.Table", autospec=True)
  def testGetMetricsFromDynamodb(self,
                                 dynamoTableClassMock,
                                 _connectDynamoDBMock):

    expectedResult = (Mock(), Mock(), Mock())

    dynamoTableClassMock.return_value.scan = Mock(
      return_value = (obj for obj in expectedResult),
      __name__="scan")

    result = check_model_consistency._getMetricsFromDynamodb(verbose=False)

    self.assertEqual(result, expectedResult)


  def testParseArgsWithoutArgs(self):
    args = check_model_consistency._parseArgs(args=[])
    self.assertEqual(args.verbose, False)
    self.assertEqual(args.warningsAsErrors, False)


  def testParseArgsWithVerboseAndWarningsAsErrors(self):
    args = check_model_consistency._parseArgs(
      args=["--verbose", "--warningsAsErrors"])

    self.assertEqual(args.verbose, True)
    self.assertEqual(args.warningsAsErrors, True)

    # Check short verbose option
    args = check_model_consistency._parseArgs(args=["-v"])
    self.assertEqual(args.verbose, True)

