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

import contextlib
from datetime import datetime, timedelta
import json
import logging
import os
import time

import requests
import sqlalchemy as sql

from nta.utils.error_handling import retry
from nta.utils import date_time_utils
from nta.utils import message_bus_connector

import taurus_metric_collectors
from taurus_metric_collectors import collectorsdb
from taurus_metric_collectors.collectorsdb import schema



_EPOCH_DATETIME = datetime.utcfromtimestamp(0)



class ModelQuotaExceededError(Exception):
  """ Raised when too many models or "instances" have been created """
  pass



class ModelMonitorRequestError(Exception):
  """ Generic exception for non-specific error while attempting to monitor a
  metric
  """
  pass



class ModelUnmonitorRequestError(Exception):
  """ Generic exception for non-specific error while attempting to unmonitor a
  metric
  """
  pass



class MetricDeleteRequestError(Exception):
  """ Generic exception for non-specific error while attempting to delete a
  metric
  """
  pass



class MetricNotFound(Exception):
  """Specified metric was not found"""
  pass



class GetModelsRequestError(Exception):
  """ Generic exception for non-specific error while getting all models
  """
  pass



class RetriesExceededError(Exception):
  """ Exceeded max retries without a single successful execution """
  pass



g_log = logging.getLogger("taurus_metric_collectors.metric_utils")



# Retry decorator for specific `requests` errors
def _retryOnRequestsErrors(timeoutSec=10, pauseSec=0.2):

  def retryFilter(exc, _args, _kwargs):
    if isinstance(exc, requests.exceptions.HTTPError):
      # Retry on:
      # 500 Internal Server Error
      # 502 Server Error: Bad Gateway
      # 503 Service Unavailable
      # 504 Gateway Timeout
      if (exc.response is not None and
          exc.response.status_code in [500, 502, 503, 504]):
        return True
      else:
        return False

    return True

  return retry(
    timeoutSec=timeoutSec,
    initialRetryDelaySec=pauseSec,
    maxRetryDelaySec=pauseSec,
    retryExceptions=(
      # requests retries on DNS errors, but not on connection errors
      requests.exceptions.ConnectionError,
      requests.exceptions.HTTPError,
      requests.exceptions.Timeout,
    ),
    retryFilter=retryFilter,
    logger=g_log)



def getMetricsConfiguration():
  """ Get metric configuration object that defines all instances and metrics for
  all data collectors.

  :returns: metric configuration object that defines all instances and metrics
    for all data collectors
  :rtype: dict; from conf/metrics.json
  """
  metricsConfPath = os.path.join(taurus_metric_collectors.CONF_DIR, "metrics.json")
  with open(metricsConfPath) as fileObj:
    return json.load(fileObj)



def getMetricNamesFromConfig(metricsConfig):
  """Return all metric names from the given metrics configuration

  :param dict metricsConfig: metrics configuration as returned by
    `getMetricsConfiguration()`

  :returns: all metric names from the given metricsConfig
  :rtype: sequence
  """
  return tuple(key for resource in metricsConfig.itervalues()
               for key in resource["metrics"].iterkeys())



def getAllMetricSecurities():
  """ Load  all referenced securities from the common metric configuration

  :returns: sequence of stock ticker symbol and exchange tuples
  """
  return tuple(
    (resVal["symbol"], resVal["stockExchange"])
    for resVal in getMetricsConfiguration().itervalues())



def getMetricSymbolsForProvider(provider):
  """ Load  symbols of interest from the common metric configuration for the
  given provider

  :param provider: name of provider to match in the metrics configuration

  :returns: sequence of stock ticker symbol and exchange tuples
  """
  return tuple(
    set(
      (resVal["symbol"], resVal["stockExchange"])
      for resVal in getMetricsConfiguration().itervalues()
      for metricVal in resVal["metrics"].itervalues()
      if metricVal["provider"] == provider))



def createHtmModel(host, apiKey, modelParams):
  """ Create a model for a metric;

  :param host: API server's hostname or IP address
  :param apiKey: API server's API Key
  :param modelParams: model parameters dict per _models POST API

  :returns: model info dictionary from the result of the _models POST request on
    success;
  :rtype: dict

  :raises: ModelQuotaExceededError if quota limit was exceeded
  :raises: ModelMonitorRequestError for non-specific error in request
  :raises: RetriesExceededError if retries were exceeded
  """

  modelParams = json.dumps(modelParams)

  for _retries in xrange(20):
    try:
      response = requests.post(
        "https://%s/_models" % (host,),
        auth=(apiKey, ""),
        data=modelParams,
        verify=False)

      if response.status_code == 201:
        return json.loads(response.text)[0]

      # TODO: this check for "Server limit exceeded" is temporary for MER-1366
      if (response.status_code == 500 and
          "Server limit exceeded" in response.text):
        raise ModelQuotaExceededError()

      raise ModelMonitorRequestError("Unable to create model: %s (%s)" % (
        response, response.text))
    except ModelQuotaExceededError:
      raise
    except Exception:  # pylint: disable=W0703
      g_log.exception("Assuming transient error while creating model")
      time.sleep(2)
    else:
      break
  else:
    raise RetriesExceededError("Create-model retries exceeded")



