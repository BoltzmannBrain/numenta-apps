// Copyright © 2015, Numenta, Inc.  Unless you have purchased from
// Numenta, Inc. a separate commercial license for this software code, the
// following terms and conditions apply:
//
// This program is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero Public License version 3 as published by the Free
// Software Foundation.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE. See the GNU Affero Public License for more details.
//
// You should have received a copy of the GNU Affero Public License along with
// this program.  If not, see http://www.gnu.org/licenses.
//
// http://numenta.org/licenses/


import {ACTIONS} from '../lib/Constants';

/**
 * Load model data
 * @param  {FluxibleContext} actionContext [description]
 * @param  {string} metricId      [description]
 * @emits {LOAD_MODEL_DATA_FAILED}
 * @emits {LOAD_MODEL_DATA}
 * @return {Promise}
 */
export default function (actionContext, metricId) {
  return new Promise((resolve, reject) => {
    let db = actionContext.getDatabaseClient();
    db.getModelData(metricId, (error, modelData) => {
      if (error) {
        actionContext.dispatch(ACTIONS.LOAD_MODEL_DATA_FAILED, error);
        reject(error);
      } else {
        // Extract data from record
        modelData = JSON.parse(modelData);
        let data = modelData.map((record) => [
          record.timestamp, record.metric_value, record.anomaly_score
        ]);
        actionContext.dispatch(ACTIONS.LOAD_MODEL_DATA, {
          modelId: metricId, data
        });
        resolve(data);
      }
    });
  });
}
