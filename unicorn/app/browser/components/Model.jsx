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

import Card from 'material-ui/lib/card/card';
import CardActions from 'material-ui/lib/card/card-actions';
import CardHeader from 'material-ui/lib/card/card-header';
import CardText from 'material-ui/lib/card/card-text';
import Checkbox from 'material-ui/lib/checkbox';
import CheckboxIcon from 'material-ui/lib/svg-icons/toggle/check-box';
import CheckboxOutline from 'material-ui/lib/svg-icons/toggle/check-box-outline-blank';
import StopIcon from 'material-ui/lib/svg-icons/av/stop';
import Colors from 'material-ui/lib/styles/colors';
import connectToStores from 'fluxible-addons-react/connectToStores';
import Dialog from 'material-ui/lib/dialog';
import FlatButton from 'material-ui/lib/flat-button';
import RaisedButton from 'material-ui/lib/raised-button';
import React from 'react';
import {remote} from 'electron';

import ChartUpdateViewpoint from '../actions/ChartUpdateViewpoint';
import CreateModelDialog from './CreateModelDialog'
import DeleteModelAction from '../actions/DeleteModel';
import ExportModelResultsAction from '../actions/ExportModelResults';
import FileStore from '../stores/FileStore';
import MetricStore from '../stores/MetricStore';
import ModelData from './ModelData';
import ModelStore from '../stores/ModelStore';
import ModelDataStore from '../stores/ModelDataStore';
import ShowCreateModelDialogAction from '../actions/ShowCreateModelDialog';
import StartParamFinderAction from '../actions/StartParamFinder';
import {TIMESTAMP_FORMAT_PY_MAPPING} from '../../common/timestamp';
import {
  DATA_FIELD_INDEX, ANOMALY_YELLOW_VALUE, ANOMALY_RED_VALUE
} from '../lib/Constants';

const dialog = remote.require('dialog');


/**
 * Model component, contains Chart details, actions, and Chart Graph itself.
 */
@connectToStores([ModelStore, MetricStore], (context, props) => {
  let model = context.getStore(ModelStore).getModel(props.modelId);
  let modelData = context.getStore(ModelDataStore).getData(props.modelId);
  let file = context.getStore(FileStore).getFile(model.filename);
  let valueField = context.getStore(MetricStore).getMetric(props.modelId);
  let metrics = context.getStore(MetricStore).getMetricsByFileId(file.uid);
  let timestampField = metrics.find((metric) => metric.type === 'date');
  return {model, modelData, file, valueField, timestampField};
})
export default class Model extends React.Component {

