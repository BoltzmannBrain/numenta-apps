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

import CircularProgress from 'material-ui/lib/circular-progress';
import connectToStores from 'fluxible-addons-react/connectToStores';
import Dialog from 'material-ui/lib/dialog';
import RaisedButton from 'material-ui/lib/raised-button';
import path from 'path';
import React from 'react';

import HideCreateModelDialogAction from '../actions/HideCreateModelDialog';
import MetricStore from '../stores/MetricStore';
import StartModelAction from '../actions/StartModel';
import Utils from '../../main/Utils';


/**
 * "Create Model" Dialog
 */
@connectToStores([MetricStore], (context) => ({
  fileName: context.getStore(MetricStore).fileName,
  metricName: context.getStore(MetricStore).metricName,
  open: context.getStore(MetricStore).open,
  paramFinderResults: context.getStore(MetricStore).paramFinderResults
}))
export default class CreateModelDialog extends React.Component {

  static contextTypes = {
    executeAction: React.PropTypes.func,
    getConfigClient: React.PropTypes.func,
    getStore: React.PropTypes.func,
    muiTheme: React.PropTypes.object
  };

  static propTypes = {
    initialOpenState: React.PropTypes.bool.isRequired
  };

  constructor(props, context) {
    super(props, context);
    this._config = this.context.getConfigClient();

    this.state = Object.assign({}, this.props);

    this._styles = {
      raw: {
        fontSize: 11
      }
    };
  }

  componentWillReceiveProps(nextProps) {
    this.state = Object.assign({}, nextProps);
  }

  _resetState() {
    this.setState({
      open: false,
      fileName: null,
      metricName: null
    });
  }

  _onClick(modelPayload) {
    this.context.executeAction(HideCreateModelDialogAction);
    this.context.executeAction(StartModelAction, modelPayload);
    this._resetState()
  }

  render() {
    let body = null;
    let actions = [];
    let title = Utils.trims`Create model for ${this.state.metricName}
                  (${path.basename(this.state.fileName)})`;

    if (this.state.fileName && this.state.metricName) {
      let metricStore = this.context.getStore(MetricStore);
      let metrics = metricStore.getMetrics();
      let metricId = null;
      for (let metric of metrics.values()) {
        if (metric.name === this.state.metricName) {
          metricId = metric.uid;
        }
      }

      let inputOpts = metricStore.getInputOpts(metricId);
      let paramFinderResults = metricStore.getParamFinderResults(metricId);
      if (paramFinderResults) {
        let rawPayload = {
          metricId,
          inputOpts,
          modelOpts: paramFinderResults.modelInfo,
          aggOpts: {}
        };
        let aggregatePayload = Object.assign({}, rawPayload, {
          aggOpts: paramFinderResults.aggInfo
        });

        body = Utils.trims`We determined that you will get the best results if
                we aggregate your data to
                ${paramFinderResults.aggInfo.windowSize} seconds intervals.`;

        actions.push(
          <RaisedButton
            label={this._config.get('button:okay')}
            onTouchTap={this._onClick.bind(this, aggregatePayload)}
            primary={true}
            />
        );
        actions.push(
          <a href="#"
            onClick={this._onClick.bind(this, rawPayload)}
            styles={this._styles.raw}
            >
              {this._config.get('dialog:model:create:raw')}
          </a>
        );
      } else {
        body = (
          <div>
            <CircularProgress size={0.5} />
            {this._config.get('dialog:model:create:loading')}
          </div>
        );
      }
    }
    return (
      <Dialog actions={actions} open={this.state.open} title={title}>
        {body}
      </Dialog>
    );
  }

}
