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
This service sends email notifications to report invalid company security
symbols, if they haven't already been reported.
"""

import json
import logging
from optparse import OptionParser
import os
import time

import requests
from nta.utils import error_handling, error_reporting

from taurus_metric_collectors import collectorsdb
from taurus_metric_collectors.collectorsdb import schema
from taurus_metric_collectors import logging_support
from taurus_metric_collectors import metric_utils



# Interval between processing cycles
_SLEEP_INTERVAL_SEC = 3600



class _SelfCheckError(Exception):
  """ Self-check failed """
  pass



# Initialize logging
g_log = logging.getLogger("check_company_symbols")



g_httpSession = requests.Session()



# Retry decorator for specific errors
_RETRY_ON_REQUESTS_ERROR = error_handling.retry(
  timeoutSec=10, initialRetryDelaySec=0.05, maxRetryDelaySec=1,
  retryExceptions=(
    # requests retries on DNS errors, but not on connection errors
    requests.exceptions.ConnectionError,
  ),
  logger=g_log
)



def _checkCompanySymbols(xigniteApiToken):
  """
  Check if company security symbols are valid.
  Email notifications are sent for invalid symbols.
  Each time an invalid symbol is reported successfully, we add it to a table
  keeping track of invalid symbols that were already reported -- to avoid
  duplicate emails about the same symbol.

  :param xigniteApiToken: Xignite API Token
  :type xigniteApiToken: string
  """
  _selfCheck(xigniteApiToken)

  allSymbols = [sec[0] for sec in metric_utils.getAllMetricSecurities()]

  unknownSymbols = _validateSymbols(allSymbols, xigniteApiToken)
  if unknownSymbols:
    # Report unknown symbol
    g_log.error("Unknown=%s", unknownSymbols)

    for symbol in unknownSymbols:
      if not _unknownSymbolReported(symbol):
        subject = "%s: Company symbol=%s is unknown" % (__name__, symbol,)
        body = "%s: Company symbol=%s is unknown." % (__name__, symbol,)
        error_reporting.sendErrorEmail(subject=subject, body=body)

        # Flag it, so it won't be reported again
        _flagUnknownSymbolAsReported(symbol)
  else:
    # Remove all rows of company_symbol_failures table
    _clearUnknownSymbols()
    g_log.info("All company security symbols passed validation")



def _selfCheck(xigniteApiToken):
  """ Perform a self-check on _validateSymbols() to validate that the
  hack in _validateSymbols works. Report error if the self-check fails.
  """
  # NOTE: "WAG" used to be the symbol of "Walgreen Co"
  expectedUnknownSymbols = ["WAG", "ZZZZZZ"]
  expectedKnownSymbols = ["AAPL", "F"]

  failedSelfCheckFlag = ".SELFCHECK"
  try:
    unknownSymbols = _validateSymbols(expectedUnknownSymbols, xigniteApiToken,
                                      negativeTest=True)
    if set(unknownSymbols) != set(expectedUnknownSymbols):
      raise _SelfCheckError(
        "Unknown symbol self-check failed: "
        "expectedUnknown=%s, reportedUnknown=%s"
        % (expectedUnknownSymbols, unknownSymbols))

    unknownSymbols = _validateSymbols(expectedKnownSymbols, xigniteApiToken)
    if unknownSymbols:
      raise _SelfCheckError(
        "Known symbol self-check failed: expectedKnown=%s, reportedUnknown=%s"
        % (expectedKnownSymbols, unknownSymbols))
  except _SelfCheckError as e:
    if not _unknownSymbolReported(failedSelfCheckFlag):
      subject = "%s: self-check failed" % (__name__)
      body = "%s: self-check failed: %r" % (__name__, e,)
      error_reporting.sendErrorEmail(subject=subject, body=body)

      # Flag it, so it won't be reported again
      _flagUnknownSymbolAsReported(failedSelfCheckFlag)

    raise



@collectorsdb.retryOnTransientErrors
def _unknownSymbolReported(symbol):
  """ Check if a specific company symbol already exists in the
  company_symbol_failures table.

  :param str symbol: symbol of the company's security (e.g., "AAPL")
  :returns: True, if symbol is already in the table. False, otherwise
  :rtype: bool
  """
  sel = schema.companySymbolFailures.select(
    ).where(schema.companySymbolFailures.c.symbol == symbol)
  rows = collectorsdb.engineFactory().execute(sel).fetchall()

  return len(rows) > 0



@collectorsdb.retryOnTransientErrors
def _flagUnknownSymbolAsReported(symbol):
  """
  Flag unknown company symbol as reported in database

  :param str symbol: symbol of the company's security (e.g., "AAPL")
  """
  ins = schema.companySymbolFailures.insert(  # pylint: disable=E1120
    ).prefix_with('IGNORE', dialect="mysql").values(symbol=symbol)

  collectorsdb.engineFactory().execute(ins)

  g_log.debug("Saved unknown company symbol=%s", symbol)



@collectorsdb.retryOnTransientErrors
def _clearUnknownSymbols():
  """
  Remove all rows from the company_symbol_failures table.
  """

  result = collectorsdb.engineFactory().execute(
    schema.companySymbolFailures.delete())  # pylint: disable=E1120

  if result.rowcount:
    g_log.info("Deleted %s rows from %s table",
               result.rowcount, schema.companySymbolFailures)



@_RETRY_ON_REQUESTS_ERROR
def _httpGetWithRetries(url, params):
  """ Wrap requests.Session.get in necessary retries

  :param url: URL string
  :param params: params dict to pass to requests.Session.get

  :returns: requests.models.Response instance. see requests.Session.get for
    details
  """
  return g_httpSession.get(url, params=params)



def _validateSymbols(symbols, xigniteApiToken, negativeTest=False):
  """ Checks which of the symbols are valid

  :param symbols: company symbols of interest (e.g., ["AAPL", "F", ...])
  :param str xigniteApiToken: Xignite API Token
  :param bool negativeTest: True if known invalid symbols are passed in
    self-check mode to check that invalid symbols are not treated as valid.
    Turns on additional logging for false positive diagnostics.

  :returns: a sequence of invalid symbols
  """
  baseUrl = ("http://globalquotes.xignite.com/v3/xGlobalQuotes.json/"
             "GetGlobalDelayedQuotes")
  params = {
    "_Token": xigniteApiToken,
    "IdentifierType": "Symbol",
    "Identifiers": ",".join(sym for sym in symbols),
    "_fields": "Outcome,Message,Delay,Security"
  }

  response = _httpGetWithRetries(baseUrl, params)
  response.raise_for_status()

  quotes = json.loads(response.text)

  invalidSymbols = []

  for i, quote in enumerate(quotes):
    sym = quote["Security"]["Symbol"]
    message = quote.get("Message")
    outcome = quote["Outcome"]

    if outcome == "RequestError":
      if message:

        # HACK: Xignite doesn't provide a specific error code at this time, so
        # we're peeking inside the message
        if ("no data available for this symbol" in message.lower() or
            "no match found for this symbol" in message.lower()):
          assert sym.lower() == symbols[i].lower(), (sym, symbols[i])
          invalidSymbols.append(symbols[i])
          continue

    if negativeTest:
      g_log.error("Negative self-check: unexpected outcome or error message "
                  "for symbol %s: outcome=%s; message=%r",
                  sym, outcome, message)

  return invalidSymbols



def _parseArgs():
  """
  :returns: empty dict
  """

  helpString = (
    "%prog\n"
    "Periodically checks and sends email notifications to report invalid "
    "company security symbols, if they haven't already been reported.\n\n"
    "/!\\ This script depends on the following environment variables:\n"
    "* XIGNITE_API_TOKEN: XIgnite API Token.\n"
    "* ERROR_REPORT_EMAIL_AWS_REGION: AWS region for error report email.\n"
    "* ERROR_REPORT_EMAIL_SES_ENDPOINT: SES endpoint for error report email.\n"
    "* ERROR_REPORT_EMAIL_SENDER_ADDRESS: Sender address for error report "
    "email.\n"
    "* ERROR_REPORT_EMAIL_RECIPIENTS: Recipients error report email. Email "
    "addresses need to be comma separated.\n"
    "       Example => 'recipient1@numenta.com, recipient2@numenta.com'\n"
    "* AWS_ACCESS_KEY_ID: AWS access key ID for error report email.\n"
    "* AWS_SECRET_ACCESS_KEY: AWS secret access key for error report email.\n")

  parser = OptionParser(helpString)

  _, remainingArgs = parser.parse_args()
  if remainingArgs:
    parser.error("Unexpected remaining args: %r" % (remainingArgs,))

  return dict()



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

    # Validate environment variables for error-reporting
    error_reporting.validateErrorReportingEnvVars()

    xigniteApiToken = os.environ.get("XIGNITE_API_TOKEN")
    if xigniteApiToken:
      xigniteApiToken = xigniteApiToken.strip()
    if not xigniteApiToken:
      raise Exception("Empty or undefined environment variable "
                      "XIGNITE_API_TOKEN")

    while True:
      _checkCompanySymbols(xigniteApiToken)

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

