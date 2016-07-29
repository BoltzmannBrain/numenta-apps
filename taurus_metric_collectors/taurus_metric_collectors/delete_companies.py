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

"""Delete specified companies from Taurus Collector and Taurus Engine."""

import argparse
import logging
import os
import random
import time
import uuid

from nta.utils.error_handling import retry
from nta.utils import prompt_utils

from taurus_metric_collectors import collectorsdb
from taurus_metric_collectors import logging_support
from taurus_metric_collectors import metric_utils



# Max time to wait for flushing of Taurus Engine's metric data path
_DATA_PATH_FLUSH_TIMEOUT_SEC = 300

# Prefix of metric name used for flushing Taurus Engine's metric data path;
# see code comments in `deleteCompanies()` for more info.
_DATA_PATH_FLUSHER_METRIC_PREFIX = (  # pylint: disable=C0103
  ".delete_metric_flusher_")


# Default timeout for the warning prompt
_DEFAULT_WARNING_PROMPT_TIMEOUT_SEC = 30



g_log = logging.getLogger(__name__)



class UserAbortedOperation(Exception):
  """When prompted with a warning about this destructive action, the user
  aborted this operation.
  """
  pass



class WarningPromptTimeout(Exception):
  """The warning prompt about the destructive action timed out"""
  pass



class FlusherMetricNotFound(Exception):
  """Inidicates that the wait for Taurus Engine metric data path flusher
  metric timed out.
  """
  pass



def deleteCompanies(tickerSymbols,
                    engineServer,
                    engineApiKey,
                    warnAboutDestructiveAction=True,
                    warningTimeout=_DEFAULT_WARNING_PROMPT_TIMEOUT_SEC):
  """Delete companies from Taurus Collector and their metrics/models from
  Taurus Engine.

  :param sequence tickerSymbols: stock ticker symbols of companies to be
    deleted

  :param str engineServer: dns name of ip addres of Taurus API server

  :param str engineApiKey: API Key of Taurus HTM Engine

  :param bool warnAboutDestructiveAction: whether to warn about destructive
    action; defaults to True.

  :param float warningTimeout: Timeout for the warning prompt; ignored if
    warnAboutDestructiveAction is False

  :raises WarningPromptTimeout: if warning prompt timed out
  :raises UserAbortedOperation: if user chose to abort the operation
  :raises FlusherMetricNotFound:
  """
  tickerSymbols = tuple(symbol.upper() for symbol in tickerSymbols)

  # Check for duplicate symbols
  repeatedSymbols = set(sym for sym in tickerSymbols
                        if tickerSymbols.count(sym) > 1)
  if repeatedSymbols:
    raise ValueError("{numRepeats} symbol(s) are present more than once in "
                     "tickerSymbols arg: {repeats}"
                     .format(numRepeats=len(repeatedSymbols),
                             repeats=repeatedSymbols))

  # Set will be handier going forward
  tickerSymbols = set(tickerSymbols)

  if warnAboutDestructiveAction:
    _warnAboutDestructiveAction(timeout=warningTimeout,
                                tickerSymbols=tickerSymbols,
                                engineServer=engineServer)

  # If any of the ticker symbols still appear in the collector's metrics config,
  # abort the operation as a precautionary measure.
  allSymbols = set(security[0].upper() for security in
                   metric_utils.getAllMetricSecurities())

  problemSymbols = tickerSymbols & allSymbols
  assert not problemSymbols, (
    "Can't delete - {numProblem} of the specified companies [{symbols}] are "
    "in active metrics configuration".format(numProblem=len(problemSymbols),
                                             symbols=problemSymbols))

  # First, we need to synchronize with Taurus Engine's metric data path.
  # If any of the data still in the pipeline is for any of the companies being
  # deleted, then the metrics may be re-created in the Engine after we delete
  # them. This is an yet unresolved subtlety with custom metrics in htmengine.
  _flushTaurusEngineMetricDataPath(engineServer, engineApiKey)

  # NOTE: We must query custom metrics after flushing the metric data path,
  # since metrics may get created as a side-effect of processing metric data.
  allMetricsMap = {
    obj["name"] : obj
    for obj in
    metric_utils.getAllCustomMetrics(host=engineServer, apiKey=engineApiKey)
  }

  allMetricNames = allMetricsMap.keys()

  for symbolNum, symbol in enumerate(tickerSymbols, 1):
    # Delete corresponding metrics from Taurus Engine
    metricNamesToDelete = metric_utils.filterCompanyMetricNamesBySymbol(
      allMetricNames,
      symbol)
    if not metricNamesToDelete:
      g_log.info("No metrics to delete for symbol=%s (%d of %d)", symbol,
                 symbolNum, len(tickerSymbols))
      continue

    g_log.info("Deleting metrics and models for ticker symbol=%s from Taurus "
               "Engine=%s (%d of %d)", symbol, engineServer,
               symbolNum, len(tickerSymbols))

    for metricName in metricNamesToDelete:
      metric_utils.deleteMetric(host=engineServer,
                                apiKey=engineApiKey,
                                metricName=metricName)
      g_log.info("Deleted metric name=%s, uid=%s", metricName,
                 allMetricsMap[metricName]["uid"])


    # Delete the symbol from xignite_security table last; this cascades to
    # delete related rows in other tables via cascading delete relationship.
    #
    # NOTE: garbage collection from other tables not tied to xiginte_security
    #  symbols presently depends on aging of the rows (e.g., twitter tables).
    #  After ENG-83, all company-specific rows from all tables will be
    # cleaned up and THIS NOTE SHOULD THEN BE REMOVED
    with collectorsdb.engineFactory().begin() as conn:
      numDeleted = (
        conn.execute(
          collectorsdb.schema.xigniteSecurity  # pylint: disable=E1120
          .delete()
          .where(collectorsdb.schema.xigniteSecurity.c.symbol == symbol))
        ).rowcount

      if numDeleted:
        g_log.info("Deleted row=%s from table=%s", symbol,
                   collectorsdb.schema.xigniteSecurity)
      else:
        g_log.warning(
          "Couldn't delete security row=%s: not found in table=%s",
          symbol, collectorsdb.schema.xigniteSecurity)


