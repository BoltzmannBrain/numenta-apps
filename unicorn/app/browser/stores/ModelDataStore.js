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

import BaseStore from 'fluxible/addons/BaseStore';

import {DATA_FIELD_INDEX} from '../lib/Constants';
import databaseClient from '../lib/HTMStudio/DatabaseClient';

const TIME_BUFFER = 400;

/**
 * Maintains model results data store
 */
export default class ModelDataStore extends BaseStore {

  static get storeName() {
    return 'ModelDataStore';
  }

  static get handlers() {
    return {
      PREPARE_FOR_MODEL_RESULTS: '_handlePrepareForResults',
      NOTIFY_NEW_MODEL_RESULTS: '_handleNewModelResults',
      LOAD_MODEL_DATA: '_handleLoadModelData',
      HIDE_MODEL: '_handleHideModel',
      STOP_APPLICATION: '_handleStopApplication',
      DELETE_MODEL: '_handleDeleteModel'
    };
  }

  constructor(dispatcher) {
    super(dispatcher);
    this._models = new Map();
    this._pendingModels = new Map();
  }

  _handlePrepareForResults(modelId) {
    this._pendingModels.set(modelId, {
      shouldFetch: false
    });
  }

  _handleNewModelResults(modelId) {
    if (this._models.has(modelId)) {
      this._fetchNewResultsSoon(modelId);
    } else if (this._pendingModels.has(modelId)) {
      this._pendingModels.get(modelId).shouldFetch = true;
    }
  }

  _handleLoadModelData(payload) {
    let {modelId, data} = payload;

    let pendingModel = this._pendingModels.get(modelId);
    if (pendingModel) {
      this._pendingModels.delete(modelId);
      let model = {
        modelId,
        data,
        modified: new Date(),
        lastFetchTime: 0,
        fetchTimeoutId: null
      };

      this._models.set(modelId, model);

      if (pendingModel.shouldFetch) {
        this._fetchNewResultsSoon(modelId);
      }
    } else if (this._models.get(modelId)) {
      // Multiple LOAD_MODEL_DATA events can happen back-to-back if you rapidly show and hide a model.
      // If you rapidly show and hide the model, the event order might be:
      //   PREPARE_FOR_MODEL_RESULTS
      //   PREPARE_FOR_MODEL_RESULTS
      //   LOAD_MODEL_DATA
      //   LOAD_MODEL_DATA
      //
      // In this case, we've already stored this model.
      this._fetchNewResultsSoon(modelId);
    } else {
      // Normally this means there's a bug in the code.
      //
      // This can also happen when LOAD_MODEL_DATA and HIDE_MODEL events occur
      // in a strange order, e.g. when you rapidly show and hide a model while
      // another model is running. So just warn, don't throw an exception.
      console.warn(`Showed a model without first listening for new results. ${modelId}`); // eslint-disable-line
    }

    this.emitChange();
  }

  _fetchNewResults(modelId) {
    // The model may have been hidden during the delay.
    let model = this._models.get(modelId);

    if (model) {
      // Immediately begin listening for new notifications. Don't wait for the
      // database query to finish.
      model.fetchTimeoutId = null;
      model.lastFetchTime = Date.now();

      let offset = model.data.length;

      databaseClient.getModelData(modelId, offset, (error, data) => {
        if (error) {
          throw new Error('getModelData failed', modelId, offset);
        } else {
          let records = JSON.parse(data);
          model.data.splice(offset, records.length, ...records);
          model.modified = new Date();
          this.emitChange();
        }
      });
    }
  }

  _fetchNewResultsSoon(modelId) {
    let model = this._models.get(modelId);
    if (model && model.fetchTimeoutId === null) {
      let delay = TIME_BUFFER - (Date.now() - model.lastFetchTime);
      if (delay > 0) {
        model.fetchTimeoutId =
          setTimeout(this._fetchNewResults.bind(this, modelId), delay);
      } else {
        this._fetchNewResults(modelId);
      }
    }
  }

  /**
   * Hide model
   * @param {string} modelId - Model to delete
   */
  _handleHideModel(modelId) {
    this._models.delete(modelId);
    this.emitChange();
  }

  /**
   * Close application
   */
  _handleStopApplication() {
    for (let model of this._models.values()) {
      if (model.fetchTimeoutId !== null) {
        clearTimeout(model.fetchTimeoutId);
        model.fetchTimeoutId = null;
      }
    }
  }

  /**
   * Delete model data.
   * @param {string} modelId - Model to delete
   */
  _handleDeleteModel(modelId) {
    this._models.delete(modelId);
    this.emitChange();
  }

  /**
   * Returns the date period stored for the given Model
   * @param {string} modelId - Model to get
   * @return {Object} date range or null
   * @property {Date} from From timestamp
   * @property {Date} to  To timestamp
   */
  getTimeRange(modelId) {
    let model = this._models.get(modelId);
    if (model) {
      let data = model.data;
      if (data && data.length > 0) {
        return {
          from: data[0][DATA_FIELD_INDEX.DATA_INDEX_TIME],
          to: data[data.length - 1][DATA_FIELD_INDEX.DATA_INDEX_TIME]
        };
      }
    }
    return null;
  }

  /**
   * Get data for the given model.
   * @param  {string} modelId - Model to get data from
   * @return {Object[]} - Model results
   * @property {string} modelId: - The model id
   * @property {Array<number[]>} data -  [[val11, val12], [val21, val22], ...],
   * @property {Date} modified - Last time the data was modified
   */
  getData(modelId) {
    let model = this._models.get(modelId);
    return model
      ? {modelId, data: model.data, modified: model.modified}
      : {modelId, data: [], modified: 0};
  }
}
