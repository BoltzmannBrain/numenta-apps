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

"""Baseline non-destructive health checks of the running Taurus Metric
Collectors server.
"""


import unittest
from urlparse import urljoin
import xmlrpclib


from nta.utils import error_handling



# Max time to wait for service to enter RUNNING state
_RUNNING_TIMEOUT_SEC = 5


_METRICS_COLLECTOR_SUPERVISOR_API_URL = urljoin("http://localhost:8001", "RPC2")


_RETRY_SERVICE_RUNNING_CHECK = error_handling.retry(
  _RUNNING_TIMEOUT_SEC,
  initialRetryDelaySec=1,
  maxRetryDelaySec=1)



class TaurusMetricCollectorsHealthCheckTestCase(unittest.TestCase):

  @staticmethod
  def _getServiceStateName(serviceName):
    """Get the state name of a service

    :param str serviceName: name of service
    :returns: State name of the service; see
      http://supervisord.org/subprocess.html#process-states
    :rtype: str
    """
    server = xmlrpclib.Server(_METRICS_COLLECTOR_SUPERVISOR_API_URL)

    info = server.supervisor.getProcessInfo(serviceName)

    return info["statename"]


  @_RETRY_SERVICE_RUNNING_CHECK
  def testMetricMaintenanceAgentIsRunning(self):
    # NOTE: This service exits when configured for hot-standby mode
    self.assertIn(self._getServiceStateName("metric_maintenance_agent"),
                  ["RUNNING", "EXITED"])


  @_RETRY_SERVICE_RUNNING_CHECK
  def testXigniteStockAgentIsRunning(self):
    self.assertEqual(self._getServiceStateName("xignite_stock_agent"),
                     "RUNNING")


  @_RETRY_SERVICE_RUNNING_CHECK
  def testTwitterDirectAgentIsRunning(self):
    self.assertEqual(self._getServiceStateName("twitter_direct_agent"),
                     "RUNNING")


  @_RETRY_SERVICE_RUNNING_CHECK
  def testTweetDeletionAgentIsRunning(self):
    self.assertEqual(self._getServiceStateName("tweet_deletion_agent"),
                     "RUNNING")


  @_RETRY_SERVICE_RUNNING_CHECK
  def testTwitterScreenNameCheckerIsRunning(self):
    self.assertEqual(self._getServiceStateName("twitter_screen_name_checker"),
                     "RUNNING")


  @_RETRY_SERVICE_RUNNING_CHECK
  def testStockSymbolCheckerIsRunning(self):
    self.assertEqual(self._getServiceStateName("stock_symbol_checker"),
                     "RUNNING")



if __name__ == "__main__":
  unittest.main()
