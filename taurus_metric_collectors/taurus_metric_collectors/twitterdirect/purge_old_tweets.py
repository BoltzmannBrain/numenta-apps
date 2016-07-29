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
Purges old records from taurus_collectors.twitter_tweets table.

NOTE: this script may be configured as "console" app by the package
installer.
"""

import logging
from optparse import OptionParser

import sqlalchemy as sql

from taurus_metric_collectors import collectorsdb, logging_support



# Maximum number of rows to delete per query for reducing the likelihood of the
# MySQL "Lock wait timeout exceeded" error
_MAX_DELETE_BATCH_SIZE = 1000



g_log = logging.getLogger("purge_old_tweets")



def _parseArgs():
  """
  :returns: dict of arg names and values:
    days - Messages older than this number of days will be purged
  """
  helpString = ("%prog [options] Purges old records from {} table.").format(
    collectorsdb.schema.twitterTweets)

  parser = OptionParser(helpString)

  parser.add_option(
    "--days",
    action="store",
    type="int",
    dest="days",
    help="Messages older than this number of days will be purged")

  options, remainingArgs = parser.parse_args()
  if remainingArgs:
    parser.error("Unexpected remaining args: {}".format(remainingArgs))

  if options.days is None:
    parser.error("Required \"--days\" option was not specified")

  return dict(
    days=options.days)



def purgeOldTweets(thresholdDays):
  """ Purge tweets from twitter_tweets table that are older than the given
  number of days.

  :param int thresholdDays: tweets older than this many days will be deleted

  :returns: number of rows that were deleted

  """
  twitterTweetsSchema = collectorsdb.schema.twitterTweets

  g_log.info("Estimating number of tweets in table=%s older than numDays=%s",
             twitterTweetsSchema, thresholdDays)

  sqlEngine = collectorsdb.engineFactory()

  selectionPredicate = (
    twitterTweetsSchema.c.created_at <
    sql.func.date_sub(sql.func.utc_timestamp(),
                      sql.text("INTERVAL {:d} DAY".format(thresholdDays)))
  )

  estimate = _estimateNumTweetsToDelete(sqlEngine, selectionPredicate)

  g_log.info("Number of candidate old tweets to purge: estimate=%s", estimate)

  if estimate == 0:
    return 0

  # NOTE: We'll be deleting in smaller batches to avoid "Lock wait timeout
  # exceeded".
  #
  # When the number of old rows is huge, if we try to delete them in a single
  # transaction, we get perpetually mired in the error "Lock wait timeout
  # exceeded; try restarting transaction". mysql/innodb provides the setting
  # `innodb_lock_wait_timeout` that may be overriden, but there isn't a good way
  # to estimate a value that guarantees success. Doing it in one transaction
  # also doesn't facilitate progress update, thus creating the perception that
  # the operation is "stuck".
  totalDeleted = 0

  while totalDeleted < estimate:
    # NOTE: we're dealing with a couple of issues here:
    #
    # 1. sqlalchemy core doesn't support LIMIT in delete statements, so we can't
    #    use delete directly with LIMIT and ORDER BY
    # 2. MySql (5.6.21) doesn't support LIMIT & IN subqueries: "This version of
    #    MySQL doesn't yet support 'LIMIT & IN/ALL/ANY/SOME subquery"
    #
    # So, we're going to stick with sqlalchemy, and break the operation into two
    # queries: get the candidate uids, then delete rows with those uids

    limit = min(_MAX_DELETE_BATCH_SIZE, estimate - totalDeleted)

    uids = _queryCandidateRows(sqlEngine=sqlEngine,
                               selectionPredicate=selectionPredicate,
                               limit=limit)

    if uids:
      numDeleted = _deleteRows(sqlEngine=sqlEngine, uids=uids)
    else:
      # This could happen if something else deleted tweets in our range, such
      # as the process_tweet_deletions service that services deletion requests
      # from Twitter.
      break

    totalDeleted += numDeleted

    g_log.info("Purged %s old tweets [%s of %s]", numDeleted, totalDeleted,
               estimate)


  g_log.info("Purged numRows=%s of estimated=%s old tweets from table=%s",
             totalDeleted, estimate, twitterTweetsSchema)

  return totalDeleted



@collectorsdb.retryOnTransientErrors
def _estimateNumTweetsToDelete(sqlEngine, selectionPredicate):
  """
  :param sqlalchemy.engine.Engine sqlEngine:
  :param selectionPredicate: predicate for where clause that selects the desired
    tweets for purging
  """
  # This may take a very long time (beyond retry timeout) if the number of old
  # tweets is "huge"
  return sqlEngine.execute(
    sql.select([sql.func.count()])
    .where(selectionPredicate)).scalar()



@collectorsdb.retryOnTransientErrors
def _queryCandidateRows(sqlEngine, selectionPredicate, limit):
  """Query candidate uid's of tweets to delete.

  :param sqlalchemy.engine.Engine sqlEngine:
  :param selectionPredicate: predicate for where clause that selects the desired
    tweets for purging
  :param int limit: max number of rows to delete

  :returns: sequence of matching UID values (may be empty)
  """
  twitterTweetsSchema = collectorsdb.schema.twitterTweets

  results = sqlEngine.execute(
    sql.select([twitterTweetsSchema.c.uid])
    .where(selectionPredicate)
    .order_by(twitterTweetsSchema.c.created_at.asc())
    .limit(limit)
  ).fetchall()

  return tuple(str(row[0]) for row in results)



@collectorsdb.retryOnTransientErrors
def _deleteRows(sqlEngine, uids):
  """Delete twitter_tweet rows with the given UID values

  :param sqlalchemy.engine.Engine sqlEngine:
  :param uids: sequence of UID values of twitter_tweets rows to delete

  :returns: number of rows actually deleted; this may be less than requested if
    something else deleted some of the requested rows
  """
  twitterTweetsSchema = collectorsdb.schema.twitterTweets

  return sqlEngine.execute(
    twitterTweetsSchema.delete()  # pylint: disable=E1120
    .where(twitterTweetsSchema.c.uid.in_(uids))
  ).rowcount



def main():
  """
  NOTE: main also serves as entry point for "console script" generated by setup
  """
  logging_support.LoggingSupport().initTool()

  try:
    try:
      options = _parseArgs()
    except SystemExit as e:
      # OptionParser uses SystemExit on option-parsing error
      if e.code != 0:
        g_log.exception("Failed!")
      raise

    purgeOldTweets(options["days"])
  except Exception:
    g_log.exception("Failed!")
    raise


if __name__ == "__main__":
  main()
