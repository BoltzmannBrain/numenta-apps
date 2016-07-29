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

import connectToStores from 'fluxible-addons-react/connectToStores';
import MetricDataStore from '../stores/MetricDataStore';
import ModelDataStore from '../stores/ModelDataStore';
import LinearProgress from 'material-ui/lib/linear-progress';
import React from 'react';

@connectToStores([ModelDataStore], (context, props) => {
  let modelDataStore = context.getStore(ModelDataStore);
  let metriDataStore = context.getStore(MetricDataStore);
  let modelTimeRange = modelDataStore.getTimeRange(props.modelId);
  let metricTimeRange = metriDataStore.getTimeRange(props.modelId);
  let progress = 0;
  if (metricTimeRange && modelTimeRange) {
    progress = Math.round(100 *  (modelTimeRange.to - modelTimeRange.from) /
              (metricTimeRange.to - metricTimeRange.from));
  }
  return {progress};
})
export default class ModelProgress extends React.Component {

  static get contextTypes() {
    return {
      getStore: React.PropTypes.func,
      muiTheme: React.PropTypes.object
    };
  }

  static get propTypes() {
    return {
      modelId: React.PropTypes.string.isRequired,
      style: React.PropTypes.object
    };
  }

  constructor(props, context) {
    super(props, context);
    let muiTheme = this.context.muiTheme;
    this._styles = {
      container: {
        width: '7rem',
        display: 'flex'
      },
      bar: {
        marginTop: '0.25rem'
      },
      text: {
        color: muiTheme.rawTheme.palette.accent3Color,
        fontSize: 10,
        marginRight: '0.25rem'
      }
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    return nextProps.progress !== this.props.progress;
  }

  render() {
    const containerStyles = Object.assign({}, this._styles.container,
                                              this.props.style);
    return (
      <span style={containerStyles}>
        <span style={this._styles.text}>{this.props.progress}%</span>
        <LinearProgress style={this._styles.bar} mode="determinate"
          value={this.props.progress}/>
      </span>);
  }
}