def createCustomHtmModel(host,
                         apiKey,
                         metricName,
                         resourceName,
                         userInfo,
                         modelParams):
  """ Create a model for a metric;

  :param host: API server's hostname or IP address
  :param apiKey: API server's API Key
  :param metricName: Name of the metric
  :param resourceName: Name of the resource with which the metric is associated
  :param userInfo: A dict containing custom user info to be included in
    metricSpec
  :param modelParams: A dict containing custom model params to be included in
    modelSpec

  :returns: model info dictionary from the result of the _models POST request on
    success;
  :rtype: dict

  :raises: ModelQuotaExceededError if quota limit was exceeded
  :raises: ModelMonitorRequestError for non-specific error in request
  :raises: RetriesExceededError if retries were exceeded
  """
  modelParams = {
    "datasource": "custom",
    "metricSpec": {
      "metric": metricName,
      "resource": resourceName,
      "userInfo": userInfo
    },
    "modelParams": modelParams
  }

  return createHtmModel(host=host, apiKey=apiKey, modelParams=modelParams)



def createAllModels(host, apiKey, onlyMetricNames=None):
  """ Create models corresponding to all metrics in the metrics configuration.

  NOTE: Has no effect on metrics that have already been promoted to models.

  :param str host: API server's hostname or IP address
  :param str apiKey: API server's API Key
  :param onlyMetricNames: None to create models for all configured metrics; an
    iterable of metric names to limit creation of models only to metrics with
    those names - the metric names in the iterable MUST be a non-empty subset of
    the configured metrics.
  :type onlyMetricNames: None or iterable

  :returns: List of models that were created; each element is a model info
    dictionary from the successful result of the _models POST request
  :rtype: list of dicts

  :raises: ModelQuotaExceededError if quota limit was exceeded
  :raises: ModelMonitorRequestError for non-specific error in request
  :raises: RetriesExceededError if retries were exceeded
  """
  metricsConfig = getMetricsConfiguration()

  configuredMetricNames = set(getMetricNamesFromConfig(metricsConfig))

  if onlyMetricNames is not None:
    # Validate onlyMetricNames and convert it to set

    if not onlyMetricNames:
      raise ValueError("onlyMetricNames is empty")

    asSet = set(onlyMetricNames)

    onlyMetricNames = asSet

    unknownMetricNames = (onlyMetricNames -
                          configuredMetricNames)
    if unknownMetricNames:
      raise ValueError(
        "{count} elements in onlyMetricNames are not in metrics configuration: "
        "{unknown}".format(count=len(unknownMetricNames),
                           unknown=unknownMetricNames)
      )
  else:
    onlyMetricNames = configuredMetricNames

  allModels = []

  i = 0
  for resName, resVal in metricsConfig.iteritems():
    for metricName, metricVal in resVal["metrics"].iteritems():

      if metricName not in onlyMetricNames:
        continue

      i += 1

      userInfo = {
        "metricType": metricVal["metricType"],
        "metricTypeName": metricVal["metricTypeName"],
        "symbol": resVal["symbol"]
      }

      modelParams = metricVal.get("modelParams", {})

      try:
        model = createCustomHtmModel(host=host,
                                     apiKey=apiKey,
                                     metricName=metricName,
                                     resourceName=resName,
                                     userInfo=userInfo,
                                     modelParams=modelParams)
      except ModelQuotaExceededError as e:
        g_log.error("Model quota exceeded: %r", e)
        raise

      g_log.info("Enabled monitoring of metric=%s; uid=%s (%d of %d)",
                 model["name"], model["uid"], i, len(onlyMetricNames))

      allModels.append(model)

  return allModels



