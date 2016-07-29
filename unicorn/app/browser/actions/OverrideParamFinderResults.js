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
 * Override ParamFinderResults
 * @param  {FluxibleContext} actionContext The action context
 * @param {object} payload  Params to override param finder restults
 * @emits {OVERRIDE_PARAM_FINDER_RESULTS}
 */
export default function (actionContext, payload) {
  actionContext.getGATracker().event('ACTION', ACTIONS.OVERRIDE_PARAM_FINDER_RESULTS); // eslint-disable-line
  actionContext.dispatch(ACTIONS.OVERRIDE_PARAM_FINDER_RESULTS, payload);
}
