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
import instantiator from 'json-schema-instantiator';
import {Validator} from 'jsonschema';

import {DBModelSchema} from '../../database/schema';

const INSTANCE = instantiator.instantiate(DBModelSchema);
const VALIDATOR = new Validator();
VALIDATOR.addSchema(DBModelSchema);


/**
 * Fluxible Store for Model Data
 */
export default class ModelStore extends BaseStore {

  /**
   * ModelStore
   */
  static get storeName() {
    return 'ModelStore';
  }

  /**
   * @listens {ADD_MODEL}
   * @listens {DELETE_MODEL}
   * @listens {LIST_MODELS}
   * @listens {STOP_MODEL}
   * @listens {START_MODEL}
   * @listens {SHOW_MODEL}
   * @listens {HIDE_MODEL}
   * @listens {DELETE_MODEL_FAILED}
   * @listens {STOP_MODEL_FAILED}
   * @listens {START_MODEL_FAILED}
   * @listens {UNKNOWN_MODEL_FAILURE}
   */
  static get handlers() {
    return {
      ADD_MODEL: '_addModels',
      DELETE_MODEL: '_deleteModel',
      LIST_MODELS: '_addModels',
      STOP_MODEL: '_stopModel',
      START_MODEL: '_startModel',
      SHOW_MODEL: '_showModel',
      HIDE_MODEL: '_hideModel',

      DELETE_MODEL_FAILED: '_handleModelFailed',
      STOP_MODEL_FAILED: '_handleModelFailed',
      START_MODEL_FAILED: '_handleModelFailed',
      UNKNOWN_MODEL_FAILURE: '_handleModelFailed'
    };
  }

  constructor(dispatcher) {
    super(dispatcher);

    this._models = new Map();
  }

  /**
   * Load model(s) into the store.
   * @param  {ModelStore.Model|ModelStore.Model[]} models model(s) to add to
   *                                                      the store
   */
  _addModels(models) {
    let records = [];

    if (Array.isArray(models)) {
      records = models;
    } else if ('modelId' in models) {
      records.push(models);
    }

    records.forEach((model) => {
      let record = Object.assign({}, INSTANCE, model);
      let validation = VALIDATOR.validate(record, DBModelSchema);
      if (validation.errors.length) {
        throw new Error('New Model did not validate against schema');
      }
      this._models.set(model.modelId, record);
    });

    this.emitChange();
  }

  /**
   * Delete model from the store.
   * @param {string} modelId - Model to delete
   */
  _deleteModel(modelId) {
    this._models.delete(modelId);
    this.emitChange();
  }

  /**
   * Mark model as hidden from the UI
   * @param  {string} modelId - The model to update
   */
  _hideModel(modelId) {
    let model = this._models.get(modelId);
    if (model) {
      model.visible = false;
      this.emitChange();
    }
  }

  /**
   * Mark model as visible to the UI
   * @param  {string} modelId - The model to update
   */
  _showModel(modelId) {
    let model = this._models.get(modelId);
    if (model) {
      model.visible = true;
      this.emitChange();
    }
  }

  /**
   * Mark the model as active.
   * @param {Object} payload - Model info to start with
   * @param {String} payload.modelId - The model to update
   * @param {Boolean} [payload.aggregated=false] - Model flag for if data
   *  is aggregated
   */
  _startModel(payload) {
    let {modelId, aggregated} = payload;
    let model = this._models.get(modelId);
    if (model) {
      model.active = true;
      model.aggregated = aggregated;
      model.error = null;
      model.ran = true;
      this.emitChange();
    }
  }

  /**
   * Mark the model as stopped.
   * @param {string} modelId The model to update
   */
  _stopModel(modelId) {
    let model = this._models.get(modelId);
    if (model) {
      model.active = false;
      model.error = null;
      this.emitChange();
    }
  }

  /**
   * Handles model failures
   *
   * @param {Object} payload - Action payload
   * @param {string} payload.modelId - Model ID to update error
   * @param {string} payload.error - Error message
   */
  _handleModelFailed(payload) {
    let {modelId, error} = payload;
    let model = this._models.get(modelId);
    if (model) {
      model.active = false;
      model.error = error;
      this.emitChange();
    }
  }

  /**
   * Get model from store.
   * @param  {string} modelId Model to get
   * @return {?ModelStore.Model} The model object or null if the model
   *                             can't be found
   */
  getModel(modelId) {
    return this._models.get(modelId);
  }

  /**
   * Returns a list of all models currently kept in this store.
   * @return {ModelStore.Model[]} All models
   */
  getModels() {
    return Array.from(this._models.values());
  }

}
