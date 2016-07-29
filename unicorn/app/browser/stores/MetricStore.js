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

import BaseStore from 'fluxible/addons/BaseStore';
import instantiator from 'json-schema-instantiator';
import {Validator} from 'jsonschema';
import {
  DBFileSchema, DBMetricDataSchema, DBMetricSchema,
  DBModelDataSchema, DBModelSchema,
  MRAggregationSchema, MRInputSchema, MRModelSchema,
  PFInputSchema, PFOutputSchema
} from '../../database/schema';

const INSTANCE = instantiator.instantiate(DBMetricSchema);
const SCHEMAS = [
  DBFileSchema, DBMetricDataSchema, DBMetricSchema,
  DBModelDataSchema, DBModelSchema,
  MRAggregationSchema, MRInputSchema, MRModelSchema,
  PFInputSchema, PFOutputSchema
];
const VALIDATOR = new Validator();
SCHEMAS.forEach((schema) => {
  VALIDATOR.addSchema(schema);
});


/**
 * Metric store, it maintains a collection of {@link MetricStore.Metric}
 * @see ../database/schema/Metric.json
 */
export default class MetricStore extends BaseStore {

  /**
   * MetricStore
   */
  static get storeName() {
    return 'MetricStore';
  }

  /**
   * @listens {DELETE_FILE}
   * @listens {LIST_METRICS}
   */
  static get handlers() {
    return {
      DELETE_FILE: '_handleDeleteFile',
      LIST_METRICS: '_handleListMetrics',
      UPDATE_METRIC: '_handleUpdateMetric',
      CHART_UPDATE_VIEWPOINT: '_handleUpdateViewpoint'
    }
  }

  constructor(dispatcher) {
    super(dispatcher);
    this._metrics = new Map();
  }

  /**
   * Get all metrics
   * @return {MetricStore.Metric} The metric object or `null`
   */
  getMetrics() {
    return this._metrics;
  }

  /**
   * Get metric by Id
   * @param  {string} metricId The metric id
   * @return {MetricStore.Metric} The metric object or `null`
   */
  getMetric(metricId) {
    return this._metrics.get(metricId);
  }

  /**
   * Get all metrics related to the give file name
   * @param  {string} fileId File id to get metrics from
   * @return {Array<MetricStore.Metric>}  Array of metrics
   */
  getMetricsByFileId(fileId) {
    let metrics = [];
    this._metrics.forEach((value, key, map) => {
      if (value.file_uid === fileId) {
        metrics.push(value);
      }
    });
    return metrics;
  }

  /**
   * Get all metrics related to the give file name
   * @param  {string} filename File name to get metrics from
   * @return {Array<MetricStore.Metric>}  Array of metrics
   */
  getMetricsByFileName(filename) {
    let metrics = [];
    this._metrics.forEach((value, key, map) => {
      if (value.filename === filename) {
        metrics.push(value);
      }
    });
    return metrics;
  }

  /**
   * Delete all metrics associated with the file
   * @param  {string} filename The name of the file to delete
   */
  _handleDeleteFile(filename) {
    this._metrics.forEach((value, key, map) => {
      if (value.filename === filename) {
        map.delete(key);
      }
    });
    this.emitChange();
  }

  /**
   * Update store with list of metrics
   * @param  {Array} metrics List of metrics to add to the store
   */
  _handleListMetrics(metrics) {
    if (metrics) {
      metrics.forEach((metric) => {
        let record = Object.assign({}, INSTANCE, metric);
        let validation = VALIDATOR.validate(record, DBMetricSchema);
        if (validation.errors.length) {
          throw new Error('New Metric did not validate against schema');
        }
        this._metrics.set(metric.uid, record);
      });
      this.emitChange();
    }
  }

  /**
   * Update store metric
   * @param  {Object} payload - metric info to update in the store
   */
  _handleUpdateMetric(payload) {
    let {aggOpts, inputOpts, metricId, modelOpts} = payload;

    let metric = this._metrics.get(metricId);
    if (metric) {
      metric.aggregation_options = aggOpts;
      metric.input_options = inputOpts;
      metric.model_options = modelOpts;

      this.emitChange();
    }
  }

  /**
   * Update store with new chart viewpoint.
   *
   * The dateWindow endpoints are stored as a JS time, milliseconds since epoch
   * (1 January 1970 00:00:00 UTC), example = 1458342717816. null if unused.
   * This value corresponds directly to the Dygraphs dateWindow, which specifies
   * the visible Chart time interval.
   *
   * This store updater does not emit changes, as we want to keep this value for
   * the future, but not trigger a UI re-render (already did).
   *
   * @param {Object} payload - Data payload to use
   * @param {String} payload.metricId - ID of Metric to operate on
   * @param {Array} payload.dateWindow - [start, end] number pair
   *                                     Each in milliseconds since epoch UTC.
   *                                     Where to start zooming in on chart.
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date
   * @see http://dygraphs.com/options.html#dateWindow
   * @see view-source://dygraphs.com/tests/range-selector.html
   */
  _handleUpdateViewpoint(payload) {
    let {metricId, dateWindow} = payload;
    let metric = this._metrics.get(metricId);
    if (metric) {
      metric.dateWindow = dateWindow;
      // No change emit - only store value, do not cause UI to re-render.
      //  The UI just gave us this value, UI does not need any updating now.
    }
  }
}
