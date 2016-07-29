#!/usr/bin/env python
# ----------------------------------------------------------------------
# Numenta Platform for Intelligent Computing (NuPIC)
# Copyright (C) 2016, Numenta, Inc.  Unless you have purchased from
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
"""Unit test of the unicorn_backend.date_time_utils module"""

# Disable warnings concerning access to protected members
# pylint: disable=W0212

from datetime import datetime
import json
import logging
import os

import unittest

from unicorn_backend.utils import date_time_utils

g_log = logging.getLogger(__name__)



class UnixSecTimestampTestCase(unittest.TestCase):
  def testPositiveFloatingPointTimestamp(self):
    result = date_time_utils.parseDatetime("1465257536.142103", "#T")
    self.assertEqual(result, datetime(2016, 6, 6, 23, 58, 56, 142103))


  def testZeroTimestamp(self):
    result = date_time_utils.parseDatetime("0", "#T")
    self.assertEqual(result, datetime(1970, 1, 1, 0, 0))


  def testMaxTimestampDoesNotRaise(self):  # pylint: disable=R0201
    date_time_utils.parseDatetime(str(date_time_utils._MAX_UNIX_SECONDS), "#T")


  def testAboveMaxTimestampRaisesValueError(self):
    with self.assertRaises(ValueError) as errorCtx:
      date_time_utils.parseDatetime(str(date_time_utils._MAX_UNIX_SECONDS + 1),
                                    "#T")

    self.assertIn("Unable to parse", errorCtx.exception.args[0])


  def testNegativeTimestampRaisesValueError(self):
    with self.assertRaises(ValueError) as errorCtx:
      date_time_utils.parseDatetime("-5", "#T")

    self.assertIn("Expected non-negative Unix Timestamp",
                  errorCtx.exception.args[0])


  def testNonNumericTimestampRaisesValueError(self):
    with self.assertRaises(ValueError) as errorCtx:
      date_time_utils.parseDatetime("xyz", "#T")

    self.assertIn("xyz", errorCtx.exception.args[0])



class UnixMillisecTimestampTestCase(unittest.TestCase):
  def testPositiveFloatingPointTimestamp(self):
    result = date_time_utils.parseDatetime("1465257536142.103", "#t")
    self.assertEqual(result, datetime(2016, 6, 6, 23, 58, 56, 142103))


  def testZeroTimestamp(self):
    result = date_time_utils.parseDatetime("0", "#t")
    self.assertEqual(result, datetime(1970, 1, 1, 0, 0))


  def testMaxTimestampDoesNotRaise(self):  # pylint: disable=R0201
    date_time_utils.parseDatetime(str(date_time_utils._MAX_UNIX_SECONDS * 1000),
                                  "#t")


  def testAboveMaxTimestampRaisesValueError(self):
    with self.assertRaises(ValueError) as errorCtx:
      date_time_utils.parseDatetime(
        str((date_time_utils._MAX_UNIX_SECONDS + 1) * 1000),
        "#t")

    self.assertIn("Unable to parse", errorCtx.exception.args[0])


  def testNegativeTimestampRaisesValueError(self):
    with self.assertRaises(ValueError) as errorCtx:
      date_time_utils.parseDatetime("-1465257536142.103", "#t")

    self.assertIn("Expected non-negative Unix Timestamp",
                  errorCtx.exception.args[0])


  def testNonNumericTimestampRaisesValueError(self):
    with self.assertRaises(ValueError) as errorCtx:
      date_time_utils.parseDatetime("xyz", "#t")

    self.assertIn("xyz", errorCtx.exception.args[0])



