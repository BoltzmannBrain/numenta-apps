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

import {anomalyScale} from '../../../common/common-utils';
import {DATA_FIELD_INDEX} from '../Constants';
import {mapAnomalyColor} from '../../lib/browser-utils';

const {DATA_INDEX_TIME, DATA_INDEX_ANOMALY} = DATA_FIELD_INDEX;


/**
 * Helper function to Draw a rectangle on a DyGraphs canvas.
 * @param {Object} canvas - Dygraphs Canvas DOM reference.
 * @param {Number} xStart - Starting X coordinate of rectangle.
 * @param {Number} yStart - Starting Y coordinate for rectangle.
 * @param {Number} width - Width of rectangle.
 * @param {Number} height - Height of rectangle.
 * @param {String} color - Color to fill in rectangle.
 */
function _drawRectangle(canvas, xStart, yStart, width, height, color) {
  canvas.fillStyle = new RGBColor(color).toRGB();
  canvas.fillRect(xStart, yStart, width, height);
}


/**
 * DyGraph Custom Chart Underlay: AnomalyBarChart Plotter-like callback, for
 *  HTM Model Anomaly Result. Instead of using the Dygraph Chart Series rawData
 *  (which is already used and full), we send model data to the chart via
 *  customzing Dygraph's Underlay Callback. This is a much better simulation
 *  of a y3 axes, instead of a full custom plugin. Model Result data is forced
 *  in via the Dygraph.option with the key "modelData".
 * @param {Object} context - ModelData.jsx component context w/settings.
 * @param {Object} canvas - DOM Canvas object to draw with, from Dygraphs.
 * @param {Object} area - Canvas drawing area metadata, Width x Height info etc.
 * @param {Object} dygraph - Instantiated Dygraph library object itself.
 * @requries Dygraphs
 * @see view-source:http://dygraphs.com/tests/underlay-callback.html
 */
export default function (context, canvas, area, dygraph) {
  let modelData = dygraph.getOption('modelData') || [];
  let xAxisRange = dygraph.xAxisRange();
  let barWidth = context._anomalyBarWidth;
  let safeColor = context.context.muiTheme.rawTheme.palette.safeColor;
  let height = area.h;
  let halfBarWidth = Math.ceil(barWidth / 2);

  if (!(modelData.length)) {
    return;  // no anomaly data, no draw bars.
  }

  for (let index=0; index<modelData.length; index++) {
    (function (i) {  // help data survive loop closure
      let time = modelData[i][DATA_INDEX_TIME].getTime();
      let color, value, x, y;

      if (time < xAxisRange[0] || time > xAxisRange[1]) {
        return;  // filter out if not inside the current date range
      }

      value = modelData[i][DATA_INDEX_ANOMALY];
      x = Math.round(dygraph.toDomXCoord(time) - halfBarWidth);

      // draw: every point has small green marker "bar" by default
      _drawRectangle(canvas, x, height - 1, barWidth, -2, safeColor);

      if (isFinite(x) && (value >= 0)) {
        // draw: real anomaly bar
        let barHeight = Math.round(anomalyScale(value) * height);
        y = 0 - barHeight;
        color = mapAnomalyColor(value);
        _drawRectangle(canvas, x, height - 1, barWidth, y, color);
      }
    }(index));  // help data survive loop closure
  }  // for loop modelData
}
