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

""" Reset emitted status for a stock symbol so that the collector can
back-fill a previously deleted metric using data available in collectorsdb """

import argparse
import random

from taurus_metric_collectors import collectorsdb
from taurus_metric_collectors.collectorsdb import schema



def deleteFromEmitted(conn, table, symbol):
  print ("Deleting `{}` from `{}` table of `{}` database"
         .format(symbol, table.name, str(conn.engine)))
  return conn.execute(table.delete().where(table.c.symbol==symbol))



def main():
  parser = argparse.ArgumentParser()
  parser.add_argument("--symbol", required=True)

  args = parser.parse_args()

  expectedAnswer = "Yes-%s" % (random.randint(1, 30),)

  with collectorsdb.engineFactory().begin() as conn:
    answer = raw_input(
      "Attention!  You are about to reset the emitted status for the \"{}\""
      " stock symbol at {}.\n"
      "\n"
      "To back out immediately without making any changes, feel free to type "
      "anything but \"{}\" in the prompt below, and press return.\n"
      "\n"
      "Are you sure you want to continue? ".format(args.symbol,
                                                   str(conn.engine),
                                                   str(expectedAnswer)))

    if answer.strip() != expectedAnswer:
      print "Aborting - Wise choice, my friend. Bye."
      return 1

    deleteFromEmitted(conn, schema.emittedStockPrice, args.symbol)
    deleteFromEmitted(conn, schema.emittedStockVolume, args.symbol)


if __name__ == "__main__":
  main()
