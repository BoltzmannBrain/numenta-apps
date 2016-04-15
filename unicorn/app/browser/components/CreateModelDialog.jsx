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
import FlatButton from 'material-ui/lib/flat-button';
import path from 'path';
import RaisedButton from 'material-ui/lib/raised-button';
import React from 'react';

import ChartUpdateViewpoint from '../actions/ChartUpdateViewpoint';
import CreateModelStore from '../stores/CreateModelStore';
import HideCreateModelDialogAction from '../actions/HideCreateModelDialog';
import StartModelAction from '../actions/StartModel';
import {trims} from '../../common/common-utils';


/**
 * "Create Model" Dialog
 */
@connectToStores([CreateModelStore], (context) => ({
  fileName: context.getStore(CreateModelStore).fileName,
  inputOpts: context.getStore(CreateModelStore).inputOpts,
  metricId: context.getStore(CreateModelStore).metricId,
  metricName: context.getStore(CreateModelStore).metricName,
  open: context.getStore(CreateModelStore).open,
  paramFinderResults: context.getStore(CreateModelStore).paramFinderResults
}))
export default class CreateModelDialog extends React.Component {

  static contextTypes = {
    executeAction: React.PropTypes.func,
    getConfigClient: React.PropTypes.func,
    getStore: React.PropTypes.func,
    muiTheme: React.PropTypes.object
  };

  constructor(props, context) {
    super(props, context);
    this._config = this.context.getConfigClient();
    this.state = {progress: true};

    let muiTheme = this.context.muiTheme;
    this._styles = {
      agg: {
        marginRight: '1rem'
      },
      loading: {
        left: 0,
        marginRight: 10,
        position: 'relative',
        top: 16
      },
      raw: {
        color: muiTheme.rawTheme.palette.accent4Color,
        fontSize: 13,
        fontWeight: muiTheme.rawTheme.font.weight.normal,
        marginRight: '0.5rem',
        textDecoration: 'underline',
        textTransform: 'none'
      }
    };
  }

  _startModel(payload) {
    // reset chart viewpoint so we can scroll with new data again
    this.context.executeAction(ChartUpdateViewpoint, {
      metricId: payload.metricId,
      viewpoint: null
    });

    this.context.executeAction(HideCreateModelDialogAction);
    this.context.executeAction(StartModelAction, payload);
  }

  componentDidMount() {
    // Show progress for at least 4 secs
    setTimeout(() => this.setState({progress: false}), 4000);
  }

  render() {
    let {
      fileName, inputOpts, metricId, metricName, paramFinderResults
    } = this.props;
    let body = null;
    let actions = [];
    let title = trims`Create model for ${metricName}
                  (${path.basename(fileName)})`;

    if (paramFinderResults && !this.state.progress) {
      let rawPayload = {
        metricId,
        inputOpts,
        modelOpts: paramFinderResults.modelInfo,
        aggOpts: {}
      };
      if (paramFinderResults.aggInfo) {
        let aggregatePayload = Object.assign({}, rawPayload, {
          aggOpts: paramFinderResults.aggInfo
        });

        body = (
          <div>
            We determined that you will get the best results if we aggregate
            your data to {paramFinderResults.aggInfo.windowSize} seconds
            intervals.
          </div>
        );

        actions.push(
          <FlatButton
            label={this._config.get('dialog:model:create:raw')}
            onTouchTap={this._startModel.bind(this, rawPayload)}
            labelStyle={this._styles.raw}
            />
        );
        actions.push(
          <RaisedButton
            label={this._config.get('button:okay')}
            onTouchTap={this._startModel.bind(this, aggregatePayload)}
            primary={true}
            style={this._styles.agg}
            />
        );
      } else {
        // No aggregation required, just start the model
        this._startModel(rawPayload);
      }
    } else {
      body = (
        <div>
          <CircularProgress
            className="loading"
            size={0.5}
            style={this._styles.loading}
            />
          {this._config.get('dialog:model:create:loading')}
        </div>
      );
    }

    return (
      <Dialog actions={actions} open={this.props.open} title={title}>
        {body}
      </Dialog>
    );
  }
}
