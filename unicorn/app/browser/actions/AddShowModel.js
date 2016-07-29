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

import {ACTIONS} from '../lib/Constants';
import ShowModelAction from './ShowModel';


/**
 * Add new model to the {@link ModelStore}, and make visible
 * @param {FluxibleContext} actionContext - Fluxible action context object
 * @param {Object} model - Action payload object
 * @param {string} model.modelId - Model Unique ID.
 *                                	See {@link Utls.generateModelId}
 * @param {string} model.filename - File full path name
 * @param {string} model.timestampField - Timestamp field name
 * @param {string} model.metric - Metric field name
 * @return {Promise} Promise
 * @emits {ADD_MODEL}
 * @emits {ADD_MODEL_FAILED}
 */
export default function (actionContext, model) {
  actionContext.getGATracker().event('ACTION', ACTIONS.ADD_MODEL);

  return new Promise((resolve, reject) => {
    let db = actionContext.getDatabaseClient();
    db.putModel(model, (error) => {
      if (error) {
        actionContext.getGATracker().exception(ACTIONS.ADD_MODEL_FAILED);
        actionContext.dispatch(ACTIONS.ADD_MODEL_FAILED, {error, model});
        reject(error);
      } else {
        actionContext.dispatch(ACTIONS.ADD_MODEL, model);
        resolve(model.modelId);
      }
    });
  }).then(() => {
    // show model after adding it to store
    actionContext.executeAction(ShowModelAction, model.modelId);
  });
}
