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

const PARAM_FINDER_IPC_CHANNEL = 'PARAM_FINDER_IPC_CHANNEL';

import ParamFinderErrorAction from '../../actions/ParamFinderError';
import CloseParamFinderAction from '../../actions/CloseParamFinder';
import ReceiveParamFinderData from '../../actions/ReceiveParamFinderData'

/**
 * HTM Studio: ParamFinderClient - Talk to a ParamFinderService over IPC,
 *  gaining access to the Backend NuPIC Param Finder Runner. Connects via
 *  IPC adapter.
 */
export default class ParamFinderClient {

  constructor() {
    this._context = null;
  }

  start(actionContext) {
    this._context = actionContext;
    ipc.on(PARAM_FINDER_IPC_CHANNEL, this._handleIPCEvent.bind(this));
  }

  createParamFinder(metricId, params) {
    ipc.send(PARAM_FINDER_IPC_CHANNEL, {
      metricId,
      command: 'create',
      params: JSON.stringify(params)
    });
  }

  removeParamFinder(metricId) {
    ipc.send(PARAM_FINDER_IPC_CHANNEL, {
      metricId,
      command: 'remove'
    });
  }

  _handleIPCEvent(event, metricId, command, payload) {
    if (this._context) {
      if (command === 'data') {
        setTimeout(() => this._handleParamFinderData(metricId, payload));
      } else if (command === 'error') {
        let {error, ipcevent} = payload;
        setTimeout(() => this._handleIPCError(error, ipcevent));
      } else if (command === 'close') {
        setTimeout(() => this._handleCloseParamFinder(metricId ,payload));
      } else {
        console.error(`Unknown command: ${command} ${payload}`); // eslint-disable-line
      }
    }
  }

  _handleIPCError(error, ipcevent) {
    let command, metricId;

    if (ipcevent) {
      if ('command' in ipcevent) {
        command = ipcevent.command;
      }
      if ('metricId' in ipcevent) {
        metricId = ipcevent.metricId;
      }
    }
    this._context.executeAction(ParamFinderErrorAction, {
      command, metricId, error
    });
  }

  _handleCloseParamFinder(metricId, error) {
    if (error !== 0) {
      this._context.executeAction(ParamFinderErrorAction, {
        command: 'close',
        metricId,
        error: `Error closing param finder ${error}`
      });
    } else {
      this._context.executeAction(CloseParamFinderAction, metricId);
    }
  }

  _handleParamFinderData(metricId, paramFinderResults) {
    this._context.executeAction(ReceiveParamFinderData, {
      metricId, paramFinderResults
    });
  }
}
