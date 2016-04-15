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
import moment from 'moment';
import React from 'react';

import anomalyBarChartUnderlay from '../lib/Dygraphs/AnomalyBarChartUnderlay';
import axesCustomLabelsUnderlay from '../lib/Dygraphs/AxesCustomLabelsUnderlay';
import Chart from './Chart';
import {DATA_FIELD_INDEX} from '../lib/Constants';
import Dygraph from '../lib/Dygraphs/DygraphsExtended';
import {formatDisplayValue} from '../lib/browser-utils';
import MetricStore from '../stores/MetricStore';
import MetricDataStore from '../stores/MetricDataStore';
import ModelStore from '../stores/ModelStore';
import ModelDataStore from '../stores/ModelDataStore';
import RangeSelectorBarChart from '../lib/Dygraphs/RangeSelectorBarChartPlugin';

const {
  DATA_INDEX_TIME, DATA_INDEX_VALUE, DATA_INDEX_ANOMALY
} = DATA_FIELD_INDEX;


/**
 * React Component for sending Model Data from Model component to
 *  Chart component.
 */
@connectToStores([MetricStore, MetricDataStore, ModelStore, ModelDataStore],
  (context, props) => {
    let metric = context.getStore(MetricStore).getMetric(props.modelId);
    let metricData = context.getStore(MetricDataStore).getData(props.modelId);
    let model = context.getStore(ModelStore).getModel(props.modelId);
    let modelData = context.getStore(ModelDataStore).getData(props.modelId);
    return {metric, metricData, model, modelData};
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

    let muiTheme = this.context.muiTheme;
    let displayPointCount = this._config.get('chart:points');

    this._anomalyBarWidth = Math.round(displayPointCount / 16, 10);

    // Dygraphs Chart Options: Global and per-Series/Axis settings.
    this._chartOptions = {
      // Dygraphs global chart options
      options: {
        axisLineColor: muiTheme.rawTheme.palette.accent4Color,
        connectSeparatedPoints: true,  // required for raw+agg overlay
        includeZero: true,
        interactionModel: Dygraph.Interaction.dragIsPanInteractionModel,
        labelsShowZeroValues: true,
        plugins: [RangeSelectorBarChart],
        rangeSelectorPlotFillColor: muiTheme.rawTheme.palette.primary1FadeColor,
        rangeSelectorPlotStrokeColor: muiTheme.rawTheme.palette.primary1Color,
        showRangeSelector: true,
        underlayCallback: function (context, ...args) {
          axesCustomLabelsUnderlay(context, ...args);
          anomalyBarChartUnderlay(context, ...args);
        }.bind(null, this),
        xRangePad: 0,
        yRangePad: 0
      },

      // main value data chart line (could be either Raw OR Aggregated data)
      value: {
        labels: ['Time', 'Value'],
        axes: {
          x: {
            axisLabelOverflow: false,
            axisLabelWidth: 0,
            drawAxis: false,
            drawGrid: false,
            valueFormatter: (time) => moment(time).format('lll')
          },
          y: {
            axisLabelOverflow: false,
            axisLabelWidth: 0,
            drawAxis: false,
            drawGrid: false,
            valueFormatter: this._legendValueFormatter
          }
        },
        series: {
          Value: {
            axis: 'y',
            color: muiTheme.rawTheme.palette.primary2Color,  // dark blue
            independentTicks: false,
            showInRangeSelector: true,  // plot alone in range selector
            strokeWidth: 2
          }
        }
      },

      // non-aggregated line chart overlay on top of aggregated data line chart
      raw: {
        labels: ['NonAggregated'],
        axes: {
          y2: {
            axisLabelOverflow: false,
            axisLabelWidth: 0,
            drawAxis: false,
            drawGrid: false,
            valueFormatter: this._overlayValueFormatter
          }
        },
        series: {
          NonAggregated: {
            axis: 'y2',
            color: muiTheme.rawTheme.palette.primary1Color,  // light blue
            independentTicks: false,
            showInRangeSelector: false,
            strokeWidth: 2
          }
        }
      }
    }; // chartOptions
  } // constructor

  /**
   * Format Values & Anomalies for Dygraph Chart Legend. Add Anomaly when there.
   * @param {Number} time - UTC epoch milisecond stamp of current value point
   * @param {Function} options - options('key') same as dygraph.getOption('key')
   * @param {String} series - Name of series
   * @param {Object} dygraph - Instantiated Dygraphs charting object
   * @param {Number} row - Current row (series)
   * @param {Number} column - Current column (data index)
   * @returns {Number|String} - Valueset for display in Legend
   * @see http://dygraphs.com/options.html#valueFormatter
   */
  _legendValueFormatter(time, options, series, dygraph, row, column) {
    let modelData = options('modelData');  // custom
    let value = formatDisplayValue(dygraph.getValue(row, column));
    let anomaly, percent;

    if (
      modelData &&
      modelData[row] &&
      modelData[row][DATA_INDEX_ANOMALY]
    ) {
      anomaly = modelData[row][DATA_INDEX_ANOMALY];
      percent = Math.round(anomaly * 100);
      value = `${value} <strong>Anomaly</strong>: ${percent}%`;
    }

    return value;
  }

  /**
   * Format Values for non-aggregated raw overlay data on Dygraph Chart Legend.
   * @param {Number} time - UTC epoch milisecond stamp of current value point
   * @param {Function} options - options('key') same as dygraph.getOption('key')
   * @param {String} series - Name of series
   * @param {Object} dygraph - Instantiated Dygraphs charting object
   * @param {Number} row - Current row (series)
   * @param {Number} column - Current column (data index)
   * @returns {Number|String} - Valueset for display in Legend
   * @see http://dygraphs.com/options.html#valueFormatter
   */
  _overlayValueFormatter(time, options, series, dygraph, row, column) {
    return formatDisplayValue(dygraph.getValue(row, column));
  }

  /**
   * Transform two indepdent time-series datasets into a single Dygraphs
   *  data matrix, overlaid on top of each other.
   * @param {Array} dataSeries - Input Dygraph data series matrix for overlay.
   * @param {Array} metricData - Input data record list, raw metric data.
   * @returns {Array} - Output Dygraph Multi-dimensional array matrix Data
   *                    Series for charting: data[ts][series].
   * @see http://dygraphs.com/tests/independent-series.html
   */
  _overlayDataSeries(dataSeries, metricData) {
    let dataId = 0;
    let dataStamp = dataSeries[dataId][DATA_INDEX_TIME];
    let newData = [];

    metricData.forEach((item, rowid) => {
      let metricStamp = item[DATA_INDEX_TIME];
      if (metricStamp.getTime() < dataStamp.getTime()) {
        // merge in raw metric data record
        newData.push([metricStamp, null, item[DATA_INDEX_VALUE]]);
      } else {
        // merge in agg+anom data record
        let aggregate = dataSeries[dataId][DATA_INDEX_VALUE];
        newData.push([dataStamp, aggregate, null]);
        if (dataId < dataSeries.length - 1) {
          dataId++; // increment pointer to data[]
          dataStamp = dataSeries[dataId][DATA_INDEX_TIME];
        }
      }
    });

    return newData;
  }

  shouldComponentUpdate(nextProps, nextState) {
    let {model, modelData, showNonAgg} = this.props;

    // allow chart to switch between "show non-agg data" toggle states
    if (showNonAgg !== nextProps.showNonAgg) {
      return true;
    }

    // Only update if the model is visible and model data has changed
    if (model.visible && modelData.data.length) {
      return modelData.modified !== nextProps.modelData.modified;
    }

    return true;
  }

  render() {
    let {metric, metricData, model, modelData, showNonAgg} = this.props;
    let {options, raw, value} = this._chartOptions;
    let {axes, labels, series} = value;
    let metaData = {metric, model, min: -Infinity, max: Infinity};
    let data = [];  // actual matrix of data to plot w/dygraphs
    let values = [];  // used to find chart value min/max to lock Y-axis

    // 1. Raw metric data on Series 1
    if (metricData.length) {
      data = Array.from(metricData);
      metaData.metric.dataSize = metricData.length;
      values = data.map((item) => item[DATA_INDEX_VALUE]);
    }
    // 2. Model anomaly data on Underlay
    if (modelData.data.length) {
      options.modelData = modelData.data;
      metaData.model.dataSize = modelData.data.length;
      values = modelData.data.map((item) => item[DATA_INDEX_VALUE])
                .concat(values);

      // 2a. Aggregated Model metric data on Series 1
      if (model.aggregated) {
        data = Array.from(modelData.data).map((item) => {
          return item.slice(DATA_INDEX_TIME, DATA_INDEX_ANOMALY);
        });
      }
    }
    // 3. Overlay: Aggregated on Series 1. Raw on Series 2.
    if (modelData.data.length && showNonAgg) {
      // switch to use merged array
      data = this._overlayDataSeries(data, metricData);

      // Format non-aggregated overlay series
      labels = labels.concat(raw.labels);
      Object.assign(axes, raw.axes);
      Object.assign(series, raw.series);
    }

    // find Y value min+max for locking chart Y-axis in place
    metaData.min = Math.min(...values);
    metaData.max = Math.max(...values);

    // RENDER
    Object.assign(options, {axes, labels, series});
    return (
      <Chart data={data} metaData={metaData} options={options} />
    );
  }

}
