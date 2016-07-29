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

import CircularProgress from 'material-ui/lib/circular-progress';
import Paper from 'material-ui/lib/paper';
import React from 'react';
import ReactDOM from 'react-dom';
import d3 from 'd3';
import Dygraph from 'dygraphs';
import moment from 'moment';

import '../lib/Dygraphs/Plugins';

import ChartUpdateViewpoint from '../actions/ChartUpdateViewpoint';
import anomalyBarChartUnderlay from '../lib/Dygraphs/AnomalyBarChartUnderlay';
import axesCustomLabelsUnderlay from '../lib/Dygraphs/AxesCustomLabelsUnderlay';
import RangeSelectorBarChart from '../lib/Dygraphs/RangeSelectorBarChartPlugin';
import {formatDisplayValue, mapAnomalyColor} from '../lib/browser-utils';
import {
  anomalyScale, binarySearch, mapAnomalyText
} from '../../common/common-utils';
import {
  ANOMALY_BAR_WIDTH, DATA_FIELD_INDEX, PROBATION_LENGTH
} from '../lib/Constants';

const {DATA_INDEX_TIME, DATA_INDEX_ANOMALY} = DATA_FIELD_INDEX;

const GRIPPER_WIDTH = 5;
const GRIPPER_WIDTH2 = GRIPPER_WIDTH + 1; // includes stroke

// Match Dygraphs width.
const CHART_W_DIFFERENCE = -5;
const RANGE_SELECTOR_W_DIFFERENCE = -5;
const RANGE_SELECTOR_HEIGHT = 40;

/**
 * Merge two sorted arrays to create a new sorted array.
 * @param {Array} a - sorted array
 * @param {Array} b - sorted array
 * @param {Function} compareFunction - returns a negative number if arg1 < arg2
 * @returns {Array} - new sorted array
 */
function sortedMerge(a, b, compareFunction) {
  if (!a && !b) return [];
  if (!a) return b;
  if (!b) return a;

  let ret = [];
  let j = 0;

  for (let i = 0; i < a.length; i++) {
    for (; j < b.length && compareFunction(b[j], a[i]) < 0; j++) {
      ret.push(b[j]);
    }
    ret.push(a[i]);
  }

  for (; j < b.length; j++) {
    ret.push(b[j]);
  }

  return ret;
}

/**
 * Equivalent to calling
 *   g.updateOptions({dateWindow, valueRange})
 * but much faster.
 *
 * @param {Object} g - a Dygraph instance
 * @param {Array} dateWindow - x domain: pair of JavaScript time numbers
 * @param {Array} valueRange - y domain: pair of numbers
 */
function rescaleChart(g, dateWindow, valueRange) {
  if (dateWindow) {
    g.dateWindow_[0] = dateWindow[0];
    g.dateWindow_[1] = dateWindow[1];
  }

  if (valueRange) {
    g.axes_[0].valueRange = valueRange;
    g.axes_[0].computedValueRange = valueRange;
    g.axes_[0].extremeRange = valueRange.map((v) => v - valueRange[0]);
  }

  g.drawGraph_();
}

/**
 * Chart Widget. Wraps as a React Component.
 * @see http://dygraphs.com/
 */
export default class Chart extends React.Component {

  static get contextTypes() {
    return {
      executeAction: React.PropTypes.func,
      getConfigClient: React.PropTypes.func,
      muiTheme: React.PropTypes.object
    };
  }

  static get propTypes() {
    return {
      values: React.PropTypes.array,
      values2: React.PropTypes.array,
      model: React.PropTypes.object,
      modelData: React.PropTypes.array,
      zDepth: React.PropTypes.number
    };
  }

  static get defaultProps() {
    return {
      zDepth: 1
    };
  }

  constructor(props, context) {
    super(props, context);
    this._config = this.context.getConfigClient();

    this._xScale = d3.scale.linear();
    this._xScaleMini = d3.scale.linear();

    this._showAll = false;
    this._guardResolution = false;
    this._jumpToNewResults = true;

    this._xHover = null;
    this._xDragPrevious = null;

    // Dygraphs chart container
    this._dygraph = null;
    this._chartRange = [null, null];
    this._previousDataSize = 0;

    this._brush = d3.svg.brush()
      .on('brushstart', () => this._onBrushStart())
      .on('brush', () => this._onBrush())
      .on('brushend', () => this._onBrushEnd());
    this._mouseDownOnBackground = false;
    this._cancelledExtent = null;
    this._brushExtentChanged = false;

    // dynamic styles
    let muiTheme = this.context.muiTheme;
    this._styles = {
      root: {
        boxShadow: 'none',
        height: muiTheme.rawTheme.spacing.desktopKeylineIncrement * 2.75,
        marginTop: '1.5rem',
        width: '100%',
        position: 'relative'
      }
    };

    let rangeSelectorTop = this._styles.root.height - RANGE_SELECTOR_HEIGHT;
    let chartHeight = rangeSelectorTop - 3;
    this._yScale = d3.scale.linear()
      .range([chartHeight, 0]);
  }