  static get contextTypes() {
    return {
      executeAction: React.PropTypes.func,
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
    let muiTheme = this.context.muiTheme;

    this._config = this.context.getConfigClient();

    // init state
    this.state = {
      modalDialog: null,
      showNonAgg: false  // show raw data overlay on top of aggregate chart?
    };

    // style
    this._styles = {
      root: {
        marginBottom: '1rem',
        width: '100%'
      },
      title: {
        fontSize: 14,
        marginTop: -3,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        width: '13rem'
      },
      actions: {
        marginRight: 0,
        marginTop: '-5.5rem',
        textAlign: 'right'
      },
      actionLabels: {
        fontSize: 13
      },
      summary: {
        text: {
          color: muiTheme.rawTheme.palette.textColor
        },
        anomaly: {
          verticalAlign: 'top'
        }
      },
      showNonAgg: {
        root: {
          float: 'right',
          marginRight: '-3.8rem',
          top: -10,
          width: '15rem'
        },
        checkbox: {
          marginRight: 2,
          top: 2
        },
        label: {
          color: muiTheme.rawTheme.palette.primary1Color,
          fontSize: 12,
          fontWeight: muiTheme.rawTheme.font.weight.light
        }
      }
    };
  }

  /**
   * Opens a modal dialog
   * @param {String} title - Dialog title
   * @param {String} body - Dialog body
   * @param {Button[]} actions - Dialog actions
   */
  _showModalDialog(title, body, actions) {
    this.setState({
      modalDialog: {
        body,
        title,
        actions
      }
    });
  }

  _dismissModalDialog() {
    this.setState({
      modalDialog: null
    });
  }

  _createModel(model, file, valueField, timestampField) {
    let inputOpts = {
      csv: file.filename,
      rowOffset: file.rowOffset,
      timestampIndex: timestampField.index,
      valueIndex: valueField.index,
      datetimeFormat: TIMESTAMP_FORMAT_PY_MAPPING[timestampField.format]
    };
    this.context.executeAction(ShowCreateModelDialogAction, {
      fileName: file.name,
      metricName: valueField.name
    });

    this.context.executeAction(StartParamFinderAction, {
      metricId: model.modelId,
      inputOpts
    });
  }

  _deleteModel(modelId) {
    let dialogActions = [
      <FlatButton
        label={this._config.get('button:cancel')}
        onTouchTap={this._dismissModalDialog.bind(this)}
        />,
      <RaisedButton
        label={this._config.get('button:delete')}
        onTouchTap={() => {
          // reset chart viewpoint so we can start fresh on next chart re-create
          this.context.executeAction(ChartUpdateViewpoint, {
            metricId: modelId,
            viewpoint: null
          });

          this.context.executeAction(DeleteModelAction, modelId);
          this._dismissModalDialog();
        }}
        primary={true}
        />
    ];
    this._showModalDialog(
      this._config.get('dialog:model:delete:title'),
      this._config.get('dialog:model:delete:message'),
      dialogActions);
  }

  _exportModelResults(modelId) {
    dialog.showSaveDialog({
      title: this._config.get('dialog:model:export:title'),
      defaultPath: this._config.get('dialog:model:export:path')
    }, (filename) => {
      if (filename) {
        this.context.executeAction(ExportModelResultsAction, {
          modelId, filename
        });
      } else {
        // @TODO trigger error about "bad file"
      }
    });
  }

  _renderModelSummaryDialog() {
    let {model, file, modelData} = this.props;

    let total = modelData.data.reduce((previous, data) => {
      let {red, yellow} = previous;
      let anomaly = data[DATA_FIELD_INDEX.DATA_INDEX_ANOMALY];
      if (anomaly >= ANOMALY_RED_VALUE) {
        red++;
      } else if (anomaly >= ANOMALY_YELLOW_VALUE) {
        yellow++;
      }
      return {red, yellow};
    }, {red:0, yellow: 0});

    let summary = [];
    if (total.red === 0 && total.yellow === 0) {
      summary.push(<p>No anomalies</p>);
    } else {
      let muiTheme = this.context.muiTheme;
      if (total.red > 0) {
        summary.push(
          <p>
            <StopIcon
              color={muiTheme.rawTheme.palette.dangerColor}
              style={this._styles.summary.anomaly}/>
            <b>{total.red}</b> anomalies
          </p>);
      }
      if (total.yellow > 0) {
        summary.push(
          <p>
            <StopIcon
              color={muiTheme.rawTheme.palette.warnColor}
              style={this._styles.summary.anomaly}/>
            <b>{total.yellow}</b> likely anomalies
          </p>);
      }
    }

    return (
      <div>
        <p><b>What did we find?</b></p>
        <p>The HTM model completed successfully for <b>{file.name}</b> and <b>
          {model.metric}</b> and detected the following:</p>
        {summary}
        <p><b>What do I do next?</b></p>
        <ol>
          <li>Explore the chart to understand your results in context</li>
          <li>Export the results to preserve and present your findings</li>
          <li>Engage with a more scalable HTM project in the NuPIC community or
              contact us for a license</li>
        </ol>
      </div>
    );
  }

  _showModelSummaryDialog() {
    let actions = [<RaisedButton
                      label={this._config.get('button:okay')}
                      onTouchTap={this._dismissModalDialog.bind(this)}
                      primary={true}/>
                  ];
    let body = this._renderModelSummaryDialog();
    let title = this._config.get('dialog:model:summary:title');
    this._showModalDialog(title, body, actions);
  }
  /**
   * Toggle showing a 3rd series of Raw Metric Data over top of the
   *  already-charted 2-Series Model results (Aggregated Metric and Anomaly).
   */
  _toggleNonAggOverlay() {
    if (this.props.model.aggregated) {
      this.setState({showNonAgg: !this.state.showNonAgg});
    }
  }

  componentWillReceiveProps(nextProps) {
    let newModel = nextProps.model;
    let oldModel = this.props.model;
    if (oldModel.active  && !newModel.active) {
      this._showModelSummaryDialog();
    }
  }

  render() {
    let {model, file, valueField, timestampField} = this.props;
    let title = model.metric;

    // prep UI
    let muiTheme = this.context.muiTheme;
    let checkboxColor = muiTheme.rawTheme.palette.primary1Color;
    let showNonAgg = this.props.model.aggregated === true &&
                      this.state.showNonAgg === true;
    let openDialog = this.state.modalDialog !== null;
    let modalDialog = this.state.modalDialog || {};
    let actions, showNonAggAction, titleColor;

    // prep visual sub-components
    actions = (
      <CardActions style={this._styles.actions}>
        <FlatButton
          disabled={model.ran || model.active}
          label={this._config.get('button:model:create')}
          labelPosition="after"
          labelStyle={this._styles.actionLabels}
          onTouchTap={
            this._createModel.bind(this, model, file, valueField,
              timestampField)
          }
          primary={!model.ran}
          />
        <FlatButton
          disabled={!model.ran || model.active}
          label={this._config.get('button:model:summary')}
          labelPosition="after"
          labelStyle={this._styles.actionLabels}
          onTouchTap={this._showModelSummaryDialog.bind(this)}
          primary={model.ran}
          />
        <FlatButton
          disabled={!model.ran || model.active}
          label={this._config.get('button:model:export')}
          labelPosition="after"
          labelStyle={this._styles.actionLabels}
          onTouchTap={this._exportModelResults.bind(this, model.modelId)}
          primary={model.ran}
          />
        <FlatButton
          disabled={!model.ran || model.active}
          label={this._config.get('button:model:delete')}
          labelPosition="after"
          labelStyle={this._styles.actionLabels}
          onTouchTap={this._deleteModel.bind(this, model.modelId)}
          primary={model.ran}
          />
      </CardActions>
    );
    if (model.aggregated && !model.active && model.ran) {
      showNonAggAction = (
        <Checkbox
          checked={showNonAgg}
          checkedIcon={
            <CheckboxIcon color={checkboxColor} viewBox="0 0 30 30" />
          }
          defaultChecked={false}
          iconStyle={this._styles.showNonAgg.checkbox}
          label={this._config.get('chart:showNonAgg')}
          labelStyle={this._styles.showNonAgg.label}
          onCheck={this._toggleNonAggOverlay.bind(this)}
          style={this._styles.showNonAgg.root}
          unCheckedIcon={
            <CheckboxOutline color={checkboxColor} viewBox="0 0 30 30" />
          }
          />
      );
    }

    // eror handle
    if (model.error) {
      titleColor = Colors.red400;
      file.name = model.error.message;
    }

    // actual render
    return (
      <Card initiallyExpanded={true} style={this._styles.root}>
        <CardHeader
          showExpandableButton={false}
          subtitle={<div style={this._styles.title}>{file.name}</div>}
          title={<div style={this._styles.title}>{title}</div>}
          titleColor={titleColor} />
        <CardText expandable={false}>
          {actions}
          {showNonAggAction}
          <ModelData modelId={model.modelId} showNonAgg={showNonAgg} />
        </CardText>
        <Dialog
          actions={modalDialog.actions}
          onRequestClose={this._dismissModalDialog.bind(this)}
          open={openDialog}
          ref="modalDialog"
          title={modalDialog.title}>
            {modalDialog.body}
        </Dialog>
        <CreateModelDialog ref="createModelWindow"/>
      </Card>
    );
  }
}
