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

import Checkbox from 'material-ui/lib/checkbox';
import CheckboxIcon from 'material-ui/lib/svg-icons/toggle/check-box';
import CheckboxOutline from 'material-ui/lib/svg-icons/toggle/check-box-outline-blank';
import CircularProgress from 'material-ui/lib/circular-progress';
import connectToStores from 'fluxible-addons-react/connectToStores';
import Dialog from 'material-ui/lib/dialog';
import FlatButton from 'material-ui/lib/flat-button';
import RaisedButton from 'material-ui/lib/raised-button';
import IconButton from 'material-ui/lib/icon-button';
import IconClose from 'material-ui/lib/svg-icons/hardware/keyboard-arrow-down';
import IconMenu from 'material-ui/lib/menus/icon-menu';
import IconMore from 'material-ui/lib/svg-icons/navigation/more-vert';
import IconOpen from 'material-ui/lib/svg-icons/hardware/keyboard-arrow-right';
import IconStatus from 'material-ui/lib/svg-icons/image/lens';
import List from 'material-ui/lib/lists/list';
import ListItem from 'material-ui/lib/lists/list-item';
import MenuItem from 'material-ui/lib/menus/menu-item';
import React from 'react';

import AddShowModelAction from '../actions/AddShowModel';
import DeleteFileAction from '../actions/DeleteFile';
import DeleteModelAction from '../actions/DeleteModel';
import StopModelAction from '../actions/StopModel';
import FileStore from '../stores/FileStore';
import HideModelAction from '../actions/HideModel';
import MetricStore from '../stores/MetricStore';
import ModelStore from '../stores/ModelStore';
import SetFileExpandedStateAction from '../actions/SetFileExpandedState';
import ShowFileDetailsAction from '../actions/ShowFileDetails';
import ShowModelAction from '../actions/ShowModel';

// Using module from 'main' process, it may infer use of `remote` IPC calls
import {generateMetricId} from '../../main/generateId';

/**
 * Component used to display a list of files
 */
@connectToStores([FileStore, ModelStore, MetricStore], (context) => ({
  files: context.getStore(FileStore).getFiles(),
  models: context.getStore(ModelStore).getModels()
}))
export default class FileList extends React.Component {

  static get contextTypes() {
    return {
      executeAction: React.PropTypes.func,
      getConfigClient: React.PropTypes.func,
      getStore: React.PropTypes.func,
      muiTheme: React.PropTypes.object
    };
  }

