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

"""
Service that checks if twitter screen names are still valid.
Email notifications are sent for unmapped screen names.
Each time a screen name is reported successfully, we add it to a table keeping
track of unmapped screen names that were already reported -- to avoid duplicate
emails reporting the same unmapped screen name.
"""

import logging
from optparse import OptionParser
import os
import time

import tweepy

from nta.utils import error_reporting
from taurus_metric_collectors import collectorsdb
from taurus_metric_collectors import logging_support
from taurus_metric_collectors.twitterdirect.twitter_direct_agent import (
  loadMetricSpecs,
  DEFAULT_CONSUMER_KEY,
  DEFAULT_CONSUMER_SECRET,
  DEFAULT_ACCESS_TOKEN,
  DEFAULT_ACCESS_TOKEN_SECRET
)



# Interval between processing cycles
_SLEEP_INTERVAL_SEC = 3600



# Initialize logging
g_log = logging.getLogger("check_twitter_screen_names")



def _checkTwitterScreenNames(consumerKey,
                             consumerSecret,
                             accessToken,
                             accessTokenSecret,
                             errorReportEmailAwsRegion,
                             errorReportEmailSesEndpoint,
                             errorReportEmailSenderAddress,
                             awsAccessKeyId,
                             awsSecretAccessKey,
                             errorReportEmailRecipients):
  """
  Check if twitter screen names are still valid.
  Email notifications are sent for unmapped screen names.
  Each time an unmapped screen name is reported successfully, we add it to a
  table keeping track of unmapped screen names that were already reported -- to
  avoid duplicate emails reporting the same unmapped screen name.

  :param consumerKey: Twitter consumer key
  :param consumerSecret: Twitter consumer secret
  :param accessToken: Twitter access token
  :param accessTokenSecret: Twitter access token secret
  :param errorReportEmailAwsRegion: AWS region for error report email
  :type errorReportEmailAwsRegion: string
  :param errorReportEmailSesEndpoint: AWS/SES endpoint for error report email
  :type errorReportEmailSesEndpoint: string
  :param errorReportEmailSenderAddress: Sender address for error report email
  :type errorReportEmailSenderAddress: string
  :param awsAccessKeyId: AWS access key ID for error report email
  :type awsAccessKeyId: string
  :param awsSecretAccessKey: AWS secret access key for error report email
  :type awsSecretAccessKey: string
  :param errorReportEmailRecipients: Recipients error report email
  :type errorReportEmailRecipients: list of strings
  """

  authHandler = tweepy.OAuthHandler(consumerKey, consumerSecret)
  authHandler.set_access_token(accessToken, accessTokenSecret)
  tweepyApi = tweepy.API(authHandler)

  # list of screen names
  metricSpecs = loadMetricSpecs()
  screenNames = []
  for spec in metricSpecs:
    for screenName in spec.screenNames:
      screenNames.append(screenName.lower())

  unmappedScreenNames = _resolveUnmappedScreenNames(tweepyApi, screenNames)

  if unmappedScreenNames:
    g_log.error("No mappings for screenNames=%s", unmappedScreenNames)

    _reportUnmappedScreenNames(unmappedScreenNames=unmappedScreenNames,
                               awsRegion=errorReportEmailAwsRegion,
                               sesEndpoint=errorReportEmailSesEndpoint,
                               senderAddress=errorReportEmailSenderAddress,
                               awsAccessKeyId=awsAccessKeyId,
                               awsSecretAccessKey=awsSecretAccessKey,
                               recipients=errorReportEmailRecipients)
  else:
    # clearing rows of twitter_handle_failures table
    _deleteScreenNameFailures()
    g_log.info("All screen names resolved successfully")



def _resolveUnmappedScreenNames(tweepyApi, screenNames):
  """
  Map the given Twitter Screen Names to the corresponding User IDs and return

  :param tweepyApi: tweepy API object configured with the necessary AuthHandler
  :type tweepyApi: tweepy.API
  :param screenNames: list of screen names
  :type screenNames: list of strings
  :returns: set of unmapped screen names
  :rtype: set of strings
  """

  # Get twitter Ids corresponding to screen names and build a userId-to-metric
  # map
  maxLookupItems = 100  # twitter's users/lookup limit
  lookupSlices = [screenNames[n:n + maxLookupItems]
                  for n in xrange(0, len(screenNames), maxLookupItems)]
  mappedScreenNames = []
  for names in lookupSlices:
    try:
      users = tweepyApi.lookup_users(screen_names=names)
    except Exception:
      g_log.exception("tweepyApi.lookup_users failed for names=%s", names)
      raise

    # NOTE: Users that weren't found will be missing from results
    for user in users:
      screenName = user.screen_name.lower()
      userId = user.id_str
      g_log.debug("screenName=%s mapped to userId=%s", screenName, userId)

      mappedScreenNames.append(screenName)

  unmappedScreenNames = set(screenNames).difference(mappedScreenNames)
  return unmappedScreenNames