def unmonitorMetric(host, apiKey, modelId):
  """ Unmonitor a metric

  :param host: API server's hostname or IP address
  :param apiKey: API server's API Key
  :param modelId: id of the model that is monitoring the metric

  :raises: ModelUnmonitorRequestError
  :raises: RetriesExceededError
  """
  for _retries in xrange(20):
    try:
      g_log.debug("Unmonitoring model=%s", modelId)
      response = requests.delete(
        "https://%s/_models/%s" % (host, modelId,),
        auth=(apiKey, ""), verify=False)

      if response.status_code == 200:
        g_log.debug("Unmonitored model=%s", modelId)
        break

      raise ModelUnmonitorRequestError(
        "Unable to unmonitor model=%s: %s (%s)" % (
          modelId, response, response.text))
    except Exception:  # pylint: disable=W0703
      g_log.exception("Assuming transient error while unmonitoring model=%s",
                      modelId)
      time.sleep(0.2)
  else:
    raise RetriesExceededError("Unmonitor-metric retries exceeded")



def deleteMetric(host, apiKey, metricName):
  """ Delete a metric

  :param host: API server's hostname or IP address
  :param apiKey: API server's API Key
  :param metricName: name of the metric to be deleted

  :raises RetriesExceededError:
  :raises MetricNotFound:
  """
  for _retries in xrange(20):
    try:
      g_log.debug("Deleting metric=%s", metricName)
      response = requests.delete(
        "https://%s/_metrics/custom/%s" % (host, metricName,),
        auth=(apiKey, ""), verify=False)

      if response.status_code == 200:
        g_log.debug("Deleteted metric=%s", metricName)
        break

      if response.status_code == 404:
        raise MetricNotFound(response.text)

      raise MetricDeleteRequestError(
        "Unable to delete metric=%s: %s (%s)" % (
          metricName, response, response.text))
    except MetricNotFound as exc:
      g_log.warning(repr(exc))
      raise
    except Exception:  # pylint: disable=W0703
      g_log.exception("Assuming transient error while deleting metric=%s",
                      metricName)
      time.sleep(0.2)
  else:
    raise RetriesExceededError("Unmonitor-metric retries exceeded for {metric}"
                               .format(metric=metricName))



def filterCompanyMetricNamesBySymbol(metricNames, tickerSymbol):
  """Filter company metric names by stock symbol

  :param sequence metricNames: custom metric names
  :param str tickerSymbol: Stock symbol; only company metric names matching
    this stock symbol will be returned.

  :returns: sequence of company metric names matching `tickerSymbol`
  :rtype: sequence
  """
  tickerSymbol = tickerSymbol.upper()

  # Example company metric names:
  # TWITTER.TWEET.HANDLE.AET.VOLUME
  # XIGNITE.TWC.CLOSINGPRICE
  # XIGNITE.AMZN.VOLUME
  # XIGNITE.NEWS.AMZN.VOLUME
  return tuple(
    name for name in metricNames
    if all(name.split(".")) and
    len(name.split(".")) >= 3 and
    name.split(".")[-2] == tickerSymbol)



@_retryOnRequestsErrors()
def getAllCustomMetrics(host, apiKey):
  """Retrieve all custom metrics

  :param host: API server's hostname or IP address
  :param apiKey: API server's API Key

  :returns: a sequence of objects returned by the HTM server's
    GET _metrics/custom API
  """
  url = "https://%s/_metrics/custom" % (host,)

  g_log.info("Retrieving custom metrics")

  response = requests.get(url, auth=(apiKey, ""), verify=False)
  response.raise_for_status()

  return tuple(metric for metric in json.loads(response.text))



def _callGetModelsAPI(host, apiKey, modelId):
  """ Retrieve a specific model or all models

  :param host: API server's hostname or IP address
  :param apiKey: API server's API Key
  :param modelId: if None, retrieves all models,
    otherwise retrieves a specific model

  :returns: a sequence of objects returned by the HTM server's
    GET _models API

  :raises: GetModelsRequestError
  :raises: RetriesExceededError
  """
  url = "https://%s/_models" % (host,)
  if modelId is not None:
    url += "/%s" % (modelId,)

  for _retries in xrange(20):
    try:
      g_log.info("Retrieving model IDs")
      response = requests.get(
        url,
        auth=(apiKey, ""), verify=False)

      if response.status_code == 200:
        models = json.loads(response.text)
        break

      raise GetModelsRequestError("Unable to get models: %s (%s)" % (
        response, response.text))
    except Exception:  # pylint: disable=W0703
      g_log.exception("Transient error while getting models")
      time.sleep(0.2)
  else:
    raise RetriesExceededError("Get-models retries exceeded")

  return tuple(model for model in models if model["parameters"])