  _getMinTimespan() {
    let element = ReactDOM.findDOMNode(this.refs['chart']);
    return this._minDelta * element.offsetWidth / ANOMALY_BAR_WIDTH;
  }

  _getEndDateWindow() {
    let timespan = this._guardResolution
          ? this._xScale.domain()[1] - this._xScale.domain()[0]
          : this._getMinTimespan();

    let bottom = this._data[0][DATA_INDEX_TIME];
    let top = this._data[this._data.length - 1][DATA_INDEX_TIME];
    let extent = [Math.max(bottom, (top - timespan)), top];
    let discrepancy = timespan - (extent[1] - extent[0]);
    if (discrepancy > 0) {
      extent[1] += discrepancy;
    }

    return extent;
  }

  _describeZoomLevel(zoomLevel) {
    if (zoomLevel === 1) {
      return this._config.get('chart:zoom:all');
    }

    let timespan = (zoomLevel === 0)
          ? this._getMinTimespan()
          : zoomLevel * (this._data[this._data.length - 1][DATA_INDEX_TIME] -
                         this._data[0][DATA_INDEX_TIME]);

    return moment.duration(timespan).humanize();
  }

  _onWindowResize() {
    // Note: the Dygraph chart will resize itself on window resize. There's no
    // way to resize a Dygraph chart via API, so we have to rely on its window
    // resize handler. Meanwhile, here we draw the chart with its new domain.
    // So there are two chart renders on each window resize, one with a
    // maybe-wrong domain.

    let element = ReactDOM.findDOMNode(this.refs['chart']);

    d3.select(element).select('svg.rangeSelectorOverlay')
      .attr('width', (element.offsetWidth +
                      RANGE_SELECTOR_W_DIFFERENCE +
                      GRIPPER_WIDTH2*2));

    let chartWidth = element.offsetWidth + CHART_W_DIFFERENCE;

    d3.select(element).select('svg.chartOverlay')
      .attr('width', chartWidth)
      .select('rect')
      .attr('width', chartWidth);

    if (!this._showAll) {
      let min = this._data[0][DATA_INDEX_TIME];
      let max = this._data[this._data.length - 1][DATA_INDEX_TIME];

      let bottom = this._xScale.invert(0);
      let top = this._xScale.invert(chartWidth);

      let aboveMax = top - max;
      if (aboveMax > 0) {
        bottom -= aboveMax;
        top -= aboveMax;
      }

      let belowMin = min - bottom;
      if (belowMin > 0) {
        bottom += belowMin;
        top = Math.min(max, top + belowMin);
      }

      this._xScale.domain([bottom, top]);
    }

    this._xScale
      .range([0, chartWidth]);

    this._xScaleMini
      .range([0, element.offsetWidth + RANGE_SELECTOR_W_DIFFERENCE]);
    this._paintBrush();
    this._paintZoomText();
    this._rescaleChart();
  }

  _yScaleUpdate() {
    let paddingPx = 3;
    let height = this._styles.root.height - RANGE_SELECTOR_HEIGHT - 3;
    let range = [height - paddingPx, paddingPx];

    let xExtentVisible = this._xScale.domain();
    let yExtentVisible = [Infinity, -Infinity];

    // Find the start point.
    let i = binarySearch(this._data, xExtentVisible[DATA_INDEX_TIME],
                         (item, k) => {
                           return item[DATA_INDEX_TIME] - k;
                         });
    if (i < 0) {
      i = ~i;
    }

    for (; i < this._data.length; i++) {
      let t = this._data[i][0];

      // Find the end point.
      if (t > xExtentVisible[1]) break;

      let v1 = this._data[i][1];
      let v2 = this._data[i][2];

      if (v1 || v1 === 0) {
        yExtentVisible[0] = Math.min(yExtentVisible[0], v1);
        yExtentVisible[1] = Math.max(yExtentVisible[1], v1);
      } else if (v2 || v2 === 0) {
        yExtentVisible[0] = Math.min(yExtentVisible[0], v2);
        yExtentVisible[1] = Math.max(yExtentVisible[1], v2);
      }
    }

    if (yExtentVisible[0] === yExtentVisible[1]) {
      // The y scale needs to have a min that's not equal to the max.
      if (yExtentVisible[0] === 0) {
        yExtentVisible[1] = 1;
      } else {
        yExtentVisible[0] *= 0.9;
        yExtentVisible[1] *= 1.1;
      }
    }

    if (this.props.modelData.length > 0) {
      // Add space for green anomaly bars.
      range[0] -= anomalyScale(0) * height;
    }

    // Use d3's 'nice' so that small changes in the domain don't cause
    // the scale to change.
    let yScaleIntermediate = d3.scale.linear()
          .domain(yExtentVisible)
          .range(range)
          .nice();

    this._yScale
      .domain([yScaleIntermediate.invert(this._yScale.range()[0]),
               yScaleIntermediate.invert(this._yScale.range()[1])]);
  }