class ExtendedStrptimeTestCase(unittest.TestCase):
  # Each element is a three-tuple: format, input, result of datetime.isoformat
  _GOOD_SAMPLES = [
    #
    # "ISO 8601"
    #

    # Format "%Y-%m-%dT%H:%M:%S.%f%z"

    # Z
    (
      "%Y-%m-%dT%H:%M:%S.%f%z",
      "2016-01-29T23:00:00.123Z",
      "2016-01-29T23:00:00.123000+00:00",
    ),

    # +HHMM
    (
      "%Y-%m-%dT%H:%M:%S.%f%z",
      "2016-01-29T23:00:00.123+0000",
      "2016-01-29T23:00:00.123000+00:00",
    ),

    (
      "%Y-%m-%dT%H:%M:%S.%f%z",
      "2016-01-29T23:00:00.123+0030",
      "2016-01-29T23:00:00.123000+00:30",
    ),

    (
      "%Y-%m-%dT%H:%M:%S.%f%z",
      "2016-01-29T23:00:00.123+1439",
      "2016-01-29T23:00:00.123000+14:39",
    ),

    # +HH:MM
    (
      "%Y-%m-%dT%H:%M:%S.%f%z",
      "2016-01-29T23:00:00.123+00:00",
      "2016-01-29T23:00:00.123000+00:00",
    ),

    (
      "%Y-%m-%dT%H:%M:%S.%f%z",
      "2016-01-29T23:00:00.123+00:30",
      "2016-01-29T23:00:00.123000+00:30",
    ),

    (
      "%Y-%m-%dT%H:%M:%S.%f%z",
      "2016-01-29T23:00:00.123+14:39",
      "2016-01-29T23:00:00.123000+14:39",
    ),

    # -HHMM
    (
      "%Y-%m-%dT%H:%M:%S.%f%z",
      "2016-01-29T23:00:00.123-0000",
      "2016-01-29T23:00:00.123000+00:00",
    ),

    (
      "%Y-%m-%dT%H:%M:%S.%f%z",
      "2016-01-29T23:00:00.123-0030",
      "2016-01-29T23:00:00.123000-00:30",
    ),

    (
      "%Y-%m-%dT%H:%M:%S.%f%z",
      "2016-01-29T23:00:00.123-1439",
      "2016-01-29T23:00:00.123000-14:39",
    ),

    # -HH:MM
    (
      "%Y-%m-%dT%H:%M:%S.%f%z",
      "2016-01-29T23:00:00.123-00:00",
      "2016-01-29T23:00:00.123000+00:00",
    ),

    (
      "%Y-%m-%dT%H:%M:%S.%f%z",
      "2016-01-29T23:00:00.123-00:30",
      "2016-01-29T23:00:00.123000-00:30",
    ),

    (
      "%Y-%m-%dT%H:%M:%S.%f%z",
      "2016-01-29T23:00:00.123-14:39",
      "2016-01-29T23:00:00.123000-14:39",
    ),

    # -HH
    (
      "%Y-%m-%dT%H:%M:%S.%f%z",
      "2016-01-29T23:00:00.123-00",
      "2016-01-29T23:00:00.123000+00:00",
    ),

    (
      "%Y-%m-%dT%H:%M:%S.%f%z",
      "2016-01-29T23:00:00.123-14",
      "2016-01-29T23:00:00.123000-14:00",
    ),

    # Experiment with fractions
    (
      "%Y-%m-%dT%H:%M:%S.%f%z",
      "2016-01-29T23:00:00.0123-14",
      "2016-01-29T23:00:00.012300-14:00",
    ),

    (
      "%Y-%m-%dT%H:%M:%S.%f%z",
      "2016-01-29T23:00:00.01230-14",
      "2016-01-29T23:00:00.012300-14:00",
    ),

    (
      "%Y-%m-%dT%H:%M:%S.%f%z",
      "2016-01-29T23:00:00.0-14",
      "2016-01-29T23:00:00-14:00",
    ),

    # Format "%Y-%m-%dT%H:%M:%S.%f"
    (
      "%Y-%m-%dT%H:%M:%S.%f",
      "2016-01-29T23:00:00.1",
      "2016-01-29T23:00:00.100000",
    ),

    # Format "%Y-%m-%dT%H:%M:%S%z"
    (
      "%Y-%m-%dT%H:%M:%S%z",
      "2016-01-29T23:00:00-08",
      "2016-01-29T23:00:00-08:00",
    ),

    # Format "%Y-%m-%dT%H:%M:%S"
    (
      "%Y-%m-%dT%H:%M:%S",
      "2016-01-29T23:00:00",
      "2016-01-29T23:00:00",
    ),

    # Format "%Y-%m-%dT%H:%M%z"
    (
      "%Y-%m-%dT%H:%M%z",
      "2016-01-29T23:00-08",
      "2016-01-29T23:00:00-08:00",
    ),

    # Format "%Y-%m-%dT%H:%M"
    (
      "%Y-%m-%dT%H:%M",
      "2016-01-29T23:00",
      "2016-01-29T23:00:00",
    ),

    # Format "%Y-%m-%dT%H%z"
    (
      "%Y-%m-%dT%H%z",
      "2016-01-29T23-08",
      "2016-01-29T23:00:00-08:00",
    ),

    # Format "%Y-%m-%dT%H"
    (
      "%Y-%m-%dT%H",
      "2016-01-29T23",
      "2016-01-29T23:00:00",
    ),

    #
    # "ISO 8601 no T"
    #


    (
      "%Y-%m-%d %H:%M:%S.%f%z",
      "2016-01-29 23:00:00.123+0800",
      "2016-01-29T23:00:00.123000+08:00",
    ),

    # Format "%Y-%m-%d %H:%M:%S.%f"
    (
      "%Y-%m-%d %H:%M:%S.%f",
      "2016-01-29 23:00:00.1",
      "2016-01-29T23:00:00.100000",
    ),

    # Format "%Y-%m-%d %H:%M:%S%z"
    (
      "%Y-%m-%d %H:%M:%S%z",
      "2016-01-29 23:00:00-08",
      "2016-01-29T23:00:00-08:00",
    ),

    # Format "%Y-%m-%d %H:%M:%S"
    (
      "%Y-%m-%d %H:%M:%S",
      "2016-01-29 23:00:00",
      "2016-01-29T23:00:00",
    ),

    # Format "%Y-%m-%d %H:%M%z"
    (
      "%Y-%m-%d %H:%M%z",
      "2016-01-29 23:00-08",
      "2016-01-29T23:00:00-08:00",
    ),

    # Format "%Y-%m-%d %H:%M"
    (
      "%Y-%m-%d %H:%M",
      "2016-01-29 23:00",
      "2016-01-29T23:00:00",
    ),

    # Format "%Y-%m-%d %H%z"
    (
      "%Y-%m-%d %H%z",
      "2016-01-29 23-08",
      "2016-01-29T23:00:00-08:00",
    ),

    # Format "%Y-%m-%d %H"
    (
      "%Y-%m-%d %H",
      "2016-01-29 23",
      "2016-01-29T23:00:00",
    ),

    # Format "%Y-%m-%d"
    (
      "%Y-%m-%d",
      "2016-01-29",
      "2016-01-29T00:00:00",
    ),

    #
    # "US Date, 12h AM/PM time"
    #


    # Format "%m-%d-%Y %I:%M:%S.%f %p"
    (
      "%m-%d-%Y %I:%M:%S.%f %p",
      "01-29-2016 11:01:59.01 AM",
      "2016-01-29T11:01:59.010000"
    ),

    (
      "%m-%d-%Y %I:%M:%S.%f %p",
      "01-29-2016 11:01:59.01 PM",
      "2016-01-29T23:01:59.010000"
    ),

    # Format "%m-%d-%Y %I:%M:%S %p"
    (
      "%m-%d-%Y %I:%M:%S %p",
      "01-29-2016 11:01:59 PM",
      "2016-01-29T23:01:59"
    ),

    # Format "%m-%d-%Y %I:%M %p"
    (
      "%m-%d-%Y %I:%M %p",
      "01-29-2016 11:01 PM",
      "2016-01-29T23:01:00"
    ),

    #
    # "US Date, 24h time"
    #

    # Format "%m-%d-%Y %H:%M:%S.%f"
    (
      "%m-%d-%Y %H:%M:%S.%f",
      "01-29-2016 23:00:00.1",
      "2016-01-29T23:00:00.100000",
    ),

    # Format "%m-%d-%Y %H:%M:%S"
    (
      "%m-%d-%Y %H:%M:%S",
      "01-29-2016 23:00:00",
      "2016-01-29T23:00:00",
    ),

    # Format "%m-%d-%Y %H:%M"
    (
      "%m-%d-%Y %H:%M",
      "01-29-2016 23:00",
      "2016-01-29T23:00:00",
    ),

    #
    # "US Date, no time"
    #

    # Format "%m-%d-%Y"
    (
      "%m-%d-%Y",
      "01-29-2016",
      "2016-01-29T00:00:00",
    ),

    # Format "%m-%d-%y"
    (
      "%m-%d-%y",
      "01-29-16",
      "2016-01-29T00:00:00",
    ),

    #
    # "Variation of ISO 8601"
    #

    # Format "%Y/%m/%dT%H:%M:%S.%f%z"

    # Z
    (
      "%Y/%m/%dT%H:%M:%S.%f%z",
      "2016/01/29T23:00:00.123Z",
      "2016-01-29T23:00:00.123000+00:00",
    ),

    # +HHMM
    (
      "%Y/%m/%dT%H:%M:%S.%f%z",
      "2016/01/29T23:00:00.123+0000",
      "2016-01-29T23:00:00.123000+00:00",
    ),

    (
      "%Y/%m/%dT%H:%M:%S.%f%z",
      "2016/01/29T23:00:00.123+0030",
      "2016-01-29T23:00:00.123000+00:30",
    ),

    (
      "%Y/%m/%dT%H:%M:%S.%f%z",
      "2016/01/29T23:00:00.123+1439",
      "2016-01-29T23:00:00.123000+14:39",
    ),

    # +HH:MM
    (
      "%Y/%m/%dT%H:%M:%S.%f%z",
      "2016/01/29T23:00:00.123+00:00",
      "2016-01-29T23:00:00.123000+00:00",
    ),

    (
      "%Y/%m/%dT%H:%M:%S.%f%z",
      "2016/01/29T23:00:00.123+00:30",
      "2016-01-29T23:00:00.123000+00:30",
    ),

    (
      "%Y/%m/%dT%H:%M:%S.%f%z",
      "2016/01/29T23:00:00.123+14:39",
      "2016-01-29T23:00:00.123000+14:39",
    ),

    # -HHMM
    (
      "%Y/%m/%dT%H:%M:%S.%f%z",
      "2016/01/29T23:00:00.123-0000",
      "2016-01-29T23:00:00.123000+00:00",
    ),

    (
      "%Y/%m/%dT%H:%M:%S.%f%z",
      "2016/01/29T23:00:00.123-0030",
      "2016-01-29T23:00:00.123000-00:30",
    ),

    (
      "%Y/%m/%dT%H:%M:%S.%f%z",
      "2016/01/29T23:00:00.123-1439",
      "2016-01-29T23:00:00.123000-14:39",
    ),

    # -HH:MM
    (
      "%Y/%m/%dT%H:%M:%S.%f%z",
      "2016/01/29T23:00:00.123-00:00",
      "2016-01-29T23:00:00.123000+00:00",
    ),

    (
      "%Y/%m/%dT%H:%M:%S.%f%z",
      "2016/01/29T23:00:00.123-00:30",
      "2016-01-29T23:00:00.123000-00:30",
    ),

    (
      "%Y/%m/%dT%H:%M:%S.%f%z",
      "2016/01/29T23:00:00.123-14:39",
      "2016-01-29T23:00:00.123000-14:39",
    ),

    # -HH
    (
      "%Y/%m/%dT%H:%M:%S.%f%z",
      "2016/01/29T23:00:00.123-00",
      "2016-01-29T23:00:00.123000+00:00",
    ),

    (
      "%Y/%m/%dT%H:%M:%S.%f%z",
      "2016/01/29T23:00:00.123-14",
      "2016-01-29T23:00:00.123000-14:00",
    ),

    # Experiment with fractions
    (
      "%Y/%m/%dT%H:%M:%S.%f%z",
      "2016/01/29T23:00:00.0123-14",
      "2016-01-29T23:00:00.012300-14:00",
    ),

    (
      "%Y/%m/%dT%H:%M:%S.%f%z",
      "2016/01/29T23:00:00.01230-14",
      "2016-01-29T23:00:00.012300-14:00",
    ),

    (
      "%Y/%m/%dT%H:%M:%S.%f%z",
      "2016/01/29T23:00:00.0-14",
      "2016-01-29T23:00:00-14:00",
    ),

    # Format "%Y/%m/%dT%H:%M:%S.%f"
    (
      "%Y/%m/%dT%H:%M:%S.%f",
      "2016/01/29T23:00:00.1",
      "2016-01-29T23:00:00.100000",
    ),

    # Format "%Y/%m/%dT%H:%M:%S%z"
    (
      "%Y/%m/%dT%H:%M:%S%z",
      "2016/01/29T23:00:00-08",
      "2016-01-29T23:00:00-08:00",
    ),

    # Format "%Y/%m/%dT%H:%M:%S"
    (
      "%Y/%m/%dT%H:%M:%S",
      "2016/01/29T23:00:00",
      "2016-01-29T23:00:00",
    ),

    # Format "%Y/%m/%dT%H:%M%z"
    (
      "%Y/%m/%dT%H:%M%z",
      "2016/01/29T23:00-08",
      "2016-01-29T23:00:00-08:00",
    ),

    # Format "%Y/%m/%dT%H:%M"
    (
      "%Y/%m/%dT%H:%M",
      "2016/01/29T23:00",
      "2016-01-29T23:00:00",
    ),

    # Format "%Y/%m/%dT%H%z"
    (
      "%Y/%m/%dT%H%z",
      "2016/01/29T23-08",
      "2016-01-29T23:00:00-08:00",
    ),

    # Format "%Y/%m/%dT%H"
    (
      "%Y/%m/%dT%H",
      "2016/01/29T23",
      "2016-01-29T23:00:00",
    ),

    #
    # "Variation of ISO 8601 no T"
    #


    (
      "%Y/%m/%d %H:%M:%S.%f%z",
      "2016/01/29 23:00:00.123+0800",
      "2016-01-29T23:00:00.123000+08:00",
    ),

    # Format "%Y/%m/%d %H:%M:%S.%f"
    (
      "%Y/%m/%d %H:%M:%S.%f",
      "2016/01/29 23:00:00.1",
      "2016-01-29T23:00:00.100000",
    ),

    # Format "%Y/%m/%d %H:%M:%S%z"
    (
      "%Y/%m/%d %H:%M:%S%z",
      "2016/01/29 23:00:00-08",
      "2016-01-29T23:00:00-08:00",
    ),

    # Format "%Y/%m/%d %H:%M:%S"
    (
      "%Y/%m/%d %H:%M:%S",
      "2016/01/29 23:00:00",
      "2016-01-29T23:00:00",
    ),

    # Format "%Y/%m/%d %H:%M%z"
    (
      "%Y/%m/%d %H:%M%z",
      "2016/01/29 23:00-08",
      "2016-01-29T23:00:00-08:00",
    ),

    # Format "%Y/%m/%d %H:%M"
    (
      "%Y/%m/%d %H:%M",
      "2016/01/29 23:00",
      "2016-01-29T23:00:00",
    ),

    # Format "%Y/%m/%d %H%z"
    (
      "%Y/%m/%d %H%z",
      "2016/01/29 23-08",
      "2016-01-29T23:00:00-08:00",
    ),

    # Format "%Y/%m/%d %H"
    (
      "%Y/%m/%d %H",
      "2016/01/29 23",
      "2016-01-29T23:00:00",
    ),

    # Format "%Y/%m/%d"
    (
      "%Y/%m/%d",
      "2016/01/29",
      "2016-01-29T00:00:00",
    ),

    #
    # "US Date, 12h AM/PM time"
    #


    # Format "%m/%d/%Y %I:%M:%S.%f %p"
    (
      "%m/%d/%Y %I:%M:%S.%f %p",
      "01/29/2016 11:01:59.01 AM",
      "2016-01-29T11:01:59.010000"
    ),

    (
      "%m/%d/%Y %I:%M:%S.%f %p",
      "01/29/2016 11:01:59.01 PM",
      "2016-01-29T23:01:59.010000"
    ),

    # Format "%m/%d/%Y %I:%M:%S %p"
    (
      "%m/%d/%Y %I:%M:%S %p",
      "01/29/2016 11:01:59 PM",
      "2016-01-29T23:01:59"
    ),

    # Format "%m/%d/%Y %I:%M %p"
    (
      "%m/%d/%Y %I:%M %p",
      "01/29/2016 11:01 PM",
      "2016-01-29T23:01:00"
    ),

    #
    # "US Date, 24h time"
    #

    # Format "%m/%d/%Y %H:%M:%S.%f"
    (
      "%m/%d/%Y %H:%M:%S.%f",
      "01/29/2016 23:00:00.1",
      "2016-01-29T23:00:00.100000",
    ),

    # Format "%m/%d/%Y %H:%M:%S"
    (
      "%m/%d/%Y %H:%M:%S",
      "01/29/2016 23:00:00",
      "2016-01-29T23:00:00",
    ),

    # Format "%m/%d/%Y %H:%M"
    (
      "%m/%d/%Y %H:%M",
      "01/29/2016 23:00",
      "2016-01-29T23:00:00",
    ),

    #
    # "US Date, no time"
    #

    # Format "%m/%d/%Y"
    (
      "%m/%d/%Y",
      "01/29/2016",
      "2016-01-29T00:00:00",
    ),

    # Format "%m/%d/%y"
    (
      "%m/%d/%y",
      "01/29/16",
      "2016-01-29T00:00:00",
    ),

    #
    # "US Date, time (excel default for OSX)"
    #  These all use the same format but these tests ensure the format
    #  matches all of the possible datetime formats that the default
    #  excel format can take on.

    # Format "%m/%d/%y %H:%M"
    (
      "%m/%d/%y %H:%M",
      "01/29/16 2:30",
      "2016-01-29T02:30:00"
    ),

    # Format "%m/%d/%y %H:%M:%S"
    (
      "%m/%d/%y %H:%M:%S",
      "01/29/16 2:30:34",
      "2016-01-29T02:30:34"
    ),

    # Format "%m/%d/%y %H:%M"
    (
      "%m/%d/%y %H:%M",
      "01/29/16 12:30",
      "2016-01-29T12:30:00"
    ),

    # Format "%m/%d/%y %H:%M:%S"
    (
      "%m/%d/%y %H:%M:%S",
      "01/29/16 12:30:34",
      "2016-01-29T12:30:34"
    ),

    # Format "%m/%d/%y %H"
    (
      "%m/%d/%y %H",
      "01/29/16 1",
      "2016-01-29T01:00:00"
    ),

    # Format "%m/%d/%y %H"
    (
      "%m/%d/%y %H",
      "01/29/16 12",
      "2016-01-29T12:00:00"
    ),

    # Format "%m/%d/%y %H:%M"
    (
      "%m/%d/%y %H:%M",
      "1/29/16 2:30",
      "2016-01-29T02:30:00"
    ),

    # Format "%m/%d/%y %H:%M:%S"
    (
      "%m/%d/%y %H:%M:%S",
      "1/29/16 2:30:34",
      "2016-01-29T02:30:34"
    ),

    # Format "%m/%d/%y %H:%M"
    (
      "%m/%d/%y %H:%M",
      "1/29/16 12:30",
      "2016-01-29T12:30:00"
    ),

    # Format "%m/%d/%y %H:%M:%S"
    (
      "%m/%d/%y %H:%M:%S",
      "1/29/16 12:30:34",
      "2016-01-29T12:30:34"
    ),

    # Format "%m/%d/%y %H"
    (
      "%m/%d/%y %H",
      "1/29/16 1",
      "2016-01-29T01:00:00"
    ),

    # Format "%m/%d/%y %H"
    (
      "%m/%d/%y %H",
      "1/29/16 12",
      "2016-01-29T12:00:00"
    ),

    # Format "%m/%d/%y"
    (
      "%m/%d/%y",
      "1/29/16",
      "2016-01-29T00:00:00"
    ),

    # Format "%m/%d/%y %H:%M"
    (
      "%m/%d/%y %H:%M",
      "01/2/16 2:30",
      "2016-01-02T02:30:00"
    ),

    # Format "%m/%d/%y %H:%M:%S"
    (
      "%m/%d/%y %H:%M:%S",
      "01/2/16 2:30:34",
      "2016-01-02T02:30:34"
    ),

    # Format "%m/%d/%y %H:%M"
    (
      "%m/%d/%y %H:%M",
      "01/2/16 12:30",
      "2016-01-02T12:30:00"
    ),

    # Format "%m/%d/%y %H:%M:%S"
    (
      "%m/%d/%y %H:%M:%S",
      "01/2/16 12:30:34",
      "2016-01-02T12:30:34"
    ),

    # Format "%m/%d/%y %H:%M:%S"
    (
      "%m/%d/%y %H",
      "01/2/16 1",
      "2016-01-02T01:00:00"
    ),

    # Format "%m/%d/%y %H:%M:%S"
    (
      "%m/%d/%y %H",
      "01/2/16 12",
      "2016-01-02T12:00:00"
    ),

    # Format "%m/%d/%y %H:%M:%S"
    (
      "%m/%d/%y",
      "01/2/16",
      "2016-01-02T00:00:00"
    ),

    # Format "%m/%d/%y %H:%M"
    (
      "%m/%d/%y %H:%M",
      "1/2/16 2:30",
      "2016-01-02T02:30:00"
    ),

    # Format "%m/%d/%y %H:%M"
    (
      "%m/%d/%y %H:%M:%S",
      "1/2/16 2:30:34",
      "2016-01-02T02:30:34"
    ),

    # Format "%m/%d/%y %H:%M"
    (
      "%m/%d/%y %H:%M",
      "1/2/16 12:30",
      "2016-01-02T12:30:00"
    ),

    # Format "%m/%d/%y %H:%M:%S"
    (
      "%m/%d/%y %H:%M:%S",
      "1/2/16 12:30:34",
      "2016-01-02T12:30:34"
    ),

    # Format "%m/%d/%y %H:%M:%S"
    (
      "%m/%d/%y %H",
      "1/2/16 1",
      "2016-01-02T01:00:00"
    ),

    # Format "%m/%d/%y %H:%M:%S"
    (
      "%m/%d/%y %H",
      "1/2/16 12",
      "2016-01-02T12:00:00"
    ),

    # Format "%m/%d/%y %H:%M:%S"
    (
      "%m/%d/%y",
      "1/2/16",
      "2016-01-02T00:00:00"
    ),

    #
    # "US Date, time (excel default for Windows)"
    #  These all use the same format but these tests ensure the format
    #  matches all of the possible datetime formats that the default
    #  excel format can take on.

    # Format "%m/%d/%Y %H:%M"
    (
      "%m/%d/%Y %H:%M",
      "01/29/2016 2:30",
      "2016-01-29T02:30:00"
    ),

    # Format "%m/%d/%Y %H:%M:%S"
    (
      "%m/%d/%Y %H:%M:%S",
      "01/29/2016 2:30:34",
      "2016-01-29T02:30:34"
    ),

    # Format "%m/%d/%Y %H:%M"
    (
      "%m/%d/%Y %H:%M",
      "01/29/2016 12:30",
      "2016-01-29T12:30:00"
    ),

    # Format "%m/%d/%Y %H:%M:%S"
    (
      "%m/%d/%Y %H:%M:%S",
      "01/29/2016 12:30:34",
      "2016-01-29T12:30:34"
    ),

    # Format "%m/%d/%Y %H"
    (
      "%m/%d/%Y %H",
      "01/29/2016 1",
      "2016-01-29T01:00:00"
    ),

    # Format "%m/%d/%Y %H"
    (
      "%m/%d/%Y %H",
      "01/29/2016 12",
      "2016-01-29T12:00:00"
    ),

    # Format "%m/%d/%Y %H:%M"
    (
      "%m/%d/%Y %H:%M",
      "1/29/2016 2:30",
      "2016-01-29T02:30:00"
    ),

    # Format "%m/%d/%Y %H:%M:%S"
    (
      "%m/%d/%Y %H:%M:%S",
      "1/29/2016 2:30:34",
      "2016-01-29T02:30:34"
    ),

    # Format "%m/%d/%Y %H:%M"
    (
      "%m/%d/%Y %H:%M",
      "1/29/2016 12:30",
      "2016-01-29T12:30:00"
    ),

    # Format "%m/%d/%Y %H:%M:%S"
    (
      "%m/%d/%Y %H:%M:%S",
      "1/29/2016 12:30:34",
      "2016-01-29T12:30:34"
    ),

    # Format "%m/%d/%Y %H"
    (
      "%m/%d/%Y %H",
      "1/29/2016 1",
      "2016-01-29T01:00:00"
    ),

    # Format "%m/%d/%Y %H"
    (
      "%m/%d/%Y %H",
      "1/29/2016 12",
      "2016-01-29T12:00:00"
    ),

    # Format "%m/%d/%Y"
    (
      "%m/%d/%Y",
      "1/29/2016",
      "2016-01-29T00:00:00"
    ),

    # Format "%m/%d/%Y %H:%M"
    (
      "%m/%d/%Y %H:%M",
      "01/2/2016 2:30",
      "2016-01-02T02:30:00"
    ),

    # Format "%m/%d/%Y %H:%M:%S"
    (
      "%m/%d/%Y %H:%M:%S",
      "01/2/2016 2:30:34",
      "2016-01-02T02:30:34"
    ),

    # Format "%m/%d/%Y %H:%M"
    (
      "%m/%d/%Y %H:%M",
      "01/2/2016 12:30",
      "2016-01-02T12:30:00"
    ),

    # Format "%m/%d/%Y %H:%M:%S"
    (
      "%m/%d/%Y %H:%M:%S",
      "01/2/2016 12:30:34",
      "2016-01-02T12:30:34"
    ),

    # Format "%m/%d/%Y %H:%M:%S"
    (
      "%m/%d/%Y %H",
      "01/2/2016 1",
      "2016-01-02T01:00:00"
    ),

    # Format "%m/%d/%Y %H:%M:%S"
    (
      "%m/%d/%Y %H",
      "01/2/2016 12",
      "2016-01-02T12:00:00"
    ),

    # Format "%m/%d/%Y %H:%M:%S"
    (
      "%m/%d/%Y",
      "01/2/2016",
      "2016-01-02T00:00:00"
    ),

    # Format "%m/%d/%Y %H:%M"
    (
      "%m/%d/%Y %H:%M",
      "1/2/2016 2:30",
      "2016-01-02T02:30:00"
    ),

    # Format "%m/%d/%Y %H:%M"
    (
      "%m/%d/%Y %H:%M:%S",
      "1/2/2016 2:30:34",
      "2016-01-02T02:30:34"
    ),

    # Format "%m/%d/%Y %H:%M"
    (
      "%m/%d/%Y %H:%M",
      "1/2/2016 12:30",
      "2016-01-02T12:30:00"
    ),

    # Format "%m/%d/%Y %H:%M:%S"
    (
      "%m/%d/%Y %H:%M:%S",
      "1/2/2016 12:30:34",
      "2016-01-02T12:30:34"
    ),

    # Format "%m/%d/%Y %H:%M:%S"
    (
      "%m/%d/%Y %H",
      "1/2/2016 1",
      "2016-01-02T01:00:00"
    ),

    # Format "%m/%d/%Y %H:%M:%S"
    (
      "%m/%d/%Y %H",
      "1/2/2016 12",
      "2016-01-02T12:00:00"
    ),

    # Format "%m/%d/%Y %H:%M:%S"
    (
      "%m/%d/%Y",
      "1/2/2016",
      "2016-01-02T00:00:00"
    )

  ]


  def testGoodSamples(self):

    # Check for duplicate test cases
    self.assertEqual(
      len(self._GOOD_SAMPLES),
      len(set(self._GOOD_SAMPLES)),
      msg="There are duplicate test cases: {}".format(
        set(item for item in self._GOOD_SAMPLES
            if self._GOOD_SAMPLES.count(item) > 1))
    )

    # Verify the parser
    testedFormatSet = set()

    for fmt, timestamp, expectedIso in self._GOOD_SAMPLES:
      testedFormatSet.add(fmt)

      try:
        parsed = date_time_utils.parseDatetime(timestamp, fmt)
      except (TypeError, ValueError) as exc:
        self.fail(
          "Failed to parse ts={!r} using fmt={!r}; exc={!r}".format(
            timestamp, fmt, exc))

      try:
        isoEncoded = parsed.isoformat()
      except ValueError as exc:
        self.fail(
          "Failed to isoformat parsed datetime={!r}; ts={!r} using fmt={!r}; "
          "exc={!r}".format(parsed, timestamp, fmt, exc))

      self.assertEqual(
        isoEncoded, expectedIso,
        msg=(
          "ISO result {!r} didn't match expected {!r}; ts={!r} using fmt={!r}"
            .format(isoEncoded, expectedIso, timestamp, fmt)))

    # Make sure all timestamp formats from
    # unicorn/app/config/momentjs_to_datetime_strptime.json are covered by our
    # test cases

    mappingsPath = os.path.join(
      os.path.abspath(os.path.dirname(__file__)),
      os.path.pardir,
      os.path.pardir,
      os.path.pardir,
      os.path.pardir,
      "app",
      "config",
      "momentjs_to_datetime_strptime.json"
    )

    with open(mappingsPath) as mappingsFile:
      mapList = json.load(mappingsFile)

    formatsToCategoryMap = dict()

    for bundle in mapList:
      for fmt in bundle["mappings"].itervalues():
        if fmt not in formatsToCategoryMap:
          formatsToCategoryMap[fmt] = bundle["category"]

    self.assertGreater(len(formatsToCategoryMap), 0)

    self.assertGreater(len(testedFormatSet), 0)

    untestedFormats = set(formatsToCategoryMap) - testedFormatSet

    self.assertFalse(
      untestedFormats,
      msg="{} format(s) not covered by GOOD SAMPLES test cases: {}".format(
        len(untestedFormats),
        [(fmt, formatsToCategoryMap[fmt]) for fmt in untestedFormats]))


  def testBadFormatNotationRaisesException(self):

    with self.assertRaises(ValueError) as excCtx:
      date_time_utils.parseDatetime("01-29-2016 11:01:59.01 AM",
                                    "%m-%d-%Y %I:%M:%S.%f %W")

    self.assertEqual(
      excCtx.exception.args[0],
      "time data '01-29-2016 11:01:59.01 AM' does not match format "
      "'%m-%d-%Y %I:%M:%S.%f %W'")


  def testBadTimezoneRaisesException(self):

    with self.assertRaises(ValueError) as excCtx:
      date_time_utils.parseDatetime("2016-01-29T23:00:00.123+000",
                                    "%Y-%m-%dT%H:%M:%S.%f%z")

    self.assertEqual(
      excCtx.exception.args[0],
      "time data '2016-01-29T23:00:00.123+000' does not match format "
      "'%Y-%m-%dT%H:%M:%S.%f%z'")

    with self.assertRaises(ValueError) as excCtx:
      date_time_utils.parseDatetime("2016-01-29T23:00:00.123+00:60",
                                    "%Y-%m-%dT%H:%M:%S.%f%z")

    self.assertEqual(
      excCtx.exception.args[0],
      "time data '2016-01-29T23:00:00.123+00:60' does not match format "
      "'%Y-%m-%dT%H:%M:%S.%f%z': UTC offset minutes exceed 59")

    with self.assertRaises(ValueError) as excCtx:
      date_time_utils.parseDatetime("2016-01-29T23:00:00.123+25:00",
                                    "%Y-%m-%dT%H:%M:%S.%f%z")

    self.assertEqual(
      excCtx.exception.args[0],
      "time data '2016-01-29T23:00:00.123+25:00' does not match format "
      "'%Y-%m-%dT%H:%M:%S.%f%z': UTC offset +25:0 is out of bounds; must be in "
      "-24:59 .. +24:59")

    with self.assertRaises(ValueError) as excCtx:
      date_time_utils.parseDatetime("2016-01-29T23:00:00.123+00:0",
                                    "%Y-%m-%dT%H:%M:%S.%f%z")

    self.assertEqual(
      excCtx.exception.args[0],
      "time data '2016-01-29T23:00:00.123+00:0' does not match format "
      "'%Y-%m-%dT%H:%M:%S.%f%z'")

    with self.assertRaises(ValueError) as excCtx:
      date_time_utils.parseDatetime("2016-01-29T23:00:00.123+0",
                                    "%Y-%m-%dT%H:%M:%S.%f%z")

    self.assertEqual(
      excCtx.exception.args[0],
      "time data '2016-01-29T23:00:00.123+0' does not match format "
      "'%Y-%m-%dT%H:%M:%S.%f%z'")

    with self.assertRaises(ValueError) as excCtx:
      date_time_utils.parseDatetime("2016-01-29T23:00:00.123+:00",
                                    "%Y-%m-%dT%H:%M:%S.%f%z")

    self.assertEqual(
      excCtx.exception.args[0],
      "time data '2016-01-29T23:00:00.123+:00' does not match format "
      "'%Y-%m-%dT%H:%M:%S.%f%z'")

    with self.assertRaises(ValueError) as excCtx:
      date_time_utils.parseDatetime("2016-01-29T23:00:00.123+:",
                                    "%Y-%m-%dT%H:%M:%S.%f%z")

    self.assertEqual(
      excCtx.exception.args[0],
      "time data '2016-01-29T23:00:00.123+:' does not match format "
      "'%Y-%m-%dT%H:%M:%S.%f%z'")

    with self.assertRaises(ValueError) as excCtx:
      date_time_utils.parseDatetime("2016-01-29T23:00:00.123+",
                                    "%Y-%m-%dT%H:%M:%S.%f%z")

    self.assertEqual(
      excCtx.exception.args[0],
      "time data '2016-01-29T23:00:00.123+' does not match format "
      "'%Y-%m-%dT%H:%M:%S.%f%z'")
