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

import connectToStores from 'fluxible-addons-react/connectToStores';
import React from 'react';

import Chart from './Chart';
import {DATA_FIELD_INDEX} from '../lib/Constants';
import MetricStore from '../stores/MetricStore';
import MetricDataStore from '../stores/MetricDataStore';
import ModelStore from '../stores/ModelStore';
import ModelDataStore from '../stores/ModelDataStore';

const {DATA_INDEX_TIME, DATA_INDEX_VALUE} = DATA_FIELD_INDEX;

/**
 * Use a heuristic to compute the gap threshold which will be used to represent
 * timestamp gaps in the data.
 *
 * Heuristic for gap threshold:
 *
 * (1) Compute all the time-deltas between points.
 * (2) Find the 30th percentile of non-zero time-deltas and multiply it by the
 *     maximum number of missing anomaly bars (i.e. timestamp gaps in model
 *     results). Using the 30th percentile instead of the min time-delta value
 *     allows to be less sensitive to very small outliers.
 *
 * The result is the gap threshold.
 *
 * @param {Array} data - Array of arrays: [[time, ...], [time, ...], ...]
 * @returns {Array} - Tuple:
 *                    number: gap threshold
 *                    number: minimum time delta
 */
function computeGapThreshold(data) {
  let deltas = [];
  for (let i = 1; i < data.length; i++) {
    let delta = data[i][DATA_INDEX_TIME] - data[i - 1][DATA_INDEX_TIME];
    if (delta > 0) {
      deltas.push(delta);
    }
  }
  deltas.sort((a, b) => a - b);

  let percentile = 0.3;
  let smallTimestampGap = deltas[Math.floor(deltas.length * percentile)];
  let maxMissingBars = 10;
  let gapThreshold = (1 + maxMissingBars) * smallTimestampGap;
  return gapThreshold;
}


/**
 * Detect gaps in timestamps in the data. Lines will be drawn for every
 * time-delta that is less than the gap threshold.
 *
 * At each gap, insert [midpointOfGap, vals[0], vals[1], ...] as a new datum.
 *
 * @param {Array} data - Array of arrays: [[time, ...], [time, ...], ...]
 * @param {Array} vals - Values concatenated to timestamp at every single gap
 * @param {Number} gapThreshold - Lines will be drawn for every time-delta that
 *                                is less than the gap threshold.
 * @returns {Array} - data with gap values inserted
 */
function insertIntoGaps(data, vals, gapThreshold) {
  let newData = [];
  data.forEach((item, rowid) => {
    newData.push(item);

    if (rowid + 1 < data.length) {
      let curr = item[DATA_INDEX_TIME];
      let next = data[rowid + 1][DATA_INDEX_TIME];
      let delta = next - curr;
      if (delta > gapThreshold) {
        let gapItem = [curr + delta / 2].concat(vals);
        newData.push(gapItem);
      }
    }
  });

  return newData;
}

/**
 * React Component for sending Model Data from Model component to
 *  Chart component.
 */
@connectToStores([MetricStore, MetricDataStore, ModelStore, ModelDataStore],
  (context, props) => {
    let modelId = props.modelId;
    let metric = context.getStore(MetricStore).getMetric(modelId);
    let metricData = context.getStore(MetricDataStore).getData(modelId);
    let model = context.getStore(ModelStore).getModel(modelId);
    let modelData = context.getStore(ModelDataStore).getData(modelId);
    return {metric, metricData, model, modelData, modelId};
  }
)
export default class ModelData extends React.Component {

  static get contextTypes() {
    return {
      getConfigClient: React.PropTypes.func,
      getStore: React.PropTypes.func,
      muiTheme: React.PropTypes.object
    };
  }

  static get propTypes() {
    return {
      modelId: React.PropTypes.string.isRequired,
      showNonAgg: React.PropTypes.bool
    };
  }

  constructor(props, context) {
    super(props, context);
    this._config = this.context.getConfigClient();

    this._styles = {
      container: {
        position: 'relative'
      }
    };
  } // constructor

  shouldComponentUpdate(nextProps, nextState) {
    let {modelData, showNonAgg} = this.props;

    // allow chart to switch between "show non-agg data" toggle states
    if (showNonAgg !== nextProps.showNonAgg) {
      return true;
    }

    if (!nextProps.model.visible) {
      return false;
    }

    if (nextProps.modelData.data.length < 1) {
      // We're showing metric data. It only needs to render once.
      return false;
    }

    // Only update if the model data has changed.
    return modelData.modified !== nextProps.modelData.modified ||
      this.props.model.active !== nextProps.model.active;
  }

  _calculateState(props) {
    let {metric, metricData, model, modelData, showNonAgg} = props;

    metric.dataSize = metricData.length;
    model.dataSize = modelData.data.length;

    const rawDataInBackground = (modelData.data.length &&
                                 model.aggregated &&
                                 showNonAgg);

    if (model.dataSize) {
      this._values = modelData.data.map((v) => [v[DATA_INDEX_TIME],
                                                v[DATA_INDEX_VALUE]]);
      let gapThreshold = computeGapThreshold(this._values);
      this._values = insertIntoGaps(this._values, [NaN], gapThreshold);

      if (rawDataInBackground) {
        this._values2 =
          insertIntoGaps(metricData.map((v) => [v[DATA_INDEX_TIME],
                                                v[DATA_INDEX_VALUE]]),
                         [NaN], gapThreshold);
      } else {
        this._values2 = [];
      }
    } else {
      this._values = metricData.map((v) => [v[DATA_INDEX_TIME],
                                            v[DATA_INDEX_VALUE]]);
      let gapThreshold = computeGapThreshold(this._values);
      this._values = insertIntoGaps(this._values, [NaN], gapThreshold);
      this._values2 = [];
    }
  }

  componentWillUpdate(nextProps, nextState) {
    this._calculateState(nextProps);
  }

  componentWillMount() {
    this._calculateState(this.props);
  }

  render() {
    let {model, modelData, metric, modelId} = this.props;

    return (
      <div style={this._styles.container}>
        <section>
          <Chart ref={`chart-${modelId}`}
                 values={this._values}
                 values2={this._values2}
                 model={model}
                 modelData={modelData.data}
                 metric={metric}
           />
        </section>
      </div>
    );
  }
}
