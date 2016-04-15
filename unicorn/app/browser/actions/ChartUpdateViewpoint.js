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
 * Update Chart starting viewpoint in the {@link MetricStore}.
 * @emits {CHART_UPDATE_VIEWPOINT}
 * @param {FluxibleContext} actionContext - Fluxible action context object.
 * @param {Object} payload - Payload data object to use.
 * @param {String} payload.metricId - Unique Metric ID to operate on.
 * @param {Number} payload.viewpoint - JS Date stamp, ms since epoch UTC,
 *  starting point for Metric+Chart viewport.
 */
export default function (actionContext, payload) {
  actionContext.dispatch(ACTIONS.CHART_UPDATE_VIEWPOINT, payload);
}
