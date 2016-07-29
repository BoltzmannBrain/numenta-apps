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


import Paper from 'material-ui/lib/paper';
import React from 'react';

import Logo from './Logo';


/**
 * LeftNav custom View Component
 */
export default class LeftNav extends React.Component {

  static get contextTypes() {
    return {
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

    let muiTheme = this.context.muiTheme;
    this._logoHeight = muiTheme.appBar.height * 1.2;
    this._styles = {
      root: {
        backgroundColor: muiTheme.leftNav.color,
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        width: muiTheme.leftNav.width
      },
      // Use another 'fixed' element rather than an 'absolute' element to dodge
      // a Chromium bug that shifts the scrollbar to make room for a box shadow.
      // https://bugs.chromium.org/p/chromium/issues/detail?id=582358
      childrenContainer: {
        position: 'fixed',
        overflowX: 'hidden',
        overflowY: 'auto',
        top: this._logoHeight,
        bottom: 0,
        left: 0,
        width: muiTheme.leftNav.width
      }
    };
  }

  /**
   * Render
   * @return {object} Abstracted React/JSX DOM representation to render to HTML
   */
  render() {
    return (
      <Paper style={this._styles.root} zDepth={this.props.zDepth}>
        <Logo height={this._logoHeight} />
        <div style={this._styles.childrenContainer}>
          {this.props.children}
        </div>
      </Paper>
    );
  }

}
