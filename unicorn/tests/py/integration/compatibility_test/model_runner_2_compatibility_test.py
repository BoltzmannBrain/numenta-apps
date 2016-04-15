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
Compatibility test of the unicorn_backend.model_runner_2 module

"""

import csv
import datetime
import json
import logging
import os
import subprocess
import sys
import unittest

import numpy
from pkg_resources import resource_stream

from nta.utils.logging_support_raw import LoggingSupport
from nta.utils import test_utils
from unicorn_backend import date_time_utils



_LOGGER = logging.getLogger("unicorn_model_runner_test")
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")

# threshold from NAB/config/thresholds.json
ANOMALY_THRESH = 0.5126953125


def setUpModule():
  LoggingSupport.initTestApp()



class ModelRunnerCompatibilityTest(unittest.TestCase):


  @staticmethod
  def _startParamFinderRunnerSubprocess(inputSpec):
    """Start the unicorn param_finder subprocess

    :param str inputSpec: JSON object describing the input petric data
      per input_opt_schema.json
    :returns: the started subprocess.Popen object wrapped in
      ManagedSubprocessTerminator
    :rtype: nta.utils.test_utils.ManagedSubprocessTerminator
    """

    _LOGGER.info("Python: %s" % sys.executable)
    process = subprocess.Popen(
      args=[sys.executable,
            "-m", "unicorn_backend.param_finder_runner",
            "--input=%s" % inputSpec],
      stdin=subprocess.PIPE,
      stdout=subprocess.PIPE,
      stderr=subprocess.PIPE,
      close_fds=True)

    _LOGGER.info("Started unicorn model_runner subprocess=%s", process)
    return test_utils.ManagedSubprocessTerminator(process)


  @staticmethod
  def _startModelRunnerSubprocess(inputSpec, aggSpec, modelSpec):
    """Start the unicorn model_runner subprocess

    :param str inputSpec: JSON object describing the input petric data
      per input_opt_schema.json
    :param str aggSpec: JSON object describing agregation of the input
      metric per agg_opt_schema.json
    :param str modelSpec: JSON object describing the model per
      model_opt_schema.json
    :returns: the started subprocess.Popen object wrapped in
      ManagedSubprocessTerminator
    :rtype: nta.utils.test_utils.ManagedSubprocessTerminator
    """
    argumentPattern = [sys.executable,
                       "-m", "unicorn_backend.model_runner_2",
                       "--input=%s" % inputSpec,
                       "--model=%s" % modelSpec]
    if aggSpec is not None:
      argumentPattern += ["--agg=%s" % aggSpec]

    _LOGGER.info("Args: %s" % argumentPattern)
    process = subprocess.Popen(
      args=argumentPattern,
      stdin=subprocess.PIPE,
      stdout=subprocess.PIPE,
      stderr=subprocess.PIPE,
      close_fds=True)

    _LOGGER.info("Started unicorn model_runner subprocess=%s", process)
    return test_utils.ManagedSubprocessTerminator(process)


  @staticmethod
  def _loadCsvFile(path):
    data = []

    with open(path, 'r') as infile:
      csvReader = csv.reader(infile)
      csvReader.next()
      for line in csvReader:
        data.append(line)

    return data


  def _testParamFinderRunner(self, name, inputSpec):
    """
    Make sure the paramFinder returns expected aggInfo and modelInfo

    :param str name: dataset name
    :param str inputSpec: JSON object describing the input petric data
      per input_opt_schema.json
    :return: json object that contains aggregation and model info
    """

    with self._startParamFinderRunnerSubprocess(inputSpec) as pfrProcess:
      outputInfo = pfrProcess.stdout.readline()
      outputInfo = json.loads(outputInfo)

    with open(os.path.join(RESULTS_DIR, name+'_model_params.json')) as infile:
      expectedOutputInfo = json.loads(infile.read())
      self.assertEqual(outputInfo, expectedOutputInfo)
    return outputInfo


  def _testModelRunner(self, name, inputSpec, aggSpec, modelSpec):
    """
    Make sure model runner returns correct anomaly likelihood

    :param str name: dataset name
    :param str inputSpec: JSON object describing the input metric data
      per input_opt_schema.json
    :param str aggSpec: JSON object describing aggregation of the input
      metric per agg_opt_schema.json
    :param str modelSpec: JSON object describing the model per
      model_opt_schema.json
    """
    with self._startModelRunnerSubprocess(
      inputSpec, aggSpec, modelSpec) as mrProcess:

      stdoutData, stderrData = mrProcess.communicate()
      out = stdoutData.splitlines()
      self.assertEqual(stderrData, "")

      results = self._loadCsvFile(os.path.join(RESULTS_DIR,
                                               'numenta_'+name+'.csv'))
      inputSpec = json.loads(inputSpec)

      trueResultTimestamp = []
      trueAnomalyLikelihood = []
      for trueResult in results:
        timestamp = date_time_utils.parseDatetime(trueResult[0],
                                        inputSpec['datetimeFormat'])
        trueResultTimestamp.append(timestamp)
        trueAnomalyLikelihood.append(float(trueResult[2]))
      dataDuration = trueResultTimestamp[-1] - trueResultTimestamp[0]

      duration = dataDuration.total_seconds()
      anomalyWindow = duration * 0.1
      probationaryPeriod = trueResultTimestamp[0] + \
                           datetime.timedelta(seconds=duration * 0.2)

      nabDetection = self._convertAnomalyScoresToDetections(
        trueResultTimestamp, trueAnomalyLikelihood, ANOMALY_THRESH)

      computedTimestamp = []
      computedAnomalyLikelihood = []
      for computedResult in out:
        outputRecord = json.loads(computedResult)
        timestamp = date_time_utils.parseDatetime(outputRecord[0],
                                        "%Y-%m-%dT%H:%M:%S")
        computedTimestamp.append(timestamp)
        computedAnomalyLikelihood.append(float(outputRecord[2]))


      computedDetection = self._convertAnomalyScoresToDetections(
        computedTimestamp, computedAnomalyLikelihood, ANOMALY_THRESH)

      nabLabels = self._getTrueAnomalyLabels(name)

      numTruePositiveComputed = self._checkForTruePositives(
        nabLabels, computedDetection, anomalyWindow)
      numTruePositiveNAB= self._checkForTruePositives(
        nabLabels, nabDetection, anomalyWindow)

      numFalsePositiveComputed = self._checkForFalsePositives(
        nabLabels, computedDetection, anomalyWindow, probationaryPeriod)
      numFalsePositiveNAB= self._checkForFalsePositives(
        nabLabels, nabDetection, anomalyWindow, probationaryPeriod)

      self.assertGreaterEqual(numTruePositiveComputed, numTruePositiveNAB)
      self.assertLessEqual(numFalsePositiveComputed, numFalsePositiveNAB)
      self.assertEqual(mrProcess.returncode, 0)


  def _testParamFinderAndModelRunner(self, name):
    """
    Test paramFinder and modelRunner together
    :param str name: dataset name
    """
    inputSpec = json.dumps(
      {"datetimeFormat": "%Y-%m-%d %H:%M:%S",
       "timestampIndex": 0,
       "csv": os.path.join(DATA_DIR, name+".csv"),
       "rowOffset": 1,
       "valueIndex": 1})

    outputInfo = self._testParamFinderRunner(name, inputSpec)

    aggSpec = outputInfo["aggInfo"]
    if aggSpec is not None:
      aggSpec = json.dumps(aggSpec)

    modelSpec = outputInfo['modelInfo']
    modelSpec['modelId'] = 'test'
    modelSpec = json.dumps(modelSpec)

    self._testModelRunner(name, inputSpec, aggSpec, modelSpec)


  def _convertAnomalyScoresToDetections(self,
                                        timeStamps, anomalyScores, threshold):
    """
    Convert anomaly scores (values between 0 and 1) to detections (binary
    values) given a threshold.
    """
    anomalyScores = numpy.array(anomalyScores)
    anomalyDetections = []
    for alert in numpy.where(anomalyScores >= threshold)[0]:
      anomalyDetections.append(timeStamps[alert])

    return anomalyDetections


  def _getTrueAnomalyLabels(self, name):
    labelFileRelativePath = os.path.join("data", "anomaly_labels_nab.json")
    with resource_stream(__name__, labelFileRelativePath) as infile:
      nabLabels = json.load(infile)

    targetAnomalies = []
    for anomaly in nabLabels[name]:
      targetAnomalies.append(date_time_utils.parseDatetime(anomaly,
                                          "%Y-%m-%d %H:%M:%S"))
    return targetAnomalies


  def _checkForTruePositives(self, trueLabel, detections, anomalyWindow):
    numTruePositive = 0
    for targetAnomaly in trueLabel:
      timeDelta = []
      for alert in detections:
        timeDelta.append((alert-targetAnomaly).total_seconds())
      if len(timeDelta) == 0:
        continue
      if numpy.min(numpy.abs(numpy.array(timeDelta))) < anomalyWindow:
        numTruePositive += 1
    return numTruePositive


  def _checkForFalsePositives(self, trueLabel, detections,
                              anomalyWindow, probationaryPeriod):
    numFalsePositive = 0
    for alert in detections:
      if alert < probationaryPeriod:
        continue
      timeDelta = []
      for targetAnomaly in trueLabel:
        timeDelta.append((alert-targetAnomaly).total_seconds())
      if (len(timeDelta) == 0 or
              numpy.min(numpy.abs(numpy.array(timeDelta))) > anomalyWindow):
        numFalsePositive += 1
    return numFalsePositive


  def testDailyFlatMiddle(self):
    """
    Run paramFinder and ModelRunner on art_daily_flatmiddle
    This is an artificial dataset with anomaly
    """
    self._testParamFinderAndModelRunner('art_daily_flatmiddle')


  def testDailyNoNoise(self):
    """
    Run paramFinder and ModelRunner on art_daily_no_noise
    This is an artificial dataset without anomaly
    """
    self._testParamFinderAndModelRunner('art_daily_no_noise')


  def testNYCTaxi(self):
    """
    Run paramFinder and ModelRunner on nyc_taxi
    This is a realworld dataset with known anomalies
    """
    self._testParamFinderAndModelRunner('nyc_taxi')


  def testTwitterAAPL(self):
    """
    Run paramFinder and ModelRunner on Twitter_volume_AAPL
    """
    self._testParamFinderAndModelRunner('Twitter_volume_AAPL')


  def testEC2DiskWrite(self):
    """
    Run paramFinder and ModelRunner on ec2_disk_write_bytes_1ef3de
    """
    self._testParamFinderAndModelRunner('ec2_disk_write_bytes_1ef3de')


  def testEC2CPU(self):
    """
    Run paramFinder and ModelRunner on ec2_cpu_utilization_825cc2
    """
    self._testParamFinderAndModelRunner('ec2_cpu_utilization_825cc2')



if __name__ == "__main__":
  unittest.main()
