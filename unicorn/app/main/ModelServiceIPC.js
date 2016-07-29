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

export const MODEL_SERVER_IPC_CHANNEL = 'MODEL_SERVER_IPC_CHANNEL';


/**
 * IPC interface to ModelService.
 */
export default class ModelServiceIPC {

  constructor(modelService) {
    this._webContents = null;
    this._attached = new Set();
    this._service = modelService;
  }

  /**
   * Start listening for IPC events.
   * @param {Object} webContents - Electron webContents object for IPC messages.
   */
  start(webContents) {
    // Initialize IPC events
    ipc.on(MODEL_SERVER_IPC_CHANNEL, this._handleIPCEvent.bind(this));
    // Attach to renderer process
    this._webContents = webContents;
  }

  /**
   * Stop listening for IPC Events.
   */
  stop() {
    ipc.removeAllListeners(MODEL_SERVER_IPC_CHANNEL);
    this._webContents = null;
  }

  /**
   * Handle IPC calls from renderer process.
   * The supported commands are:
   *  - 'create': Create new HTM model.
   *  						See 'ModelService#createModel' for 'params' format.
   *  - 'remove': Stops and remove the model
   *  - 'list':   List running models as Array of IDs in `returnValue['models']`
   *
   * @param {Event} event - IPC Event Object.
   *                        Any error will be returned via 'returnValue.error'
   * @param {Object} payload - Event payload
   * @param {string} payload.modelId - Model Id
   * @param {string} payload.command -  'create' | 'remove' | 'list'
   * @param {string} payload.inputOpts: input options to start the model runner
   * @param {string} payload.aggOpts: aggregation options
   * @param {string} payload.modelOpts: model params
   */
  _handleIPCEvent(event, payload) {
    const modelId = payload.modelId;
    const command = payload.command;
    try {
      if (command === 'create') {
        const inputOpts = JSON.parse(payload.inputOpts);
        const aggOpts = JSON.parse(payload.aggOpts);
        const modelOpts = JSON.parse(payload.modelOpts);
        this._onCreate(modelId, inputOpts, aggOpts, modelOpts);
      } else if (command === 'remove') {
        this._onRemove(modelId);
      } else if (command === 'list') {
        event.returnValue = this._onList();
      } else {
        throw new UserError(`Unknown model command ${command}`);
      }
    } catch (error) {
      if (this._webContents) {
        // Forward error to browser
        this._webContents.send(MODEL_SERVER_IPC_CHANNEL, modelId, 'error', {
          error, ipcevent: payload
        });
      }
    }
  }

  /**
   * Start up a new model.
   * @param {string} modelId - New ID of New Model to start up
   */
  _attach(modelId) {
    if (this._attached.has(modelId)) {
      return;
    }
    this._attached.add(modelId);
    this._service.on(modelId, (command, payload) => {
      if (!this._attached.has(modelId)) {
        return;
      }
      // forward event to BrowserWindow
      if (this._webContents) {
        if (command === 'error') {
          this._webContents.send(MODEL_SERVER_IPC_CHANNEL, modelId, 'error', {
            error: new UserError(payload)
          });
        } else if (command === 'data') {
          // Do nothing.
          //
          // After the data is in the database, call _notifyNewModelResult.
        } else {
          this._webContents.send(
            MODEL_SERVER_IPC_CHANNEL, modelId, command, payload
          );
        }
      }
    });
  }

  _notifyNewModelResult(modelId) {
    this._webContents.send(
      MODEL_SERVER_IPC_CHANNEL, modelId, 'notifyNewModelResults', null
    );
  }

  /**
   * Close down a running model.
   * @param {string} modelId - ID of existing Model to shut down
   */
  _detach(modelId) {
    if (this._attached.has(modelId)) {
      this._attached.delete(modelId);
      this._service.removeAllListeners(modelId);
    }
  }

  /**
   * Event callback handler for listing data.
   * @return {Object} - Current Models + State
   */
  _onList() {
    return {
      models: this._service.getModels()
    };
  }

  /**
   * Event callback handler for creating a new model.
   * @param {string} modelId - New ID of New Model to create
   * @param {Object} inputOpts: input options to start the model runner
   * @param {Object} aggOpts: aggregation options
   * @param {Object} modelOpts: model params
   */
  _onCreate(modelId, inputOpts, aggOpts, modelOpts) {
    this._attach(modelId);
    this._service.createModel(modelId, inputOpts, aggOpts, modelOpts);
  }

  /**
   * Event callback handler for removing an existing model.
   * @param {string} modelId - ID of existing Model to shut down
   */
  _onRemove(modelId) {
    this._detach(modelId);
    this._service.removeModel(modelId);
  }
}
