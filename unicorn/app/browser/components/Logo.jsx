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

import Avatar from 'material-ui/lib/avatar';
import React from 'react';


/**
 * Logo custom View Component
 */
export default class Logo extends React.Component {

  static get contextTypes() {
    return {
      getConfigClient: React.PropTypes.func,
      muiTheme: React.PropTypes.object
    };
  }

  constructor(props, context) {
    super(props, context);

    this._config = this.context.getConfigClient();

    let muiTheme = this.context.muiTheme;
    this._styles = {
      root: {
        backgroundColor: muiTheme.rawTheme.palette.primary2Color,
        borderBottom: '5px solid #29aae2',
        color: muiTheme.appBar.textColor,
        height: props.height,
        margin: 0,
        padding: muiTheme.rawTheme.spacing.desktopGutter,
        paddingTop: muiTheme.rawTheme.spacing.desktopGutter - 5,
        width: '100%'
      },
      avatar: {
        backgroundColor: 'none',
        border: 0,
        borderRadius: 'none',
        marginLeft: -5
      },
      title: {
        fontSize: '160%',
        fontWeight: muiTheme.rawTheme.font.weight.light,
        letterSpacing: '0.33px',
        position: 'relative',
        left: '0.8rem',
        top: '-5px'
      },
      titleStrong: {
        fontWeight: muiTheme.rawTheme.font.weight.medium
      }
    };
  }

  /**
   * Render
   * @return {object} Abstracted React/JSX DOM representation to render to HTML
   */
  render() {
    let titles = this._config.get('title').split(' ');

    return (
      <header style={this._styles.root}>
        <Avatar
          size={40}
          style={this._styles.avatar}
          src="assets/images/numenta-mark.svg"
          />
        <span style={this._styles.title}>
          <span style={this._styles.titleStrong}>{titles[0]}</span> {titles[1]}
        </span>
      </header>
    );
  }

}
