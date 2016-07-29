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

"""Baseline non-destructive health checks of the running Taurus Engine server.
"""


import unittest
from urlparse import urljoin
import xmlrpclib


from nta.utils import error_handling



# Max time to wait for service to enter RUNNING state
_RUNNING_TIMEOUT_SEC = 5


_TAURUS_ENGINE_SUPERVISOR_API_URL = urljoin("http://localhost:9001", "RPC2")


_RETRY_SERVICE_RUNNING_CHECK = error_handling.retry(
  _RUNNING_TIMEOUT_SEC,
  initialRetryDelaySec=1,
  maxRetryDelaySec=1)



class TaurusEngineHealthCheckTestCase(unittest.TestCase):

  @staticmethod
  def _getServiceStateName(serviceName):
    """Get the state name of a service

    :param str serviceName: name of service
    :returns: State name of the service; see
      http://supervisord.org/subprocess.html#process-states
    :rtype: str
    """
    server = xmlrpclib.Server(_TAURUS_ENGINE_SUPERVISOR_API_URL)

    info = server.supervisor.getProcessInfo(serviceName)

    return info["statename"]


  @staticmethod
  def _findServiceStateNames(serviceGroup, processNamePrefix):
    """Get the state names of service instances. This is intended for services
    that may be configured to execute multiple concurrent instances.

    :param str serviceGroup: group name of the service
    :param str processNamePrefix: prefix of the service's process name
    :returns: Mapping of the actual process names to state names; see
      http://supervisord.org/subprocess.html#process-states
    :rtype: dict
    """
    server = xmlrpclib.Server(_TAURUS_ENGINE_SUPERVISOR_API_URL)

    infos = server.supervisor.getAllProcessInfo()

    mapping = dict()

    for info in infos:
      name = info["name"]
      if info["group"] == serviceGroup and name.startswith(processNamePrefix):
        mapping[name] = info["statename"]

    return mapping



  @_RETRY_SERVICE_RUNNING_CHECK
  def testAnomalyServiceIsRunning(self):
    self.assertEqual(
      self._getServiceStateName("htmengine:anomaly_service"),
      "RUNNING")


  @_RETRY_SERVICE_RUNNING_CHECK
  def testMetricListenerServiceIsRunning(self):
    self.assertEqual(
      self._getServiceStateName("htmengine:metric_listener"),
      "RUNNING")


  @_RETRY_SERVICE_RUNNING_CHECK
  def testMetricStorerServiceIsRunning(self):
    self.assertEqual(
      self._getServiceStateName("htmengine:metric_storer"),
      "RUNNING")


  @_RETRY_SERVICE_RUNNING_CHECK
  def testModelSchedulerrServiceIsRunning(self):
    self.assertEqual(
      self._getServiceStateName("htmengine:model_scheduler"),
      "RUNNING")


  @_RETRY_SERVICE_RUNNING_CHECK
  def testDynamoDbServiceIsRunning(self):
    serviceStates = self._findServiceStateNames(
      serviceGroup="taurus",
      processNamePrefix="dynamodb-service_")

    self.assertGreaterEqual(len(serviceStates), 1)
    self.assertEqual(serviceStates.values(), ["RUNNING"] * len(serviceStates),
                     msg=serviceStates)


  @_RETRY_SERVICE_RUNNING_CHECK
  def testTaurusApiServiceIsRunning(self):
    serviceStates = self._findServiceStateNames(
      serviceGroup="taurus",
      processNamePrefix="taurus-api_")

    self.assertGreaterEqual(len(serviceStates), 1)
    self.assertEqual(serviceStates.values(), ["RUNNING"] * len(serviceStates),
                     msg=serviceStates)


  @_RETRY_SERVICE_RUNNING_CHECK
  def testRmqMetricCollectorServiceIsRunning(self):
    serviceStates = self._findServiceStateNames(
      serviceGroup="taurus",
      processNamePrefix="rmq-metric-collector_")

    self.assertGreaterEqual(len(serviceStates), 1)
    self.assertEqual(serviceStates.values(), ["RUNNING"] * len(serviceStates),
                     msg=serviceStates)


  @_RETRY_SERVICE_RUNNING_CHECK
  def testMetricDataGarbageCollectorServiceIsRunning(self):
    serviceStates = self._findServiceStateNames(
      serviceGroup="taurus",
      processNamePrefix="metric-data-garbage-collector_")

    self.assertGreaterEqual(len(serviceStates), 1)
    self.assertEqual(serviceStates.values(), ["RUNNING"] * len(serviceStates),
                     msg=serviceStates)



if __name__ == "__main__":
  unittest.main()
