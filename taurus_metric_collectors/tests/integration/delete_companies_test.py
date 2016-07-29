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
Integration tests for taurus_metric_collectors.delete_companies
"""


import os
import unittest
import uuid

import sqlalchemy as sql

from taurus_metric_collectors import collectorsdb
from taurus_metric_collectors import delete_companies
from taurus_metric_collectors import metric_utils
from taurus_metric_collectors.collectorsdb import schema
from taurus_metric_collectors.xignite import xignite_agent_utils



def _safeDeleteMetric(host, apiKey, metricName):
  """Delete metric, suppressing metric_utils.MetricNotFound exception, if any
  """
  try:
    metric_utils.deleteMetric(host=host,
                              apiKey=apiKey,
                              metricName=metricName)
  except metric_utils.MetricNotFound:
    pass



def _deleteSecurity(symbol):
  """Delete security from xignite_security table"""
  with collectorsdb.engineFactory().begin() as conn:
    conn.execute(
      schema.xigniteSecurity  # pylint: disable=E1120
      .delete()
      .where(schema.xigniteSecurity.c.symbol == symbol))



class DeleteCompaniesTestCase(unittest.TestCase):


  def testDeleteCompanies(self):
    host = os.environ.get("TAURUS_HTM_SERVER", "127.0.0.1")
    apiKey = os.environ.get("TAURUS_APIKEY", "taurus")

    # We have four target stocker ticker symbols here:
    #  FOOBAR: has both metrics and an xignite_security symbol
    #  DOLITTLE: has metrics, but no xignite_security symbol
    #  KNOWLITTLE: has no metrics, but has an xignite_security symbol
    #  GOTNOTHING: has neither metrics, nor xignite_security symbol

    negatives = set([
      "{uuid}.ZZZZZZ.CLOSINGPRICE".format(uuid=uuid.uuid1().hex),
      "{uuid}.FOOBAR.ZZZZZZ.VOLUME".format(uuid=uuid.uuid1().hex),
      "FOOBAR.{uuid}".format(uuid=uuid.uuid1().hex),
      ".FOOBAR.{uuid}".format(uuid=uuid.uuid1().hex),
      "{uuid}.FOOBAR.".format(uuid=uuid.uuid1().hex),
      "{uuid}FOOBARCLOSINGPRICE".format(uuid=uuid.uuid1().hex),
    ])

    positives = set([
      "{uuid}.FOOBAR.CLOSINGPRICE".format(uuid=uuid.uuid1().hex),
      "{uuid}.FOOBAR.VOLUME".format(uuid=uuid.uuid1().hex),
      "{uuid}.TWEET.HANDLE.FOOBAR.VOLUME".format(uuid=uuid.uuid1().hex),
      "{uuid}.NEWS.FOOBAR.VOLUME".format(uuid=uuid.uuid1().hex),
      "{uuid}.DOLITTLE.CLOSINGPRICE".format(uuid=uuid.uuid1().hex),
      "{uuid}.DOLITTLE.VOLUME".format(uuid=uuid.uuid1().hex),
      "{uuid}.TWEET.HANDLE.DOLITTLE.VOLUME".format(uuid=uuid.uuid1().hex),
    ])

    allTestMetricNames = negatives.union(positives)

    # Register cleanup actions
    for metric in allTestMetricNames:
      self.addCleanup(_safeDeleteMetric,
                      host=host,
                      apiKey=apiKey,
                      metricName=metric)

    # Create custom models. They will be created in "pending data"" state, since
    # we're providing neither data nor min/max; thus we don't need to wait for
    # them to enter "active" model state
    for metric in allTestMetricNames:
      metric_utils.createCustomHtmModel(host=host,
                                        apiKey=apiKey,
                                        metricName=metric,
                                        resourceName=metric,
                                        userInfo=dict(),
                                        modelParams=dict())

    # Verify that all metrics got created in Taurus Engine now
    remoteMetricNames = set(obj["name"] for obj in
                            metric_utils.getAllModels(host, apiKey))
    self.assertTrue(allTestMetricNames.issubset(remoteMetricNames),
                    "Some models didn't get created: {metrics}".format(
                      metrics=allTestMetricNames.difference(remoteMetricNames)))

    # Add FOOBAR and KNOWLITTLE to xignite_security table
    def securityExists(symbol):
      security = collectorsdb.engineFactory().execute(
        sql.select([schema.xigniteSecurity.c.symbol])
        .where(schema.xigniteSecurity.c.symbol == symbol)
      ).scalar()

      if security is not None:
        self.assertEqual(security, symbol)
        return True

      return False

    def addSecurity(symbol):
      self.addCleanup(_deleteSecurity, symbol)
      xignite_agent_utils.insertSecurity(
        engine=collectorsdb.engineFactory(),
        xigniteSecurity={
          "Symbol": symbol,
          "CIK": "CIK",
          "CUSIP": "CUSIP",
          "ISIN": "ISIN",
          "Valoren": "Valoren",
          "Name": "{sym} Inc.".format(sym=symbol),
          "Market": "Market",
          "MarketIdentificationCode": "mic1",
          "MostLiquidExchange": True,
          "CategoryOrIndustry": "CategoryOrIndustry"
        })

      self.assertTrue(securityExists(symbol),
                      "inserted {symbol} not found".format(symbol=symbol))


    addSecurity("FOOBAR")
    addSecurity("KNOWLITTLE")

    # Delete companies corresponding to our target ticker symbols
    delete_companies.deleteCompanies(
      tickerSymbols=["FOOBAR", "DOLITTLE", "KNOWLITTLE", "GOTNOTHING"],
      engineServer=host,
      engineApiKey=apiKey,
      warnAboutDestructiveAction=False)

    # Verify that positives got deleted and negatives didn't
    remoteMetricNames = set(obj["name"] for obj in
                            metric_utils.getAllModels(host, apiKey))
    self.assertTrue(positives.isdisjoint(remoteMetricNames),
                    "Some positives didn't get deleted: {metrics}".format(
                      metrics=positives.intersection(remoteMetricNames)))

    self.assertTrue(negatives.issubset(remoteMetricNames),
                    "Some negatives got deleted: {metrics}".format(
                      metrics=negatives.difference(remoteMetricNames)))

    # Verify that FOOBAR and KNOWLITTLE got deleted from xignite_security table
    self.assertFalse(securityExists("FOOBAR"),
                     "FOOBAR not deleted from xignite_security")
    self.assertFalse(securityExists("FOOBAR"),
                     "KNOWLITTLE not deleted from xignite_security")



if __name__ == "__main__":
  unittest.main()
