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

"""This test suite verifies that the resources required by the Taurus Engine
server are accessible.
"""

import os
import unittest

import boto.dynamodb2

from nta.utils import error_handling
from nta.utils.message_bus_connector import MessageBusConnector

import taurus_engine
import taurus_engine.repository



_ACCESSIBILITY_TIMEOUT_SEC = 10

_RETRY_SERVICE_RUNNING_CHECK = error_handling.retry(
  _ACCESSIBILITY_TIMEOUT_SEC,
  initialRetryDelaySec=1,
  maxRetryDelaySec=1)


class TaurusEngineResourceAccessibilityTestCase(unittest.TestCase):


  @_RETRY_SERVICE_RUNNING_CHECK
  def testTaurusdbIsAccessible(self):  # pylint: disable=R0201
    transactionContext = taurus_engine.repository.engineFactory().begin()
    transactionContext.transaction.rollback()


  @_RETRY_SERVICE_RUNNING_CHECK
  def testMessageBusIsAccessible(self):  # pylint: disable=R0201
    with MessageBusConnector() as bus:
      bus.isMessageQeueuePresent("")


  @_RETRY_SERVICE_RUNNING_CHECK
  def testDynamodbIsAccessible(self):
    region = taurus_engine.config.get("dynamodb", "aws_region")

    connectKwargs = {
      "aws_access_key_id": os.getenv("AWS_ACCESS_KEY_ID", "taurus"),
      "aws_secret_access_key": os.getenv("AWS_SECRET_ACCESS_KEY", "taurus"),
      "is_secure": taurus_engine.config.getboolean("dynamodb", "is_secure"),
    }

    host = taurus_engine.config.get("dynamodb", "host")
    port = taurus_engine.config.get("dynamodb", "port")

    if host:
      connectKwargs["host"] = host
      connectKwargs["port"] = port

    conn = boto.dynamodb2.connect_to_region(region, **connectKwargs)
    conn.close()


if __name__ == "__main__":
  unittest.main()
