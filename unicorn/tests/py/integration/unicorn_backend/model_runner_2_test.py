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

"""Intergration test of the unicorn_backend.model_runner module"""

from datetime import datetime
from datetime import timedelta
import json
import logging
import os
import subprocess
import sys
import tempfile
import types
import unittest
import uuid

import dateutil.parser
import dateutil.tz

from nupic.frameworks.opf.common_models.cluster_params import (
  getScalarMetricWithTimeOfDayAnomalyParams)
from unicorn_backend.utils import test_utils



_LOGGER = logging.getLogger("unicorn_model_runner_test")
_LOGGER.addHandler(logging.StreamHandler())



class ModelRunnerTestCase(unittest.TestCase):


  def setUp(self):
    swarmParams = getScalarMetricWithTimeOfDayAnomalyParams(
      metricData=[0],
      minVal=0,
      maxVal=100,
      minResolution=None)

    self.modelConfig = swarmParams["modelConfig"]
    self.inferenceArgs = swarmParams["inferenceArgs"]
    self.timestampFieldName = "c0"
    self.valueFieldName = "c1"


  @staticmethod
  def _startModelRunnerSubprocess(inputOpt, modelOpt, aggOpt):
    """Start the unicorn model_runner subprocess

    :param dict inputOpt: input options per input_opt_schema.json
    :param dict modelOpt: input options per model_opt_schema.json
    :param dict aggOpt: aggregation options per agg_opt_schema.json; None if no
      aggregation
    :returns: the started subprocess.Popen object wrapped in
      ManagedSubprocessTerminator
    :rtype: unicorn_backend.utils.test_utils.ManagedSubprocessTerminator
    """
    args = [
      sys.executable,
      "-m", "unicorn_backend.model_runner_2",
      "--input={}".format(json.dumps(inputOpt)),
      "--model={}".format(json.dumps(modelOpt)),
    ]

    if aggOpt is not None:
      args.append("--agg={}".format(json.dumps(aggOpt)))

    process = subprocess.Popen(
      args=args,
      stdin=subprocess.PIPE,
      stdout=subprocess.PIPE,
      stderr=subprocess.PIPE,
      close_fds=True)

    _LOGGER.info("Started unicorn model_runner subprocess=%s", process)
    return test_utils.ManagedSubprocessTerminator(process)


  def testStartAndStopModelRunnerNoAggregationOption(self):
    modelId = uuid.uuid1().hex

    inputOpt = dict(
      rowOffset=0,
      timestampIndex=0,
      valueIndex=1,
      datetimeFormat="%Y-%m-%dT%H:%M:%S.%f"
    )

    modelOpt = dict(
      modelId=modelId,
      modelConfig=self.modelConfig,
      inferenceArgs=self.inferenceArgs,
      timestampFieldName=self.timestampFieldName,
      valueFieldName=self.valueFieldName
    )

    with self._startModelRunnerSubprocess(inputOpt=inputOpt,
                                          modelOpt=modelOpt,
                                          aggOpt=None) as mrProcess:
      # Close the subprocess's stdin and wait for it to terminate
      mrProcess.stdin.close()
      mrProcess.wait()

      stdoutData = mrProcess.stdout.read()
      stderrData = mrProcess.stderr.read()

      self.assertEqual(stdoutData, "")
      self.assertEqual(stderrData, "")

      self.assertEqual(mrProcess.returncode, 0)


  def testStartAndStopModelRunnerWithAggregationOption(self):
    modelId = uuid.uuid1().hex

    inputOpt = dict(
      rowOffset=0,
      timestampIndex=0,
      valueIndex=1,
      datetimeFormat="%Y-%m-%dT%H:%M:%S.%f"
    )

    modelOpt = dict(
      modelId=modelId,
      modelConfig=self.modelConfig,
      inferenceArgs=self.inferenceArgs,
      timestampFieldName=self.timestampFieldName,
      valueFieldName=self.valueFieldName
    )

    aggOpt = dict(
      windowSize=300,
      func="sum"
    )

    with self._startModelRunnerSubprocess(inputOpt=inputOpt,
                                          modelOpt=modelOpt,
                                          aggOpt=aggOpt) as mrProcess:
      # Close the subprocess's stdin and wait for it to terminate
      mrProcess.stdin.close()
      mrProcess.wait()

      stdoutData = mrProcess.stdout.read()
      stderrData = mrProcess.stderr.read()

      self.assertEqual(stdoutData, "")
      self.assertEqual(stderrData, "")

      self.assertEqual(mrProcess.returncode, 0)


  def testModelRunnerFailsWithInvalidInputOpt(self):
    modelId = uuid.uuid1().hex

    inputOpt = None

    modelOpt = dict(
      modelId=modelId,
      modelConfig=self.modelConfig,
      inferenceArgs=self.inferenceArgs,
      timestampFieldName=self.timestampFieldName,
      valueFieldName=self.valueFieldName
    )

    with self._startModelRunnerSubprocess(inputOpt=inputOpt,
                                          modelOpt=modelOpt,
                                          aggOpt=None) as mrProcess:
      # Wait for it to terminate with error
      stdoutData, stderrData = mrProcess.communicate()

      self.assertEqual(mrProcess.returncode, 1)

      self.assertEqual(stdoutData, "")

      # Validate error info
      try:
        errorInfo = json.loads(stderrData)
      except ValueError:
        _LOGGER.exception("Failed while decoding model-runner's stderr=%s",
                          stderrData)
        raise

      self.assertIn("errorText", errorInfo)
      self.assertIsInstance(errorInfo["errorText"], types.StringTypes)
      self.assertGreater(len(errorInfo["errorText"]), 0)

      self.assertIn("diagnosticInfo", errorInfo)
      self.assertIsInstance(errorInfo["diagnosticInfo"], types.StringTypes)
      self.assertGreater(len(errorInfo["diagnosticInfo"]), 0)


  def testModelRunnerFailsWithInvalidModelOpt(self):
    inputOpt = dict(
      rowOffset=0,
      timestampIndex=0,
      valueIndex=1,
      datetimeFormat="%Y-%m-%dT%H:%M:%S.%f"
    )

    modelOpt = None

    with self._startModelRunnerSubprocess(inputOpt=inputOpt,
                                          modelOpt=modelOpt,
                                          aggOpt=None) as mrProcess:
      # Wait for it to terminate with error
      stdoutData, stderrData = mrProcess.communicate()

      self.assertEqual(mrProcess.returncode, 1)

      self.assertEqual(stdoutData, "")

      # Validate error info
      try:
        errorInfo = json.loads(stderrData)
      except ValueError:
        _LOGGER.exception("Failed while decoding model-runner's stderr=%s",
                          stderrData)
        raise

      self.assertIn("errorText", errorInfo)
      self.assertIsInstance(errorInfo["errorText"], types.StringTypes)
      self.assertGreater(len(errorInfo["errorText"]), 0)

      self.assertIn("diagnosticInfo", errorInfo)
      self.assertIsInstance(errorInfo["diagnosticInfo"], types.StringTypes)
      self.assertGreater(len(errorInfo["diagnosticInfo"]), 0)


  def testModelRunnerFailsWithInvalidAggOpt(self):
    modelId = uuid.uuid1().hex

    inputOpt = dict(
      rowOffset=0,
      timestampIndex=0,
      valueIndex=1,
      datetimeFormat="%Y-%m-%dT%H:%M:%S.%f"
    )

    modelOpt = dict(
      modelId=modelId,
      modelConfig=self.modelConfig,
      inferenceArgs=self.inferenceArgs,
      timestampFieldName=self.timestampFieldName,
      valueFieldName=self.valueFieldName
    )

    aggOpt = ""

    with self._startModelRunnerSubprocess(inputOpt=inputOpt,
                                          modelOpt=modelOpt,
                                          aggOpt=aggOpt) as mrProcess:
      # Wait for it to terminate with error
      stdoutData, stderrData = mrProcess.communicate()

      self.assertEqual(mrProcess.returncode, 1)

      self.assertEqual(stdoutData, "")

      # Validate error info
      try:
        errorInfo = json.loads(stderrData)
      except ValueError:
        _LOGGER.exception("Failed while decoding model-runner's stderr=%s",
                          stderrData)
        raise

      self.assertIn("errorText", errorInfo)
      self.assertIsInstance(errorInfo["errorText"], types.StringTypes)
      self.assertGreater(len(errorInfo["errorText"]), 0)

      self.assertIn("diagnosticInfo", errorInfo)
      self.assertIsInstance(errorInfo["diagnosticInfo"], types.StringTypes)
      self.assertGreater(len(errorInfo["diagnosticInfo"]), 0)


  def testModelRunnerDoesNotFailWithEmptyInputRecord(self):

    modelId = uuid.uuid1().hex

    inputOpt = dict(
      rowOffset=0,
      timestampIndex=0,
      valueIndex=1,
      datetimeFormat="%Y-%m-%dT%H:%M:%S.%f"
    )

    modelOpt = dict(
      modelId=modelId,
      modelConfig=self.modelConfig,
      inferenceArgs=self.inferenceArgs,
      timestampFieldName=self.timestampFieldName,
      valueFieldName=self.valueFieldName
    )

    aggOpt = None

    with self._startModelRunnerSubprocess(inputOpt=inputOpt,
                                          modelOpt=modelOpt,
                                          aggOpt=aggOpt) as mrProcess:

      mrProcess.communicate(input="[]\n")
      self.assertEqual(mrProcess.returncode, 0)


  def testModelRunnerFailsWithInvalidInputRecord(self):

    modelId = uuid.uuid1().hex

    inputOpt = dict(
      rowOffset=0,
      timestampIndex=0,
      valueIndex=1,
      datetimeFormat="%Y-%m-%dT%H:%M:%S.%f"
    )

    modelOpt = dict(
      modelId=modelId,
      modelConfig=self.modelConfig,
      inferenceArgs=self.inferenceArgs,
      timestampFieldName=self.timestampFieldName,
      valueFieldName=self.valueFieldName
    )

    aggOpt = None

    with self._startModelRunnerSubprocess(inputOpt=inputOpt,
                                          modelOpt=modelOpt,
                                          aggOpt=aggOpt) as mrProcess:
      # Wait for it to terminate with error
      stdoutData, stderrData = mrProcess.communicate(input="['a','b','c']\n")

      self.assertEqual(mrProcess.returncode, 1)

      self.assertEqual(stdoutData, "")

      # Validate error info
      try:
        errorInfo = json.loads(stderrData)
      except ValueError:
        _LOGGER.exception("Failed while decoding model-runner's stderr=%s",
                          stderrData)
        raise

      self.assertIn("errorText", errorInfo)
      self.assertIsInstance(errorInfo["errorText"], types.StringTypes)
      self.assertGreater(len(errorInfo["errorText"]), 0)

      self.assertIn("diagnosticInfo", errorInfo)
      self.assertIsInstance(errorInfo["diagnosticInfo"], types.StringTypes)
      self.assertGreater(len(errorInfo["diagnosticInfo"]), 0)


  def testInputViaStdinGetOutputWithoutAggregation(self):
    modelId = uuid.uuid1().hex

    inputOpt = dict(
      rowOffset=0,
      timestampIndex=0,
      valueIndex=1,
      datetimeFormat="%Y-%m-%dT%H:%M:%S.%f"
    )

    modelOpt = dict(
      modelId=modelId,
      modelConfig=self.modelConfig,
      inferenceArgs=self.inferenceArgs,
      timestampFieldName=self.timestampFieldName,
      valueFieldName=self.valueFieldName
    )

    aggOpt = None

    inputRows = [
      (datetime.utcnow(), i + 0.599) for i in xrange(10)
    ]

    with self._startModelRunnerSubprocess(inputOpt=inputOpt,
                                          modelOpt=modelOpt,
                                          aggOpt=aggOpt) as mrProcess:
      # Send all input rows to ModelRunner for processing
      inputString = "\n".join(
        "{},{}".format(inTimestamp.isoformat(), inValue)
        for inTimestamp, inValue in inputRows)

      _LOGGER.debug("Sending to ModelRunner: %r", inputString)

      mrProcess.stdin.write(inputString)
      mrProcess.stdin.close()


      for inTimestamp, inValue in inputRows:
        # Read output row and validate
        outputRecord = mrProcess.stdout.readline()

        _LOGGER.debug("Got result=%r", outputRecord)

        outTimestamp, outValue, anomalyLikelihood = json.loads(outputRecord)

        self.assertEqual(dateutil.parser.parse(outTimestamp), inTimestamp)
        self.assertEqual(outValue, inValue)
        self.assertIsInstance(anomalyLikelihood, float)


      # Wait for subprocess to terminate
      mrProcess.wait()
      stdoutData = mrProcess.stdout.read()
      stderrData = mrProcess.stderr.read()

      self.assertEqual(stdoutData, "")
      self.assertEqual(stderrData, "")

      self.assertEqual(mrProcess.returncode, 0)


  def testInputViaStdinGetOutputWithNonReducingAggregation(self):
    modelId = uuid.uuid1().hex

    inputOpt = dict(
      rowOffset=0,
      timestampIndex=0,
      valueIndex=1,
      datetimeFormat="%Y-%m-%dT%H:%M:%S.%f"
    )

    modelOpt = dict(
      modelId=modelId,
      modelConfig=self.modelConfig,
      inferenceArgs=self.inferenceArgs,
      timestampFieldName=self.timestampFieldName,
      valueFieldName=self.valueFieldName
    )

    aggOpt = dict(
      windowSize=300,
      func="sum"
    )

    now = datetime.utcnow()

    # Set up timestamps far enough apart such that aggregation should have no
    # effect
    inputRows = [
      (now + timedelta(seconds=aggOpt["windowSize"] * i), i + 0.599)
      for i in xrange(10)
    ]

    with self._startModelRunnerSubprocess(inputOpt=inputOpt,
                                          modelOpt=modelOpt,
                                          aggOpt=aggOpt) as mrProcess:
      # Send all input rows to ModelRunner for processing
      inputString = "\n".join(
        "{},{}".format(inTimestamp.isoformat(), inValue)
        for inTimestamp, inValue in inputRows)

      _LOGGER.debug("Sending to ModelRunner: %r", inputString)

      mrProcess.stdin.write(inputString)
      mrProcess.stdin.close()


      for inTimestamp, inValue in inputRows:
        # Read output row and validate
        outputRecord = mrProcess.stdout.readline()

        _LOGGER.debug("Got result=%r", outputRecord)

        outTimestamp, outValue, anomalyLikelihood = json.loads(outputRecord)

        self.assertEqual(dateutil.parser.parse(outTimestamp), inTimestamp)
        self.assertEqual(outValue, inValue)
        self.assertIsInstance(anomalyLikelihood, float)


      # Wait for subprocess to terminate
      mrProcess.wait()
      stdoutData = mrProcess.stdout.read()
      stderrData = mrProcess.stderr.read()

      self.assertEqual(stdoutData, "")
      self.assertEqual(stderrData, "")

      self.assertEqual(mrProcess.returncode, 0)


  def testInputViaStdinGetOutputWithReducingSumAggregation(self):
    modelId = uuid.uuid1().hex

    inputOpt = dict(
      rowOffset=0,
      timestampIndex=0,
      valueIndex=1,
      datetimeFormat="%Y-%m-%dT%H:%M:%S.%f"
    )

    modelOpt = dict(
      modelId=modelId,
      modelConfig=self.modelConfig,
      inferenceArgs=self.inferenceArgs,
      timestampFieldName=self.timestampFieldName,
      valueFieldName=self.valueFieldName
    )

    aggOpt = dict(
      windowSize=300,
      func="sum"
    )

    now = datetime.utcnow()

    # Set up timestamps such that aggregation will reduce number of samples
    inputRows = [
      (now + timedelta(seconds=100 * i), i + 0.599)
      for i in xrange(10)
    ]

    with self._startModelRunnerSubprocess(inputOpt=inputOpt,
                                          modelOpt=modelOpt,
                                          aggOpt=aggOpt) as mrProcess:
      # Send all input rows to ModelRunner for processing
      inputString = "\n".join(
        "{},{}".format(inTimestamp.isoformat(), inValue)
        for inTimestamp, inValue in inputRows)

      _LOGGER.debug("Sending to ModelRunner: %r", inputString)

      mrProcess.stdin.write(inputString)
      mrProcess.stdin.close()


      # Validate aggregations
      for i in xrange((len(inputRows) + 2) // 3):
        # Read output row and validate
        outputRecord = mrProcess.stdout.readline()

        _LOGGER.debug("Got result=%r", outputRecord)

        outTimestamp, outValue, anomalyLikelihood = json.loads(outputRecord)

        aggSlice = inputRows[i*3:i*3+3]

        self.assertEqual(dateutil.parser.parse(outTimestamp), aggSlice[0][0])

        self.assertEqual(outValue, sum(row[1] for row in aggSlice))

        self.assertIsInstance(anomalyLikelihood, float)


      # Wait for subprocess to terminate
      mrProcess.wait()
      stdoutData = mrProcess.stdout.read()
      stderrData = mrProcess.stderr.read()

      self.assertEqual(stdoutData, "")
      self.assertEqual(stderrData, "")

      self.assertEqual(mrProcess.returncode, 0)


  def testInputViaStdinGetOutputWithReducingMeanAggregation(self):
    modelId = uuid.uuid1().hex

    inputOpt = dict(
      rowOffset=0,
      timestampIndex=0,
      valueIndex=1,
      datetimeFormat="%Y-%m-%dT%H:%M:%S.%f"
    )

    modelOpt = dict(
      modelId=modelId,
      modelConfig=self.modelConfig,
      inferenceArgs=self.inferenceArgs,
      timestampFieldName=self.timestampFieldName,
      valueFieldName=self.valueFieldName
    )

    aggOpt = dict(
      windowSize=300,
      func="mean"
    )

    now = datetime.utcnow()

    # Set up timestamps such that aggregation will reduce number of samples
    inputRows = [
      (now + timedelta(seconds=100 * i), i + 0.599)
      for i in xrange(10)
    ]

    with self._startModelRunnerSubprocess(inputOpt=inputOpt,
                                          modelOpt=modelOpt,
                                          aggOpt=aggOpt) as mrProcess:
      # Send all input rows to ModelRunner for processing
      inputString = "\n".join(
        "{},{}".format(inTimestamp.isoformat(), inValue)
        for inTimestamp, inValue in inputRows)

      _LOGGER.debug("Sending to ModelRunner: %r", inputString)

      mrProcess.stdin.write(inputString)
      mrProcess.stdin.close()


      # Validate aggregations
      for i in xrange((len(inputRows) + 2) // 3):
        # Read output row and validate
        outputRecord = mrProcess.stdout.readline()

        _LOGGER.debug("Got result=%r", outputRecord)

        outTimestamp, outValue, anomalyLikelihood = json.loads(outputRecord)

        aggSlice = inputRows[i*3:i*3+3]

        self.assertEqual(dateutil.parser.parse(outTimestamp), aggSlice[0][0])

        self.assertEqual(outValue,
                         sum(row[1] for row in aggSlice) / len(aggSlice))

        self.assertIsInstance(anomalyLikelihood, float)


      # Wait for subprocess to terminate
      mrProcess.wait()
      stdoutData = mrProcess.stdout.read()
      stderrData = mrProcess.stderr.read()

      self.assertEqual(stdoutData, "")
      self.assertEqual(stderrData, "")

      self.assertEqual(mrProcess.returncode, 0)


  def testInputPathGetOutputWithHeaderAndReducingMeanAggregation(self):
    modelId = uuid.uuid1().hex

    csvFd, csvPath = tempfile.mkstemp()
    self.addCleanup(os.unlink, csvPath)

    # Populate CSV file
    now = datetime.utcnow()

    # Set up timestamps such that aggregation will reduce number of samples
    inputRows = [
      (now + timedelta(seconds=100 * i), i + 0.599)
      for i in xrange(10)
    ]

    with os.fdopen(csvFd, "wb") as csvFile:
      inputString = "\n".join(
        "{},{}".format(col1, col2) for col1, col2 in
        [("when", "scalar")] + [(inTimestamp.isoformat(), inValue)
                                for inTimestamp, inValue in inputRows]
      )

      _LOGGER.debug("Writing to csv file %s: %r", csvPath, inputString)

      csvFile.write(inputString)


    # Start ModelRunner
    inputOpt = dict(
      csv=csvPath,
      rowOffset=1,
      timestampIndex=0,
      valueIndex=1,
      datetimeFormat="%Y-%m-%dT%H:%M:%S.%f"
    )

    modelOpt = dict(
      modelId=modelId,
      modelConfig=self.modelConfig,
      inferenceArgs=self.inferenceArgs,
      timestampFieldName=self.timestampFieldName,
      valueFieldName=self.valueFieldName
    )

    aggOpt = dict(
      windowSize=300,
      func="mean"
    )


    with self._startModelRunnerSubprocess(inputOpt=inputOpt,
                                          modelOpt=modelOpt,
                                          aggOpt=aggOpt) as mrProcess:
      # Validate aggregations
      for i in xrange((len(inputRows) + 2) // 3):
        # Read output row and validate
        outputRecord = mrProcess.stdout.readline()

        _LOGGER.debug("Got result=%r", outputRecord)

        outTimestamp, outValue, anomalyLikelihood = json.loads(outputRecord)

        aggSlice = inputRows[i*3:i*3+3]

        self.assertEqual(dateutil.parser.parse(outTimestamp), aggSlice[0][0])

        self.assertEqual(outValue,
                         sum(row[1] for row in aggSlice) / len(aggSlice))

        self.assertIsInstance(anomalyLikelihood, float)


      # Wait for subprocess to terminate
      mrProcess.wait()
      stdoutData = mrProcess.stdout.read()
      stderrData = mrProcess.stderr.read()

      self.assertEqual(stdoutData, "")
      self.assertEqual(stderrData, "")

      self.assertEqual(mrProcess.returncode, 0)


  def testInputPathGetOutputWithTimezoneAndReducingMeanAggregation(self):
    modelId = uuid.uuid1().hex

    csvFd, csvPath = tempfile.mkstemp()
    self.addCleanup(os.unlink, csvPath)

    # Populate CSV file
    now = datetime.utcnow().replace(tzinfo=dateutil.tz.tzutc())

    # Set up timestamps such that aggregation will reduce number of samples
    inputRows = [
      (now + timedelta(seconds=100 * i), i + 0.599)
      for i in xrange(10)
    ]

    with os.fdopen(csvFd, "wb") as csvFile:
      inputString = "\n".join(
        "{},{}".format(col1, col2) for col1, col2 in
        [(inTimestamp.isoformat(), inValue)
         for inTimestamp, inValue in inputRows]
      )

      _LOGGER.debug("Writing to csv file %s: %r", csvPath, inputString)

      csvFile.write(inputString)


    # Start ModelRunner
    inputOpt = dict(
      csv=csvPath,
      rowOffset=0,
      timestampIndex=0,
      valueIndex=1,
      datetimeFormat="%Y-%m-%dT%H:%M:%S.%f%z"
    )

    modelOpt = dict(
      modelId=modelId,
      modelConfig=self.modelConfig,
      inferenceArgs=self.inferenceArgs,
      timestampFieldName=self.timestampFieldName,
      valueFieldName=self.valueFieldName
    )

    aggOpt = dict(
      windowSize=300,
      func="mean"
    )


    with self._startModelRunnerSubprocess(inputOpt=inputOpt,
                                          modelOpt=modelOpt,
                                          aggOpt=aggOpt) as mrProcess:
      # Validate aggregations
      for i in xrange((len(inputRows) + 2) // 3):
        # Read output row and validate
        outputRecord = mrProcess.stdout.readline()

        _LOGGER.debug("Got result=%r", outputRecord)

        outTimestamp, outValue, anomalyLikelihood = json.loads(outputRecord)

        aggSlice = inputRows[i*3:i*3+3]

        self.assertEqual(dateutil.parser.parse(outTimestamp), aggSlice[0][0])

        self.assertEqual(outValue,
                         sum(row[1] for row in aggSlice) / len(aggSlice))

        self.assertIsInstance(anomalyLikelihood, float)


      # Wait for subprocess to terminate
      mrProcess.wait()
      stdoutData = mrProcess.stdout.read()
      stderrData = mrProcess.stderr.read()

      self.assertEqual(stdoutData, "")
      self.assertEqual(stderrData, "")

      self.assertEqual(mrProcess.returncode, 0)