  _rescaleChart() {
    this._yScaleUpdate();
    rescaleChart(this._dygraph, this._xScale.domain(), this._yScale.domain());
    this._paintChartHover();
  }

  _paintZoomText() {
    if (this._data.length < 1) return;

    let chartNode = ReactDOM.findDOMNode(this.refs['chart']);
    let muiTheme = this.context.muiTheme;
    let start = this._data[0][DATA_INDEX_TIME];
    let end = this._data[this._data.length-1][DATA_INDEX_TIME];

    if (this.props.model.active) {
      // Don't show the links if the model is active.
      d3.select(chartNode).select('.zoomLinks')
        .style('visibility', 'hidden');
      return;
    }

    let that = this;
    d3.select(chartNode).select('.zoomLinks')
      .style('visibility', null)
      .selectAll('.zoomLink')
      .data([0, 0.25, 1])
      .call((zoomLink) => {
        zoomLink.enter()
          .append('div')
          .attr('class', 'zoomLink')
          .style('padding-right', '0.5rem')
          .style('display', 'inline-block');

        zoomLink.exit()
          .remove();
      })
      .style('text-decoration', 'underline')
      .style('color', muiTheme.rawTheme.palette.primary1Color)
      .style('cursor', 'pointer')
      .each(function (zoomLevel) {
        // Don't use an arrow function. We need the `this` that d3 gives us.

        let timespan = that._xScale.domain()[1] - that._xScale.domain()[0];
        let minTimespan = that._getMinTimespan();

        // Floating point math can interfere.
        let isMinTimespan = Math.abs(timespan - minTimespan) < 0.1;
        let currentZoom = isMinTimespan ? 0 : timespan / (end - start);
        let isCurrentZoom = Math.abs(currentZoom - zoomLevel) < 0.000001;

        d3.select(this) // eslint-disable-line no-invalid-this
          .on('click', isCurrentZoom ? null : () => {
            let targetTimespan = (zoomLevel > 0)
                  ? (end - start) * zoomLevel
                  : minTimespan;

            let midpoint = that._xScale.invert(chartNode.offsetWidth / 2);
            let dateWindow = [Math.max(start, midpoint - targetTimespan/2),
                              Math.min(end, midpoint + targetTimespan/2)];
            let discrepancy = targetTimespan - (dateWindow[1] - dateWindow[0]);
            if (discrepancy > 0) {
              dateWindow[0] = Math.max(start, dateWindow[0] - discrepancy);
              discrepancy = targetTimespan - (dateWindow[1] - dateWindow[0]);
              if (discrepancy > 0) {
                dateWindow[1] += discrepancy;
              }
            }

            that._xScale.domain(dateWindow);
            that._onUserSpecifiedScale();
            that._paintBrush();
            that._paintZoomText();
            that._rescaleChart();
          })
          .style('text-decoration', isCurrentZoom ? 'none' : 'underline')
          .style('color', isCurrentZoom
                 ? muiTheme.rawTheme.palette.textColor
                 : muiTheme.rawTheme.palette.primary1Color);
      })
      .text((zoomLevel) => {
        return this._describeZoomLevel(zoomLevel);
      });
  }

  _paintBrush() {
    if (this._data.length === 0) return;

    let chartNode = ReactDOM.findDOMNode(this.refs['chart']);

    this._xScaleMini
      .domain([this._data[0][DATA_INDEX_TIME],
               this._data[this._data.length-1][DATA_INDEX_TIME]]);

    let extent = this._xScale.domain();
    this._brush
      .x(this._xScaleMini)
      .extent(extent);

    let brushNode = d3.select(chartNode).select('g.brush');
    brushNode.call(this._brush);

    this._paintBrushExtras(brushNode);
  }

  _paintBrushExtras(brushNode) {
    if (!brushNode) {
      let chartNode = ReactDOM.findDOMNode(this.refs['chart']);
      brushNode = d3.select(chartNode).select('g.brush');
    }

    let extent = this._xScale.domain();
    let top = this._data[this._data.length-1][DATA_INDEX_TIME];

    brushNode.select('.left.shade')
      .attr('width', this._xScaleMini(extent[0]));

    brushNode.select('.right.shade')
      .attr('x', this._xScaleMini(extent[1]))
      .attr('width', this._xScaleMini(top) - this._xScaleMini(extent[1]));
  }

