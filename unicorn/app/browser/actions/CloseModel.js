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
 * ModelRunnar Process was closed either via {@link StopModel} action or
 * because the process ended
 * @param {FluxibleContext} actionContext - Fluxible action context object
 * @param {string} modelId - Model ID
 * @emits {CLOSE_MODEL}
 */
export default function (actionContext, modelId) {
  actionContext.getGATracker().event('ACTION', ACTIONS.CLOSE_MODEL);
  actionContext.dispatch(ACTIONS.CLOSE_MODEL, modelId);
}
