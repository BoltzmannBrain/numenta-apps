// Numenta Platform for Intelligent Computing (NuPIC)
// Copyright (C) 2015, Numenta, Inc.  Unless you have purchased from
// Numenta, Inc. a separate commercial license for this software code, the
// following terms and conditions apply:
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero Public License version 3 as
// published by the Free Software Foundation.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
// See the GNU Affero Public License for more details.
//
// You should have received a copy of the GNU Affero Public License
// along with this program.  If not, see http://www.gnu.org/licenses.
//
// http://numenta.org/licenses/

import {ipcRenderer as ipc} from 'electron';

import ModelErrorAction from '../../actions/ModelError';
import NotifyNewModelResultsAction from '../../actions/NotifyNewModelResults';
import CloseModelAction from '../../actions/CloseModel';

const MODEL_SERVER_IPC_CHANNEL = 'MODEL_SERVER_IPC_CHANNEL';


/**
 * HTM Studio: ModelClient - Talk to a ModelService over IPC, gaining
 *  access to the Backend NuPIC Model Runner. Connects via IPC adapter.
 */
export default class ModelClient {

  constructor() {
    this._context = null;
  }

  start(actionContext) {
    this._context = actionContext;
    ipc.on(MODEL_SERVER_IPC_CHANNEL, this._handleIPCEvent.bind(this));
  }

  createModel(modelId, inputOpts, aggOpts, modelOpts) {
    ipc.send(MODEL_SERVER_IPC_CHANNEL, {
      modelId,
      command: 'create',
      inputOpts: JSON.stringify(inputOpts),
      aggOpts: JSON.stringify(aggOpts),
      modelOpts: JSON.stringify(modelOpts)
    });
  }

  removeModel(modelId) {
    ipc.send(MODEL_SERVER_IPC_CHANNEL, {
      modelId,
      command: 'remove'
    });
  }

  _handleIPCEvent(event, modelId, command, payload) {
    if (this._context) {
      if (command === 'notifyNewModelResults') {
        this._context.executeAction(NotifyNewModelResultsAction, modelId);
      } else if (command === 'error') {
        let {error, ipcevent} = payload;
        this._handleIPCError(error, ipcevent);
      } else if (command === 'close') {
        this._handleCloseModel(modelId, payload);
      } else {
        console.error(`Unknown command: ${command} ${payload}`); // eslint-disable-line
      }
    }
  }

  _handleIPCError(error, ipcevent) {
    let command, modelId;

    if (ipcevent) {
      if ('command' in ipcevent) {
        command = ipcevent.command;
      }
      if ('modelId' in ipcevent) {
        modelId = ipcevent.modelId;
      }
    }

    this._context.executeAction(ModelErrorAction, {command, modelId, error});
  }

  _handleCloseModel(modelId, error) {
    if (error !== 0) {
      this._context.executeAction(ModelErrorAction, {
        command: 'close',
        modelId,
        error: `Error closing model ${error}`
      });
    } else {
      // Close model
      this._context.executeAction(CloseModelAction, modelId);
    }
  }
}
