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
 * Show {@link CreateModelDialog} page
 * @emits {SHOW_CREATE_MODEL_DIALOG}
 * @param {FluxibleContext} actionContext - The action context
 * @param {Object} payload - Payload data object
 * @param {String} payload.fileName - Filename path of metric
 * @param {String} payload.metricName - Name to use for Metric
 * @emits {SHOW_CREATE_MODEL_DIALOG}
 */
export default function (actionContext, payload) {
  actionContext.getGATracker().event('ACTION',
    ACTIONS.SHOW_CREATE_MODEL_DIALOG);
  let {fileName, metricName} = payload;
  actionContext.dispatch(ACTIONS.SHOW_CREATE_MODEL_DIALOG, {
    fileName, metricName
  });
}