def getAllModels(host, apiKey):
  """ Retrieve properties of all models

  :param host: API server's hostname or IP address
  :param apiKey: API server's API Key

  :returns: a sequence of objects returned by the HTM server's
    GET _models API

  :raises: GetModelsRequestError
  :raises: RetriesExceededError
  """
  return _callGetModelsAPI(host, apiKey, modelId=None)



def getOneModel(host, apiKey, modelId):
  """ Retrieve properties of a specific model

  :param host: API server's hostname or IP address
  :param apiKey: API server's API Key

  :returns: a model object returned by the HTM server's
    GET _models API for the given modelId

  :raises: GetModelsRequestError
  :raises: RetriesExceededError
  """
  models = _callGetModelsAPI(host, apiKey, modelId=modelId)
  assert len(models) == 1, "%s is not a model" % (modelId,)
  return models[0]



def getAllModelIds(host, apiKey):
  """ Retrieve IDs of all models

  :param host: API server's hostname or IP address
  :param apiKey: API server's API Key

  :returns: a sequence of unique model id strings

  :raises: GetModelsRequestError
  :raises: RetriesExceededError
  """
  return tuple(obj["uid"] for obj in getAllModels(host, apiKey))



@collectorsdb.retryOnTransientErrors
def establishLastEmittedSampleDatetime(key, aggSec):
  """ Query UTC timestamp of the last emitted sample batch; if one hasn't been
  saved yet, then synthesize one, using negative aggregation period offset
  from current time

  :param int aggSec: aggregation period in seconds
  :returns: (possibly synthesized) UTC timestamp of the last
    successfully-emitted sample batch
  :rtype: datetime.datetime
  """
  lastEmittedTimestamp = queryLastEmittedSampleDatetime(key)
  if lastEmittedTimestamp is not None:
    return lastEmittedTimestamp

  # Start at the present to avoid re-sending metric data that we may have
  # already sent to Taurus.
  lastEmittedTimestamp = (datetime.utcnow().replace(microsecond=0) -
                          timedelta(seconds=aggSec))
  collectorsdb.engineFactory().execute(
    schema.emittedSampleTracker.insert()  # pylint: disable=E1120
    .prefix_with("IGNORE", dialect="mysql")
    .values(key=key, sample_ts=lastEmittedTimestamp))

  # Query again after saving to account for mysql's loss of accuracy
  return queryLastEmittedSampleDatetime(key)



@collectorsdb.retryOnTransientErrors
def queryLastEmittedSampleDatetime(key):
  """
  :param str key: caller's key in schema.emittedSampleTracker
  :returns: UTC timestamp of the last successfully-emitted sample batch; None if
    one hasn't been set up yet; see establishLastEmittedSampleDatetime
  :rtype: datetime.datetime if not None
  """
  sel = sql.select([schema.emittedSampleTracker.c.sample_ts]).where(
    schema.emittedSampleTracker.c.key == key)

  return collectorsdb.engineFactory().execute(sel).scalar()



@collectorsdb.retryOnTransientErrors
def updateLastEmittedSampleDatetime(key, sampleDatetime):
  """ Update the last emitted sample timestamp value in the database for the
  Tweet Volume metrics

  :param str key: caller's key in schema.emittedSampleTracker
  :param datetime sampleDatetime: UTC datetime of last successfully-emitted
    sample batch
  """
  update = schema.emittedSampleTracker.update(  # pylint: disable=E1120
    ).values(
      sample_ts=sampleDatetime
    ).where(
      (schema.emittedSampleTracker.c.key == key)
    )

  collectorsdb.engineFactory().execute(update)



@collectorsdb.retryOnTransientErrors
def queryLastEmittedNonMetricSequence(key):
  """
  :param str key: caller's key in schema.emittedNonMetricTracker
  :returns: last emitted sequence number for non-metric source; None if one
    hasn't been saved yet.
  :rtype: int if not None
  """
  sel = sql.select([schema.emittedNonMetricTracker.c.last_seq]).where(
    schema.emittedNonMetricTracker.c.key == key)

  return collectorsdb.engineFactory().execute(sel).scalar()



