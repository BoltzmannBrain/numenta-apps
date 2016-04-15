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
import moment from 'moment';
import Paper from 'material-ui/lib/paper';
import React from 'react';
import ReactDOM from 'react-dom';

import ChartUpdateViewpoint from '../actions/ChartUpdateViewpoint';
import Dygraph from '../lib/Dygraphs/DygraphsExtended';
import {DATA_FIELD_INDEX} from '../lib/Constants';

const {DATA_INDEX_TIME} = DATA_FIELD_INDEX;
const RANGE_SELECTOR_CLASS = 'dygraph-rangesel-fgcanvas';


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
      data: React.PropTypes.array.isRequired,
      metaData: React.PropTypes.object,
      options: React.PropTypes.object,
      zDepth: React.PropTypes.number
    };
  }

  static get defaultProps() {
    return {
      data: [],
      metaData: {},
      options: {},
      zDepth: 1
    };
  }

  constructor(props, context) {
    super(props, context);
    this._config = this.context.getConfigClient();

    // DyGraphs chart container
    this._dygraph = null;
    this._chartRange = [null, null];
    this._displayPointCount = this._config.get('chart:points');
    this._previousDataSize = 0;

    // dynamic styles
    let muiTheme = this.context.muiTheme;
    this._styles = {
      root: {
        boxShadow: 'none',
        height: muiTheme.rawTheme.spacing.desktopKeylineIncrement * 2.75,
        marginTop: '0.5rem',
        width: '100%'
      }
    };
  }

  componentDidMount() {
    if (this.props.data.length) {
      this._chartInitalize();
    }
  }

  componentWillUnmount() {
    let {model} = this.props.metaData;
    let element = ReactDOM.findDOMNode(this.refs[`chart-${model.modelId}`]);
    let range = element.getElementsByClassName(RANGE_SELECTOR_CLASS)[0];

    if (this._dygraph) {
      Dygraph.removeEvent(element, 'mouseup', this._handleMouseUp.bind(this));
      Dygraph.removeEvent(range, 'mousedown', this._handleMouseDown.bind(this));
      this._dygraph.destroy();
      this._dygraph = null;
    }
  }

  componentDidUpdate() {
    if (this._dygraph && this.props.data.length > 1) {
      this._chartUpdate();
    } else if (this.props.data.length) {
      this._chartInitalize();
    }
  }

  componentWillUpdate() {
    if (this.props.data.length < this._previousDataSize) {
      this.componentWillUnmount();
    }
  }

  /**
   * DyGrpahs Chart Initalize and Render
   */
  _chartInitalize() {
    let {data, metaData, options} = this.props;
    let {metric, model} = metaData;
    let element = ReactDOM.findDOMNode(this.refs[`chart-${model.modelId}`]);
    let first = moment(data[0][DATA_INDEX_TIME]).valueOf();
    let second = moment(data[1][DATA_INDEX_TIME]).valueOf();
    let unit = second - first; // each datapoint
    let rangeWidth = unit * this._displayPointCount;
    let rangeEl;

    this._chartRange = [first, first + rangeWidth]; // float left

    // move chart back to last valid display position from previous viewing?
    if ('viewpoint' in metric && metric.viewpoint) {
      this._chartRange = [metric.viewpoint, metric.viewpoint + rangeWidth];
    }

    // init, render, and draw chart!
    options.dateWindow = this._chartRange;  // update viewport of range selector
    options.axes.y.valueRange = [metaData.min, metaData.max];  // lock y-axis
    this._previousDataSize = data.length;
    this._dygraph = new Dygraph(element, data, options);

    // after: track chart viewport position changes
    rangeEl = element.getElementsByClassName(RANGE_SELECTOR_CLASS)[0];
    Dygraph.addEvent(rangeEl, 'mousedown', this._handleMouseDown.bind(this));
    Dygraph.addEvent(element, 'mouseup', this._handleMouseUp.bind(this));
  }

  /**
   * DyGrpahs Chart Update Logic and Re-Render
   */
  _chartUpdate() {
    let {data, metaData, options} = this.props;
    let {model} = metaData;
    let modelIndex = Math.abs(model.dataSize - 1);
    let first = moment(data[0][DATA_INDEX_TIME]).valueOf();
    let [rangeMin, rangeMax] = this._chartRange;
    let rangeWidth = rangeMax - rangeMin;
    let scrollLock = false;

    // should we scroll along with incoming model data?
    if (model.active && (modelIndex < data.length) && (
      (model.aggregated && (data.length !== this._previousDataSize)) ||
      (!model.aggregated)
    )) {
      scrollLock = true;
    }

    // scroll along with fresh anomaly model data input.
    if (scrollLock) {
      rangeMax = moment(data[modelIndex][DATA_INDEX_TIME]).valueOf();
      rangeMin = rangeMax - rangeWidth;
      if (rangeMin < first) {
        rangeMin = first;
        rangeMax = rangeMin + rangeWidth;
      }
      this._chartRange = [rangeMin, rangeMax];
    }

    // update chart
    options.dateWindow = this._chartRange;
    options.file = data;  // new data
    this._previousDataSize = data.length;
    this._dygraph.updateOptions(options);
  }

  /**
   * Overlay default Dygraphs Range Selector mousedown event handler in order
   *  to move chart viewpoint easily via point-and-click.
   * @param {Object} event - DOM `mousedown` event object
   */
  _handleMouseDown(event) {
    if (! this._dygraph) return;

    let eventX = this._dygraph.eventToDomCoords(event)[0];
    let {w: canvasWidth} = this._dygraph.getArea();
    let [chartStart, chartEnd] = this._dygraph.xAxisExtremes();
    let [rangeStart, rangeEnd] = this._chartRange;
    let chartWidth = chartEnd - chartStart;
    let rangeWidth = rangeEnd - rangeStart;
    let rangeWidthHalf = rangeWidth / 2;
    let pixelFactor = eventX / canvasWidth;
    let chartFactor = pixelFactor * chartWidth;
    let ts = chartStart + chartFactor;
    let newMin = ts - rangeWidthHalf;
    let newMax = ts + rangeWidthHalf;

    // only handle click outside of range finder handle
    if (ts >= rangeStart && ts <= rangeEnd) return;

    // watch out for Range Selector hanging off edges
    if (newMin < chartStart) {
      newMin = chartStart;
      newMax = chartStart + rangeWidth;
    } else if (newMax > chartEnd) {
      newMax = chartEnd;
      newMin = chartEnd - rangeWidth;
    }

    // update chart
    this._chartRange = [newMin, newMax];
    this._chartUpdate();
  }

  /**
   * Overlay default Dygraphs mouseup event handler to also store the current
   *  chart viewpoint (viewport starting UTC date stamp). This is used for
   *  both the Main Chart and the Range Selector.
   * @param {Object} event - DOM `mouseup` event object
   */
  _handleMouseUp(event) {
    if (! this._dygraph) return;
    let range = this._dygraph.xAxisRange();
    this._chartRange = range;

    // store viewpoint position
    this.context.executeAction(ChartUpdateViewpoint, {
      metricId: this.props.metaData.model.modelId,
      viewpoint: range[0] || null
    });
  }

  /**
   * React render()
   * @return {Object} - Built React component pseudo-DOM object
   */
  render() {
    let {model} = this.props.metaData;

    if (model.aggregated) {
      this._styles.root.marginTop = '1rem';  // make room for: ☑ ShowNonAgg?
    }

    return (
      <Paper
        className="dygraph-chart"
        ref={`chart-${model.modelId}`}
        style={this._styles.root}
        zDepth={this.props.zDepth}
        >
          <CircularProgress className="loading" size={0.5} />
          {this._config.get('chart:loading')}
      </Paper>
    );
  }

}
