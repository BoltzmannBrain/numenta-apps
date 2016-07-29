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

"""Unit test for taurus_metric_collectors.twitterdirect.purge_old_tweets
"""

# Suppress pylint warnings concerning access to protected member
# pylint: disable=W0212


import itertools
import unittest

import mock
from mock import patch

import taurus_metric_collectors
from taurus_metric_collectors import logging_support
from taurus_metric_collectors.twitterdirect import purge_old_tweets


def setUpModule():
  logging_support.LoggingSupport.initTestApp()



@patch("taurus_metric_collectors.twitterdirect.purge_old_tweets"
       "._deleteRows", autospec=True)
@patch("taurus_metric_collectors.twitterdirect.purge_old_tweets"
       "._queryCandidateRows", autospec=True)
@patch("taurus_metric_collectors.twitterdirect.purge_old_tweets"
       "._estimateNumTweetsToDelete", autospec=True)
@patch("taurus_metric_collectors.twitterdirect.purge_old_tweets"
       ".collectorsdb",
       new=mock.Mock(spec_set=taurus_metric_collectors.collectorsdb))
class PurgeOldTweetsUnitTestCase(unittest.TestCase):



  def testPurgeOldTweetsWithoutOldRecords(self,
                                          estimateNumTweetsToDeleteMock,
                                          queryCandidateRowsMock,
                                          deleteRowsMock):
    estimateNumTweetsToDeleteMock.return_value = 0

    # These should not be called in this test
    queryCandidateRowsMock.side_effect = []
    deleteRowsMock.side_effect = []

    numDeleted = purge_old_tweets.purgeOldTweets(thresholdDays=90)

    self.assertEqual(numDeleted, 0)

    self.assertEqual(estimateNumTweetsToDeleteMock.call_count, 1)

    self.assertEqual(queryCandidateRowsMock.call_count, 0)
    self.assertEqual(deleteRowsMock.call_count, 0)


  def testPurgeOldTweetsDeletedLessThanExpected(self,
                                                estimateNumTweetsToDeleteMock,
                                                queryCandidateRowsMock,
                                                deleteRowsMock):

    estimate = purge_old_tweets._MAX_DELETE_BATCH_SIZE * 3

    estimateNumTweetsToDeleteMock.return_value = estimate


    uidsIter = iter(xrange(estimate))

    queryCandidateRowsMock.side_effect = (
      lambda limit, **kwargs: tuple(itertools.islice(uidsIter, limit)))

    deletedCounts = [
      purge_old_tweets._MAX_DELETE_BATCH_SIZE,
      purge_old_tweets._MAX_DELETE_BATCH_SIZE // 2,
      purge_old_tweets._MAX_DELETE_BATCH_SIZE
    ]

    deleteRowsMock.side_effect = iter(deletedCounts)

    # Execute
    numDeleted = purge_old_tweets.purgeOldTweets(thresholdDays=90)

    self.assertEqual(numDeleted, sum(deletedCounts))

    self.assertEqual(estimateNumTweetsToDeleteMock.call_count, 1)

    self.assertEqual(queryCandidateRowsMock.call_count, 4)
    self.assertEqual(deleteRowsMock.call_count, 3)


  def testPurgeOldTweetsFewerCandidatesThanExpected(
      self,
      estimateNumTweetsToDeleteMock,
      queryCandidateRowsMock,
      deleteRowsMock):

    estimate = purge_old_tweets._MAX_DELETE_BATCH_SIZE * 2

    estimateNumTweetsToDeleteMock.return_value = estimate


    uidsIter = iter(xrange(estimate // 2))

    queryCandidateRowsMock.side_effect = (
      lambda limit, **kwargs: tuple(itertools.islice(uidsIter, limit)))

    deleteRowsMock.side_effect = lambda uids, **kwargs: len(uids)

    # Execute
    numDeleted = purge_old_tweets.purgeOldTweets(thresholdDays=90)

    self.assertEqual(numDeleted, estimate // 2)

    self.assertEqual(estimateNumTweetsToDeleteMock.call_count, 1)

    self.assertEqual(queryCandidateRowsMock.call_count, 2)
    self.assertEqual(deleteRowsMock.call_count, 1)


  def testPurgeOldTweetsStopAtEstimated(
      self,
      estimateNumTweetsToDeleteMock,
      queryCandidateRowsMock,
      deleteRowsMock):

    estimate = purge_old_tweets._MAX_DELETE_BATCH_SIZE * 2

    estimateNumTweetsToDeleteMock.return_value = estimate


    uidsIter = iter(xrange(estimate + 1))

    queryCandidateRowsMock.side_effect = (
      lambda limit, **kwargs: tuple(itertools.islice(uidsIter, limit)))

    deleteRowsMock.side_effect = lambda uids, **kwargs: len(uids)

    # Execute
    numDeleted = purge_old_tweets.purgeOldTweets(thresholdDays=90)

    self.assertEqual(numDeleted, estimate)

    self.assertEqual(estimateNumTweetsToDeleteMock.call_count, 1)

    self.assertEqual(queryCandidateRowsMock.call_count, 2)
    self.assertEqual(deleteRowsMock.call_count, 2)

    # Make sure it didn't try to retrieve candidates beyond estimated number
    self.assertEqual(len(tuple(uidsIter)), 1)



if __name__ == "__main__":
  unittest.main()
