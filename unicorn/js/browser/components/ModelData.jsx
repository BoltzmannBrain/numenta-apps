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
import RGBColor from 'rgbcolor';

import Chart from '../components/Chart';
import MetricDataStore from '../stores/MetricDataStore';
import ModelDataStore from '../stores/ModelDataStore';
import ModelStore from '../stores/ModelStore';
import RangeSelectorBarChart from '../lib/Dygraphs/RangeSelectorBarChartPlugin';
import Utils from '../../main/Utils';


/**
 * React Component for sending Model Data from Model component to
 *  Chart component.
 */
@connectToStores([MetricDataStore, ModelDataStore, ModelStore], () => ({}))
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
      modelId: React.PropTypes.string.isRequired
    };
  }

  constructor(props, context) {
    super(props, context);
    this._config = this.context.getConfigClient();

    let muiTheme = this.context.muiTheme;
    let displayPointCount = this._config.get('chart:points');

    this._anomalyBarWidth = Math.round(displayPointCount / 16, 10);
    this._anomalyValueHeight = 1.0;

    this._chartOptions = {
      // dygraphs global chart options
      options: {
        plugins: [RangeSelectorBarChart],
        rangeSelectorPlotFillColor: muiTheme.rawTheme.palette.primary1FadeColor,
        rangeSelectorPlotStrokeColor: muiTheme.rawTheme.palette.primary1Color,
        showRangeSelector: true
      },

      // main value data chart line
      value: {
        labels: ['Time', 'Value'],
        axes: {
          x: {drawGrid: false},
          y: {drawGrid: false}
        },
        series: {
          Value: {
            color: muiTheme.rawTheme.palette.primary2Color,
            showInRangeSelector: true,
            strokeWidth: 2
          }
        }
      },

      // anomaly value chart line
      anomaly: {
        labels: ['Anomaly'],
        axes: {
          y2: {
            axisLabelWidth: 0,
            drawGrid: false,
            valueRange: [0.0, this._anomalyValueHeight]
          }
        },
        series: {
          Anomaly: {
            axis: 'y2',
            plotter: this._anomalyBarChartPlotter.bind(this)
          }
        }
      }
    }; // chartOptions
  } // constructor

  /**
   * DyGraphs custom plotter function to draw Anomaly bar charts
   * @param {Object} event - Dygraph event object reference
   * @requires RGBColor
   */
  _anomalyBarChartPlotter(event) {
    let context = event.drawingContext;
    let points = event.points;
    let yBottom = event.dygraph.toDomYCoord(0);

    points.forEach((point) => {
      let height = yBottom - point.canvasy;
      let xCenter = point.canvasx;
      let xStart = (xCenter - this._anomalyBarWidth / 2);
      let xEnd = (xCenter + this._anomalyBarWidth / 2);
      let startColor = new RGBColor(Utils.mapAnomalyColor(0, yBottom)).toRGB();
      let color, index;

      // every bar has a basic 2px placeholder green line
      this._chartDrawLine(context, xStart, xEnd, yBottom, startColor);
      this._chartDrawLine(context, xStart, xEnd, yBottom-1, startColor);

      // draw vertical bar with several horizontal lines in column
      color = new RGBColor(Utils.mapAnomalyColor(height, yBottom));
      if (color && 'toRGB' in color) {
        // @TODO This was originally for anomaly bars that had color gradients
        //  instead of flat bars. It could probably be optimized to use less
        //  calls to the <canvas> actually .stroke()ing.
        for (index=0; index<height; index++) {
          let y = yBottom - index;
          this._chartDrawLine(context, xStart, xEnd, y, color.toRGB());
        }
      }
    });
  }

  /**
   * DyGraph custom Plotter function to draw a simple horizontal line
   * @param {Object} context - DyGraph object context
   * @param {Number} xStart - Starting X coord of line
   * @param {Number} xEnd - Ending X coord of line
   * @param {Number} y - Y coord of line
   * @param {String|Object} color - Color (string or RGBColor object) for line
   */
  _chartDrawLine(context, xStart, xEnd, y, color) {
    context.strokeStyle = color;
    context.beginPath();
    context.moveTo(xStart, y);
    context.lineTo(xEnd, y);
    context.stroke();
  }

  render() {
    let metricDataStore = this.context.getStore(MetricDataStore);
    let modelDataStore = this.context.getStore(ModelDataStore);
    let modelStore = this.context.getStore(ModelStore);

    let modelId = this.props.modelId;
    let metricData = metricDataStore.getData(modelId);
    let modelData = modelDataStore.getData(modelId);
    let model = modelStore.getModel(modelId);

    let {anomaly, options} = this._chartOptions;
    let {axes, labels, series} = this._chartOptions.value;
    let anomalyIndex = 2;
    let metaData = {model, length: {metric: 0, model: 0}};
    let data = [];

    if (metricData && metricData.length && !model.aggregated) {
      // using metric data
      data = Array.from(metricData);
      metaData.length.metric = metricData.length;
    }
    if (model && modelData.data && modelData.data.length) {
      // using model data
      if (model.aggregated) {
        // use only model data in "aggregated data mode"
        data = Array.from(modelData.data);
      } else {
        // append model data to current metric data for "raw data mode"
        data.forEach((item) => item[anomalyIndex] = Number.NaN);  // init

        // Update values: ts, value, anomaly
        modelData.data.forEach((item, rowid) => {
          if (rowid < data.length) {
            data[rowid][anomalyIndex] = item[anomalyIndex];
          }
        });
      }
      metaData.length.model = modelData.data.length;

      // Format anomaly series
      labels = labels.concat(anomaly.labels);
      Object.assign(axes, anomaly.axes);
      Object.assign(series, anomaly.series);
    }

    Object.assign(options, {axes, labels, series});

    return (
      <Chart data={data} metaData={metaData} options={options} />
    );
  }

}
