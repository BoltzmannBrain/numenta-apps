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

"""Unit test of the unicorn_backend.param_finder module"""

# Disable pylint warnings concerning access to protected members
# pylint: disable=W0212

import datetime
import dateutil.tz
import random
import unittest

import numpy

from unicorn_backend import param_finder



class ParamFinderTestCase(unittest.TestCase):
  def testGetMedianSamplingInterval(self):
    timestamps = numpy.array([datetime.datetime(2000, 1, 1) +
                              datetime.timedelta(hours=i) for i in xrange(24)])
    timestamps = timestamps.astype('datetime64[ms]')
    medianSamplingIntervalInMs = param_finder._getMedianSamplingInterval(
      timestamps)

    self.assertAlmostEqual(medianSamplingIntervalInMs,
                           numpy.timedelta64(3600 * 1000, 'ms'))


  def testGetAggregationFunction(self):
    aggFunc = param_finder._getAggregationFunction(numpy.random.rand(100, 1))
    self.assertEqual(aggFunc, 'mean')

    # use sum aggregation for binary data
    aggFunc = param_finder._getAggregationFunction(numpy.ones((100, 1)))
    self.assertEqual(aggFunc, 'sum')


  def testResampleData(self):
    # test upsampling by a factor of 2
    timestampsInS = numpy.array([numpy.datetime64(
      datetime.datetime(2000, 1, 1, tzinfo=dateutil.tz.tzlocal()) +
      datetime.timedelta(hours=i)) for i in xrange(8)])
    values = numpy.linspace(0, 7, 8)

    newSamplingIntervalInS = numpy.timedelta64(1800, 's')
    newSamplingIntervalInMs = newSamplingIntervalInS.astype('timedelta64[ms]')
    timestampsInMs = timestampsInS.astype('datetime64[ms]')

    newValues = param_finder._resampleData(timestampsInMs, values,
                                           newSamplingIntervalInMs)

    self.assertTrue(numpy.allclose(newValues, numpy.linspace(0, 7, 15)))

    # test down-sampling by a factor of 2
    newSamplingIntervalInS = numpy.timedelta64(7200, 's')
    newSamplingIntervalInMs = newSamplingIntervalInS.astype('timedelta64[ms]')
    newValues = param_finder._resampleData(timestampsInMs, values,
                                           newSamplingIntervalInMs)

    self.assertTrue(numpy.allclose(newValues, numpy.linspace(0, 6, 4)))


  def testCalculateContinuousWaveletTransform(self):
    """
    Verify that the periodicity can be correctly identified with CWT
    """
    samplingIntervalInS = numpy.timedelta64(300, 's')
    samplingIntervalInMs = samplingIntervalInS.astype('timedelta64[ms]')
    values = numpy.sin(numpy.linspace(0, 100, 101) * 2 * numpy.pi / 10.0)
    targetPeriod = 3000.0

    (cwtVar, timeScaleInMs) = param_finder._calculateContinuousWaveletTransform(
      samplingIntervalInMs, values)

    calculatedPeriodInMs = timeScaleInMs[numpy.where(
      cwtVar == max(cwtVar))[0][0]]
    calculatedPeriodInS = calculatedPeriodInMs.astype('float32') / 1000
    self.assertTrue(abs(targetPeriod - calculatedPeriodInS) / targetPeriod < .1)


  def testDetermineEncoderTypes(self):
    # daily and weekly periodicity in units of seconds
    dayPeriod = 86400.0
    weekPeriod = 604800.0

    samplingIntervalInS = numpy.timedelta64(300, 's')
    widths = numpy.logspace(0, numpy.log10(40000 / 20), 50)
    timeScaleInS = widths * samplingIntervalInS * 4

    # a flat cwtVar distribution, no encoder should be used
    cwtVar = numpy.ones(shape=timeScaleInS.shape)

    (useTimeOfDay,
     useDayOfWeek) = param_finder._determineEncoderTypes(cwtVar, timeScaleInS)
    self.assertFalse(useTimeOfDay)
    self.assertFalse(useDayOfWeek)

    # make a peak around daily period
    ts = timeScaleInS.astype('float64')
    cwtVar = numpy.exp(-(ts - dayPeriod) ** 2 / (2 * 100000.0 ** 2))
    (useTimeOfDay,
     useDayOfWeek) = param_finder._determineEncoderTypes(cwtVar, timeScaleInS)
    self.assertTrue(useTimeOfDay)
    self.assertFalse(useDayOfWeek)

    # make a peak around weekly period
    ts = timeScaleInS.astype('float64')
    cwtVar = numpy.exp(-(ts - weekPeriod) ** 2 / (2 * 100000.0 ** 2))
    (useTimeOfDay,
     useDayOfWeek) = param_finder._determineEncoderTypes(cwtVar, timeScaleInS)
    self.assertFalse(useTimeOfDay)
    self.assertFalse(useDayOfWeek)  # dayOfWeek is always false in Unicorn

    # A double peaked function.
    ts = timeScaleInS.astype('float64')
    cwtVar = (numpy.exp(-(ts - dayPeriod) ** 2 / (2 * 100000.0 ** 2)) +
              numpy.exp(-(ts - weekPeriod) ** 2 / (2 * 100000.0 ** 2)))
    (useTimeOfDay,
     useDayOfWeek) = param_finder._determineEncoderTypes(cwtVar, timeScaleInS)
    self.assertTrue(useTimeOfDay)
    self.assertFalse(useDayOfWeek)  # dayOfWeek is always false in Unicorn


  def testDetermineAggregationWindow(self):
    """
    Verify aggregation window can be determined from the cwtVar distribution
    """
    weekPeriod = 604800.0
    samplingIntervalInS = numpy.timedelta64(300, 's')
    widths = numpy.logspace(0, numpy.log10(40000 / 20), 50)

    timeScaleInS = widths * samplingIntervalInS * 4
    timeScaleInS = timeScaleInS.astype('timedelta64[s]')

    ts = timeScaleInS.astype('float64')
    cwtVar = numpy.exp(-(ts - weekPeriod) ** 2 / (2 * 100000.0 ** 2))
    numDataPts = 40000

    maxSamplingInterval = (float(numDataPts) / 1000.0 * samplingIntervalInS)
    maxSamplingInterval = maxSamplingInterval.item().total_seconds()

    timeScaleInMs = timeScaleInS.astype('timedelta64[ms]')
    samplingIntervalInMs = samplingIntervalInS.astype('timedelta64[ms]')
    aggregationTimeScaleInMs = param_finder._determineAggregationWindow(
      timeScale=timeScaleInMs,
      cwtVar=cwtVar,
      thresh=0.2,
      samplingInterval=samplingIntervalInMs,
      numDataPts=40000
    )

    aggregationTimeScaleInS = aggregationTimeScaleInMs.item().total_seconds()
    self.assertLessEqual(aggregationTimeScaleInS, maxSamplingInterval)
    self.assertGreater(aggregationTimeScaleInS,
                       samplingIntervalInS.astype('float64'))

    # if the numDataPts < MIN_ROW_AFTER_AGGREGATION, no aggregation should occur
    aggregationTimeScaleInMs = param_finder._determineAggregationWindow(
      timeScale=timeScaleInMs,
      cwtVar=cwtVar,
      thresh=0.2,
      samplingInterval=samplingIntervalInMs,
      numDataPts=param_finder.MIN_ROW_AFTER_AGGREGATION - 1
    )
    aggregationTimeScaleInS = aggregationTimeScaleInMs.item().total_seconds()
    self.assertEqual(aggregationTimeScaleInS,
                     samplingIntervalInS.astype('float64'))


  def testFindParameters(self):
    def createTestData(dataType, timeStepSeconds=300):
      dayPeriod = 86400.0
      weekPeriod = 604800.0

      timeStep = datetime.timedelta(seconds=timeStepSeconds)
      timestamp = datetime.datetime(2016, 1, 1, 0, 0, 0)

      random.seed(42)
      samples = []
      for i in xrange(2000):
        timestamp += timeStep

        if dataType == "flat":
          value = 10.0
        elif dataType == "daily":
          value = numpy.sin(2 * numpy.pi * (timeStep.seconds * i) / dayPeriod)
        elif dataType == "weekly":
          value = numpy.sin(2 * numpy.pi * (timeStep.seconds * i) / weekPeriod)
        elif dataType == "binaryTransaction":
          value = 1 if int(i / 100) % 2 else 0

        samples.append((timestamp, value))
      return samples

    outputInfo = param_finder.findParameters(createTestData("flat", 300))
    self.assertGreater(outputInfo["aggInfo"]["windowSize"], 300)
    self.assertEqual(outputInfo["aggInfo"]["func"], "sum")
    # Exclude timeOfDay and dayOfWeek encoder for flat line
    self.assertIsNone(outputInfo["modelInfo"]["modelConfig"]["modelParams"]
                      ["sensorParams"]["encoders"]["c0_timeOfDay"])
    self.assertIsNone(outputInfo["modelInfo"]["modelConfig"]["modelParams"]
                      ["sensorParams"]["encoders"]["c0_dayOfWeek"])

    outputInfo = param_finder.findParameters(createTestData("daily", 300))
    self.assertGreater(outputInfo["aggInfo"]["windowSize"], 300)
    self.assertEqual(outputInfo["aggInfo"]["func"], "mean")
    # Use timeOfDay but not dayOfWeek encoder for dataSet with daily period
    self.assertIsNotNone(outputInfo["modelInfo"]["modelConfig"]["modelParams"]
                         ["sensorParams"]["encoders"]["c0_timeOfDay"])
    self.assertIsNone(outputInfo["modelInfo"]["modelConfig"]["modelParams"]
                      ["sensorParams"]["encoders"]["c0_dayOfWeek"])

    outputInfo = param_finder.findParameters(createTestData("weekly", 7200))
    self.assertGreater(outputInfo["aggInfo"]["windowSize"], 7200)
    self.assertEqual(outputInfo["aggInfo"]["func"], "mean")
    # Use dayOfWeek but not timeOfDay encoder for dataSet with daily period
    self.assertIsNone(outputInfo["modelInfo"]["modelConfig"]["modelParams"]
                      ["sensorParams"]["encoders"]["c0_timeOfDay"])
    self.assertIsNone(outputInfo["modelInfo"]["modelConfig"]["modelParams"]
                      ["sensorParams"]["encoders"]["c0_dayOfWeek"])

    outputInfo = param_finder.findParameters(
      createTestData("binaryTransaction", 300))
    self.assertGreaterEqual(outputInfo["aggInfo"]["windowSize"], 300)
    self.assertEqual(outputInfo["aggInfo"]["func"], "sum")
    # Use dayOfWeek but not timeOfDay encoder for dataSet with daily period
    self.assertIsNone(outputInfo["modelInfo"]["modelConfig"]["modelParams"]
                      ["sensorParams"]["encoders"]["c0_timeOfDay"])
    # Check that dayOfWeek has been disabled event if the dataset has a daily 
    # period.
    self.assertIsNone(outputInfo["modelInfo"]["modelConfig"]["modelParams"]
                      ["sensorParams"]["encoders"]["c0_dayOfWeek"])


  def testGetModelParams(self):
    values = numpy.linspace(0, 10, 10)
    modelParams = param_finder._getModelParams(
      useTimeOfDay=False, useDayOfWeek=False, values=values)

    self.assertIsNone(modelParams["modelConfig"]["modelParams"]
                      ["sensorParams"]["encoders"]["c0_timeOfDay"])
    self.assertIsNone(modelParams["modelConfig"]["modelParams"]
                      ["sensorParams"]["encoders"]["c0_dayOfWeek"])


    modelParams = param_finder._getModelParams(
      useTimeOfDay=True, useDayOfWeek=False, values=values)
    self.assertIsNotNone(modelParams["modelConfig"]["modelParams"]
                         ["sensorParams"]["encoders"]["c0_timeOfDay"])
    self.assertIsNone(modelParams["modelConfig"]["modelParams"]
                      ["sensorParams"]["encoders"]["c0_dayOfWeek"])


    modelParams = param_finder._getModelParams(
      useTimeOfDay=False, useDayOfWeek=True, values=values)
    self.assertIsNone(modelParams["modelConfig"]["modelParams"]
                      ["sensorParams"]["encoders"]["c0_timeOfDay"])
    self.assertIsNotNone(modelParams["modelConfig"]["modelParams"]
                         ["sensorParams"]["encoders"]["c0_dayOfWeek"])


    modelParams = param_finder._getModelParams(
      useTimeOfDay=True, useDayOfWeek=True, values=values)
    self.assertIsNotNone(modelParams["modelConfig"]["modelParams"]
                         ["sensorParams"]["encoders"]["c0_timeOfDay"])
    self.assertIsNotNone(modelParams["modelConfig"]["modelParams"]
                         ["sensorParams"]["encoders"]["c0_dayOfWeek"])

if __name__ == "__main__":
  unittest.main()
  