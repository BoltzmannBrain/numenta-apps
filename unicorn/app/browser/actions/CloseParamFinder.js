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
 * ParamFinder Process was closed either via {@link StopParamFinder} action or
 * because the process ended
 * @param {FluxibleContext} actionContext - Fluxible action context object
 * @param {string} metricId - metric ID
 * @emits {CLOSE_PARAM_FINDER}
 */
export default function (actionContext, metricId) {
  actionContext.getGATracker().event('ACTION', ACTIONS.CLOSE_PARAM_FINDER);
  actionContext.dispatch(ACTIONS.CLOSE_PARAM_FINDER, metricId);
}