  _onBrushStart() {
    // Set the cursor.
    //
    // This would be better with CSS, but Chromium doesn't invalidate the cursor
    // until mouse-move, so the grab cursor doesn't immediately become a
    // grabbing cursor on mousedown. To force Chrome to notice the cursor, put
    // an entire div below the cursor.
    let chartNode = ReactDOM.findDOMNode(this.refs['chart']);
    let rangeSelectorTop = this._styles.root.height - RANGE_SELECTOR_HEIGHT;
    let cursorDiv = d3.select(chartNode).append('div')
          .attr('class', 'forceChromiumCursorChange')
          .style('width', `${chartNode.offsetWidth}px`)
          .style('height', `${RANGE_SELECTOR_HEIGHT}px`)
          .style('position', 'absolute')
          .style('left', `${chartNode.offsetLeft}px`)
          .style('top', `${rangeSelectorTop}px`)
          .style('z-index', 50);

    let classes = d3.event.sourceEvent.target.classList;
    if (classes.contains('extent')) {
      cursorDiv.style('cursor', '-webkit-grabbing');
      d3.select(document.body).style('cursor', '-webkit-grabbing');
    } else if (classes.contains('background')) {
      this._mouseDownOnBackground = true;
      cursorDiv.style('cursor', 'crosshair');
      d3.select(document.body).style('cursor', 'crosshair');
    }

    this._brushExtentChanged = false;
  }

  _onBrush() {
    let extent = this._brush.extent();

    let minTimespan = this._getMinTimespan();
    if (extent[1] - extent[0] < minTimespan) {
      this._cancelledBrushExtent = [extent[0], extent[1]];

      let movingLeftEdge = extent[1] === this._xScale.domain()[1];
      let movingRightEdge = extent[0] === this._xScale.domain()[0];
      if (movingLeftEdge || movingRightEdge) {
        // It's a previously valid extent that's been resized below the minimum.
        // Put it precisely at the minimum.
        if (movingLeftEdge) {
          extent[0] = extent[1] - minTimespan;
        } else {
          extent[1] = extent[0] + minTimespan;
        }

        this._xScale.domain(extent);
        this._onUserSpecifiedScale();
        this._brush.extent(extent);
        this._brushExtentChanged = true;
        this._rescaleChart();
        this._paintZoomText();
        this._paintBrush();
      } else {
        // It's a totally new extent and it's below the miminum timespan.
        // Revert it.
        extent = this._xScale.domain();
        this._brush.extent(extent);
        this._paintBrush();
      }
    } else {
      this._xScale.domain(extent);
      this._onUserSpecifiedScale();
      this._rescaleChart();
      this._brushExtentChanged = true;
      this._cancelledBrushExtent = null;
      this._paintZoomText();
      this._paintBrushExtras();
    }
  }

  _onBrushEnd() {
    let chartNode = ReactDOM.findDOMNode(this.refs['chart']);

    if (this._mouseDownOnBackground && !this._brushExtentChanged) {
      // If a sufficient range wasn't brushed, treat it as a click.
      // Center the brush on the click point.
      let min = this._data[0][DATA_INDEX_TIME];
      let max = this._data[this._data.length-1][DATA_INDEX_TIME];

      if (!this._cancelledBrushExtent) {
        throw new Error(
          `Internal error: cancelledExtent ${this._cancelledBrushExtent}`
        );
      }
      let extent = [this._cancelledBrushExtent[0],
                    this._cancelledBrushExtent[1]];

      let brushWidth = this._xScale.domain()[1] - this._xScale.domain()[0];

      extent[0] = Math.max(min, extent[0] - brushWidth/2);
      extent[1] = Math.min(max, extent[1] + brushWidth/2);
      let discrepancy = brushWidth - (extent[1] - extent[0]);
      if (discrepancy > 0) {
        extent[1] = Math.min(max, extent[1] + discrepancy);
        discrepancy = brushWidth - (extent[1] - extent[0]);
        if (discrepancy > 0) {
          extent[0] = Math.max(min, extent[0] - discrepancy);
        }
      }

      this._xScale.domain(extent);
      this._onUserSpecifiedScale();
      this._paintBrush();
      this._paintZoomText();
      this._rescaleChart();
      this._cancelledBrushExtent = null;
    }

    d3.select(chartNode).select('.forceChromiumCursorChange')
      .remove();

    d3.select(document.body).style('cursor', null);

    this._mouseDownOnBackground = false;
  }

  _onUserSpecifiedScale() {
    this.context.executeAction(ChartUpdateViewpoint, {
      metricId: this.props.model.modelId,
      dateWindow: this._xScale.domain()
    });

    // These options all deal with how to change the scale as new data arrives.
    // Don't change the options until data is arriving.
    if (this.props.modelData.length > 0) {
      let extent = this._xScale.domain();
      let bottom = this._data[0][DATA_INDEX_TIME];
      let top = this._data[this._data.length-1][DATA_INDEX_TIME];
      let minTimespan = this._getMinTimespan();

      this._jumpToNewResults = (extent[1] === top);
      this._showAll = (extent[0] === bottom && extent[1] === top);
      this._guardResolution = (extent[1] - extent[0] !== minTimespan);
    }
  }