@retry(timeoutSec=_DATA_PATH_FLUSH_TIMEOUT_SEC, initialRetryDelaySec=0.5,
       maxRetryDelaySec=5, retryExceptions=(FlusherMetricNotFound,))
def _waitForFlusherAndGarbageCollect(engineServer,
                                     engineApiKey,
                                     flusherMetricName):
  """Wait for the data path flusher metric to be created in Taurus Engine and
  also garbage-collect flushers from this and prior sessions

  :param str engineServer: dns name of ip addres of Taurus API server

  :param str engineApiKey: API Key of Taurus HTM Engine

  :param str flusherMetricName: the unique name of the flusher metric to wait
    on.

  :raises FlusherMetricNotFound: if the wait fails
  """
  flushers = [obj["name"] for obj in
              metric_utils.getAllCustomMetrics(engineServer, engineApiKey)
              if obj["name"].startswith(_DATA_PATH_FLUSHER_METRIC_PREFIX)]
  found = flusherMetricName in flushers

  # Delete flushers, including any from past attempts that failed delete
  for metric in flushers:
    g_log.info("Deleting metric data path flusher metric %s", metric)
    metric_utils.deleteMetric(host=engineServer,
                              apiKey=engineApiKey,
                              metricName=metric)

  if not found:
    raise FlusherMetricNotFound("Still waiting for data path flusher metric "
                                "{metric}".format(metric=flusherMetricName))


def _flushTaurusEngineMetricDataPath(engineServer, engineApiKey):
  """Flush Taurus Engine's metric data path.

  There is no formal mechanism for this in htmengine, so we're going to flush
  the data path by sending a metric data item for a dummy metric and wait for
  the dummy metric to be created (and then delete the dummy metric). It's a
  hack, but it's pretty much all we got right now.

  :param str engineServer: dns name of ip addres of Taurus API server

  :param str engineApiKey: API Key of Taurus HTM Engine
  """
  g_log.info("Flushing Taurus Engine metric data path, please wait...")

  flusherMetricName = _DATA_PATH_FLUSHER_METRIC_PREFIX + uuid.uuid1().hex

  with metric_utils.metricDataBatchWrite(g_log) as putSample:
    putSample(flusherMetricName, 99999, int(time.time()))

  _waitForFlusherAndGarbageCollect(engineServer=engineServer,
                                   engineApiKey=engineApiKey,
                                   flusherMetricName=flusherMetricName)


