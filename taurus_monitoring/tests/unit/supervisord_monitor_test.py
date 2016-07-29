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
Unittest of taurus_monitoring/supervisord_monitor/supervisord_monitor.py
"""
from mock import Mock, patch
import unittest
import os

#from nta.utils.config import Config
from nta.utils.test_utils import patch_helpers

from taurus_monitoring.supervisord_monitor.supervisord_monitor import (
  SupervisorChecker,
  SupervisorMonitorError,
  SupervisorNotRunning,
  SupervisorProcessInFatalState
)
from taurus_monitoring.supervisord_monitor import (
  taurus_collector_supervisord_monitor,
  taurus_server_supervisord_monitor
)


# Absolute path to directory in which test.conf configuration file may be found
_CONF_DIR = os.path.dirname(os.path.abspath(__file__))
_TEST_CONF_FILEPATH = os.path.join(_CONF_DIR, "test.conf")



class SupervisorCheckerTest(unittest.TestCase):

  # Mock command line arguments, specifying test config file and serverUrl
  @patch_helpers.patchCLIArgs("taurus-server-supervisor-monitor",
                              "--monitorConfPath",
                              _TEST_CONF_FILEPATH,
                              "--serverUrl",
                              "http://127.0.0.1:9001")
  @patch("taurus_monitoring.supervisord_monitor.supervisord_monitor"
         ".SupervisorClient", autospec=True)
  # Disable pylint warning re: unused dispatchNotificationMock argument
  # pylint: disable=W0613
  def testCheckSupervisordState(self, supervisorClientMock):
    runningState = {"statename": "RUNNING"}
    getStateMock = Mock(return_value=runningState)

    supervisorClientMock.return_value = Mock(
      supervisor=Mock(
        getState=getStateMock))

    SupervisorChecker().checkSupervisordState()

    getStateMock.assert_any_call()


  # Mock command line arguments, specifying test config file and serverUrl
  @patch_helpers.patchCLIArgs("taurus-server-supervisor-monitor",
                              "--monitorConfPath",
                              _TEST_CONF_FILEPATH,
                              "--serverUrl",
                              "http://127.0.0.1:9001")
  @patch("taurus_monitoring.supervisord_monitor.supervisord_monitor"
         ".SupervisorClient", autospec=True)
  # Disable pylint warning re: unused dispatchNotificationMock argument
  # pylint: disable=W0613
  def testCheckSupervisorProcesses(self, supervisorClientMock):
    runningState = {"statename": "RUNNING"}
    getAllProcessInfoMock = Mock(return_value=[runningState])

    supervisorClientMock.return_value = Mock(
      supervisor=Mock(
        getAllProcessInfo=getAllProcessInfoMock))

    SupervisorChecker().checkSupervisorProcesses()

    getAllProcessInfoMock.assert_any_call()


  # Mock command line arguments, specifying test config file and serverUrl
  @patch_helpers.patchCLIArgs("taurus-server-supervisor-monitor",
                              "--monitorConfPath",
                              _TEST_CONF_FILEPATH,
                              "--serverUrl",
                              "http://127.0.0.1:9001")
  @patch("taurus_monitoring.supervisord_monitor.supervisord_monitor"
         ".SupervisorClient", autospec=True)
  # Disable pylint warning re: unused dispatchNotificationMock argument
  # pylint: disable=W0613
  def testCheckSupervisordStateRaisesExceptionOnSupervisorClientFailure(self,
      supervisorClientMock):
    noneState = None
    getStateMock = Mock(return_value=noneState)

    supervisorClientMock.return_value = Mock(
      supervisor=Mock(
        getState=getStateMock))

    with self.assertRaises(SupervisorMonitorError):
      SupervisorChecker().checkSupervisordState()

    getStateMock.assert_any_call()


  # Mock command line arguments, specifying test config file and serverUrl
  @patch_helpers.patchCLIArgs("taurus-server-supervisor-monitor",
                              "--monitorConfPath",
                              _TEST_CONF_FILEPATH,
                              "--serverUrl",
                              "http://127.0.0.1:9001")
  @patch("taurus_monitoring.supervisord_monitor.supervisord_monitor"
         ".SupervisorClient", autospec=True)
  # Disable pylint warning re: unused dispatchNotificationMock argument
  # pylint: disable=W0613
  def testCheckSupervisorProcessesRaisesExceptionOnSupervisorClientFailure(
      self, supervisorClientMock):
    noneState = None
    getAllProcessInfoMock = Mock(return_value=noneState)

    supervisorClientMock.return_value = Mock(
      supervisor=Mock(
        getAllProcessInfo=getAllProcessInfoMock))

    with self.assertRaises(SupervisorMonitorError):
      SupervisorChecker().checkSupervisorProcesses()

    getAllProcessInfoMock.assert_any_call()


  # Mock command line arguments, specifying test config file serverUrl
  @patch_helpers.patchCLIArgs("taurus-server-supervisor-monitor",
                              "--monitorConfPath",
                              _TEST_CONF_FILEPATH,
                              "--serverUrl",
                              "http://127.0.0.1:9001")
  @patch("taurus_monitoring.supervisord_monitor.supervisord_monitor"
         ".SupervisorClient", autospec=True)
  # Disable pylint warning re: unused dispatchNotificationMock argument
  # pylint: disable=W0613
  def testCheckSupervisordRaisesExceptionOnSupervisorNotInRunningState(self,
      supervisorClientMock):

    getStateMock = Mock(return_value={"statename": "FATAL"})

    supervisorClientMock.return_value = Mock(
      supervisor=Mock(
        getState=getStateMock))

    with self.assertRaises(SupervisorNotRunning):
      SupervisorChecker().checkSupervisordState()

    getStateMock.assert_any_call()


  # Mock command line arguments, specifying test config file and serverUrl
  @patch_helpers.patchCLIArgs("taurus-server-supervisor-monitor",
                              "--monitorConfPath",
                              _TEST_CONF_FILEPATH,
                              "--serverUrl",
                              "http://127.0.0.1:9001")
  @patch("taurus_monitoring.supervisord_monitor.supervisord_monitor"
         ".SupervisorClient", autospec=True)
  # Disable pylint warning re: unused dispatchNotificationMock argument
  # pylint: disable=W0613
  def testCheckSupervisorProcessesRaisesExceptionOnFatalProcess(self,
      supervisorClientMock):

    getAllProcessInfoMock = Mock(return_value=[{
      "statename": "FATAL",
      "group": "process-group",
      "name": "process-name",
      "description": "process-description"}])

    supervisorClientMock.return_value = Mock(
      supervisor=Mock(
        getAllProcessInfo=getAllProcessInfoMock,
        tailProcessLog=Mock(return_value="Some arbitrary log value")))

    with self.assertRaises(SupervisorProcessInFatalState):
      SupervisorChecker().checkSupervisorProcesses()

    getAllProcessInfoMock.assert_any_call()


  # Mock command line arguments, specifying test config file and ommitting
  # serverUrl
  @patch_helpers.patchCLIArgs("taurus-server-supervisor-monitor",
                              "--monitorConfPath",
                              _TEST_CONF_FILEPATH)
  # Disable pylint warning re: unused dispatchNotificationMock argument
  # pylint: disable=W0613
  def testMissingServerUrlArgRaisesParserError(self):

    # Assert that not specifying a required --serverUrl option will result in
    # a parser error, and consequently a sys.exit(), as indicated by the
    # SystemExit exception
    with self.assertRaises(SystemExit):
      SupervisorChecker()


  @staticmethod
  # Prevent SupervisorChecker from actually being instantiated
  @patch("taurus_monitoring.supervisord_monitor."
         "taurus_collector_supervisord_monitor.SupervisorChecker",
         autospec=True)
  def testTaurusCollectorSupervisordMonitorMain(supervisorCheckerMock):
    taurus_collector_supervisord_monitor.main()
    supervisorCheckerMock.assert_called_once_with()
    supervisorCheckerMock.return_value.checkAll.assert_called_once_with()


  @staticmethod
  # Prevent SupervisorChecker from actually being instantiated
  @patch("taurus_monitoring.supervisord_monitor."
         "taurus_server_supervisord_monitor.SupervisorChecker",
         autospec=True)
  def testTaurusServerSupervisordMonitorMain(supervisorCheckerMock):
    taurus_server_supervisord_monitor.main()
    supervisorCheckerMock.assert_called_once_with()
    supervisorCheckerMock.return_value.checkAll.assert_called_once_with()


  # Mock command line arguments, specifying test config file and serverUrl
  @patch_helpers.patchCLIArgs("taurus-server-supervisor-monitor",
                              "--monitorConfPath",
                              _TEST_CONF_FILEPATH,
                              "--serverUrl",
                              "http://127.0.0.1:9001")
  @patch("taurus_monitoring.supervisord_monitor.supervisord_monitor"
         ".SupervisorClient", autospec=True)
  # Disable pylint warning re: unused dispatchNotificationMock argument
  # pylint: disable=W0613
  def testRegisterCheckRegisteredBothChecksAndNothingElse(self,
      supervisorClientMock):
    supervisorChecker = SupervisorChecker()
    self.assertEqual(len(supervisorChecker.checks), 2)
    self.assertSetEqual(set(fn.func_name for fn in supervisorChecker.checks),
                        set(["checkSupervisordState",
                             "checkSupervisorProcesses"]))



if __name__ == "__main__":
  # TODO: Remove (or retain) this pending resolution of
  # "PROPOSAL: setup.py test runner"
  unittest.main()
