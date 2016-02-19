// Copyright © 2015, Numenta, Inc. Unless you have purchased from
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

// import Checkbox from 'material-ui/lib/checkbox'; //  FIXME: UNI-323
import connectToStores from 'fluxible-addons-react/connectToStores';
import Dialog from 'material-ui/lib/dialog';
import FlatButton from 'material-ui/lib/flat-button';
import fs from 'fs';
import List from 'material-ui/lib/lists/list';
import ListItem from 'material-ui/lib/lists/list-item';
import React from 'react';
import Table from 'material-ui/lib/table/table';
import TableBody from 'material-ui/lib/table/table-body';
import TableHeader from 'material-ui/lib/table/table-header';
import TableHeaderColumn from 'material-ui/lib/table/table-header-column';
import TableRow from 'material-ui/lib/table/table-row';
import TableRowColumn from 'material-ui/lib/table/table-row-column';
import TextField from 'material-ui/lib/text-field';

import FileStore from '../stores/FileStore';
import MetricStore from '../stores/MetricStore';
import FileDetailsStore from '../stores/FileDetailsStore';
import FileUpdateAction from '../actions/FileUpdate';
import HideFileDetailsAction from '../actions/HideFileDetails';
import Utils from '../../main/Utils';


/**
 * Show file details page. The file must be available from the {@link FileStore}
 */
@connectToStores([FileDetailsStore], (context) => ({
  filename: context.getStore(FileDetailsStore).getFileName(),
  visible: context.getStore(FileDetailsStore).isVisible(),
  newFile: context.getStore(FileDetailsStore).isNewFile()
}))
export default class FileDetails extends React.Component {

  static contextTypes = {
    executeAction: React.PropTypes.func,
    getStore: React.PropTypes.func,
    getFileClient: React.PropTypes.func,
    muiTheme: React.PropTypes.object
  };

  constructor(props, context) {
    super(props, context);

    this.state = {
      file: null,
      fileSize: 0,
      data: [],
      metrics: new Map()
    };

    this._styles = {
      container: {
        display: 'flex',
        flex: '1 100%',
        flexDirection: 'row'
      },
      fields: {
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0
      },
      metric: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        width: '10rem'
      },
      data: {
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
        margin: 'auto',
        marginLeft: 15,
        border: '1px solid gray'
      },
      tableHeader: {
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    };
  }

  componentWillReceiveProps(nextProps) {
    let file, fileMetrics, stats;
    let fileStore = this.context.getStore(FileStore);
    let metricStore = this.context.getStore(MetricStore);
    let fileClient = this.context.getFileClient();
    let metrics = new Map();
    let data = [];
    let fileSize = 0;

    if (nextProps.visible && nextProps.filename) {
      // Initialize file
      file = fileStore.getFile(nextProps.filename);
      fileMetrics = metricStore.getMetricsByFileId(file.uid);

      // Initialize metrics
      if (file) {
        fileMetrics.forEach((metric) => {
          if (metric.type !== 'date') {
            let modelId = Utils.generateMetricId(file.filename, metric.name);
            metrics.set(modelId, null);
          }
        });

        // File size in bytes
        stats = fs.statSync(file.filename); // eslint-disable-line no-sync
        fileSize = stats.size;

        // Load first 20 records
        fileClient.getData(file.filename, {limit: 20}, (error, buffer) => {
          if (error) {
            throw new Error(error);
          } else if (buffer) {
            data.push(JSON.parse(buffer));
          } else {
            // Initialize State
            this.setState({file, fileSize, data, metrics});
          }
        });
      }
    }
  }

  _handleFileInputChange(e) {
    let name = e.target.name;
    let value = e.target.value;
    let state = this.state;
    state.file[name] = value;
    this.setState(state);
  }

  _onRequestClose() {
    this.context.executeAction(HideFileDetailsAction);
  }

  _onSave() {
    let {file} = this.state;
    if (file) {
      // Update File
      this.context.executeAction(FileUpdateAction, file);
    }
    this.context.executeAction(HideFileDetailsAction);
  }

  _onMetricCheck(modelId, filename, timestampField, metric, event, checked) {
    let state = this.state;
    if (checked) {
      state.metrics.set(modelId, {
        modelId, filename, metric, timestampField
      });
    } else {
      state.metrics.delete(modelId);
    }
    this.setState(state);
  }