@collectorsdb.retryOnTransientErrors
def _saveScreenNameFailure(unmappedScreenName):
  """
  Save unmapped twitter handle in database

  :param unmappedScreenName: the twitter handle that is not valid anymore
  :type unmappedScreenName: string
  """

  ins = (collectorsdb.schema  # pylint: disable=E1120
         .twitterHandleFailures.insert()
         .prefix_with('IGNORE', dialect="mysql")
         .values(handle=unmappedScreenName))

  collectorsdb.engineFactory().execute(ins)

  g_log.info("Saved unmapped twitter handle; handle=%s", unmappedScreenName)



@collectorsdb.retryOnTransientErrors
def _deleteScreenNameFailures():
  """
  Clear rows from the twitter_handle_failures table.
  """

  result = collectorsdb.engineFactory().execute(
    collectorsdb.schema.twitterHandleFailures.delete())  # pylint: disable=E1120

  if result.rowcount:
    g_log.info("Deleted %s rows from %s table",
               result.rowcount, collectorsdb.schema.twitterHandleFailures)



@collectorsdb.retryOnTransientErrors
def _screenNameFailureReported(screenName):
  """ Check if a specific twitter handle already exists in the
  tweet_handle_failures table.

  :param screenName: twitter handle
  :type screenName: string
  :returns: True, if twitter handle is already in the table. False, otherwise
  :rtype: Boolean
  """
  table = collectorsdb.schema.twitterHandleFailures

  sel = (table.select().where(table.c.handle == screenName))
  rows = collectorsdb.engineFactory().execute(sel)

  return rows.rowcount != 0



def _reportUnmappedScreenNames(unmappedScreenNames,
                               awsRegion,
                               sesEndpoint,
                               senderAddress,
                               awsAccessKeyId,
                               awsSecretAccessKey,
                               recipients):
  """
  Report unmapped twitter handles.
  Notify via email if unmapped screen name has not already been reported.
  After emailing, log unmapped twitter handle in DB to prevent re-reporting.

  :param unmappedScreenNames: the twitter handles that are not valid anymore
  :type unmappedScreenNames: list of strings
  :param awsRegion: AWS region for report email
  :type awsRegion: string
  :param sesEndpoint: AWS/SES endpoint for report email
  :type sesEndpoint: string
  :param senderAddress: Sender address for report email
  :type senderAddress: string
  :param awsAccessKeyId: AWS access key ID for report email
  :type awsAccessKeyId: string
  :param awsSecretAccessKey: AWS secret access key for report email
  :type awsSecretAccessKey: string
  :param recipients: Recipients report email
  :type recipients: sequence of strings

  """

  for unmappedScreenName in unmappedScreenNames:
    if not _screenNameFailureReported(unmappedScreenName):

      subject = "Twitter handle '%s' is invalid" % unmappedScreenName
      body = "Twitter handle '%s' needs to be updated." % unmappedScreenName
      try:
        error_reporting.sendEmailViaSES(
          subject=subject,
          body=body,
          recipients=recipients,
          awsRegion=awsRegion,
          sesEndpoint=sesEndpoint,
          senderAddress=senderAddress,
          awsAccessKeyId=awsAccessKeyId,
          awsSecretAccessKey=awsSecretAccessKey)
      except Exception:
        g_log.exception("sendEmailViaSES faield")
        raise
      else:
        # Create entry in DB for this unmapped handle.
        # Since it was successfully reported and we don't want to report it
        # anymore.
        _saveScreenNameFailure(unmappedScreenName)
    else:
      g_log.info("Invalid twitter handle '%s' already reported. Will not send "
                 "email again.", unmappedScreenName)



