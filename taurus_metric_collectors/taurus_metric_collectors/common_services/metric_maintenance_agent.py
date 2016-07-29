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

"""This service maintains consistency between the collectors' metrics
configuration and the models as well as the buffered data in metric collectors
repository. It also promotes unmonitored metrics that have reached a certain
metric data quantity threshold to models.

This service relies explicitly on these environment variables:
  TAURUS_HTM_SERVER
  TAURUS_API_KEY

NOTE: the functionality is influenced by the service's opmode (see below), which
is configured via `taurus-collectors-set-opmode`.

Upon start-up: The script checks its opmode and exits with 0 return code if the
service is configured for hot-standby mode.

In active opmode, the service first checks for consistency between metrics
configuration and the stock symbols in the xignite_security table. It then
proceeds to delete metrics/models and xignite_security rows for companies whose
stock symbol is no longer in metrics config.

Then, the service enters a loop where it periodically promotes unmonitored
metrics that have reached a preconfigured metric data quantity threshold to
models.
"""

import logging
import argparse
import os
import sys
import time

import sqlalchemy as sql

import taurus_metric_collectors
from taurus_metric_collectors import collectorsdb
from taurus_metric_collectors import delete_companies
from taurus_metric_collectors import metric_utils
from taurus_metric_collectors import logging_support
from taurus_metric_collectors.collectorsdb import schema


# Interval between repetitive processing cycles
_SLEEP_INTERVAL_SEC = 3600 * 4



# Unmonitored company metrics that have accumulated at least this many metric
# data rows in Taurus Engine will be promoted to models
_NUM_METRIC_DATA_ROWS_THRESHOLD = 1000



_TAURUS_HTM_SERVER = os.environ["TAURUS_HTM_SERVER"]
_TAURUS_API_KEY = os.environ["TAURUS_API_KEY"]


# Values of htmengine.repository.queries.MetricStatus.UNMONITORED, etc.
# NOTE: taurus_metric_collectors presently has no dependency on htmengine, which
# would necessitate nupic, etc.
_METRIC_STATUS_UNMONITORED = 0
_METRIC_STATUS_ACTIVE = 1


# Initialize logging
g_log = logging.getLogger(__name__)



def _parseArgs(args):
  """ Parse command-line.

  NOTE: there are presently no custom args for this service, so this handles
  the boilerplate `--help`, `-h`, and makes sure that nothing unexpected was
  passed in.

  :param list args: the equivalent of sys.argv[1:]

  """
  parser = argparse.ArgumentParser(description=__doc__)

  parser.parse_args(args=args)



@collectorsdb.retryOnTransientErrors
def _queryCachedCompanySymbols():
  """Get the cached security symbols from the xignite_security table

  :returns: A sequence of stock symbols from the xignite_security table
  :rtype: sequence
  """
  engine = collectorsdb.engineFactory()

  return tuple(
    row.symbol for row in
    engine.execute(sql.select([schema.xigniteSecurity.c.symbol])).fetchall())



def _purgeDeprecatedCompanies():
  """Purge cached data and Taurus Engine metrics/models corresponding to symbols
  that are in xignite_security table, but not in metrics configuration.
  """
  activeCompanySymbols = set(security[0] for security in
                             metric_utils.getAllMetricSecurities())

  deprecatedSymbols = set(_queryCachedCompanySymbols()) - activeCompanySymbols

  if deprecatedSymbols:
    delete_companies.deleteCompanies(
      tickerSymbols=deprecatedSymbols,
      engineServer=_TAURUS_HTM_SERVER,
      engineApiKey=_TAURUS_API_KEY,
      warnAboutDestructiveAction=False)
  else:
    g_log.info("There were no deprecated companies to remove")



def _filterMetricsReadyForPromotion(metricsConfig, allCustomMetrics):
  """Determine which metrics need to be promoted to models.

  The qualified metrics meet the following criteria:
    1. Presently not monitored
    2. Metric's name exists in metric collector's current metrics configuration
    3. The metric has at least _NUM_METRIC_DATA_ROWS_THRESHOLD metric data
       elements in Taurus Engine

  :param dict metricsConfig: Metric configuration object that defines all
    instances and metrics for all data collectors; as returned by
    `metric_utils.getMetricsConfiguration()`

  :param sequence allCustomMetrics: Custom metric info dicts from
    Taurus Engine as returned by `metric_utils.getAllCustomMetrics()`

  :returns: Names of of metrics that need to be promoted to models
  :rtype: sequence
  """
  configuredMetricNames = set(
    metric_utils.getMetricNamesFromConfig(metricsConfig))

  # Compile a set of unmonitored metrics that are in our current metrics
  # configuration and are ready for promoting to models
  return tuple(
    obj["name"] for obj in allCustomMetrics
    if obj["status"] == _METRIC_STATUS_UNMONITORED and
    obj["name"] in configuredMetricNames and
    obj["last_rowid"] >= _NUM_METRIC_DATA_ROWS_THRESHOLD)



def _promoteReadyMetricsToModels():
  """Promote unmonitored company metrics that reached
  _NUM_METRIC_DATA_ROWS_THRESHOLD to models
  """

  # Build a map of all configured metric names to metric/model args for
  # promoting to models
  metricsConfig = metric_utils.getMetricsConfiguration()

  readyMetricNames = _filterMetricsReadyForPromotion(
    metricsConfig=metricsConfig,
    allCustomMetrics=metric_utils.getAllCustomMetrics(
      _TAURUS_HTM_SERVER,
      _TAURUS_API_KEY))

  if not readyMetricNames:
    g_log.debug("There are no metrics that are ready for promotion at this time")
    return

  # Promote them to models
  metric_utils.createAllModels(host=_TAURUS_HTM_SERVER,
                               apiKey=_TAURUS_API_KEY,
                               onlyMetricNames=readyMetricNames)



def main():
  """ NOTE: main may be used as "console script" entry point by setuptools
  """
  logging_support.LoggingSupport.initService()

  try:

    try:
      _parseArgs(sys.argv[1:])
    except SystemExit as e:
      if e.code == 0:
        # Suppress exception logging when exiting due to --help
        return

      raise

    opMode = taurus_metric_collectors.config.get("metric_maintenance_agent", "opmode")
    if opMode != taurus_metric_collectors.config.OP_MODE_ACTIVE:
      g_log.info("Exiting normally due to start in non-active opmode=%s",
                 opMode)
      return 0

    _purgeDeprecatedCompanies()

    while True:
      _promoteReadyMetricsToModels()

      g_log.info("Pausing ... will resume in %s minutes",
                 _SLEEP_INTERVAL_SEC/60.0)
      time.sleep(_SLEEP_INTERVAL_SEC)

  except KeyboardInterrupt:
    # Suppress exception that typically results from the SIGINT signal sent by
    # supervisord to stop the service; log with exception info to help debug
    # deadlocks
    g_log.info("Observed KeyboardInterrupt", exc_info=True)
    return 0
  except:
    g_log.exception("Failed!")
    raise



if __name__ == "__main__":
  main()
