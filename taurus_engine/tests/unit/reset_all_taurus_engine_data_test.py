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

"""Unit test for module taurus_engine.reset_all_taurus_engine_data"""


# Suppress pylint warnings concerning access to protected member
# pylint: disable=W0212


import unittest

import mock
from mock import ANY, Mock, patch

from nta.utils.logging_support_raw import LoggingSupport
import nta.utils.prompt_utils

from taurus_engine import reset_all_taurus_engine_data



def setUpModule():
  LoggingSupport.initTestApp()



@patch("taurus_engine.reset_all_taurus_engine_data"
       ".taurus_engine.repository", autospec=True)
@patch("taurus_engine.reset_all_taurus_engine_data"
       ".amqp", autospec=True)
@patch("taurus_engine.reset_all_taurus_engine_data"
       ".MessageBusConnector", autospec=True)
@patch("taurus_engine.reset_all_taurus_engine_data"
       ".model_checkpoint_mgr", autospec=True)
class ResetAllTaurusEngineDataUnitTestCase(unittest.TestCase):


  def testParseArgsWithSuppressPrompt(self,
                                      _modelCheckpointMgrModuleMock,
                                      _messageBusConnectorClassMock,
                                      _amqpModuleMock,
                                      _repositoryMock):
    args = reset_all_taurus_engine_data._parseArgs(
      ["--suppress-prompt-and-obliterate"])

    self.assertEqual(args.suppressPrompt, True)


  def testParseArgsWithoutSuppressPrompt(self,
                                         _modelCheckpointMgrModuleMock,
                                         _messageBusConnectorClassMock,
                                         _amqpModuleMock,
                                         _repositoryMock):
    args = reset_all_taurus_engine_data._parseArgs([])

    self.assertEqual(args.suppressPrompt, False)


  @patch("taurus_engine.reset_all_taurus_engine_data._resetAll", autospec=True)
  def testMainWithSuppressPrompt(self,  # pylint: disable=R0201
                                 resetAllMock,
                                 _modelCheckpointMgrModuleMock,
                                 _messageBusConnectorClassMock,
                                 _amqpModuleMock,
                                 _repositoryMock):
    reset_all_taurus_engine_data.main(args=["--suppress-prompt-and-obliterate"])

    resetAllMock.assert_called_once_with(suppressPrompt=True)


  @patch("taurus_engine.reset_all_taurus_engine_data._resetAll", autospec=True)
  def testMainWithoutSuppressPrompt(self,  # pylint: disable=R0201
                                    resetAllMock,
                                    _modelCheckpointMgrModuleMock,
                                    _messageBusConnectorClassMock,
                                    _amqpModuleMock,
                                    _repositoryMock):
    reset_all_taurus_engine_data.main(args=[])

    resetAllMock.assert_called_once_with(suppressPrompt=False)


  @patch("taurus_engine.reset_all_taurus_engine_data"
         "._cleanModelCheckpoints", autospec=True)
  @patch("taurus_engine.reset_all_taurus_engine_data"
         "._cleanRepository", autospec=True)
  @patch("taurus_engine.reset_all_taurus_engine_data"
         "._cleanRabbitmq", autospec=True)
  @patch("taurus_engine.reset_all_taurus_engine_data"
         "._warnAboutDestructiveAction", autospec=True)
  def testResetAllWithSuppressPrompt(self,
                                     warnAboutDestructiveActionMock,
                                     cleanRabbitmqMock,
                                     cleanRepositoryMock,
                                     cleanModelCheckpointsMock,
                                     _modelCheckpointMgrModuleMock,
                                     _messageBusConnectorClassMock,
                                     _amqpModuleMock,
                                     _repositoryMock):
    reset_all_taurus_engine_data._resetAll(suppressPrompt=True)

    self.assertEqual(warnAboutDestructiveActionMock.call_count, 0)

    self.assertEqual(cleanRabbitmqMock.call_count, 1)
    self.assertEqual(cleanRepositoryMock.call_count, 1)
    self.assertEqual(cleanModelCheckpointsMock.call_count, 1)


  @patch("taurus_engine.reset_all_taurus_engine_data"
         "._cleanModelCheckpoints", autospec=True)
  @patch("taurus_engine.reset_all_taurus_engine_data"
         "._cleanRepository", autospec=True)
  @patch("taurus_engine.reset_all_taurus_engine_data"
         "._cleanRabbitmq", autospec=True)
  @patch("taurus_engine.reset_all_taurus_engine_data"
         "._warnAboutDestructiveAction", autospec=True)
  def testResetAllWithoutSuppressPrompt(self,
                                        warnAboutDestructiveActionMock,
                                        cleanRabbitmqMock,
                                        cleanRepositoryMock,
                                        cleanModelCheckpointsMock,
                                        _modelCheckpointMgrModuleMock,
                                        _messageBusConnectorClassMock,
                                        _amqpModuleMock,
                                        _repositoryMock):
    reset_all_taurus_engine_data._resetAll(suppressPrompt=False)

    self.assertEqual(warnAboutDestructiveActionMock.call_count, 1)

    self.assertEqual(cleanRabbitmqMock.call_count, 1)
    self.assertEqual(cleanRepositoryMock.call_count, 1)
    self.assertEqual(cleanModelCheckpointsMock.call_count, 1)


  @patch("taurus_engine.reset_all_taurus_engine_data.prompt_utils"
         ".promptWithTimeout", autospec=True)
  @patch("taurus_engine.reset_all_taurus_engine_data.random.randint",
         autospec=True)
  def testWarnAboutDestructiveActionConfirmed(self,  # pylint: disable=R0201
                                              randintMock,
                                              promptWithTimeoutMock,
                                              _modelCheckpointMgrModuleMock,
                                              _messageBusConnectorClassMock,
                                              _amqpModuleMock,
                                              _repositoryMock):
    randintMock.return_value = 1
    promptWithTimeoutMock.return_value = "Yes-1"

    reset_all_taurus_engine_data._warnAboutDestructiveAction()

    promptWithTimeoutMock.assert_called_once_with(
      promptText=ANY,
      timeout=reset_all_taurus_engine_data._WARNING_PROMPT_TIMEOUT_SEC)


  @patch("taurus_engine.reset_all_taurus_engine_data.prompt_utils"
         ".promptWithTimeout", autospec=True)
  def testWarnAboutDestructiveActionRejected(self,
                                             promptWithTimeoutMock,
                                             _modelCheckpointMgrModuleMock,
                                             _messageBusConnectorClassMock,
                                             _amqpModuleMock,
                                             _repositoryMock):
    # NOTE: rejection can be anything other than the expected input of
    # "Yes-<randint>"
    promptWithTimeoutMock.return_value = "No"

    with self.assertRaises(reset_all_taurus_engine_data.UserAbortedOperation):
      reset_all_taurus_engine_data._warnAboutDestructiveAction()


  @patch("taurus_engine.reset_all_taurus_engine_data.prompt_utils"
         ".promptWithTimeout", autospec=True)
  def testWarnAboutDestructiveActionTimedOut(self,
                                             promptWithTimeoutMock,
                                             _modelCheckpointMgrModuleMock,
                                             _messageBusConnectorClassMock,
                                             _amqpModuleMock,
                                             _repositoryMock):

    # NOTE: py.test by default captures console output and patches console input
    # such that raw_input fails. Although not ideal, we have to patch
    # raw_input with something else that blocks and will be interrupted by
    # SIGINT.
    promptWithTimeoutMock.side_effect = nta.utils.prompt_utils.PromptTimeout

    with self.assertRaises(nta.utils.prompt_utils.PromptTimeout):
      reset_all_taurus_engine_data._warnAboutDestructiveAction()


  def testCleanRabbitMQ(self,
                        _modelCheckpointMgrModuleMock,
                        messageBusConnectorClassMock,
                        amqpModuleMock,
                        _repositoryMock):


    allQueues = [
      "taurus.metric.custom.data",
      "taurus.mswapper.results",
      "taurus.mswapper.scheduler.notification",
      "taurus.mswapper.model.input.1",
      "taurus.mswapper.model.input.2",
      "should.not.be.deleted"
    ]

    deletedQueues = []

    messageBusMock = (
      messageBusConnectorClassMock.return_value.__enter__.return_value)


    messageBusMock.getAllMessageQueues.side_effect = [allQueues]
    messageBusMock.deleteMessageQueue.side_effect = deletedQueues.append


    # Execute
    reset_all_taurus_engine_data._cleanRabbitmq()


    # Verify queue deletion logic
    self.assertEqual(set(allQueues) - set(deletedQueues),
                     {"should.not.be.deleted"})


    # Verify exchange deletion logic
    amqpClientMock = (amqpModuleMock.synchronous_amqp_client
                      .SynchronousAmqpClient.return_value)
    expectedDeleteExchangeCalls = [
      mock.call(exchange="taurus.model.results"),
      mock.call(exchange="taurus.data.non-metric")
    ]

    self.assertItemsEqual(expectedDeleteExchangeCalls,
                          amqpClientMock.deleteExchange.call_args_list)


  def testCleanRepository(self,
                          _modelCheckpointMgrModuleMock,
                          _messageBusConnectorClassMock,
                          _amqpModuleMock,
                          repositoryMock):
    reset_all_taurus_engine_data._cleanRepository()

    self.assertEqual(repositoryMock.reset.call_count, 1)
    repositoryMock.reset.assert_called_once_with(
      suppressPromptAndContinueWithDeletion=True)


  def testCleanModelCheckpoints(self,
                                modelCheckpointMgrModuleMock,
                                _messageBusConnectorClassMock,
                                _amqpModuleMock,
                                _repositoryMock):
    reset_all_taurus_engine_data._cleanModelCheckpoints()

    self.assertEqual(
      modelCheckpointMgrModuleMock.ModelCheckpointMgr.removeAll.call_count, 1)

    (modelCheckpointMgrModuleMock.ModelCheckpointMgr.removeAll
     .assert_called_once_with())

