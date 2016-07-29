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
import {DATA_FIELD_INDEX} from '../lib/Constants';


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
    let metric;
    if (payload && 'metricId' in payload) {
      metric = this._metrics.get(payload._metrics);
      if (metric) {
        // Append payload data to existing metric
        metric.push(...payload.data);
      } else {
        // Load New metric
        this._metrics.set(payload.metricId, payload.data);
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
   * Returns the date range stored for the given metric
   * @param {string} metricId - Metric to get
   * @return {Object} date range or null
   * @property {number} from From timestamp
   * @property {number} to  To timestamp
   */
  getTimeRange(metricId) {
    let data = this._metrics.get(metricId);
    if (data && data.length > 0) {
      return {
        from: data[0][DATA_FIELD_INDEX.DATA_INDEX_TIME],
        to: data[data.length - 1][DATA_FIELD_INDEX.DATA_INDEX_TIME]
      };
    }
    return null;
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
