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
 * Dispatches `param_finder` errors
 * @param {FluxibleContext} actionContext  FluxibleContext
 * @param {object} payload       Error payload
 * @param {string} payload.command The command that generate the error
 * @param {string} payload.metricId The metric that generate the error
 * @param {string} payload.error The error description
 * @emits {START_PARAM_FINDER_FAILED}
 * @emits {STOP_PARAM_FINDER_FAILED}
 * @emits {UNKNOWN_PARAM_FINDER_FAILURE}
*/
export default function (actionContext, payload) {
  let {command, metricId, error} = payload;
  if (command === 'create') {
    actionContext.getGATracker().exception(ACTIONS.START_PARAM_FINDER_FAILED);
    actionContext.dispatch(ACTIONS.START_PARAM_FINDER_FAILED, {
      metricId, error
    });
    return;
  } else if (command === 'remove') {
    actionContext.getGATracker().exception(ACTIONS.STOP_PARAM_FINDER_FAILED);
    actionContext.dispatch(ACTIONS.STOP_PARAM_FINDER_FAILED, {
      metricId, error
    });
    return;
  }

  actionContext.getGATracker().exception(ACTIONS.UNKNOWN_PARAM_FINDER_FAILURE);
  actionContext.dispatch(ACTIONS.UNKNOWN_PARAM_FINDER_FAILURE, {
    metricId, error
  });
}
