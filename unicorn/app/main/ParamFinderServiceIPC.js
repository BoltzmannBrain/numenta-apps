// Copyright © 2016, Numenta, Inc. Unless you have purchased from
// Numenta, Inc. a separate commercial license for this software code, the
// following terms and conditions apply:
//
// This program is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero Public License version 3 as published by the
// Free Software Foundation.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE. See the GNU Affero Public License for more details.
//
// You should have received a copy of the GNU Affero Public License along with
// this program. If not, see http://www.gnu.org/licenses.
//
// http://numenta.org/licenses/


import {ipcMain as ipc} from 'electron';

import UserError from './UserError';

export const PARAM_FINDER_IPC_CHANNEL = 'PARAM_FINDER_IPC_CHANNEL';


/**
 * IPC interface to ParamFinderService.
 */
export default class ParamFinderServiceIPC {

  constructor(paramFinderService) {
    this._webContents = null;
    this._attached = new Set();
    this._service = paramFinderService;
  }

  /**
   * Start listening for IPC events.
   * @param {Object} webContents - Electron webContents object for IPC messages.
   */
  start(webContents) {
    // Initialize IPC events
    ipc.on(PARAM_FINDER_IPC_CHANNEL, this._handleIPCEvent.bind(this));
    // Attach to renderer process
    this._webContents = webContents;
  }

  /**
   * Stop listening for IPC Events.
   */
  stop() {
    ipc.removeAllListeners(PARAM_FINDER_IPC_CHANNEL);
    this._webContents = null;
  }

  /**
   * Handle IPC calls from renderer process.
   * The supported commands are:
   *  - 'create': Create new Param Finder.
   *  						See 'ParamFinderService#createParamFinder' for 'params' format.
   *  - 'remove': Stops and remove the paramFinder
   *  - 'list':   List running param finders as Array of IDs
   *
   * @param {Event} event - IPC Event Object.
   *                        Any error will be returned via 'returnValue.error'
   * @param {Object} payload - Event payload
   * @param {string} metricId - Metric Id
   * @param {string} command -  'create' | 'remove' | 'list'
   * @param {Object} [params] - Command parameters
   */
  _handleIPCEvent(event, payload) {
    const {metricId, command} = payload;
    try {
      if (command === 'create') {
        this._onCreate(metricId, payload.params);
      } else if (command === 'remove') {
        this._onRemove(metricId);
      } else if (command === 'list') {
        event.returnValue = this._onList();
      } else {
        throw new UserError(`Unknown param finder command ${command}`);
      }
    } catch (error) {
      if (this._webContents) {
        // Forward error to browser
        this._webContents.send(
          PARAM_FINDER_IPC_CHANNEL,
          metricId,
          'error',
          {error, ipcevent: payload}
        );
      }
    }
  }

  /**
   * Start up a new param finder.
   * @param {string} metricId - ID of the param finder to start up.
   */
  _attach(metricId) {
    if (this._attached.has(metricId)) {
      return;
    }
    this._attached.add(metricId);
    this._service.on(metricId, (command, payload) => {
      if (!this._attached.has(metricId)) {
        return;
      }
      // forward event to BrowserWindow
      if (this._webContents) {
        if (command === 'error') {
          this._webContents.send(
            PARAM_FINDER_IPC_CHANNEL,
            metricId,
            'error',
            {error: new UserError(payload)}
          );
        } else {
          this._webContents.send(
            PARAM_FINDER_IPC_CHANNEL, metricId, command, payload
          );
        }
      }
    });
  }

  /**
   * Close down a running param finder.
   * @param {string} metricId - ID of existing param finder to shut down
   */
  _detach(metricId) {
    if (this._attached.has(metricId)) {
      this._attached.delete(metricId);
      this._service.removeAllListeners(metricId);
    }
  }

  /**
   * Event callback handler for listing data.
   * @return {Object} - Current Param Finder + State
   */
  _onList() {
    return {
      paramFinders: this._service.getParamFinders()
    };
  }

  /**
   * Event callback handler for creating a new param finder.
   * @param {string} metricId -  ID of New Param Finder to create
   * @param {Object} params - ParamFinder parameters
   */
  _onCreate(metricId, params) {
    this._attach(metricId);
    this._service.createParamFinder(metricId, JSON.parse(params));
  }

  /**
   * Event callback handler for removing an existing param finder.
   * @param {string} metricId - ID of existing param finder to shut down
   */
  _onRemove(metricId) {
    this._detach(metricId);
    this._service.removeParamFinder(metricId);
  }
}
