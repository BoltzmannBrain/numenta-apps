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

import {anomalyScale, binarySearch} from '../../../common/common-utils';
import {
  ANOMALY_BAR_WIDTH , DATA_FIELD_INDEX, PROBATION_LENGTH
} from '../Constants';
import {mapAnomalyColor} from '../../lib/browser-utils';

const {
  DATA_INDEX_TIME, DATA_INDEX_ANOMALY
} = DATA_FIELD_INDEX;

// Anomaly bar padding in pixels
const PADDING = 3;

/**
 * Helper function to Draw a rectangle on a DyGraphs canvas.
 * @param {CanvasRenderingContext2D} ctx - Dygraphs Canvas context.
 * @param {Number} xStart - Starting X coordinate of rectangle.
 * @param {Number} yStart - Starting Y coordinate for rectangle.
 * @param {Number} width - Width of rectangle.
 * @param {Number} height - Height of rectangle.
 * @param {String} color - Color to fill in rectangle.
 */
function _drawRectangle(ctx, xStart, yStart, width, height, color) {
  ctx.fillStyle = new RGBColor(color).toRGB();
  ctx.fillRect(xStart, yStart, width, height);
}

/**
 * Compare function used to search row by time
 * @param  {Object}  current Current data recored
 * @param  {integer} key     Timestamp key (UTC miliseconds)
 * @return {integer}         0 for match,
 *                           negative value if current < key,
 *                           positive value if current > key
 * @see  {@link binarySearch}
 */
function _compare(current, key) {
  return current[DATA_INDEX_TIME] - key;
}

/**
 * DyGraph Custom Chart Underlay: AnomalyBarChart Plotter-like callback, for
 *  HTM Model Anomaly Result. Instead of using the Dygraph Chart Series rawData
 *  (which is already used and full), we send model data to the chart via
 *  customzing Dygraph's Underlay Callback. This is a much better simulation
 *  of a y3 axes, instead of a full custom plugin. Model Result data is forced
 *  in via the Dygraph.option with the key "modelData".
 * @param {Object} context - Chart.jsx component context.
 * @param {CanvasRenderingContext2D} canvasCtx - Dygraphs Canvas context.
 * @param {Object} area - Canvas drawing area metadata, Width x Height info etc.
 * @param {Object} dygraph - Instantiated Dygraph library object itself.
 * @requries Dygraphs
 * @see view-source:http://dygraphs.com/tests/underlay-callback.html
 */
export default function (context, canvasCtx, area, dygraph) { // eslint-disable-line max-statements
  let modelData = dygraph.getOption('modelData');
  if (modelData.length < 2) {
    // Not enough data
    return;
  }

  // Divide the x extent into buckets.
  // Each bucket contains zero or more points.
  let timespan = dygraph.xAxisRange();
  let visibleBucketCount = canvasCtx.canvas.offsetWidth / ANOMALY_BAR_WIDTH;
  let timestampBucketWidth =
        (timespan[1] - timespan[0]) / visibleBucketCount;
  let bucketStart0 =
        modelData[0][DATA_INDEX_TIME] - timestampBucketWidth/2;
  let firstVisibleBucket =
        Math.floor((timespan[0] - bucketStart0) / timestampBucketWidth);

  // Walk all of the visible buckets, using a single `iData` index.
  let bucketIndex = firstVisibleBucket;
  let bucketStart = bucketStart0 + (bucketIndex * timestampBucketWidth);

  let iData = binarySearch(modelData, timespan[0], _compare);
  if (iData < 0) {
    iData = ~iData;
  }

  while (bucketStart <= timespan[1]) {
    // Find all results within this bucket.
    let bucketEnd = bucketStart + timestampBucketWidth;

    let matchStart = iData;
    while (matchStart < modelData.length &&
           modelData[matchStart][DATA_INDEX_TIME] < bucketStart) {
      matchStart++;
    }

    let matchEnd = matchStart;
    while (matchEnd < modelData.length &&
           modelData[matchEnd][DATA_INDEX_TIME] < bucketEnd) {
      matchEnd++;
    }

    if (matchStart !== matchEnd) {
      let color, heightPercent;
      if (matchEnd - 1 < PROBATION_LENGTH) {
        // All results in this bucket are in the probationary period.
        color = mapAnomalyColor(null);
        heightPercent = anomalyScale(0);
      } else {
        // Use the highest anomaly score in this bucket.
        let maxAnomaly = 0;
        for (let i = Math.max(matchStart, PROBATION_LENGTH); i < matchEnd;
             i++) {
          maxAnomaly = Math.max(maxAnomaly, modelData[i][DATA_INDEX_ANOMALY]);
        }

        color = mapAnomalyColor(maxAnomaly);
        heightPercent = anomalyScale(maxAnomaly);
      }

      let x = dygraph.toDomXCoord(bucketStart);
      let y = area.h - 1;
      let height = heightPercent * area.h;
      _drawRectangle(canvasCtx, x + PADDING/2, y, ANOMALY_BAR_WIDTH - PADDING,
                     -height, color);
    }

    bucketIndex++;
    bucketStart = bucketStart0 + (bucketIndex * timestampBucketWidth);
    iData = matchEnd;
  }
}
