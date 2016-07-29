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

"""Unit test for taurus_engine.set_api_key.py"""

# Disable pylint message concerning "method could be a function
# pylint: disable=R0201

import unittest

from mock import patch

import taurus_engine
from taurus_engine import set_api_key



@patch("taurus_engine.set_api_key.logging_support", autospec=True)
class SetApiKeyTestCase(unittest.TestCase):


  @patch("taurus_engine.set_api_key.Config", autospec=True)
  def testMain(self, configClassMock, _loggingSupportMock):

    with patch("sys.argv", new=["testapp", "--apikey", "ApIkEy"]):
      set_api_key.main()

      configClassMock.assert_called_with(
        configName=taurus_engine.config.configName,
        baseConfigDir=taurus_engine.config.baseConfigDir,
        mode=configClassMock.MODE_OVERRIDE_ONLY)

      configClassMock.return_value.set.assert_called_once_with("security",
                                                               "apikey",
                                                               "ApIkEy")
      configClassMock.return_value.save.assert_called_once_with()



if __name__ == '__main__':
  unittest.main()