  _renderMetrics() {
    let items;
    let file = this.state.file;
    let metricStore = this.context.getStore(MetricStore);
    let fileMetrics = metricStore.getMetricsByFileId(file.uid);
    let timestampField = fileMetrics.find((metric) => {
      return metric.type === 'date';
    });

    if (this.props.newFile && timestampField) {
      items = fileMetrics.map((metric) => {
        // let checked; FIXME: UNI-323
        let modelId;

        if (metric.type !== 'date') {
          modelId = Utils.generateMetricId(file.filename, metric.name);
          // FIXME: UNI-323 Disable multiple model creation until new "multiple models creation" flow is implemented
          // checked = metrics.get(modelId) ? true : false; // eslint-disable-line
          // let metrics = this.state.metrics;
          /*
           return (
           <ListItem
           key={modelId}
           leftCheckbox={
           <Checkbox
           checked={checked}
           name={modelId}
           onCheck={
           this._onMetricCheck.bind(this, modelId, file.filename,
           timestampField.name, metric.name)
           }
           />
           }
           primaryText={<div style={this._styles.metric}>{metric.name}</div>}
           />
           );
           */
          return (
            <ListItem
              key={modelId}
              primaryText={<div style={this._styles.metric}>{metric.name}</div>}
            />
          );
        }
      });
      return (
        // FIXME: UNI-323
        // <List subheader="Create Models" height="50px">
        <List subheader="Metrics" height="50px">
          {items}
        </List>
      );
    }
  }

  _renderDataTable() {
    let columnHeader;
    let data = this.state.data;
    let tableRows = [];

    if (data.length > 0) {
      columnHeader = Object.keys(data[0]).map((name, idx) => {
        return (
          <TableHeaderColumn key={idx} style={this._styles.tableHeader}>
            {name}
          </TableHeaderColumn>
        );
      });

      data.forEach((row, rowIdx) => {
        let columns = [];
        Object.values(row).map((value, colIdx) => {
          columns.push(<TableRowColumn key={colIdx}>{value}</TableRowColumn>);
        });
        tableRows.push(<TableRow key={rowIdx}>{columns}</TableRow>);
      });

      return (
        <Table selectable={false} fixedHeader={true} height="300">
          <TableHeader adjustForCheckbox={false} displaySelectAll={false}
                       enableSelectAll={false}>
            <TableRow>
              {columnHeader}
            </TableRow>
          </TableHeader>
          <TableBody stripedRows={true} displayRowCheckbox={false}>
            {tableRows}
          </TableBody>
        </Table>
      );
    }
  }

  _renderBody() {
    let file = this.state.file;
    let fileSize = this.state.fileSize;

    return (
      <div style={this._styles.container}>
        <div style={this._styles.fields}>
          <TextField
            floatingLabelText="Description"
            multiLine={true}
            name="description"
            onChange={this._handleFileInputChange.bind(this)}
            ref="description"
            rowsMax={1}
            value={file.description}
          />
          <TextField
            floatingLabelText="File Size (bytes)"
            name="fileSize"
            readOnly={true}
            ref="fileSize"
            tabIndex={-1}
            underlineFocusStyle={{display:'none'}}
            underlineStyle={{display:'none'}}
            value={fileSize.toString()}
          />
          {this._renderMetrics()}
        </div>
        <div style={this._styles.data}>
          {this._renderDataTable()}
        </div>
      </div>
    );
  }

  render() {
    let body, title;
    let actions = [
      <FlatButton
        label="Cancel"
        onRequestClose={this._onRequestClose.bind(this)}
        onTouchTap={this._onSave.bind(this)}
      />,
      <FlatButton
        label="Save"
        onTouchTap={this._onSave.bind(this)}
        primary={true}
        ref="submit"
      />
    ];

    if (this.state.file) {
      title = this.state.file.name;
      body = this._renderBody();
    }

    return (
      <Dialog
        open={this.props.visible}
        actions={actions}
        onRequestClose={this._onRequestClose.bind(this)}
        ref="dialog"
        title={title}
      >
        {body}
      </Dialog>
    );
  }
}
