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

import 'roboto-fontface/css/roboto-fontface.css';

import {File} from 'file-api';
import provideContext from 'fluxible-addons-react/provideContext';
import RaisedButton from 'material-ui/lib/raised-button';
import React from 'react';
import {remote} from 'electron';
import ThemeDecorator from 'material-ui/lib/styles/theme-decorator';
import ThemeManager from 'material-ui/lib/styles/theme-manager';

import FileValidateAction from '../actions/FileValidate';
import FileList from './FileList';
import FileDetails from './FileDetails';
import HTMStudioTheme from '../lib/MaterialUI/HTMStudioTheme';
import LeftNav from './LeftNav';
import ModelList from './ModelList';

const app = remote.app;
const dialog = remote.require('dialog');


/**
 * React Main View Component
 */
@provideContext({
  getConfigClient: React.PropTypes.func,
  getLogger: React.PropTypes.func,
  getDatabaseClient: React.PropTypes.func,
  getFileClient: React.PropTypes.func,
  getGATracker: React.PropTypes.func,
  getModelClient: React.PropTypes.func,
  getParamFinderClient: React.PropTypes.func
})
@ThemeDecorator(ThemeManager.getMuiTheme(HTMStudioTheme)) // eslint-disable-line new-cap
export default class Main extends React.Component {

  static get contextTypes() {
    return {
      executeAction: React.PropTypes.func.isRequired,
      getParamFinderClient: React.PropTypes.func,
      getConfigClient: React.PropTypes.func,
      getModelClient: React.PropTypes.func,
      muiTheme: React.PropTypes.object
    };
  }

  constructor(props, context) {
    super(props, context);
    let muiTheme = this.context.muiTheme;

    this._config = this.context.getConfigClient();

    this._styles = {
      root: {},
      add: {
        marginLeft: '1.1rem',
        marginTop: '1.1rem',
        minWidth: '45%'  // add button more wide
      },
      addLabel: {
        fontSize: 13,
        fontWeight: muiTheme.rawTheme.font.weight.medium
      },
      models: {
        position: 'fixed',
        overflowX: 'hidden',
        overflowY: 'auto',
        top: 0,
        bottom: 0,
        right: 0,
        left: muiTheme.leftNav.width,
        padding: '1rem'
      }
    };
  }

  /**
   * Add/Upload new data/CSV file button onClick event handler
   */
  _onClick() {
    let file = {};
    let selected = dialog.showOpenDialog({
      title: this._config.get('dialog:file:add:title'),
      defaultPath: app.getPath('desktop'),
      filters: [
        {name: 'CSV', extensions: ['csv']}
      ],
      properties: ['openFile']
    });
    if (selected && selected.length > 0) {
      file = new File({path: selected[0]});
      this.context.executeAction(FileValidateAction, file.path);
    }
  }

  /**
   * Render
   * @return {object} Abstracted React/JSX DOM representation to render to HTML
   * @TODO refactor to better sub-components with individuated styles
   * @TODO check up zIndex and zDepths
   * @TODO Tooltip on + ADD icon - "Upload new CSV file" or something
   */
  render() {
    return (
      <main style={this._styles.root}>
        <LeftNav>
          <RaisedButton
            label={this._config.get('button:add')}
            labelStyle={this._styles.addLabel}
            onClick={this._onClick.bind(this)}
            primary={true}
            style={this._styles.add}
            />
          <FileList/>
        </LeftNav>
        <section style={this._styles.models}>
          <ModelList />
        </section>
        <FileDetails/>
      </main>
    );
  }
}
