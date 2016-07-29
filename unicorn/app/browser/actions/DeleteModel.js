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


/**
 * Delete model
 * @param {FluxibleContext} actionContext -
 * @param {string} modelId - Model ID
 * @emits {DELETE_MODEL}
 * @emits {DELETE_MODEL_FAILED}
 * @return {Promise}
 */
export default function (actionContext, modelId) {
  actionContext.getGATracker().event('ACTION', ACTIONS.DELETE_MODEL);

  return new Promise((resolve, reject) => {
    let database = actionContext.getDatabaseClient();
    // Delete model
    database.deleteModel(modelId, (error) => {
      if (error) {
        actionContext.getGATracker().exception(ACTIONS.DELETE_MODEL_FAILED);
        actionContext.dispatch(ACTIONS.DELETE_MODEL_FAILED, {modelId, error});
        reject(error);
      } else {
        actionContext.dispatch(ACTIONS.DELETE_MODEL, modelId);
        let modelClient = actionContext.getModelClient();
        modelClient.removeModel(modelId);
        resolve(modelId);
      }
    });
  });
}
