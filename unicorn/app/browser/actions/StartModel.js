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
import {promisify} from '../../common/common-utils';


/**
 * Start model
 * @param {FluxibleContext} actionContext - Fluxible action context object
 * @param {Object} payload -
 * @param {Object} payload.aggOpts - aggregation options
 * @param {Object} payload.inputOpts - input options to start the model
 * @param {String} payload.metricId - ID of the metric to start model for
 * @param {Object} payload.modelOpts - model params options
 * @return {Promise}  Promise
 */
export default function (actionContext, payload) {
  actionContext.getGATracker().event('ACTION', ACTIONS.START_MODEL);

  return new Promise((resolve, reject) => {
    let {aggOpts, inputOpts, metricId, modelOpts} = payload;
    let aggregated = (Object.keys(aggOpts).length >= 1);

    // Update metricStore
    actionContext.dispatch(ACTIONS.UPDATE_METRIC, payload);

    // Save to database
    let db = actionContext.getDatabaseClient();
    return promisify(::db.updateMetric, metricId, {
      input_options: inputOpts,
      aggregation_options: aggOpts,
      model_options: modelOpts
    })
    .then((metric) => promisify(::db.updateModel, metricId, {
      ran: true,
      aggregated
    }))
    .then(() => {
      // Start model
      let modelClient = actionContext.getModelClient();
      modelClient.createModel(metricId, inputOpts, aggOpts, modelOpts);
      actionContext.dispatch(ACTIONS.START_MODEL, {
        modelId: metricId, aggregated
      });
      return resolve();
    })
    .catch((error) => {
      actionContext.getGATracker().exception(ACTIONS.START_MODEL_FAILED);
      return reject(error);
    });
  });
}
