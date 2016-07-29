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

"""This test suite verifies that the resources required by the Taurus Metric
Collectors server are accessible. NOTE: This test suite MUST be executed while
the services are stopped to prevent the twitter stream test from getting
throttled indefinitely.
"""

# Disable warning "access to protected member"
# pylint: disable=W0212


from datetime import datetime, timedelta
import os
import unittest

import tweepy

from nta.utils import error_handling
from nta.utils import error_reporting
from nta.utils.message_bus_connector import MessageBusConnector

from taurus_metric_collectors import collectorsdb
from taurus_metric_collectors import metric_utils
from taurus_metric_collectors.xignite import xignite_stock_agent


_ACCESSIBILITY_TIMEOUT_SEC = 20

_RETRY_ACCESSIBILITY_CHECK = error_handling.retry(
  _ACCESSIBILITY_TIMEOUT_SEC,
  initialRetryDelaySec=1,
  maxRetryDelaySec=1)



class TaurusMetricCollectorsResourceAccessibilityTestCase(unittest.TestCase):


  @_RETRY_ACCESSIBILITY_CHECK
  def testCollectorsdbIsAccessible(self):  # pylint: disable=R0201
    transactionContext = collectorsdb.engineFactory().begin()
    transactionContext.transaction.rollback()


  @_RETRY_ACCESSIBILITY_CHECK
  def testMessageBusIsAccessible(self):  # pylint: disable=R0201
    with MessageBusConnector() as bus:
      bus.isMessageQeueuePresent("")


  # Twitter API sometimes throttles for a while, so we use longer retries
  @error_handling.retry(timeoutSec=90,
                        initialRetryDelaySec=2,
                        maxRetryDelaySec=2)
  def testTwitterStreamInterfaceIsAccessible(self):
    # NOTE: this test MUST be executed while the twitter-direct-agent is stopped
    # to prevent the throttling error (420).
    class ConnectedOk(Exception):
      pass


    class ConnectionFailed(Exception):
      pass


    class TwitterStreamListener(tweepy.StreamListener):
      def on_connect(self):
        # Connection succeeded, abort the streamer loop
        raise ConnectedOk()

      def on_error(self, status):
        raise ConnectionFailed("HTTP error=%s" % (status,))

      def on_timeout(self):
        raise ConnectionFailed("Connection timed out")


    consumerKey = os.environ.get(
      "TAURUS_TWITTER_CONSUMER_KEY")

    consumerSecret = os.environ.get(
      "TAURUS_TWITTER_CONSUMER_SECRET")

    accessToken = os.environ.get(
      "TAURUS_TWITTER_ACCESS_TOKEN")

    accessTokenSecret = os.environ.get(
      "TAURUS_TWITTER_ACCESS_TOKEN_SECRET")

    authHandler = tweepy.OAuthHandler(consumerKey,
                                      consumerSecret)
    authHandler.set_access_token(accessToken,
                                 accessTokenSecret)

    stream = tweepy.Stream(authHandler, TwitterStreamListener())

    try:
      stream.filter(track=["@Accenture"])
    except ConnectedOk:
      return

    self.fail("Unexpected return of control from stream.filter()")


  @_RETRY_ACCESSIBILITY_CHECK
  def testXigniteSecuritiesInterfaceIsAccessible(self):

    def getData(formattedStartTime, formattedEndTime):
      """ Get data for specified window of time

      :param str formattedStartTime: Formatted timestamp representing the start
        of the request window
      :param str formattedEndTime: Formatted timestamp representing the end of
        the request window
      :returns: Response dict.  See xignite_stock_agent.getData()
      """
      return xignite_stock_agent.getData(
        symbol="AAPL",
        apitoken=os.environ.get("XIGNITE_API_TOKEN"),
        barlength=5,
        startTime=formattedStartTime,
        endTime=formattedEndTime,
        fields=["Outcome"])

    now = datetime.now(xignite_stock_agent._UTC_TZ)
    startTime = (
      ((now - timedelta(days=1)).astimezone(xignite_stock_agent._EASTERN_TZ)))
    endTime = now.astimezone(xignite_stock_agent._EASTERN_TZ)

    formattedStartTime = startTime.strftime(xignite_stock_agent.DATE_FMT)
    formattedEndTime = endTime.strftime(xignite_stock_agent.DATE_FMT)

    data = getData(formattedStartTime, formattedEndTime)

    if data["Outcome"] == "RequestError":
      # Try again with an expanded window. Start by adjusting the start time to
      # 14 days prior, and then repeatedly reduce the end time by one until a
      # successful response is returned, or the window narrows such that the
      # end time is less than, or equal to the start time.

      startTime -= timedelta(days=14)
      while data["Outcome"] != "Success" and endTime > startTime:
        formattedStartTime = startTime.strftime(xignite_stock_agent.DATE_FMT)
        formattedEndTime = endTime.strftime(xignite_stock_agent.DATE_FMT)
        data = getData(formattedStartTime, formattedEndTime)
        endTime -= timedelta(days=1)

    self.assertEqual(
      data["Outcome"], "Success",
      ("Unable to query the XIgnite API for recent data for AAPL between {} "
       "and now").format(startTime))


  @_RETRY_ACCESSIBILITY_CHECK
  def testTaurusEngineRestApiIsAccessible(self): # pylint: disable=R0201
    metric_utils.getAllCustomMetrics(
      host=os.environ["TAURUS_HTM_SERVER"],
      apiKey=os.environ["TAURUS_API_KEY"])


  @_RETRY_ACCESSIBILITY_CHECK
  def testSendErrorEmailIsPossible(self): # pylint: disable=R0201
    """Send email to devnull@numenta.com via error-reporting email mechanism"""
    params = error_reporting._getErrorReportingParamsFromEnv()
    params["recipients"][:] = ["devnull@numenta.com"]

    error_reporting.sendErrorEmail(subject="testSendErrorEmailIsPossible",
                                   body="Testing testSendErrorEmailIsPossible",
                                   params=params)




if __name__ == "__main__":
  unittest.main()
