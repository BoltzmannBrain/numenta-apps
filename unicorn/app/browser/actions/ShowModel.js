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
import LoadModelDataAction from './LoadModelData';
import LoadMetricDataAction from './LoadMetricData';


/**
 * Show model making sure its data is loaded
 * @param  {FluxibleContext} actionContext - The action context
 * @param  {string} modelId - The model to show.
 *                            Must be in the {@link ModelStore}
 * @emits {SHOW_MODEL}
 * @emits {PREPARE_FOR_MODEL_RESULTS}
 * @emits {LoadMetricDataAction}
 * @returns {Promise} - A Promise to be resolved with return value
 */
export default function (actionContext, modelId) {
  actionContext.getGATracker().event('ACTION', ACTIONS.SHOW_MODEL);

  actionContext.dispatch(ACTIONS.PREPARE_FOR_MODEL_RESULTS, modelId);

  return Promise.all([
    actionContext.executeAction(LoadModelDataAction, modelId),
    actionContext.executeAction(LoadMetricDataAction, modelId)
  ]).then(() => {
    actionContext.dispatch(ACTIONS.SHOW_MODEL, modelId);
  });
}
