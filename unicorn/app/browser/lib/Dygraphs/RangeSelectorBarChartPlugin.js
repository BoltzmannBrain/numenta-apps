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

import RGBColor from 'rgbcolor';

import {
  DATA_FIELD_INDEX, ANOMALY_YELLOW_VALUE
} from '../Constants';
import Dygraph from './DygraphsExtended';
import {mapAnomalyColor} from '../browser-utils';

const {DATA_INDEX_ANOMALY} = DATA_FIELD_INDEX;


/**
 * DyGraph Plugin - RangeSelectorBarChart overlay for HTM Anomalies. Small clone
 *  and repurposing of the stock RangeSelector Dygraph plugin. Full ES6.
 *  Instead of using the Dygraph Chart Series rawData (already used and full),
 *  we send model data to the plugin via customzing the Dygraph options with a
 *  "modelData" key+value.
 * @requries Dygraphs
 * @see github.com/danvk/dygraphs/blob/master/src/plugins/
 * @see github.com/danvk/dygraphs/blob/master/src/plugins/range-selector.js
 */
export default class {

  /**
   * Construct Dygraphs Plugin object
   */
  constructor() {
    this._canvas = null;
    this._canvas_context = null;
    this._canvasRect = null;
    this._dygraph = null;
    this._graphDiv = null;
    this._interfaceCreated = false;
  }

  // --- public Dygraph Plugin API methods ---

  /**
   * Get Dygraphs Plugin info
   * @returns {String} - Plugin text description
   */
  toString() {
    return 'RangeSelector BarChart Plugin';
  }

  /**
   * Activate Dygraphs Plugin
   * @param {Object} dygraph - Dygraph object to plug
   * @returns {Object} - Dygraph Plugin utility hash object
   */
  activate(dygraph) {
    this._dygraph = dygraph;

    if (this._getOption('showRangeSelector')) {
      this._createInterface();
    }

    return {
      predraw: this._renderStaticLayer
    };
  }

  /**
   * Destroy Dygraphs Plugin
   */
  destroy() {
    this._canvas = null;
    this._canvas_context = null;
    this._canvasRect = null;
    this._dygraph = null;
    this._graphDiv = null;
    this._interfaceCreated= null;
  }

  // --- private methods ---

  /**
   * Adds the range selector bar charts to the graph.
   */
  _addToGraph() {
    let graphDiv = this._graphDiv = this._dygraph.graphDiv;
    graphDiv.appendChild(this._canvas);
  }

  /**
   * Creates the background and foreground canvases.
   */
  _createCanvases() {
    this._canvas = Dygraph.createCanvas();
    this._canvas.className = 'dygraph-rangeselbarchart-canvas';
    this._canvas.style.position = 'absolute';
    this._canvas.style.zIndex = 20;
    this._canvas_context = Dygraph.getContext(this._canvas);
  }

  /**
   * Creates the range selector bar chart elements and adds them to the graph.
   */
  _createInterface() {
    this._createCanvases();
    this._interfaceCreated = true;
    this._addToGraph();
  }

  /**
   * Draws a mini bar on the canvas.
   * @param {Object} context - Dygraph drawing context object
   * @param {Number} x - X Coordinate of bar to draw
   * @param {Number} height - Max height of line
   * @param {String} color - String of color to use for bar draw
   * @param {String} stroke - Bar stroke width
   */
  _drawMiniBar(context, x, height, color, stroke) {
    context.beginPath();
    context.moveTo(x, height + 1);
    context.lineTo(x, 2);
    context.closePath();
    this._canvas_context.lineWidth = stroke;
    this._canvas_context.strokeStyle = new RGBColor(color).toRGB();
    context.stroke();
  }

  /**
   * Draws the mini plot on the canvas.
   */
  _drawMiniPlot() {
    let context = this._canvas_context;
    let xExtremes = this._dygraph.xAxisExtremes();
    let xRange = Math.max(xExtremes[1] - xExtremes[0], 1.e-30);
    let margin = 0.5;
    let canvasWidth = this._canvasRect.w - margin;
    let canvasHeight = this._canvasRect.h - margin;
    let xFactor = canvasWidth / xRange;
    let previous = {x: null, value: null};
    let stroke = this._getOption('rangeSelectorPlotLineWidth');
    let data = this._getOption('modelData') || [];
    let barWidth, color, point, value, x;

    if (!data.length) {
      return;  // no data, no draw.
    }

    barWidth = Math.ceil(data.length / canvasWidth);

    for (let i=0; i<data.length; i+=barWidth) {
      let points = data.slice(i, i + barWidth);
      let maxIndex = 0;

      for (let j=0; j<points.length; j++) {
        let current = points[j][DATA_INDEX_ANOMALY];
        let max = points[maxIndex][DATA_INDEX_ANOMALY];
        if (current > max) {
          maxIndex = j;
        }
      }

      point = points[maxIndex]; // aggregate to prevent pixel overwriting
      value = point[DATA_INDEX_ANOMALY];
      x = this._xValueToPixel(point[0], xExtremes[0], xFactor);

      if (x === previous.x && value < previous.value) {
        continue;  // skip unwanted repeated pixel drawing overlay
      }

      previous.x = x;
      previous.value = value;

      if (isFinite(x) && value >= ANOMALY_YELLOW_VALUE) {
        color = mapAnomalyColor(value);
        this._drawMiniBar(context, x, canvasHeight, color, stroke);
      }
    }
  }

