# ----------------------------------------------------------------------
# Numenta Platform for Intelligent Computing (NuPIC)
# Copyright (C) 2015, Numenta, Inc.  Unless you have purchased from
# Numenta, Inc. a separate commercial license for this software code, the
# following terms and conditions apply:
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License version 3 as
# published by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
# See the GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see http://www.gnu.org/licenses.
#
# http://numenta.org/licenses/
# ----------------------------------------------------------------------

from collections import namedtuple
import logging
import datetime

import boto.dynamodb2
from boto.dynamodb2.table import Table
import numpy
import pytz
import requests

from nta.utils import error_reporting
from nta.utils.dynamodb_utils import retryOnTransientDynamoDBError

from taurus_monitoring import (loadConfig,
                               loadEmailParamsFromConfig,
                               logging_support,
                               MonitorOptionParser,
                               TaurusMonitorError)
from taurus_monitoring.monitor_dispatcher import MonitorDispatcher



MIN_THRESHOLD = 3600 # Required minimum number of seconds to pass since last
                     # known timestamp before a model may be _considered_ as
                     # not having recent data
SIGMA_MULTIPLIER = 3 # Standard deviation multiplier.  According to 68-95-99.7
                     # rule, 99.73% of values are within 3 standard deviations
                     # from the mean, assuming a normal distribution.  For our
                     # purposes, intervals greater than 3 x stddev are
                     # exceptional for that data set
FIXED_WINDOW = 14 # Number of days over which to calculate stddev.

# UTC datetime objects will be converted to US/Eastern local time for purposes
# of determining market closure
_UTC_TZ = pytz.timezone("UTC")
_EASTERN_TZ = pytz.timezone("US/Eastern")



g_logger = logging.getLogger(__name__)



_LatencyMonitorErrorParams = (
  namedtuple("_LatencyMonitorErrorParams",
             "model_name model_uid threshold last_timestamp")
)



class LatencyMonitorErrorParams(_LatencyMonitorErrorParams):
  def __repr__(self):
    return ("{}(model_name={}, model_uid={}, threshold={} seconds, "
            "last_timestamp={})"
            .format(self.__class__.__name__,
                    self.model_name,
                    self.model_uid,
                    self.threshold,
                    self.last_timestamp))



class LatencyMonitorError(TaurusMonitorError):
  pass



def isOutsideMarketHours(utcnow):
  """ Determines whether or not the passed time is within a time period during
  which we should expect recent stock data.

  :param datetime utcnow: UTC-localized timestamp
  :returns: Truth value for whether or not passed utcnow param is outside of
    expected market hours
  """
  # Adjust utcnow for market hours...
  marketLocalTime = utcnow.astimezone(_EASTERN_TZ)

  if marketLocalTime.date().weekday() > 4:
    # Weekday is 5 (saturday) or 6 (sunday)
    return True

  # NASDAQ and NYSE holidays through 2020, according to
  # http://markets.on.nytimes.com/research/markets/holidays/holidays.asp
  marketClosureHolidays = {
    datetime.date(2015, 1, 1),
    datetime.date(2015, 1, 19),
    datetime.date(2015, 2, 16),
    datetime.date(2015, 4, 3),
    datetime.date(2015, 5, 25),
    datetime.date(2015, 7, 3),
    datetime.date(2015, 9, 7),
    datetime.date(2015, 11, 26),
    datetime.date(2015, 12, 25),
    datetime.date(2016, 1, 1),
    datetime.date(2016, 1, 18),
    datetime.date(2016, 2, 15),
    datetime.date(2016, 3, 25),
    datetime.date(2016, 5, 30),
    datetime.date(2016, 7, 4),
    datetime.date(2016, 9, 5),
    datetime.date(2016, 11, 24),
    datetime.date(2016, 12, 26),
    datetime.date(2017, 1, 2),
    datetime.date(2017, 1, 16),
    datetime.date(2017, 2, 20),
    datetime.date(2017, 4, 14),
    datetime.date(2017, 5, 29),
    datetime.date(2017, 7, 4),
    datetime.date(2017, 9, 4),
    datetime.date(2017, 11, 23),
    datetime.date(2017, 12, 25),
    datetime.date(2018, 1, 1),
    datetime.date(2018, 1, 15),
    datetime.date(2018, 2, 19),
    datetime.date(2018, 3, 30),
    datetime.date(2018, 5, 28),
    datetime.date(2018, 7, 4),
    datetime.date(2018, 9, 3),
    datetime.date(2018, 11, 22),
    datetime.date(2018, 12, 25),
    datetime.date(2019, 1, 1),
    datetime.date(2019, 1, 21),
    datetime.date(2019, 2, 18),
    datetime.date(2019, 4, 19),
    datetime.date(2019, 5, 27),
    datetime.date(2019, 7, 4),
    datetime.date(2019, 9, 2),
    datetime.date(2019, 11, 28),
    datetime.date(2019, 12, 25),
    datetime.date(2020, 1, 1),
    datetime.date(2020, 1, 20),
    datetime.date(2020, 2, 17),
    datetime.date(2020, 4, 10),
    datetime.date(2020, 5, 25),
    datetime.date(2020, 7, 3),
    datetime.date(2020, 9, 7),
    datetime.date(2020, 11, 26),
    datetime.date(2020, 12, 25)
  }

  if marketLocalTime.date() in marketClosureHolidays:
    # market-local date is a known market holiday
    return True

  if (marketLocalTime.time() < datetime.time(10, 30) or
      marketLocalTime.time() > datetime.time(17, 30)):
    # market-local time is roughly within the time frame we care about.  10:30
    # to account for a natural delay at the beginning, and 5:30 to account for
    # catching up at the end of the day.  The specific values are chosen to
    # generously account for delayed market info and dynamodb latency rather
    # than match true market hours.
    return True

  return False



