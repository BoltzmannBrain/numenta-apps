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

import connectToStores from 'fluxible-addons-react/connectToStores';
import IconCheckbox from 'material-ui/lib/svg-icons/toggle/check-box';
import Paper from 'material-ui/lib/paper';
import React from 'react';
import ReactDOM from 'react-dom';

import Model from './Model';
import ModelStore from '../stores/ModelStore';


/**
 * List of Model Charts, React component
 */
@connectToStores([ModelStore], (context) => ({
  models: context.getStore(ModelStore).getModels(),
  visibleModelStack: context.getStore(ModelStore).getVisibleModelStack()
}))
export default class ModelList extends React.Component {

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

    let muiTheme = this.context.muiTheme;
    this._styles = {
      root: {
        backgroundColor: 'transparent',
        boxShadow: 'none',
        width: '100%'
      },
      empty: {
        marginLeft: (0 - (muiTheme.leftNav.width / 2)) - 33,
        position: 'fixed',
        textAlign: 'center',
        top: '43%',
        transform: 'translateY(-43%)',
        width: '100%'
      },
      emptyMessage: {
        color: muiTheme.rawTheme.palette.accent4Color,
        fontWeight: muiTheme.rawTheme.font.weight.normal,
        left: 8,
        position: 'relative',
        top: -5
      }
    };
  }

  _renderModels() {
    let checkboxColor, emptyMessage;
    if (!this.props.visibleModelStack) {
      emptyMessage = this._config.get('heading:chart:empty');
      checkboxColor = this.context.muiTheme.rawTheme.palette.primary1Color;

      return (
        <div style={this._styles.empty}>
          <IconCheckbox color={checkboxColor} />
          <span style={this._styles.emptyMessage}>{emptyMessage}</span>
        </div>
      );
    }

    return this.props.visibleModelStack
      .map((model) => {
        return (
          <Model key={model.modelId} modelId={model.modelId} />
        );
      });
  }

  /**
   * Work around a Chromium bug.
   *
   * Chromium "hibernates" each canvas when the page is in the
   * background. On Mac OS X with a "retina" display, it often fails
   * to unhibernate, leaving a blank canvas.
   *
   * This won't be necessary with the next version of Electron.
   * FIXME: https://jira.numenta.com/browse/UNI-484
   *
   * @see https://bugs.chromium.org/p/chromium/issues/detail?id=588434
   */
  _onVisibilityChange() {
    if (!document.hidden) {
      let element = ReactDOM.findDOMNode(this.refs['root']);
      let canvases = element.getElementsByTagName('canvas');

      for (let i = 0; i < canvases.length; i++) {
        let canvas = canvases[i];
        let ctx = canvas.getContext('2d');
        let imagedata = ctx.getImageData(0, 0, canvas.width, canvas.height);

        canvas.height += 1;
        canvas.height -= 1;

        ctx.putImageData(imagedata, 0, 0);

        // We caused the transform to reset. The Dygraphs "retina"
        // display handling assumes the transform won't change.
        let scale = canvas.height / canvas.offsetHeight;
        ctx.transform(scale, 0, 0, scale, 0, 0);
      }
    }
  }

  componentDidMount() {
    this._onVisibilityChangeWrapper = this._onVisibilityChange.bind(this);
    document.addEventListener('visibilitychange',
                              this._onVisibilityChangeWrapper);
  }

  componentWillUnmount() {
    document.removeEventListener(this._onVisibilityChangeWrapper);
  }

  render() {
    return (
      <Paper style={this._styles.root} zDepth={this.props.zDepth} ref="root">
        {this._renderModels()}
      </Paper>
    );
  }
}
