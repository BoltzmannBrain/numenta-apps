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
Unittest of taurus_monitoring/monitor_dispatcher.py
"""
import random
import sys
import unittest

from mock import MagicMock, Mock, patch

import sqlalchemy

from taurus_monitoring.monitor_dispatcher import MonitorDispatcher



class MonitorDispatcherTest(unittest.TestCase):


  def testIncompleteSubclassImplementation(self):

    # Disable pylint warning re: abc method not defined
    # pylint: disable=W0223
    class MyMonitor(MonitorDispatcher):
      pass # Class does not implement dispatchNotification

    self.assertRaises(TypeError, MyMonitor)


  # Disable "method could be a function" pylint warning
  # pylint: disable=R0201
  def testRegisterCheck(self):

    self.assertTrue(hasattr(MonitorDispatcher, "registerCheck"))

    checkInnerMock1 = Mock()
    checkInnerMock2 = Mock()

    class MyMonitor(MonitorDispatcher):

      def dispatchNotification(self, checkFn, excType, excValue, excTraceback):
        pass # abc protocol requires this in MonitorDispatcher subclasses

      @MonitorDispatcher.registerCheck
      # Disable "method could be a function" pylint warning
      # pylint: disable=R0201
      def myCheck1(self):
        checkInnerMock1()

      @MonitorDispatcher.registerCheck
      def myCheck2(self):
        checkInnerMock2()

    MyMonitor().checkAll()

    checkInnerMock1.assert_called_once_with()
    checkInnerMock2.assert_called_once_with()


  def testCheckAllSendsNotifications(self):

    self.assertTrue(hasattr(MonitorDispatcher, "checkAll"))

    dispatchNotificationMock = Mock()

    class MyMonitor(MonitorDispatcher):

      def dispatchNotification(self, checkFn, excType, excValue, excTraceback):
        dispatchNotificationMock(excType, excValue)

      @MonitorDispatcher.registerCheck
      def myCheck(self):
        raise Exception("myCheckFailed")

    myMonitor = MyMonitor()
    myMonitor.checkAll()

    (excType, excValue), _ = dispatchNotificationMock.call_args_list[0]

    self.assertIs(excType, Exception)
    self.assertIsInstance(excValue, Exception)
    self.assertEqual(excValue.message, "myCheckFailed")


  @patch("taurus_monitoring.monitor_dispatcher.monitorsdb.engineFactory",
         autospec=True)
  def testPreventDuplicatesPreventsDuplicates(self, engineFactoryMock):

    cleanupOldNotificationsConnMock = Mock()
    recordNotificationConnMock = Mock(begin=Mock(return_value=MagicMock()))

    contextualConn = (
      recordNotificationConnMock.begin.return_value.__enter__.return_value
    )

    contextualConn.execute.side_effect = iter([
      # First Insert Succeeds.
      Mock(),
      # Second Insert raises an IntegrityError exception
      sqlalchemy.exc.IntegrityError("statement", "params", "orig")
    ])

    # We're going to call MyMonitor().checkAll() twice below, so duplicate the
    # mocks
    engineFactoryMock.side_effect = iter(2*[
      cleanupOldNotificationsConnMock,
      recordNotificationConnMock
    ])

    dispatchNotificationMock = Mock()

    exceptionToRaiseInMyCheck = Exception("myCheckFailed")

    class MyMonitor(MonitorDispatcher):

      @MonitorDispatcher.preventDuplicates
      def dispatchNotification(self, checkFn, excType, excValue, excTraceback):
        dispatchNotificationMock(excType, excValue)

      @MonitorDispatcher.registerCheck
      def myCheck(self):
        raise exceptionToRaiseInMyCheck

    MyMonitor().checkAll()

    # Assert that MyMonitor().checkAll() attempted to delete something,
    # presumably to clean up old notifications
    self.assertTrue(cleanupOldNotificationsConnMock.execute.called)
    (deleteObj,), _ = cleanupOldNotificationsConnMock.execute.call_args_list[0]
    self.assertIsInstance(deleteObj, sqlalchemy.sql.dml.Delete)

    # Assert that MyMonitor().checkAll() attempted to insert something
    self.assertTrue(contextualConn.execute.called)
    (insertObj,), _ = contextualConn.execute.call_args_list[0]
    self.assertIsInstance(insertObj, sqlalchemy.sql.dml.Insert)

    # Call it again to force a duplicate exception
    MyMonitor().checkAll()

    # Assert the dispatchNotification was called once, and only once as a
    # result of the IntegrityError
    dispatchNotificationMock.assert_called_once_with(
      Exception,
      exceptionToRaiseInMyCheck
    )


  def testFormatTraceback(self):
    try:
      raise Exception("Bogus exception")
    except Exception: # pylint: disable=W0703
      formattedTraceback = MonitorDispatcher.formatTraceback(sys.exc_type,
                                                             sys.exc_value,
                                                             sys.exc_traceback)
    self.assertIsInstance(formattedTraceback, str)
    self.assertTrue(
      formattedTraceback.startswith("Traceback (most recent call last):"))
    self.assertTrue(
      formattedTraceback.endswith("Exception: Bogus exception\n"))


  # Note: In patching raw_input(), you will NOT be able to use pdb!
  @patch("__builtin__.raw_input", Mock(side_effect=["No", "Yes-42"]))
  @patch("random.randint",  Mock(return_value=42, spec=random.randint))
  @patch("taurus_monitoring.monitor_dispatcher.monitorsdb.engineFactory",
         autospec=True)
  def testClearAllNotificationsInteractiveConsoleScriptEntryPoint(self,
      engineFactoryMock):

    # In first attempt, user passes "No", in which case ensure that the
    # database is not touched
    (MonitorDispatcher
     .clearAllNotificationsInteractiveConsoleScriptEntryPoint)()

    self.assertFalse(engineFactoryMock.return_value.execute.called)

    # In second attempt, user passes "Yes-42", in which case ensure that
    # an attempt is made to delete
    (MonitorDispatcher
     .clearAllNotificationsInteractiveConsoleScriptEntryPoint)()

    self.assertTrue(engineFactoryMock.return_value.execute.called)
    (deleteObj,), _ = engineFactoryMock.return_value.execute.call_args_list[0]
    self.assertIsInstance(deleteObj, sqlalchemy.sql.dml.Delete)



if __name__ == "__main__":
  # TODO: Remove (or retain) this pending resolution of
  # "PROPOSAL: setup.py test runner"
  unittest.main()