  _chartHoverPaintText(item) { // eslint-disable-line
    let chartNode = ReactDOM.findDOMNode(this.refs['chart']);
    let legend = d3.select(chartNode).select('.legend');
    legend.html('');

    if (!item) return;

    let muiTheme = this.context.muiTheme;
    let color, secondary, value;
    if (item[1] || item[1] === 0) {
      value = item[1];
      secondary = false;
      color = muiTheme.rawTheme.palette.primary2Color;
    } else if (item[2] || item[2] === 0) {
      value = item[2];
      secondary = true;
      color = muiTheme.rawTheme.palette.primary1Color;
    } else {
      throw new Error(`Invalid item at ${item[DATA_INDEX_TIME]}`);
    }

    let m = moment.utc(item[DATA_INDEX_TIME]);
    legend.append('span')
      .text(m.format('ddd, MMM D YYYY, h:mm a'));

    let keyvalue = legend.append('span')
          .style('padding-left', '1rem')
          .style('color', color);

    keyvalue.append('span')
      .style('font-weight', 'bold')
      .text((secondary || !this.props.model.aggregated)
            ? `${this.props.metric.name}: `
            : `Aggregated ${this.props.metric.name}: `);

    keyvalue.append('span')
      .text(formatDisplayValue(value));

    let modelData = this.props.modelData;
    if (modelData.length > 0) {
      // Find anomaly closest to the time
      let anomalyIdx = binarySearch(modelData, item[DATA_INDEX_TIME],
                                    (current, key) => {
                                      return current[DATA_INDEX_TIME] - key;
                                    });

      let anomalyIdxFinal, anomalyValue;
      if (anomalyIdx >= 0) {
        // Found exact value
        anomalyIdxFinal = anomalyIdx;
        anomalyValue = modelData[anomalyIdx][DATA_INDEX_ANOMALY];
      } else {
        // Get max value from neighboring points
        let first = ~anomalyIdx;
        let second = first + 1;
        if (second >= modelData.length - 1) {
          second = modelData.length - 1;
        }

        if (modelData[first][DATA_INDEX_ANOMALY] >
            modelData[second][DATA_INDEX_ANOMALY]) {
          anomalyIdxFinal = first;
          anomalyValue = modelData[first][DATA_INDEX_ANOMALY];
        } else {
          anomalyIdxFinal = second;
          anomalyValue = modelData[second][DATA_INDEX_ANOMALY];
        }
      }

      if (anomalyIdxFinal < PROBATION_LENGTH) {
        anomalyValue = null;
      }

      let anomaly = legend.append('span')
            .style('padding-left', '1rem')
            .style('color', mapAnomalyColor(anomalyValue));

      anomaly.append('span')
        .style('font-weight', 'bold')
        .text('Anomaly: ');

      anomaly.append('span')
        .text(mapAnomalyText(anomalyValue));
    }
  }

  _paintChartHover() { // eslint-disable-line max-statements, complexity
    let chartNode = ReactDOM.findDOMNode(this.refs['chart']);

    let hoveredItem;
    if (this._xHover !== null) {
      let time = this._xScale.invert(this._xHover);

      let index = this._data.findIndex((item) => time <= item[DATA_INDEX_TIME]);
      if (index === -1) {
        index = this._data.length;
      }

      // Make sure to skip gap NaN values.
      let minDistance = Infinity;
      let nearest = null;
      for (let i = index; i < this._data.length; i++) {
        if (this._data[i][1] || this._data[i][1] === 0 ||
            this._data[i][2] || this._data[i][2] === 0) {
          let distance = this._data[i][DATA_INDEX_TIME] - time;
          if (distance < minDistance) {
            minDistance = distance;
            nearest = i;
          }
          break;
        }
      }
      for (let i = index - 1; i >= 0; i--) {
        if (this._data[i][1] || this._data[i][1] === 0 ||
            this._data[i][2] || this._data[i][2] === 0) {
          let distance = time - this._data[i][DATA_INDEX_TIME];
          if (distance < minDistance) {
            minDistance = distance;
            nearest = i;
          }
          break;
        }
      }

      if (nearest !== null) {
        hoveredItem = this._data[nearest];

        let muiTheme = this.context.muiTheme;
        let color, value;
        if (hoveredItem[1] || hoveredItem[1] === 0) {
          value = hoveredItem[1];
          color = muiTheme.rawTheme.palette.primary2Color;
        } else {
          value = hoveredItem[2];
          color = muiTheme.rawTheme.palette.primary1Color;
        }

        d3.select(chartNode).select('svg.chartOverlay .hoverDot')
          .attr('fill', color)
          .attr('cx', this._xScale(this._data[nearest][DATA_INDEX_TIME]))
          .attr('cy', this._yScale(value));
      }
    }

    this._chartHoverPaintText(hoveredItem);

    if (!hoveredItem) {
      d3.select(chartNode).select('svg.chartOverlay .hoverDot')
        .attr('cx', -50)
        .attr('cy', -50);
    }
  }

