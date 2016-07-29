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
import os
import pickle

from taurus_monitoring.latency_monitor.model_latency_monitor import (
  ModelLatencyChecker
)



_DATA_DIR = os.path.dirname(os.path.abspath(__file__))

_LOCALS = {}
execfile(os.path.join(_DATA_DIR, "models.py"), {}, _LOCALS)
MODELS = _LOCALS["MODELS"]



class ModelLatencyCheckerUtil(ModelLatencyChecker):
  """ Utility helper class for generating new metric data samples from a live
  taurus configuration.

  Usage::

     ModelLatencyCheckerUtil().run()

  This class subclasses ModelLatencyChecker and augments the command line
  parser to accept additional options specific to the process of caching
  metric data samples.  For example:

    python tests/unit/data/model_latency_monitor_metric_data_util.py \
      --monitorConfPath <path to moniting configuration file> \
      --metricDataTable <taurus metric data dynamodb table name>

  """
  def __init__(self):
    self.parser.add_option("--destinationDir",
                           type="str",
                           default=_DATA_DIR)
    super(ModelLatencyCheckerUtil, self).__init__()


  def generateMetricDataSamples(self):
    for model in MODELS:
      resultSet = self.getMetricData(metricUid=model["uid"])

      # Cache only a subset of the data used in the monitor and test
      metricData = [
        {"timestamp": sample["timestamp"],
          "metric_value": sample["metric_value"]
        } for sample in resultSet
      ]

      filename = os.path.join(self.options.destinationDir,
                              model["name"] + "-data.pickle")

      with open(filename, "w") as outp:
        pickle.dump(metricData, outp)



if __name__ == "__main__":
  ModelLatencyCheckerUtil().generateMetricDataSamples()
