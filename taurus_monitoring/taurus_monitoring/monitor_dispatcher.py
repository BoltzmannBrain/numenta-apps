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
from abc import ABCMeta, abstractmethod
from datetime import datetime, timedelta
from functools import wraps
import hashlib
import logging
import random
import sys
import traceback

from sqlalchemy.exc import IntegrityError

from taurus_monitoring import monitorsdb
from taurus_monitoring.monitorsdb.schema import monitorDispatcherTable



g_logger = logging.getLogger(__name__)



# Number of days to retain notifications, during which duplicates are not
# sent.  Duplicate problems that are not resolved within the retention period
# will continue to result in notifications no more frequent than the retention
# period.

NOTIFICATION_RETENTION_PERIOD = 7



class _SubclassMetaClassWatcher(ABCMeta):
  def __new__(cls, name, bases, attr):
    """ Ensure that subclasses do not carry over previous checks.

    If you import multiple modules in which MonitorDispatcher is subclassed,
    all checks are saved in the global MonitorDispatcher class.
    """
    subclass = ABCMeta.__new__(cls, name, bases, attr)

    subclass.checks = [
      check for check in subclass.checks if check in attr.values()
    ]

    return subclass



# Disable `Abstract class not referenced (abstract-class-not-used)` warnings
# pylint: disable=R0921
class MonitorDispatcher(object):
  __metaclass__ = _SubclassMetaClassWatcher

  checks = []



  @abstractmethod
  def dispatchNotification(self, checkFn, excType, excValue, excTraceback):
    """ Send notification.  Implementation to be provided by subclass.

    :param function checkFn: The check function that raised an exception
    :param type excType: Exception type
    :param exception excValue: Exception value
    :param traceback excTraceback: Exception traceback
    :returns: None
    """
    raise NotImplementedError("dispatchNotification() must be implemented in "
                              "subclass per abc protocol.")


  @staticmethod
  def _hashExceptionValue(excValue):
    """
    :param exception excValue:
    :returns: Hash digest (currently sha1)
    """
    return hashlib.sha1(str(excValue)).digest()


  @classmethod
  def clearAllNotificationsInteractiveConsoleScriptEntryPoint(cls):
    """ Interactive utility for manually clearing out all notifications.
    Meant to be used as a console script entry point, defined in setup.py.

    User will be prompted with a stern warning to delete notifications, and
    required to enter "Yes-" followed by a random integer.
    """

    engine = monitorsdb.engineFactory()
    expectedAnswer = "Yes-%s" % (random.randint(1, 30),)

    answer = raw_input(
      "Attention!  You are about to do something irreversible, and potentially"
      " dangerous.\n"
      "\n"
      "To back out immediately without making any changes, feel free to type "
      "anything but \"{}\" in the prompt below, and press return.\n"
      "\n"
      "Should you choose to continue, all notifications in the DATABASE \"{}\""
      "will be PERMANENTLY DELETED.\n"
      "\n"
      "Are you sure you want to continue? "
      .format(expectedAnswer, engine))

    if answer.strip() != expectedAnswer:
      print "Aborting - Wise choice, my friend. Bye."
      return

    # Disable `No value passed for parameter 'dml' in function call
    # (no-value-for-parameter)` warnings
    # pylint: disable=E1120

    cmd = monitorDispatcherTable.delete()

    @monitorsdb.retryOnTransientErrors
    def _executeWithRetries():
      monitorsdb.engineFactory().execute(cmd)

    _executeWithRetries()

    print "Notifications deleted."


  @classmethod
  def _cleanupOldNotifications(cls):
    """ Delete all notifications older than a date determined by subtracting
    the number of days held in the value of the NOTIFICATION_RETENTION_PERIOD
    module-level variable from the current UTC timestamp.
    """
    cutoffDate = (datetime.utcnow() -
                  timedelta(days=NOTIFICATION_RETENTION_PERIOD))

    # Disable `No value passed for parameter 'dml' in function call
    # (no-value-for-parameter)` warnings
    # pylint: disable=E1120
    cmd = (monitorDispatcherTable
           .delete()
           .where(monitorDispatcherTable.c.timestamp < cutoffDate))

    @monitorsdb.retryOnTransientErrors
    def _executeWithRetries():
      monitorsdb.engineFactory().execute(cmd)

    _executeWithRetries()


  @classmethod
  def _recordNotification(cls, conn, checkFn, excType, excValue):
    """ Record notification, uniquely identified by the name of the function,
    the exception type, and a hash digest of the exception value that triggered
    the notification.  Duplicate notifications will be silently ignored.

    :param conn: Database connection.  Note, preventDuplicates() starts a
      transaction using the monitorsdb.engineFactory().begin() context
      manager.  If the actual dispatchNotification() call fails for whatever
      reason, the transaction is not completed and changes are not committed.
    :param function checkFn: Function that triggered notification
    :param excType: Exception type that triggered notification
    :param excValue: Actual exception that triggered notification
    :returns: Boolean result.  True if notification succesfully recorded, False
      if IntegrityError raised due to pre-existing duplicate.
    """
    excValueDigest = cls._hashExceptionValue(excValue)

    # Disable `No value passed for parameter 'dml' in function call
    # (no-value-for-parameter)` warnings
    # pylint: disable=E1120
    ins = (monitorDispatcherTable
           .insert()
           .values(checkFn=checkFn.__name__,
                   excType=excType.__name__,
                   excValueDigest=excValueDigest,
                   timestamp=datetime.utcnow(),
                   excValue=excValue))

    try:
      conn.execute(ins)
      return True
    except IntegrityError:
      g_logger.info("Duplicate notification quietly ignored -- %r",
                    tuple([checkFn, excType, excValue]))

    return False


  @classmethod
  def preventDuplicates(cls, dispatchNotification):
    """ Decorator to complement implementations of dispatchNotification to
    prevent similar errors from triggering multiple emails.

    :param function dispatchNotification: Implementation of
      dispatchNotification as required by abc protocol.  This function MUST
      implement the same signature as MonitorDispatcher.dispatchNotification()
    """
    @wraps(dispatchNotification)
    def wrappedDispatchNotification(
        self, checkFn, excType, excValue, excTraceback):
      """
      See dispatchNotification() for signature and docstring.
      """
      cls._cleanupOldNotifications()

      @monitorsdb.retryOnTransientErrors
      def _dispatchNotificationWithTransactionAwareRetries():
        with monitorsdb.engineFactory().begin() as conn:
          """ Wrap dispatchNotification() in a transaction, in case there is an
          error that prevents the notification being dispatched.  In such a
          case we DO NOT want to save the notification so that it may be
          re-attempted later
          """
          if cls._recordNotification(conn, checkFn, excType, excValue):
            dispatchNotification(self, checkFn, excType, excValue, excTraceback)

      _dispatchNotificationWithTransactionAwareRetries()

    return wrappedDispatchNotification


  def checkAll(self):
    """ Run all previously-registered checks and send an email upon failure
    """
    for check in self.checks:
      # Disable `Catching too general exception Exception (broad-except)`
      # warning
      # pylint: disable=W0703
      try:
        check(self)
      except Exception:
        self.dispatchNotification(check,
                                  sys.exc_type,
                                  sys.exc_value,
                                  sys.exc_traceback)


  @staticmethod
  def formatTraceback(excType, excValue, excTraceback):
    """ Helper utility to format an exception and traceback into a str.  Alias
    for::

      "".join(traceback.format_exception(excType, excValue, excTraceback))

    :returns: str
    """
    return "".join(traceback.format_exception(excType, excValue, excTraceback))


  @classmethod
  def registerCheck(cls, fn):
    """ Function decorator to register an externally defined function as a
    check.  Function must be an instance method of a MonitorDispatcher subclass
    and accept no additional arguments.
    """
    cls.checks.append(fn)
    return fn