  _onMouseMove() {
    let chartNode = ReactDOM.findDOMNode(this.refs['chart']);
    this._xHover =
      d3.mouse(d3.select(chartNode).select('rect.chartInteraction').node())[0];
    this._paintChartHover();
  }

  _onMouseOut() {
    this._xHover = null;
    this._paintChartHover();
  }

  _onChartDragStart() {
    this._xDragPrevious = d3.event.sourceEvent.clientX;
  }

  _onChartDrag() {
    // `d3.event.x` isn't set for 'ondragstart', so use clientX.
    let timeDelta = (this._xScale.invert(this._xDragPrevious) -
                     this._xScale.invert(d3.event.sourceEvent.clientX));

    let dateWindow = this._xScale.domain();
    let timespan = dateWindow[1] - dateWindow[0];
    let bottom = this._data[0][DATA_INDEX_TIME];
    let top = this._data[this._data.length - 1][DATA_INDEX_TIME];

    dateWindow = [
      Math.max(bottom, dateWindow[0] + timeDelta),
      Math.min(top, dateWindow[1] + timeDelta)
    ];

    let discrepancy = timespan - (dateWindow[1] - dateWindow[0]);
    if (discrepancy > 0) {
      dateWindow[0] = Math.max(bottom, dateWindow[0] - discrepancy);

      discrepancy = timespan - (dateWindow[1] - dateWindow[0]);
      if (discrepancy > 0) {
        dateWindow[1] = Math.min(top, dateWindow[1] + discrepancy);
      }
    }

    this._xScale.domain(dateWindow);
    this._onUserSpecifiedScale();
    this._paintBrush();
    this._rescaleChart();

    this._xDragPrevious = d3.event.sourceEvent.clientX;
  }

  _onChartDragEnd() {
    this._xDragPrevious = null;
  }

