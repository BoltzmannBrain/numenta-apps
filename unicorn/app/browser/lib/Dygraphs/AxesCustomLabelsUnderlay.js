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

/* eslint-disable max-statements */

import moment from 'moment';
import RGBColor from 'rgbcolor';

import {formatDisplayValue} from '../browser-utils';


/**
 * DyGraph Custom Chart Underlay: On-chart X and Y Axes Labels and Markers,
 *  via customzing Dygraph's Underlay Callback. Text rendered via
 *  DOM `<canvas>` API.
 * @param {Object} context - ModelData.jsx component context w/settings.
 * @param {Object} canvas - DOM Canvas object to draw with, from Dygraphs.
 * @param {Object} area - Canvas drawing area metadata, Width x Height info etc.
 * @param {Object} dygraph - Instantiated Dygraph library object itself.
 * @requries Dygraphs
 * @see view-source:http://dygraphs.com/tests/underlay-callback.html
 */
export default function (context, canvas, area, dygraph) {
  const muiTheme = context.context.muiTheme.rawTheme;
  const xLabels = 5;
  const yLabels = 4;
  const pad = 10;
  const xFactor = area.w / (xLabels - 1);
  const xAxisRange = dygraph.xAxisRange();
  const xRangeWidth = xAxisRange[1] - xAxisRange[0];
  const yFactor = area.h / (yLabels - 1);
  const yAxisRange = dygraph.yAxisRange();
  const yRangeWidth = yAxisRange[1] - yAxisRange[0];
  let xValues = Array.from(xAxisRange);
  let yValues = Array.from(yAxisRange);


  // --- Custom Y axis and labels (on left) ---

  // prep Y value labels
  for (let y=1; y<(yLabels - 1); y++) {
    let multiplier = y / (yLabels - 1);
    let value = yAxisRange[0] + (yRangeWidth * multiplier);
    yValues.splice(y, 0, value);
  }

  // draw Y axis line
  canvas.beginPath();
  canvas.lineWidth = 2;
  canvas.strokeStyle = new RGBColor(muiTheme.palette.accent3Color).toRGB();
  canvas.moveTo(area.x, area.y);
  canvas.lineTo(area.x, area.y + area.h);  // y axis left
  canvas.stroke();

  // draw left-side Y axis labels
  canvas.font = '12px Roboto';
  canvas.fillStyle = new RGBColor(muiTheme.palette.accent3Color).toRGB();
  for (let y=0; y<yValues.length; y++) {
    let yHeight = area.h - (y * yFactor);
    let value = formatDisplayValue(yValues[y]);

    if (y === yValues.length - 1) {
      yHeight += pad;  // bring down top label to make visible
    } else if (y === 0) {
      yHeight--;  // visual: push bottom label pixel spacing a bit
    } else {
      yHeight += (pad/2);  // visual: slight vertical padding
    }

    canvas.fillText(value, area.x + (pad/2), area.y + yHeight);
  }


  // --- Custom X axis and labels and markers (along top) ---

  // prep X value labels
  for (let x=1; x<(xLabels - 1); x++) {
    let multiplier = x / (xLabels - 1);
    let value = xAxisRange[0] + (xRangeWidth * multiplier);
    xValues.splice(x, 0, value);
  }
  xValues.reverse();  // order time min<->max

  // draw top X axis labels and markers
  canvas.font = '11px Roboto';
  canvas.lineWidth = 1;
  canvas.fillStyle = new RGBColor(muiTheme.palette.disabledColor).toRGB();
  canvas.strokeStyle = new RGBColor(muiTheme.palette.disabledColor).toRGB();
  for (let x=1; x<(xValues.length - 1); x++) {
    let xWidth = area.w - (x * xFactor);
    let when = moment(xValues[x]);
    let date = when.format('ll');
    let time = when.format('LT');

    // draw x axis label
    canvas.fillText(date, area.x + xWidth + (pad/2), area.y + pad);
    canvas.fillText(time, area.x + xWidth + (pad/2), area.y + (pad*2)+3);

    // draw thin x axis label vertical marker line
    canvas.beginPath();
    canvas.moveTo(area.x + xWidth, area.y);
    canvas.lineTo(area.x + xWidth, area.y + area.h);
    canvas.stroke();
  }
}
