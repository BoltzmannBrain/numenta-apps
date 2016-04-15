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
import moment from 'moment';


/**
 * Maintains model results data store
 */
export default class ModelDataStore extends BaseStore {

  static get storeName() {
    return 'ModelDataStore';
  }

  /**
   * @listens {RECEIVE_MODEL_DATA}
   * @listens {DELETE_MODEL}
   */
  static get handlers() {
    return {
      RECEIVE_MODEL_DATA: '_handleReceiveModelData',
      HIDE_MODEL: '_handleHideModel',
      LOAD_MODEL_DATA: '_handleLoadModelData',
      DELETE_MODEL: '_handleDeleteModel'
    };
  }

  constructor(dispatcher) {
    super(dispatcher);
    this._models = new Map();
  }

  /**
   * Append data to the specified model
   * @param  {string} modelId   The model to add data
   * @param  {Array} data       New data to be appended
   */
  _appendModelData(modelId, data) {
    // Convert timestamp to Date
    let newData = data.map((row) => [moment(row[0]).toDate(), row[1], row[2]]);
    let model = this._models.get(modelId);
    if (model) {
      // Append payload data to existing model
      model.data.push(...newData);
      // Record last time this model was modified
      model.modified = moment().toDate();
    } else {
      // New model
      this._models.set(modelId, {
        modelId,
        data: newData,
        // Record last time this model was modified
        modified: moment().toDate()
      });
    }
    this.emitChange();
  }

  _handleReceiveModelData(payload) {
    let {modelId, data} = payload;
    this._appendModelData(modelId, data);
  }

  _handleLoadModelData(payload) {
    let {modelId, data} = payload;
    this._appendModelData(modelId, data);
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
   * Delete model data.
   * @param {string} modelId - Model to delete
   */
  _handleDeleteModel(modelId) {
    this._models.delete(modelId);
    this.emitChange();
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
    return Object.assign({
      modelId, data:[], modified:0
    }, this._models.get(modelId));
  }
}