  componentDidMount() { // eslint-disable-line max-statements
    let {metric} = this.props;
    let element = ReactDOM.findDOMNode(this.refs['chart']);

    this._onWindowResizeWrapper = this._onWindowResize.bind(this);
    window.addEventListener('resize', this._onWindowResizeWrapper);

    if (this.props.modelData.length > 0 && !this.props.model.active) {
      // This model already ran, but updates might still happen via
      // the aggregated / non-aggregated checkbox.
      this._jumpToNewResults = false;
    }

    let dateWindow;
    if (this.props.model.active) {
      dateWindow = this._getEndDateWindow();
    } else if (metric.dateWindow) {
      dateWindow = metric.dateWindow;

      let minTimespan = this._getMinTimespan();
      let discrepancy = minTimespan - (dateWindow[1] - dateWindow[0]);
      if (discrepancy > 0) {
        let bottom = this._data[0][DATA_INDEX_TIME];
        dateWindow[0] = Math.max(bottom, dateWindow[0] - discrepancy);
        if (discrepancy > 0) {
          dateWindow[1] += discrepancy;
        }
      }
    } else {
      dateWindow = [this._data[0][DATA_INDEX_TIME],
                    this._data[0][DATA_INDEX_TIME] + this._getMinTimespan()];
    }

    this._xScale
      .domain(dateWindow)
      .range([0, element.offsetWidth + CHART_W_DIFFERENCE]);
    this._yScaleUpdate();

    let muiTheme = this.context.muiTheme;
    let options = {
      labelsUTC: true,
      dateWindow: [this._xScale.domain()[0], this._xScale.domain()[1]],
      valueRange: this._yScale.domain(),
      axisLineColor: muiTheme.rawTheme.palette.accent4Color,
      connectSeparatedPoints: true,  // required for raw+agg overlay
      highlightCircleSize: 3, // also configures the 'point between gaps' size
      drawHighlightPointCallback: () => {}, // disable highlight points
      interactionModel: {}, // we handle all of the interaction
      showLabelsOnHighlight: false,
      labelsDiv: document.createElement('div'), // put its labels into the abyss
      plugins: [RangeSelectorBarChart],
      rangeSelectorHeight: RANGE_SELECTOR_HEIGHT,
      rangeSelectorPlotFillColor: muiTheme.rawTheme.palette.primary1FadeColor,
      rangeSelectorPlotStrokeColor: muiTheme.rawTheme.palette.primary1Color,
      showRangeSelector: true,
      underlayCallback: function (context, ...args) {
        axesCustomLabelsUnderlay(context, ...args);
        anomalyBarChartUnderlay(context, ...args);
      }.bind(null, this),
      xRangePad: 0,
      yRangePad: 0,
      axes: {
        x: {
          axisLabelOverflow: false,
          axisLabelWidth: 0,
          drawAxis: false,
          drawGrid: false
        },
        y: {
          axisLabelOverflow: false,
          axisLabelWidth: 0,
          drawAxis: false,
          drawGrid: false
        }
      },
      labels: ['Time', 'Value', 'NonAggregated'],
      series: {
        Value: {
          axis: 'y',
          color: muiTheme.rawTheme.palette.primary2Color,  // dark blue
          independentTicks: false,
          showInRangeSelector: true,  // plot alone in range selector
          strokeWidth: 2
        },
        NonAggregated: {
          axis: 'y',
          color: muiTheme.rawTheme.palette.primary1Color,  // light blue
          independentTicks: false,
          showInRangeSelector: false,
          strokeWidth: 2
        }
      },

      // Custom options
      modelData: this.props.modelData
    };

    this._dygraph = new Dygraph(element, this._data, options);

    d3.select(element).append('div')
      .attr('class', 'legend')
      .style('position', 'absolute')
      .style('height', '1rem')
      .style('font-size', '12px')
      .style('top', '-23px');

    d3.select(element).append('div')
      .attr('class', 'zoomLinks')
      .style('position', 'absolute')
      .style('height', '1rem')
      .style('font-size', '12px')
      .style('top', '-23px')
      .style('right', 0)
      .append('span')
      .style('color', muiTheme.rawTheme.palette.accent3Color)
      .style('padding-right', '1rem')
      .style('font-weight', 'bold')
      .text('Zoom:');

    let chartNode = element.getElementsByTagName('canvas')[0];

    let rangeSelectorTop = this._styles.root.height - RANGE_SELECTOR_HEIGHT;
    let chartHeight = rangeSelectorTop - 3;

    let chartOverlay = d3.select(element).append('svg')
          .attr('class', 'chartOverlay')
          .attr('width', chartNode.offsetWidth + CHART_W_DIFFERENCE)
          .attr('height', chartHeight)
          .style('position', 'absolute')
          .style('left', `${chartNode.offsetLeft}px`)
          .style('top', `${chartNode.offsetTop}px`)
          .style('z-index', 40);

    chartOverlay.append('circle')
      .attr('class', 'hoverDot')
      .attr('stroke', 'none')
      .attr('r', 3)
      .attr('cx', -50)
      .attr('cy', -50);

    chartOverlay.append('rect')
      .attr('class', 'chartInteraction')
      .attr('fill', 'transparent')
      .attr('stroke', 'none')
      .attr('width', chartNode.offsetWidth + CHART_W_DIFFERENCE)
      .attr('height', chartHeight)
      .style('cursor', 'default')
      .on('mousemove', () => this._onMouseMove())
      .on('mouseout', () => this._onMouseOut())
      .call(d3.behavior.drag()
            .on('dragstart', () => this._onChartDragStart())
            .on('drag', () => this._onChartDrag())
            .on('dragend', () => this._onChartDragEnd()));

    let rangeSelectorOverlay = d3.select(element).append('svg')
          .attr('class', 'rangeSelectorOverlay')
          .attr('width', chartNode.offsetWidth + GRIPPER_WIDTH2*2)
          .attr('height', RANGE_SELECTOR_HEIGHT)
          .style('position', 'absolute')
          .style('left', `${chartNode.offsetLeft - GRIPPER_WIDTH2}px`)
          .style('top', `${rangeSelectorTop}px`)
          .style('z-index', 40)
          .append('g')
          .attr('transform', `translate(${GRIPPER_WIDTH2}, 0)`);

    rangeSelectorOverlay.append('rect')
      .attr('fill', 'transparent')
      .attr('stroke', 'none')
      .attr('width', chartNode.offsetWidth + RANGE_SELECTOR_W_DIFFERENCE)
      .attr('height', RANGE_SELECTOR_HEIGHT);

    this._xScaleMini
      .domain([this._data[0][DATA_INDEX_TIME],
               this._data[this._data.length-1][DATA_INDEX_TIME]])
      .range([0, chartNode.offsetWidth + RANGE_SELECTOR_W_DIFFERENCE]);

    let brushNode = rangeSelectorOverlay
          .append('g')
          .attr('class', 'x brush');

    brushNode.append('rect')
      .attr('class', 'left shade')
      .attr('height', RANGE_SELECTOR_HEIGHT)
      .attr('stroke', 'none')
      .attr('fill', 'black')
      .attr('fill-opacity', 0.125);

    brushNode.append('rect')
      .attr('class', 'right shade')
      .attr('height', RANGE_SELECTOR_HEIGHT)
      .attr('stroke', 'none')
      .attr('fill', 'black')
      .attr('fill-opacity', 0.125);

    // Inject the brush's rectangles now so that we can do a one-time resize.
    brushNode.call(this._brush);

    brushNode
      .select('.extent')
      .attr('y', 0.5)
      .attr('height', RANGE_SELECTOR_HEIGHT - 1)
      .attr('stroke', 'black')
      .attr('fill', 'transparent')
      .style('cursor', null); // use css

    brushNode
      .select('.background')
      .attr('height', RANGE_SELECTOR_HEIGHT)
      .style('cursor', null); // use css

    let gripperHeight = 16;
    let rangeSelectorY = RANGE_SELECTOR_HEIGHT/2 - gripperHeight/2;
    brushNode
      .selectAll('.resize')
      .style('cursor', null) // use css
      .select('rect')
      .attr('y', rangeSelectorY)
      .attr('height', gripperHeight)
      .attr('width', GRIPPER_WIDTH)
      .attr('fill', 'black')
      .style('visibility', null);

    brushNode
      .select('.resize.w rect')
      .attr('x', -GRIPPER_WIDTH)
      .attr('fill', 'white')
      .attr('stroke', 'black')
      .attr('stroke-width', 1);

    brushNode
      .select('.resize.e rect')
      .attr('x', 0)
      .attr('fill', 'white')
      .attr('stroke', 'black')
      .attr('stroke-width', 1);

    brushNode
      .select('.resize.w')
      .append('line')
      .attr('stroke', 'black')
      .attr('stroke-width', 1)
      .attr('stroke-linecap', 'butt')
      .attr('x1', -GRIPPER_WIDTH/2)
      .attr('y1', rangeSelectorY + 2)
      .attr('x2', -GRIPPER_WIDTH/2)
      .attr('y2', rangeSelectorY +  gripperHeight - 2);

    brushNode
      .select('.resize.e')
      .append('line')
      .attr('stroke', 'black')
      .attr('stroke-width', 1)
      .attr('stroke-linecap', 'butt')
      .attr('x1', GRIPPER_WIDTH/2)
      .attr('y1', rangeSelectorY + 2)
      .attr('x2', GRIPPER_WIDTH/2)
      .attr('y2', rangeSelectorY +  gripperHeight - 2);

    this._paintBrush();
    this._paintZoomText();
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this._onWindowResizeWrapper);
  }

  componentDidUpdate() {
    if (this._data.length > 0) {
      let bottom = this._data[0][DATA_INDEX_TIME];
      let top = this._data[this._data.length - 1][DATA_INDEX_TIME];
      if (this._showAll) {
        this._xScale.domain([bottom, top]);
      } else if (this._jumpToNewResults && this.props.modelData.length > 0) {
        let dateWindow = this._getEndDateWindow();
        this._xScale.domain(dateWindow);
      }

      this._yScaleUpdate();

      let options = {
        dateWindow: this._xScale.domain(),
        valueRange: this._yScale.domain(),
        file: this._data,
        modelData: this.props.modelData
      };

      this._dygraph.updateOptions(options);
    }

    this._paintZoomText();
    this._paintBrush();
    this._paintChartHover();
  }

  _computeState(props) {
    let {values, values2} = props;

    if (values.length < 1) return;

    let adjustedValues2;
    if (this.props.model.active) {
      // Since we receive all nonaggregated values immediately, only display the
      // ones before the last model result.
      let top = values[values.length-1][DATA_INDEX_TIME];
      let i = 0;
      while (i < values2.length && values2[i][DATA_INDEX_TIME] < top) {
        i++;
      }

      adjustedValues2 = values2.slice(0, i);
    } else {
      adjustedValues2 = values2;
    }

    this._minDelta = null;
    for (let i = 1; i < values.length; i++) {
      let delta = values[i][0] - values[i-1][0];
      if (delta > 0 && (this._minDelta === null ||
                        delta < this._minDelta)) {
        this._minDelta = delta;
      }
    }

    this._valueExtent = [Infinity, -Infinity];
    values.forEach((v) => {
      if (isNaN(v[1])) return;
      this._valueExtent[0] = Math.min(this._valueExtent[0], v[1]);
      this._valueExtent[1] = Math.max(this._valueExtent[1], v[1]);
    });
    adjustedValues2.forEach((v) => {
      if (isNaN(v[1])) return;
      this._valueExtent[0] = Math.min(this._valueExtent[0], v[1]);
      this._valueExtent[1] = Math.max(this._valueExtent[1], v[1]);
    });

    this._data = sortedMerge(values.map((v) => [v[0], v[1], null]),
                             adjustedValues2.map((v) => [v[0], null, v[1]]),
                             (a, b) => a[0] - b[0]);
  }

  componentWillMount() {
    this._computeState(this.props);
  }

  componentWillReceiveProps(nextProps) {
    this._computeState(nextProps);
  }

  /**
   * React render()
   * @return {Object} - Built React component pseudo-DOM object
   */
  render() {
    return (
      <Paper
        className={`dygraph-chart-zoom`}
        style={this._styles.root}
        zDepth={this.props.zDepth}
        ref="chart"
        >
          <CircularProgress className="loading" size={0.5}/>
          {this._config.get('chart:loading')}
      </Paper>
    );
  }
}
