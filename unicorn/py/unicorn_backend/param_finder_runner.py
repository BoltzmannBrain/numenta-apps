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
Implements Unicorn's param_finder interface.
"""
from argparse import ArgumentParser
import csv
import json
import logging
import os
import pkg_resources
import sys
import traceback

from dateutil import tz
import validictory

from unicorn_backend.param_finder import findParameters
from unicorn_backend.param_finder import MAX_NUM_ROWS

from unicorn_backend.utils import date_time_utils
from unicorn_backend.utils import na

g_log = logging.getLogger(__name__)



class _CommandLineArgError(Exception):
  """ Error parsing command-line options """
  pass



class _Options(object):
  """Options returned by _parseArgs"""

  __slots__ = ("fileName",
               "rowOffset",
               "timestampIndex",
               "valueIndex",
               "datetimeFormat")


  def __init__(self,
               fileName,
               rowOffset,
               timestampIndex,
               valueIndex,
               datetimeFormat):
    """
    :param fileName: str path to input csv file
    :param rowOffset: int, zero-based index of first data row in csv
    :param timestampIndex: int, zero-based column index of the timestamp
    :param valueIndex: int, zero-based column index of the value
    :param datetimeFormat: str, datetime format string for python's
                          datetime.strptime
    """
    self.fileName = fileName
    self.rowOffset = rowOffset
    self.timestampIndex = timestampIndex
    self.valueIndex = valueIndex
    self.datetimeFormat = datetimeFormat


  @property
  def __dict__(self):  # pylint: disable=C0103
    """ Required for **vars() usage
    """
    return {slot: getattr(self, slot) for slot in self.__slots__}


def _parseArgs():
  """ Parse command-line args

  :rtype: _Options object
  :raises _CommandLineArgError: on command-line arg error
  """


  class SilentArgumentParser(ArgumentParser):
    def error(self, msg):
      """Override `error()` to prevent unstructured output to stderr"""
      raise _CommandLineArgError(msg)


  parser = SilentArgumentParser(description=("Start Unicorn ParamFinderRunner"))

  parser.add_argument(
    "--input",
    type=str,
    dest="inputSpec",
    required=True,
    help=("REQUIRED: JSON object describing the input metric data per "
          "input_opt_schema_param_finder.json"))


  options = parser.parse_args()

  # Input spec is required
  try:
    inputSpec = json.loads(options.inputSpec)
  except ValueError as exc:
    g_log.exception("JSON parsing of --input value failed")
    parser.error("--input option value failed JSON parsing: {}".format(exc))

  with pkg_resources.resource_stream(
    __name__, "input_opt_schema_param_finder.json") as schemaFile:
    try:
      validictory.validate(inputSpec, json.load(schemaFile))
    except validictory.ValidationError as exc:
      g_log.exception("JSON schema validation of --input value failed")
      parser.error("JSON schema validation of --input value failed: {}"
                   .format(exc))

  return _Options(fileName=inputSpec["csv"],
                  rowOffset=inputSpec["rowOffset"],
                  timestampIndex=inputSpec["timestampIndex"],
                  valueIndex=inputSpec["valueIndex"],
                  datetimeFormat=inputSpec["datetimeFormat"])


def _createCsvReader(fileObj):
  # We'll be operating on csvs with arbitrarily long fields
  csv.field_size_limit(2**27)

  # Make sure readline() works on windows too
  os.linesep = "\n"

  return csv.reader(fileObj, dialect="excel")


def _readCSVFile(fileName,
                 rowOffset,
                 timestampIndex,
                 valueIndex,
                 datetimeFormat):
  """
  Read csv data file, the data file must have two columns
  that contains time stamps and data values

  :param str fileName: path to input csv file
  :param int rowOffset: index of first data row in csv
  :param int timestampIndex: column index of the timestamp
  :param int valueIndex: column index of the value
  :param str datetimeFormat: datetime format string for python's
    datetime.strptime
  :returns: Sequence of two tuples (timestamp, value), where
    timestamp of type datetime.datetime and value is a number (int of float)
  """

  with open(fileName, "rU") as csvFile:
    fileReader = _createCsvReader(csvFile)
    for _ in xrange(rowOffset):
      fileReader.next()  # skip header line

    samples = []
    numRows = 0
    for row in fileReader:
      if len(row) > valueIndex:
        if not (na.isNA(str(row[valueIndex])) or
         na.isNA(str(row[timestampIndex]))):
          timestamp = date_time_utils.parseDatetime(row[timestampIndex],
                                                    datetimeFormat)
  
          # use utc timezone if timezone information is not provided
          if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=tz.tzutc())
  
          samples.append((timestamp, float(row[valueIndex])))
  
          numRows += 1
          if numRows >= MAX_NUM_ROWS:
            break
    return samples


def main():
  # Use NullHandler for now to avoid getting the unwanted unformatted warning
  # message from logger on stderr "No handlers could be found for logger".
  g_log.addHandler(logging.NullHandler())
  try:

    outputInfo = findParameters(_readCSVFile(**vars( _parseArgs())))

    sys.stdout.write(json.dumps(outputInfo))
    sys.stdout.flush()

  except Exception as ex:  # pylint: disable=W0703
    g_log.exception("ParamFinder failed")

    errorMessage = {
      "errorText": str(ex) or repr(ex),
      "diagnosticInfo": traceback.format_exc()
    }

    errorMessage = "%s\n" % (json.dumps(errorMessage))

    try:
      sys.stderr.write(errorMessage)
      sys.stderr.flush()
    except Exception:  # pylint: disable=W0703
      g_log.exception("Failed to emit error message to stderr; msg=%s",
                      errorMessage)

    # Use os._exit to abort the process instead of an exception to prevent
    # the python runtime from dumping traceback to stderr (since we dump a json
    # message to stderr, and don't want the extra text to interfere with parsing
    # in the Front End)
    os._exit(1)  # pylint: disable=W0212



if __name__ == "__main__":
  main()