  constructor(props, context) {
    super(props, context);
    let muiTheme = this.context.muiTheme;

    this._config = this.context.getConfigClient();

    // init state
    this.state = Object.assign({
      deleteConfirmDialog: null
    }, props);

    this._styles = {
      root: {
        paddingTop: '0.5rem'
      },
      subhead: {
        color: muiTheme.rawTheme.palette.accent3Color,
        fontSize: 13,
        fontWeight: muiTheme.rawTheme.font.weight.normal
      },
      file: {
        fontSize: 14,
        fontWeight: muiTheme.rawTheme.font.weight.medium,
        marginLeft: '-1.4rem',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      },
      fileToggle: {
        margin: 0
      },
      more: {
        width: 40
      },
      metric: {
        fontSize: 14,
        fontWeight: muiTheme.rawTheme.font.weight.medium,
        marginLeft: '-1.9rem',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      },
      checkbox: {
        left: 12,
        top: 14
      },
      tooltip: {
        marginBottom: 0,
        marginLeft: 0,
        marginRight: 23,
        marginTop: 2,
        padding: 0
      },
      loading: {
        position: 'absolute',
        height: 15,
        marginLeft: 3,
        marginTop: 1,
        width: 15
      },
      loadingInner: {
        left: -20,
        position: 'relative',
        top: -19
      },
      status: {
        position: 'absolute',
        height: 15,
        width: 15
      }
    };
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

  _onMetricCheck(modelId, filename, timestampField, metric, event, checked) {
    let models = this.props.models;
    let model = models.find((m) => m.modelId === modelId);

    if (checked && model) {
      // show: already known
      this.context.executeAction(ShowModelAction, modelId);
    } else if (checked) {
      // show: unknown, so add and show
      this.context.executeAction(AddShowModelAction, {
        modelId, filename, timestampField, metric
      });
    } else {
      // hide
      this.context.executeAction(HideModelAction, modelId);
    }
  }

  _handleFileToggle(fileId, event) {
    // piggyback on default MaterialUI nested show/hide
    let ref = this.refs[`file-toggle-${fileId}`];
    ref.setState({open: !ref.state.open});

    this.props.files.some((file) => {
      if (file.uid === fileId) {
        this.context.executeAction(SetFileExpandedStateAction, {
          filename: file.filename, expanded: !file.expanded
        });
        return true;
      }
    });
  }

  _handleFileContextMenu(file, event, action) {
    if (action === 'detail') {
      this.context.executeAction(ShowFileDetailsAction, file);
    } else if (action === 'delete') {
      this._showDeleteConfirmDialog(
        this._config.get('dialog:file:delete:title'),
        this._config.get('dialog:file:delete:message'),
        () => {
          let models = this.props.models;
          models.forEach((model) => {
            if (model.filename === file.filename) {
              if (model.visible) {
                this.context.executeAction(HideModelAction, model.modelId);
              }
              if (model.active) {
                this.context.executeAction(StopModelAction, model.modelId);
              }
              this.context.executeAction(DeleteModelAction, model.modelId);
            }
          });
          this.context.executeAction(DeleteFileAction, file.filename);
          this._dismissDeleteConfirmDialog();
        }
      );
    }
  }

  _renderMetrics(file) {
    let metricStore = this.context.getStore(MetricStore);

    let fileMetrics = metricStore.getMetricsByFileId(file.uid);
    let timestampField = fileMetrics.find((metric) => {
      return metric.type === 'date';
    });
    if (timestampField) {
      return fileMetrics.map((metric) => {
        if (metric.type !== 'date') {
          let muiTheme = this.context.muiTheme;
          let modelId = generateMetricId(file.filename, metric.name);
          let models = this.props.models;
          let model = models.find((m) => m.modelId === modelId);
          let isModelVisible = false;
          let checkboxColor = muiTheme.rawTheme.palette.primary1Color;
          let statusColor, statusIcon, statusTooltip;

          if (model) {
            if (model.visible) {
              isModelVisible = true;
            }
            if (model.active) {
              statusTooltip = this._config.get('status:model:active');
              statusColor = muiTheme.rawTheme.palette.primary2Color;
              statusIcon = (
                <CircularProgress
                  className="loading"
                  color={statusColor}
                  innerStyle={this._styles.loadingInner}
                  size={0.2}
                  style={this._styles.loading}
                  />
              );
            } else {
              if (model.ran) {
                statusTooltip = this._config.get('status:model:ran');
                statusColor = muiTheme.rawTheme.palette.primary2Color;
              } else {
                statusTooltip = this._config.get('status:model:none');
                statusColor = muiTheme.rawTheme.palette.disabledColor;
              }
              statusIcon = (
                <IconStatus color={statusColor} style={this._styles.status} />
              );
            }
          } else {
            statusTooltip = this._config.get('status:model:none');
            statusColor = muiTheme.rawTheme.palette.disabledColor;
            statusIcon = (
              <IconStatus color={statusColor} style={this._styles.status} />
            );
          }

          return (
            <ListItem
              key={modelId}
              leftCheckbox={
                <Checkbox
                  checked={isModelVisible}
                  checkedIcon={
                    <CheckboxIcon
                      color={checkboxColor}
                      viewBox="0 0 30 30"
                      />
                  }
                  onCheck={
                    this._onMetricCheck.bind(
                      this,
                      modelId,
                      file.filename,
                      timestampField.name,
                      metric.name
                    )
                  }
                  style={this._styles.checkbox}
                  unCheckedIcon={
                    <CheckboxOutline
                      color={checkboxColor}
                      viewBox="0 0 30 30"
                      />
                  }
                  />
              }
              primaryText={
                <div style={this._styles.metric}>
                  <span title={statusTooltip} style={this._styles.tooltip}>
                    {statusIcon}
                  </span>
                  {metric.name}
                </div>
              }
              />
          );
        }
      });
    }
  }

  _renderFiles(filetype) {
    return this.props.files.map((file) => {
      if (file.type === filetype) {
        let color = this.context.muiTheme.rawTheme.palette.primary1Color;
        let fileId = file.uid;
        let contextMenu = (
          <IconMenu
            iconButtonElement={
              <IconButton><IconMore color={color} /></IconButton>
            }
            onChange={this._handleFileContextMenu.bind(this, file)}
            style={this._styles.more}
            >
              <MenuItem index={1}
                primaryText={this._config.get('menu:file:details')}
                value="detail"
                />
              <MenuItem index={2}
                disabled={filetype === 'sample'}
                primaryText={this._config.get('menu:file:delete')}
                value="delete"
                />
          </IconMenu>
        );
        let leftIconButton, toggleIcon;

        // choose file visibility toggle icon
        if (file.expanded) {
          toggleIcon = (<IconClose color={color} />);
        } else {
          toggleIcon = (<IconOpen color={color} />);
        }
        leftIconButton = (
          <IconButton style={this._styles.fileToggle}>
              {toggleIcon}
          </IconButton>
        );

        return (
          <ListItem
            initiallyOpen={file.expanded}
            key={file.name}
            onTouchTap={this._handleFileToggle.bind(this, fileId)}
            leftIcon={leftIconButton}
            nestedItems={this._renderMetrics(file)}
            primaryText={<div style={this._styles.file}>{file.name}</div>}
            ref={`file-toggle-${fileId}`}
            rightIconButton={contextMenu}
            />
        );
      }
    });
  }

  render() {
    let uploaded = this.props.files.filter((file) => file.type === 'uploaded');
    let uploadCount = uploaded.length || 0;
    let deleteConfirmDialog = this.state.deleteConfirmDialog || {};
    let dialogOpen = this.state.deleteConfirmDialog !== null;
    let sampleAttrs = {key: 'sample'};
    let dialogActions = [
      <FlatButton
        label={this._config.get('button:cancel')}
        onTouchTap={this._dismissDeleteConfirmDialog.bind(this)}
        />,
      <RaisedButton
        label={this._config.get('button:delete')}
        onTouchTap={deleteConfirmDialog.callback}
        primary={true}
        ref="submit"
        />
    ];
    let userFiles = (
      <List key="uploaded">
        {this._renderFiles('uploaded')}
      </List>
    );
    let filesList, sampleFiles;

    if (uploadCount > 0) {
      sampleAttrs.subheader = this._config.get('heading:data:sample');
      sampleAttrs.subheaderStyle = this._styles.subhead;
    }
    sampleFiles = (
      <List {...sampleAttrs}>
        {this._renderFiles('sample')}
      </List>
    );
    filesList = [userFiles, sampleFiles];

    return (
      <nav>
        {filesList}
        <Dialog
          actions={dialogActions}
          onRequestClose={this._dismissDeleteConfirmDialog.bind(this)}
          open={dialogOpen}
          ref="deleteConfirmDialog"
          title={deleteConfirmDialog.title}
          >
            {deleteConfirmDialog.message}
        </Dialog>
      </nav>
    );
  }
}