  /**
   * Draws the static layer in the background canvas.
   */
  _drawStaticLayer() {
    let context = this._canvas_context;
    context.clearRect(0, 0, this._canvasRect.w, this._canvasRect.h);
    try {
      this._drawMiniPlot();
    } catch (error) {
      console.error(error);  // eslint-disable-line
    }
  }

  /**
   * Helper shortcut to get options from live Dygraphs chart
   * @param {String} name - Name of dygraph option to get
   * @param {String} series - Filter options for a specific series
   * @returns {Number|Object|String} - Resulting Dygrpah option value
   */
  _getOption(name, series) {
    return this._dygraph.getOption(name, series);
  }

  /**
   * Detect if we have valid data input
   * @returns {Boolean} - Flag if actual data was passed in or not
   */
  _hasData() {
    let data = this._getOption('modelData');
    let hasData = false;
    let first = NaN;

    if (data && data.length && data[0][DATA_INDEX_ANOMALY]) {
      first = data[0][DATA_INDEX_ANOMALY];
    }
    hasData = !isNaN(first);
    return hasData;
  }

  /**
   * Removes the range selector bar charts from the graph.
   */
  _removeFromGraph() {
    let graphDiv = this._graphDiv;
    graphDiv.removeChild(this._canvas);
    this._graphDiv = null;
  }

  /**
   * Renders the static portion of the range selector bar charts at predraw.
   * @param {Event} event - Dygraph event fired when time to render our own.
   */
  _renderStaticLayer(event) {
    if (! this._updateVisibility()) {
      return;
    }
    this._resize();
    this._drawStaticLayer();
  }

  /**
   * Resizes the range selector bar charts
   */
  _resize() {
    let plotArea = this._dygraph.layout_.getPlotArea();
    this._canvasRect = {
      x: plotArea.x,
      y: plotArea.y + plotArea.h + 3,
      w: plotArea.w,
      h: this._getOption('rangeSelectorHeight')
    };
    this._setElementRect(this._canvas, this._canvas_context, this._canvasRect);
  }

  /**
   * Resize/Rescale a DOM element via Dygraphs utils and css
   * @param {Object} canvas - Actual canvas to draw to
   * @param {Object} context - Dygraph context object
   * @param {Object} rect - Rectangle to use as canvas
   */
  _setElementRect(canvas, context, rect) {
    let canvasScale = Dygraph.getContextPixelRatio(context);

    canvas.style.top = `${rect.y}px`;
    canvas.style.left = `${rect.x}px`;
    canvas.width = rect.w * canvasScale;
    canvas.height = rect.h * canvasScale;
    canvas.style.width = `${rect.w}px`;
    canvas.style.height = `${rect.h}px`;

    if (canvasScale !== 1) {
      context.scale(canvasScale, canvasScale);
    }
  }

  /**
   * Check to see if the range selector is en/disabled and update visibility.
   * @returns {Boolean} - Flag whether to show or not
   */
  _updateVisibility() {
    let enabled = this._getOption('showRangeSelector');
    let data = this._getOption('modelData');
    let first = (data && data[0] && data[0][DATA_INDEX_ANOMALY])
                  ? data[0][DATA_INDEX_ANOMALY] : NaN;
    let hasData = !isNaN(first);

    if (enabled) {
      if (!this._interfaceCreated) {
        this._createInterface();
      } else if (hasData && (!this._graphDiv || !this._graphDiv.parentNode)) {
        this._addToGraph();
      }
    } else if (this._graphDiv) {
      let dygraph = this._dygraph;
      this._removeFromGraph();
      setTimeout(() => {
        dygraph.width_ = 0;
        dygraph.resize();
      }, 1);
    }
    return enabled;
  }

  /**
   * Convert X value (ts) to X Pixel Coord
   * @param {Number} x - X value to map
   * @param {Number} xMax - Relative X Max value to map against
   * @param {Number} xFactor - Relative X Scaling factor
   * @returns {Number|NaN} - X pixel coordinate
   */
  _xValueToPixel(x, xMax, xFactor) {
    if (x !== null) {
      return Math.round((x - xMax) * xFactor, 10);
    }
    return NaN;
  }

  /**
   * Convert Y value (data value) to Y Pixel Coord
   * @param {Number} y - Y value to map
   * @param {Number} yMin - Relative Y Min value to map against
   * @param {Number} yMax - Relative Y Max value to map against
   * @param {Number} yFactor - Relative Y Scaling factor
   * @returns {Number|NaN} - Y pixel coordinate
   */
  _yValueToPixel(y, yMin, yMax, yFactor) {
    if (y !== null) {
      return Math.round(yMax - ((y - yMin) * yFactor), 10);
    }
    return NaN;
  }

}