def _warnAboutDestructiveAction(timeout, tickerSymbols, engineServer):
  """Prompt user about continuing with the destructive action

  :param float timeout: Timeout for the warning prompt
  :param sequence tickerSymbols: stock ticker symbols of companies to be
    deleted
  :param str engineServer: dns name of ip addres of Taurus API server

  :raises WarningPromptTimeout: if warning prompt timed out
  :raises UserAbortedOperation: if user chose to abort the operation
  """

  expectedAnswer = "Yes-{randomNum}".format(randomNum=random.randint(1, 30),)

  if len(tickerSymbols) <= 5:
    tickersInPrompt = "[{tickers}]".format(tickers=", ".join(tickerSymbols))
  else:
    tickersInPrompt = "[{tickers}, ... and {more} more]".format(
      tickers=tickerSymbols[:5],
      more=len(tickerSymbols)-5)

  promptText = (
    "Attention!  You are about to delete {total} companies {tickers} from "
    "Taurus Collector and their metrics/models from Taurus Engine {engine}\n"
    "\n"
    "To back out immediately without making any changes, feel free to type "
    "anything but \"{expectedAnswer}\" in the prompt below, and press "
    "return. (auto-abort in {timeout} seconds)\n"
    "\n"
    "Are you sure you want to continue? "
    .format(total=len(tickerSymbols),
            tickers=tickersInPrompt,
            engine=engineServer,
            expectedAnswer=expectedAnswer,
            timeout=timeout))

  try:
    answer = prompt_utils.promptWithTimeout(promptText=promptText,
                                            timeout=timeout)
  except prompt_utils.PromptTimeout:
    raise WarningPromptTimeout("Warning prompt timed out")

  if answer.strip() != expectedAnswer:
    raise UserAbortedOperation("User aborted operation from warning prompt")



def _parseArgs():
  """Parse command-line arguments

  :returns: the args object generated by ``argparse.ArgumentParser.parse_args``
    with the following attributes:
      tickerSymbols: The company stock ticker symbol(s);
      engineServer: Hostname or IP addr of server running Taurus's HTM Engine
        API;
      engineApiKey: API Key of Taurus's HTM Engine;
      suppressWarning: True to suppress destruction action warning prompt

  """
  parser = argparse.ArgumentParser(
    description=(
      "Delete specified companies from Taurus Collector and its metrics/models "
      "from Taurus Engine. "
      "NOTE1: as a precaution, the script will abort if the company's ticker "
      "symbol still appears in the collector's metrics configuration."))

  parser.add_argument(
    "--symbols",
    required=True,
    dest="tickerSymbols",
    metavar="S",
    nargs="+",
    help=("Stock ticker symbols identifying the companies to delete; "
          "e.g., WAG ACT T GOOG"))

  parser.add_argument(
    "--engine",
    required=True,
    dest="engineServer",
    metavar="TAURUS_ENGINE_SERVER",
    help=("Hostname or IP address of server running Taurus HTM Engine API to "
          "delete metrics/models."))

  parser.add_argument(
    "--suppress-destructive-action-warning-prompt",
    action="store_true",
    dest="suppressWarning",
    help=("Specify this option to suppress warning prompt. For automation."))

  parser.add_argument(
    "--engine-apikey",
    required=True,
    dest="engineApiKey",
    metavar="TAURUS_ENGINE_API_KEY",
    help="API Key of Taurus HTM Engine")

  args = parser.parse_args()

  if not args.tickerSymbols:
    msg = "Missing or empty company stock ticker symbols"
    g_log.error(msg)
    parser.error(msg)

  if not args.engineServer:
    msg = ("Missing or empty Hostname or IP address of server running Taurus "
           "HTM Engine API")
    g_log.error(msg)
    parser.error(msg)

  if not args.engineApiKey:
    msg = "Missing or empty API Key of Taurus HTM Engine"
    g_log.error(msg)
    parser.error(msg)

  return args



def main():
  """Console script entry point. Delete companies from Taurus Collector and
  their metrics/models from Taurus Engine.
  """
  logging_support.LoggingSupport.initTool()

  try:
    args = _parseArgs()

    try:
      deleteCompanies(
        tickerSymbols=args.tickerSymbols,
        engineServer=args.engineServer,
        engineApiKey=args.engineApiKey,
        warnAboutDestructiveAction=not args.suppressWarning)
    except (WarningPromptTimeout,
            UserAbortedOperation) as exc:
      g_log.warn("%s", exc)
      os._exit(1)  # pylint: disable=W0212
  except SystemExit as exc:
    if exc.code == 0:
      # probably result of --help
      g_log.debug("Exiting with %r", exc)
    else:
      g_log.error("SystemExit: %r", exc)

    raise
  except:
    g_log.exception("Operation failed.")
    raise



if __name__ == "__main__":
  main()
