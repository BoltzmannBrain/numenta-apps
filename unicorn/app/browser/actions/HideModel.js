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
 * Hides model from UI
 * @param  {FluxibleContext} actionContext - The action context
 * @param  {string} modelId - The model to hide.
 *                            Must be in the {@link ModelStore}
 * @emits {HIDE_MODEL}
 * @see http://fluxible.io/api/actions.html#api-code-actions-code-
 */
export default function (actionContext, modelId) {
  actionContext.getGATracker().event('ACTION', ACTIONS.HIDE_MODEL);
  actionContext.dispatch(ACTIONS.HIDE_MODEL, modelId);
}