@collectorsdb.retryOnTransientErrors
def updateLastEmittedNonMetricSequence(key, seq):
  """ Update the last emitted sample timestamp value in the database for the
  Tweet Volume metrics

  :param str key: caller's key in schema.emittedNonMetricTracker
  :param int seq: sequence of last successfully-emitted non-metric
  """
  update = schema.emittedNonMetricTracker.update(  # pylint: disable=E1120
    ).values(
      last_seq=seq
    ).where(
      (schema.emittedNonMetricTracker.c.key == key)
    )

  result = collectorsdb.engineFactory().execute(update)

  # If update didn't find the key, then insert
  #
  # NOTE: sqlalchemy doesn't support "ON DUPLICATE KEY UPDATE" in its syntactic
  # sugar; see https://bitbucket.org/zzzeek/sqlalchemy/issue/960
  if result.rowcount == 0:
    # The row didn't exist, so create it
    collectorsdb.engineFactory().execute(
      schema.emittedNonMetricTracker.insert()  # pylint: disable=E1120
      .values(key=key, last_seq=seq))



def aggTimestampFromSampleTimestamp(sampleDatetime, aggRefDatetime, aggSec):
  """ Compute aggregation timestamp from the sample's timestamp as the lower
  aggregation boundary relative to the given reference.

  :param datetime sampleDatetime: offset-naive UTC timestamp of the sample (
    e.g., create_at property of a tweet)
  :param datetime aggRefDatetime: offset-naive UTC reference aggregation
    timestamp belonging to the sample stream; may precede, follow, or be equal
    to sampleDatetime
  :agg int aggSec: the corresponding metric's aggregation period in seconds

  :returns: offset=naive UTC timestamp of aggregation period that the sample
    belongs to, which is the bottom boundary of its aggregation window. E.g.,
      sample="2015-02-20 2:14:00", ref="2015-02-20 2:00:00", aggSec=300 (5min)
        would return "2015-02-20 2:10:00"
      sample="2015-02-20 2:14:00", ref="2015-02-20 2:20:00", aggSec=300 (5min)
        would return "2015-02-20 2:10:00"
      sample="2015-02-20 2:15:00", ref="2015-02-20 2:15:00", aggSec=300 (5min)
        would return "2015-02-20 2:15:00"
  :rtype: datetime
  """
  sampleEpoch = date_time_utils.epochFromNaiveUTCDatetime(sampleDatetime)
  aggRefEpoch = date_time_utils.epochFromNaiveUTCDatetime(aggRefDatetime)

  deltaSec = sampleEpoch - aggRefEpoch
  if deltaSec >= 0:
    # Sample timestamp equals or follows reference
    deltaAggIntervalSec = (deltaSec // aggSec) * aggSec
    aggEpoch = aggRefEpoch + deltaAggIntervalSec
  else:
    # Sample timestamp precedes reference

    # Back up to beginning of aggregation window
    deltaAggIntervalSec = ((abs(deltaSec) + (aggSec - 1)) // aggSec) * aggSec
    aggEpoch = aggRefEpoch - deltaAggIntervalSec


  return datetime.utcfromtimestamp(aggEpoch)


# Number of data samples per batch; used by metricDataBatchWrite
_METRIC_DATA_BATCH_WRITE_SIZE = 200


@contextlib.contextmanager
def metricDataBatchWrite(log):
  """ Context manager for sending metric data samples more efficiently using
  batches.

  :param log: logger object for logging

  On entry, it yields a callable putSample for putting metric data samples:

    putSample(metricName, value, epochTimestamp)

  The user calls putSample for each metricDataSample that it wants to send;
  putSample accumulates incoming samples into a batch and sends each batch to
  Taurus server when optimal batch size is reached. At normal exit, the context
  manager sends remaining samples, if any

  Usage example:

    with metricDataBatchWrite(logger) as putSample:
      putSample(metricName1, value1, epochTimestamp1)
      putSample(metricName2, value2, epochTimestamp2)
      . . .
      putSample(metricNameX, valueX, epochTimestampX)

  """

  # __enter__ part begins here:

  batch = []

  bus = message_bus_connector.MessageBusConnector()

  def sendBatch():
    try:
      msg = json.dumps(dict(protocol="plain", data=batch))
      bus.publish(mqName="taurus.metric.custom.data", body=msg, persistent=True)
      log.info("Published numSamples=%d: first=%r; last=%r",
               len(batch), str(batch[0]), str(batch[-1]))
    finally:
      del batch[:]


  def putSample(metricName, value, epochTimestamp):
    # NOTE: we use %r for value to avoid loss of accuracy in floats;
    # NOTE: we cast value to float to deal with values like the long 72001L that
    #   would fail the parsing back to float in the receiver.
    batch.append("%s %r %d" % (metricName, float(value), epochTimestamp))
    if len(batch) >= _METRIC_DATA_BATCH_WRITE_SIZE:
      sendBatch()


  with bus:
    yield putSample

    # __exit__ part begins here:

    # Send remnants, if any
    if batch:
      sendBatch()