def _parseArgs():
  """ Parse command-line args """

  helpString = (
    "%prog\n"
    "Periodically checks for unmapped screen names and sends email "
    "notifications to report them if they haven't already been reported. This "
    "script is intended to run as a service under supervisord or similar.\n"
    "/!\ This script depends on the following environment variables:\n"
    "* TAURUS_TWITTER_CONSUMER_KEY: Twitter consumer key.\n"
    "* TAURUS_TWITTER_CONSUMER_SECRET: Twitter consumer secret.\n"
    "* TAURUS_TWITTER_ACCESS_TOKEN: Twitter access token.\n"
    "* TAURUS_TWITTER_ACCESS_TOKEN_SECRET: Twitter access token secret.\n"
    "* ERROR_REPORT_EMAIL_AWS_REGION: AWS region for error report email.\n"
    "* ERROR_REPORT_EMAIL_SES_ENDPOINT: SES endpoint for error report email.\n"
    "* ERROR_REPORT_EMAIL_SENDER_ADDRESS: Sender address for error report "
    "email.\n"
    "* AWS_ACCESS_KEY_ID: AWS access key ID for error report email.\n"
    "* AWS_SECRET_ACCESS_KEY: AWS secret access key for error report email.\n"
    "* ERROR_REPORT_EMAIL_RECIPIENTS: Recipients error report email. Email "
    "addresses need to be comma separated.\n"
    "                                 Example => 'recipient1@numenta.com, "
    "recipient2@numenta.com'\n")

  parser = OptionParser(helpString)

  _, remainingArgs = parser.parse_args()
  if remainingArgs:
    parser.error("Unexpected remaining args: %r" % (remainingArgs,))



def main():
  """ NOTE: main may be used as "console script" entry point by setuptools
  """

  logging_support.LoggingSupport.initService()

  try:

    try:
      _parseArgs()
    except SystemExit as e:
      if e.code == 0:
        # Suppress exception logging when exiting due to --help
        return

      raise

    errorReportEmailAwsRegion=os.environ.get("ERROR_REPORT_EMAIL_AWS_REGION")
    assert errorReportEmailAwsRegion, (
      "Environment variable ERROR_REPORT_EMAIL_AWS_REGION is empty or "
      "undefined.")

    errorReportEmailSesEndpoint=os.environ.get(
      "ERROR_REPORT_EMAIL_SES_ENDPOINT")

    errorReportEmailSenderAddress=os.environ.get(
      "ERROR_REPORT_EMAIL_SENDER_ADDRESS")
    assert errorReportEmailSenderAddress, (
      "Environment variable ERROR_REPORT_EMAIL_SENDER_ADDRESS is empty or "
      "undefined.")

    errorReportEmailRecipients=os.environ.get("ERROR_REPORT_EMAIL_RECIPIENTS")
    # parsing comma separated list of email
    errorReportEmailRecipients = [
      addr.strip() for addr in errorReportEmailRecipients.split(",")
      if addr.strip()
    ]
    assert errorReportEmailRecipients, (
      "Environment variable ERROR_REPORT_EMAIL_RECIPIENTS is empty or "
      "undefined.")

    awsAccessKeyId=os.environ.get("AWS_ACCESS_KEY_ID")
    assert awsAccessKeyId, (
      "Environment variable AWS_ACCESS_KEY_ID is empty or undefined.")

    awsSecretAccessKey=os.environ.get("AWS_SECRET_ACCESS_KEY")
    assert awsSecretAccessKey, (
      "Environment variable AWS_SECRET_ACCESS_KEY is empty or undefined.")


    while True:
      _checkTwitterScreenNames(
        consumerKey=DEFAULT_CONSUMER_KEY,
        consumerSecret=DEFAULT_CONSUMER_SECRET,
        accessToken=DEFAULT_ACCESS_TOKEN,
        accessTokenSecret=DEFAULT_ACCESS_TOKEN_SECRET,
        errorReportEmailAwsRegion=errorReportEmailAwsRegion,
        errorReportEmailSesEndpoint=errorReportEmailSesEndpoint,
        errorReportEmailSenderAddress=errorReportEmailSenderAddress,
        errorReportEmailRecipients=errorReportEmailRecipients,
        awsAccessKeyId=awsAccessKeyId,
        awsSecretAccessKey=awsSecretAccessKey
      )

      time.sleep(_SLEEP_INTERVAL_SEC)

  except KeyboardInterrupt:
    # Suppress exception that typically results from the SIGINT signal sent by
    # supervisord to stop the service; log with exception info to help debug
    # deadlocks
    g_log.info("Observed KeyboardInterrupt", exc_info=True)
  except:
    g_log.exception("Failed!")
    raise



if __name__ == "__main__":
  main()

