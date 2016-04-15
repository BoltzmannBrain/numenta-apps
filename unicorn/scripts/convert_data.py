#!/usr/bin/python
# ----------------------------------------------------------------------
# Copyright (C) 2015, Numenta, Inc.  Unless you have an agreement
# with Numenta, Inc., for a separate license for this software code, the
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
This script converts CSV data formatted for the OPF into data formatted for
streaming to the HTM Studio model runner.
"""
import argparse
import csv
from datetime import datetime
import json
import time



def convert(dataPath, outputPath, numHeaderRows=None, timestampFormat=None):
  with open(dataPath, 'r') as infile:
    reader = csv.reader(infile)

    for _ in xrange(numHeaderRows):
      reader.next()

    with open(outputPath, 'w') as outfile:
      for row in reader:
        timestamp = datetime.strptime(row[0], timestampFormat)
        timestamp = int(time.mktime(timestamp.timetuple()))
        value = float(row[1])
        outfile.write(json.dumps([timestamp, value]))
        outfile.write("\n")



if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument('data', metavar='/path/to/data.csv', type=str)
  parser.add_argument('output', metavar='/path/to/output.json', type=str)
  parser.add_argument('-n', '--num_header_rows', type=int, default=3)
  parser.add_argument('-t', '--timestamp_format', type=str,
                      default='%Y-%m-%d %H:%M:%S')

  args = parser.parse_args()

  convert(args.data, args.output,
          numHeaderRows=args.num_header_rows,
          timestampFormat=args.timestamp_format)
