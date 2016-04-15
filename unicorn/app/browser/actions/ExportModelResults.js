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
 * Export model results
 * @param {FluxibleContext} actionContext -
 * @param {Object} payload Action payload
 * @param {string} payload.modelId - Model to export results from
 * @param {string} payload.filename - The destination csv file to store model results
 * @emits {EXPORT_MODEL_RESULTS}
 * @emits {EXPORT_MODEL_RESULTS_FAILED}
 * @return {Promise} - Promise to resolve when data is loaded
 */
export default function (actionContext, payload) {
  return new Promise((resolve, reject) => {
    let {modelId, filename} = payload;
    let database = actionContext.getDatabaseClient();
    database.exportModelData(modelId, filename, (error) => {
      if (error) {
        actionContext.dispatch(ACTIONS.EXPORT_MODEL_RESULTS_FAILED, error);
        reject(error);
      } else {
        actionContext.dispatch(ACTIONS.EXPORT_MODEL_RESULTS, {
          modelId, filename
        });
        resolve();
      }
    });
  })
}
