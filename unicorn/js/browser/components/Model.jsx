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
import Colors from 'material-ui/lib/styles/colors';
import connectToStores from 'fluxible-addons-react/connectToStores';
import Dialog from 'material-ui/lib/dialog';
import FlatButton from 'material-ui/lib/flat-button';
import path from 'path';
import React from 'react';
import {remote} from 'electron';

import CreateModelDialog from '../components/CreateModelDialog'
import DeleteModelAction from '../actions/DeleteModel';
import ExportModelResultsAction from '../actions/ExportModelResults';
import FileStore from '../stores/FileStore';
import MetricStore from '../stores/MetricStore';
import ModelData from '../components/ModelData';
import ModelStore from '../stores/ModelStore';
import ShowCreateModelDialogAction from '../actions/ShowCreateModelDialog';
import StartParamFinderAction from '../actions/StartParamFinder';

const dialog = remote.require('dialog');
const MOMENTS_TO_DATETIME =
  require('../../config/momentjs_to_datetime_strptime.json');


/**
 * Model component, contains Chart details, actions, and Chart Graph itself.
 */
@connectToStores([ModelStore, FileStore, MetricStore], (context) => ({
  files: context.getStore(FileStore).getFiles()
}))
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

    let store = this.context.getStore(ModelStore);
    let model = store.getModel(this.props.modelId);

    this._config = this.context.getConfigClient();

    this._styles = {
      root: {
        marginBottom: '1rem',
        width: '100%'
      },
      title: {
        marginTop: -3,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        width: '13rem'
      },
      actions: {
        textAlign: 'right',
        marginRight: 0,
        marginTop: '-5.5rem'
      }
    };

    // init state
    this.state = Object.assign({
      deleteConfirmDialog: null
    }, model);
  }

  componentWillReceiveProps(nextProps) {
    let store = this.context.getStore(ModelStore);
    let model = store.getModel(nextProps.modelId);
    this.setState(Object.assign({}, model));
  }

  /**
   * Opens a modal confirmation dialog
   * @param  {string}   title    Dialog title
   * @param  {string}   message  Dialog Message
   * @param  {Function} callback Function to be called on confirmation
   */
  _showDeleteConfirmDialog(title, message, callback) {
    this.setState({
      deleteConfirmDialog: {callback, message, title}
    });
  }

  _dismissDeleteConfirmDialog() {
    this.setState({
      deleteConfirmDialog: null
    });
  }

  _createModel(metricName, metricId, csvPath, rowOffset, timestampIndex,
                valueIndex, datetimeFormat) {
    let inputOpts = {
      csv: csvPath, rowOffset, timestampIndex, valueIndex, datetimeFormat
    };

    this.context.executeAction(ShowCreateModelDialogAction, {
      fileName: path.basename(csvPath),
      metricName
    });

    this.context.executeAction(StartParamFinderAction, {metricId, inputOpts});
  }

  _deleteModel(modelId) {
    this._showDeleteConfirmDialog(
      this._config.get('dialog:model:delete:title'),
      this._config.get('dialog:model:delete:message'),
      () => {
        this.context.executeAction(DeleteModelAction, modelId);
        this._dismissDeleteConfirmDialog();
      }
    );
  }

  _exportModelResults(modelId) {
    dialog.showSaveDialog({
      title: this._config.get('dialog:model:export:title'),
      defaultPath: this._config.get('dialog:model:export:path')
    }, (filename) => {
      if (filename) {
        this.context.executeAction(
          ExportModelResultsAction, {modelId, filename}
        );
      } else {
        // @TODO trigger error about "bad file"
      }
    });
  }

  render() {
    let metric, timestampIndex, titleColor, valueIndex;
    let model = this.state;
    let modelId = model.modelId;
    let filename = path.basename(model.filename);
    let title = model.metric;
    let hasModelRun = (model && ('ran' in model) && model.ran);
    let deleteConfirmDialog = this.state.deleteConfirmDialog || {};
    let dialogOpen = false;

    let file = this.props.files.find((file) => {
      return file.name === path.basename(this.state.filename);
    });
    let tsFormat = file.timestampFormat;

    let datetimeFormatCategory = MOMENTS_TO_DATETIME.find((category) => {
      return category.mappings[tsFormat];
    });

    let datetimeFormat = datetimeFormatCategory.mappings[tsFormat];

    let mStore = this.context.getStore(MetricStore);
    let metrics = mStore.getMetricsByFileId(file.uid);

    for (let [index, value] of metrics.entries()) {
      if (value.type === 'date') {
        timestampIndex = index;
      }
      if (value.name === this.state.metric) {
        valueIndex = index;
        metric = value
      }
    }

    // @FIXME - UNI-324
    valueIndex = 1;
    timestampIndex = 0;

    let csvPath = file.filename;
    let metricName = metric.name;
    let rowOffset = 1; // @TODO; should be replaced by user defined selection (if check use first row as headers) at file upload time

    let dialogActions = [
      <FlatButton
        label={this._config.get('button:cancel')}
        onTouchTap={this._dismissDeleteConfirmDialog.bind(this)}
        />,
      <FlatButton
        keyboardFocused={true}
        label={this._config.get('button:delete')}
        onTouchTap={deleteConfirmDialog.callback}
        primary={true}
        ref="submit"
        />
    ];
    let actions = (
      <CardActions style={this._styles.actions}>
        <FlatButton
          disabled={hasModelRun}
          label={this._config.get('button:model:create')}
          labelPosition="after"
          onTouchTap={
            this._createModel.bind(this, metricName, metric.uid, csvPath,
                                    rowOffset, timestampIndex, valueIndex,
                                    datetimeFormat)
          }
          primary={!hasModelRun}
          />
        <FlatButton
          disabled={!hasModelRun}
          label={this._config.get('button:model:delete')}
          labelPosition="after"
          onTouchTap={this._deleteModel.bind(this, modelId)}
          primary={hasModelRun}
          />
        <FlatButton
          disabled={!hasModelRun}
          label={this._config.get('button:model:export')}
          labelPosition="after"
          onTouchTap={this._exportModelResults.bind(this, modelId)}
          primary={hasModelRun}
          />
      </CardActions>
    );

    if (model.error) {
      titleColor = Colors.red400;
      title = `${model.metric} | ${model.error.message}`;
    }

    if (this.state.deleteConfirmDialog) {
      dialogOpen = true;
    }

    return (
      <Card initiallyExpanded={true} style={this._styles.root}>
        <CardHeader
          showExpandableButton={false}
          subtitle={<div style={this._styles.title}>{filename}</div>}
          title={<div style={this._styles.title}>{title}</div>}
          titleColor={titleColor}
          />
        <CardText expandable={false}>
          {actions}
          <ModelData modelId={modelId}/>
        </CardText>
        <Dialog
          actions={dialogActions}
          onRequestClose={this._dismissDeleteConfirmDialog.bind(this)}
          open={dialogOpen}
          ref="deleteConfirmDialog"
          title={deleteConfirmDialog.title}
          >
            {deleteConfirmDialog.message}
        </Dialog>
        <CreateModelDialog ref="createModelWindow" initialOpenState={false}/>
      </Card>
    );
  }
}