class ModelLatencyChecker(MonitorDispatcher):
  parser = MonitorOptionParser(
    usage="Usage: %prog --metricDataTable=TABLE [options]",
    description=("Monitoring script to alert on models that do not have recent"
                 " data in public metric data dynamodb table.  A model is "
                 "considered to have exceeded the acceptable threshold if the "
                 "time since the most recent sample exceeds a minimum, "
                 "user-defined threshold (in seconds) AND such interval "
                 "exceeds a multiple of the standard deviation for all "
                 "intervals for that model during a fixed window of time (14 "
                 "days)."))

  parser.add_option("--threshold",
                    default=MIN_THRESHOLD,
                    type="int",
                    dest="threshold",
                    metavar="SECONDS",
                    help=("Required minimum number of seconds to pass since "
                          "most-recent known timestamp before a model may be "
                          "_considered_ as not having recent data "
                          "(Default: {})").format(MIN_THRESHOLD))
  parser.add_option("--sigmaMultiplier",
                    default=SIGMA_MULTIPLIER,
                    type="float",
                    dest="sigmaMultiplier",
                    help=("Standard deviation multiplier. Consider 68-95-99.7 "
                          "rule.  For example, 99.7% of values fall within 3 "
                          "standard deviations of the mean.  Any value greater"
                          " than 3 x stddev is considered exceptional. "
                          "(Default: {})").format(SIGMA_MULTIPLIER))
  parser.add_option("--metricDataTable",
                    type="string",
                    dest="metricDataTable",
                    help="**REQUIRED metric data dynamodb table name**")
  parser.add_option("--days",
                    default=FIXED_WINDOW,
                    type="int",
                    dest="days",
                    help="Default: {}".format(FIXED_WINDOW))


  def __init__(self):
    options = self.parser.parse_options()

    logging_support.LoggingSupport.initLogging(
      loggingLevel=options.loggingLevel)

    if not options.monitorConfPath:
      self.parser.error("You must specify a --monitorConfPath argument.")

    if not options.metricDataTable:
      self.parser.error("You must specify a --metricDataTable argument.")

    self.config = loadConfig(options)
    self.emailParams = loadEmailParamsFromConfig(self.config)
    self.apiKey = self.config.get("S1", "MODELS_MONITOR_TAURUS_API_KEY")
    self.modelsUrl = self.config.get("S1", "MODELS_MONITOR_TAURUS_MODELS_URL")
    self.awsDynamoDBRegion = self.config.get(
      "S1", "MODELS_MONITOR_TAURUS_DYNAMODB_REGION")
    self.awsAccessKeyId = self.config.get(
      "S1", "MODELS_MONITOR_TAURUS_DYNAMODB_AWS_ACCESS_KEY_ID")
    self.awsSecretAccessKey = self.config.get(
      "S1", "MODELS_MONITOR_TAURUS_DYNAMODB_AWS_SECRET_ACCESS_KEY")
    self.threshold = options.threshold
    self.sigmaMultiplier = options.sigmaMultiplier

    self.metricDataTable = options.metricDataTable
    self.days = options.days
    self.options = options

    g_logger.info("Initialized %r", repr(self))


  def __repr__(self):
    invocation = " ".join("--{}={}".format(key, value)
                          for key, value in vars(self.options).items())
    return "{} {}".format(self.parser.get_prog_name(), invocation)


  @MonitorDispatcher.preventDuplicates
  def dispatchNotification(self, checkFn, excType, excValue, excTraceback):
    """  Send notification.

    :param function checkFn: The check function that raised an exception
    :param type excType: Exception type
    :param exception excValue: Exception value
    :param traceback excTraceback: Exception traceback

    Required by MonitorDispatcher abc protocol.
    """
    dispatchKwargs = dict(
      monitorName=__name__ + ":" + checkFn.__name__,
      resourceName=repr(self),
      message=self.formatTraceback(excType, excValue, excTraceback),
      subjectPrefix="Model Latency Monitor",
      params=self.emailParams)

    g_logger.info("Dispatching notification: %r", dispatchKwargs)
    error_reporting.sendMonitorErrorEmail(**dispatchKwargs)


  def getModels(self):
    """ Queries models API for full model list

    :returns: list of model dicts
    """
    response = requests.get(self.modelsUrl, auth=(self.apiKey, ""),
                            timeout=60, verify=False)

    if response.status_code != 200:
      raise LatencyMonitorError("Unable to query Taurus API for active models:"
                                " Unexpected HTTP response status ({}) from "
                                "{} -- {}".format(response.status_code,
                                                  self.modelsUrl,
                                                  response.text))

    return response.json()


  def _connectDynamoDB(self):
    """ Connect to DynamoDB with boto and return connection object

    :returns: boto DynamoDB connection (see boto.dynamodb2.connect_to_region())
    """
    return boto.dynamodb2.connect_to_region(
      self.awsDynamoDBRegion,
      aws_access_key_id=self.awsAccessKeyId,
      aws_secret_access_key=self.awsSecretAccessKey)


  def getMetricData(self, metricUid):
    """ Retrieve and return metric data from dynamodb

    :param str metricUid: Metric uid
    :param str timestamp: Timestamp representing the lower bounds for metric
      data samples to retrieve
    :returns: DynamoDB ResultSet (see
      http://boto.readthedocs.org/en/latest/dynamodb2_tut.html#the-resultset)
    """
    # Query recent DynamoDB metric data for each model
    now = datetime.datetime.now(_UTC_TZ)

    then = now - datetime.timedelta(days=self.days,
                                    microseconds=now.microsecond)

    conn = self._connectDynamoDB()
    metricDataTable = Table(self.metricDataTable, connection=conn)

    return retryOnTransientDynamoDBError(g_logger)(metricDataTable.query_2)(
      uid__eq=metricUid, timestamp__gte=then.strftime("%Y-%m-%d %H:%M:%S"))


  @MonitorDispatcher.registerCheck
  def checkAllModelLatency(self):
    """ Check all model latencies by querying Taurus API for all models, and
    then checking DynamoDB for corresponding data.  Models that don't have
    recent data trigger an error.  Errors are batched up into a single
    exception reported by MonitorDispatcher.dispatchNotification() protocol
    """

    models = self.getModels()

    errors = []

    for model in models:

      # Calculate current UTC timestamp adjusted to account for acceptable
      # 10-minute delay in processing.
      utcnow = datetime.datetime.now(_UTC_TZ) - datetime.timedelta(minutes=10)

      # Skip processing of models outside of market hours to avoid false
      # positives
      if isOutsideMarketHours(utcnow):
        g_logger.debug("Skipping %s.  Reason: outside market hours",
                       model["name"])
        continue

      resultSet = self.getMetricData(metricUid=model["uid"])
      # Track all time intervals between valid (e.g. non-zero) samples
      intervals = []

      lastSampleTimestamp = None
      for sample in resultSet:

        if not sample["metric_value"]:
          continue

        timestamp = (
          _UTC_TZ.localize(datetime.datetime.strptime(sample["timestamp"],
                                                      "%Y-%m-%dT%H:%M:%S"))
        )

        if lastSampleTimestamp is None:
          lastSampleTimestamp = timestamp
          continue

        intervals.append((timestamp - lastSampleTimestamp).total_seconds())
        lastSampleTimestamp = timestamp

      if not intervals:
        errors.append(
          LatencyMonitorErrorParams(model["name"], model["uid"], None, None)
        )
        continue # There are no intervals between samples, indicating there is
                 # no data at all!  No point in calculating stddev.

      # Even though we only apply this to stock metrics during approximate
      # market hours, we still count intervals included in off-market hours.
      # It's ok, though.  The math still works out and we'll catch metrics for
      # which we stop receiving data anyway.
      stddev = numpy.nanstd(intervals)  # pylint: disable=E1101
      mean = numpy.mean(intervals)  # pylint: disable=E1101

      # Fabricate a hypothetical interval representing the amount of time since
      # the most recent valid timestamp
      currentInterval = (utcnow - lastSampleTimestamp).total_seconds()

      # Only consider intervals that are more than N sigma AND above an
      # arbitrary minimum threshold.  More frequent companies will have a
      # lower stddev and therefore required a higher, if artifical, threshold
      # to avoid too many false positives
      acceptableThreshold = (
        max(self.threshold, mean + self.sigmaMultiplier * stddev)
      )

      # If the hypothetical interval exceeds the acceptable threshold, then we
      # have a reasonable expectation that there may be a problem with the
      # model
      if currentInterval > acceptableThreshold:
        errors.append(LatencyMonitorErrorParams(model["name"],
                                                model["uid"],
                                                acceptableThreshold,
                                                lastSampleTimestamp))

    g_logger.info("Processed statistics for %d model%s, found %d error%s.",
                  len(models),
                  "s" if len(models) != 1 else "",
                  len(errors),
                  "s" if len(errors) != 1 else "")

    if errors:
      msg = ("The following models have exceeded the acceptable threshold for "
             "time since last timestamp in {} DynamoDB table:\n    {}"
             .format(self.metricDataTable,
                     "\n    ".join(str(error) for error in errors)))
      raise LatencyMonitorError(msg)




def main():
  ModelLatencyChecker().checkAll()



if __name__ == "__main__":
  raise NotImplementedError("This module is not intended to be run directly.  "
                            "See setup.py for `taurus-model-latency-monitor` "
                            "console script entry point definition.")
