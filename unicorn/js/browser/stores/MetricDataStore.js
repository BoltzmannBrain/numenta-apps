// Copyright © 2016, Numenta, Inc.  Unless you have purchased from
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

import BaseStore from 'fluxible/addons/BaseStore';

/**
 * Maintains metric raw data store
 */
export default class MetricDataStore extends BaseStore {

  static get storeName() {
    return 'MetricDataStore';
  }

  /**
   * @listens {LOAD_METRIC_DATA}
   * @listens {UNLOAD_METRIC_DATA}
   */
  static get handlers() {
    return {
      LOAD_METRIC_DATA: '_handLoadData',
      UNLOAD_METRIC_DATA: '_handleUnloadData',
      HIDE_MODEL: '_handleHideModel'
    };
  }

  constructor(dispatcher) {
    super(dispatcher);
    this._metrics = new Map();
  }

  /**
   * Received new data for a specific metric.
   * @param  {Object} payload The action payload in the following format:
   *                          <code>
   *                          {
   *                          	metricId: {String}, // Required metric id
   *                          	data:{Array}},      // New data to be appended
   *                          }
   *                          </code>
   */
  _handLoadData(payload) {
    if (payload && 'metricId' in payload) {
      let metric = this._metrics.get(payload._metrics);
      if (metric) {
        // Append payload data to existing metric
        metric.push(...payload.data);
      } else {
        // Load New metric
        this._metrics.set(payload.metricId, Array.from(payload.data || []));
      }
      this.emitChange();
    }
  }

  /**
   * Unload metric data.
   * @param {string} metricId - Metric to unload the data
   */
  _handleUnloadData(metricId) {
    this._metrics.delete(metricId);
    this.emitChange();
  }

  _handleHideModel(metricId) {
    this._handleUnloadData(metricId);
  }
  /**
   * Get data for the given metric.
   * @param  {string} metricId - Metric to get data from
   * @return {Array<number[]>} - Metric raw data
   */
  getData(metricId) {
    return this._metrics.get(metricId) || [];
  }
}
