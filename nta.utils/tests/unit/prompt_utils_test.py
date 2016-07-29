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
Unit tests for nta.utils.prompt_utils
"""

import time
import unittest

from mock import patch

from nta.utils import prompt_utils



class PromptUtilsTestCase(unittest.TestCase):


  @patch("__builtin__.raw_input", autospec=True)
  def testPromptWithTimeoutNoTimeout(self, rawInputMock):
    rawInputMock.return_value = "Yes"

    answer = prompt_utils.promptWithTimeout(promptText="Ask user something",
                                            timeout=10)

    self.assertEqual(answer, "Yes")

    rawInputMock.assert_called_once_with("Ask user something")


  @unittest.skip("DEVOPS-105 Skip until compatible with bamboo/docker env")
  @patch("__builtin__.raw_input", autospec=True)
  def testPromptWithTimeoutTimedOut(self, rawInputMock):

    # NOTE: py.test by default captures console output and patches console input
    # such that raw_input fails. Although not ideal, we have to patch
    # raw_input with something else that blocks and will be interrupted by
    # SIGINT.
    rawInputMock.side_effect = lambda *args: time.sleep(10)

    with self.assertRaises(prompt_utils.PromptTimeout):
      prompt_utils.promptWithTimeout(promptText="Ask user something",
                                     timeout=0.001)
