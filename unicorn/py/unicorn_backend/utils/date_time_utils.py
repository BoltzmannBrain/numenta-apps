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

"""
Date/time-related utilities for the Unicorn project
"""

from datetime import datetime
import re

from dateutil import tz


# unicorn_backend's format string for Unix Timestamp (seconds)
UNIX_TIMESTAMP_SEC = "#T"

# unicorn_backend's custom format string for Unix Timestamp (milliseconds)
UNIX_TIMESTAMP_MILLISEC = "#t"

# +HHMM or -HHMM
_BASIC_HHMM_UTC_OFFSET = re.compile(r"([+]|[-])(\d\d)(\d\d)$")

# +HH:MM or -HH:MM
_EXTENDED_HHMM_UTC_OFFSET = re.compile(r"([+]|[-])(\d\d):(\d\d)$")

# +HH or -HH
_ONLY_HH_UTC_OFFSET = re.compile(r"([+]|[-])(\d\d)$")


# Based on datetime.isoformat complaint:
#   ValueError: tzinfo.utcoffset() returned 1440; must be in -1439 .. 1439
_MAX_UTC_OFFSET_PARTS = (24, 59)
_MAX_UTC_OFFSET_IN_SECONDS = ((_MAX_UTC_OFFSET_PARTS[0] * 60 +
                               _MAX_UTC_OFFSET_PARTS[1]) * 60)

# Last day/hour/min/sec of year 9999 in unix seconds, the maximum value
# datetime.utcfromtimestamp() parses UNIX seconds
_MAX_UNIX_SECONDS = 253402300799.0

def parseDatetime(dateString, dateFormat):
  """ Utility for parsing timestamps. Supports `datetime.strptime` formats
  with extensions as well as custom formats described below.

  1. Extends `datetime.strptime` functionality with the following format
  designators:

  Timezone offset %z at end of format string: accepts
    "Z", +HHMM, +HH:MM, -HHMM, -HH:MM, +HH, -HH

    NOTE: python presently supports %z in datetime.strftime, but not in
    strptime due to lack of builtin timezone implementation

  2. Unix Timestamp custom format: "#T"

  Seconds since Unix Epoch as int or float.

  3. Unix Timestamp custom format: "#t"

  Milliseconds since Unix Epoch as int or float.


  :param str dateString: date string to parse
  :param str dateFormat: `datetime.strptime` format string, with the extension
      of permitting %z at the end for UTC offset

  :returns: parsed datetime; if the timestamp includes a timezone offset, the
    result will contain the corresponding tzinfo; otherwise, the result will be
    a naive datetime.
  :rtype: `datetime.datetime`
  """
  originalDateString = dateString
  originalDateFormat = dateFormat

  if dateFormat in [UNIX_TIMESTAMP_SEC, UNIX_TIMESTAMP_MILLISEC]:
    # Our custom formats: Seconds or milliseconds since Unix Epoch as int or
    # float
    timestampFloat = float(dateString)
    if timestampFloat < 0:
      raise ValueError(
        "Expected non-negative Unix Timestamp, but got {}".format(dateString))

    if dateFormat == UNIX_TIMESTAMP_MILLISEC:
      # Convert from milliseconds to seconds
      timestampFloat /= 1000

    try:
      return datetime.utcfromtimestamp(timestampFloat)
    except ValueError as exc:
      raise ValueError(
        "Unable to parse {} from format {}: {}".format(
          dateString, dateFormat, exc))

  # Handle datetime.strptime formats with extensions

  # If timestamp is not naive, parse tzinfo and strip it from date and format
  tzinfo = None
  if dateFormat.endswith("%z"):
    # Strip UTC offset pattern from date format so datetime.strptime won't choke
    dateFormat = dateFormat[:-2]

    if dateString.endswith("Z"):
      tzname = "Z"
      offsetInSeconds = 0  # Z=UTC

      # Strip UTC offset from date string so datetime.strptime won't choke
      dateString = dateString[:-1]

    else:
      parts = None

      match = (_BASIC_HHMM_UTC_OFFSET.search(dateString) or
               _EXTENDED_HHMM_UTC_OFFSET.search(dateString))
      if match is not None:
        parts = match.groups()

      if match is None:
        match = _ONLY_HH_UTC_OFFSET.search(dateString)
        if match is not None:
          parts = match.groups() + ("00",)

      if match is None:
        raise ValueError(
          "time data {!r} does not match format {!r}".format(
            originalDateString,
            originalDateFormat))

      tzname = match.group()

      # Strip UTC offset from date string so datetime.strptime won't choke
      dateString = dateString[:match.start()]

      # Convert offset parts to offset in seconds
      assert len(parts) == 3, len(parts)

      sign, hours, minutes = parts[0], int(parts[1]), int(parts[2])

      if minutes > 59:
        raise ValueError(
          "time data {!r} does not match format {!r}: UTC offset minutes "
          "exceed 59".format(originalDateString, originalDateFormat))

      offsetInSeconds = (hours * 60 + minutes) * 60
      if sign == "-":
        offsetInSeconds = -offsetInSeconds

      if abs(offsetInSeconds) > _MAX_UTC_OFFSET_IN_SECONDS:
        raise ValueError(
          "time data {!r} does not match format {!r}: UTC offset {}{}:{} is "
          "out of bounds; must be in -{} .. +{}"
          .format(originalDateString, originalDateFormat,
                  sign, hours, minutes,
                  ":".join(str(i) for i in _MAX_UTC_OFFSET_PARTS),
                  ":".join(str(i) for i in _MAX_UTC_OFFSET_PARTS)))


    tzinfo = tz.tzoffset(name=tzname, offset=offsetInSeconds)


  result = datetime.strptime(dateString, dateFormat)
  if tzinfo is not None:
    result = result.replace(tzinfo=tzinfo)

  return result
