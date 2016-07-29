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

""" Delete specific metric on the given destination HTM server """

import logging
from optparse import OptionParser
import os
import sys

from taurus_metric_collectors import logging_support, metric_utils



DEFAULT_HTM_SERVER = os.environ.get("TAURUS_HTM_SERVER")



g_log = logging.getLogger("metric_collectors.unmonitor_metrics")



def _parseArgs():
  """
  :returns: dict of arg names and values:
    htmServer
    apiKey
    metricName
  """
  helpString = (
    "%prog [options] [metric name]\n\n"
    "Deletes specific metric on an HTM server.")

  parser = OptionParser(helpString)

  parser.add_option(
    "--server",
    action="store",
    type="string",
    dest="htmServer",
    default=DEFAULT_HTM_SERVER,
    help="Hostname or IP address of server running HTM Engine API to create "
    "models [default: %default]")

  parser.add_option(
    "--apikey",
    action="store",
    type="string",
    dest="apiKey",
    help="API Key of HTM Engine")

  options, metricNames = parser.parse_args()

  if len(metricNames) != 1:
    msg = ("Unexpected additional arguments"
           if len(metricNames) > 1
           else "Missing metric name argument")
    g_log.error(msg)
    parser.error(msg)

  if not options.htmServer:
    msg = ("Missing or empty Hostname or IP address of server running HTM "
           "Engine API")
    g_log.error(msg)
    parser.error(msg)

  if not options.apiKey:
    msg = "Missing or empty API Key of HTM Engine"
    g_log.error(msg)
    parser.error(msg)


  return dict(
    htmServer=options.htmServer,
    apiKey=options.apiKey,
    metricName = metricNames[0]
  )



def main():
  logging_support.LoggingSupport.initTool()

  try:
    options = _parseArgs()
    g_log.info("Running %s with options=%r", sys.argv[0], options)

    for metric in metric_utils.getAllCustomMetrics(host=options["htmServer"],
                                                   apiKey=options["apiKey"]):
      if metric["name"] == options["metricName"]:
        metric_utils.deleteMetric(host=options["htmServer"],
                                  apiKey=options["apiKey"],
                                  metricName=metric["name"])

        g_log.info("Deleted metric=%s", metric["name"])
        break

  except SystemExit as e:
    if e.code != 0:
      g_log.exception("delete_metric failed")
    raise
  except Exception:
    g_log.exception("delete_metric failed")
    raise



if __name__ == "__main__":
  main()
