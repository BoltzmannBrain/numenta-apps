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

/* eslint-disable no-process-env */

const webpack = require('webpack');

// Get current environment ('development' or 'production')
const DEVELOPMENT = process.env.NODE_ENV === 'development';

/**
 * WebPack ES6 Config File
 */
export default {
  bail: true,
  plugins: [
    new webpack.EnvironmentPlugin([
      'NODE_ENV', 'GA_TRACKING_ID'
    ])
  ],
  devtool: DEVELOPMENT ? 'source-map' : null,
  entry: ['babel-polyfill', './app/browser/entry'],
  module: {
    loaders: [
      // fonts
      {
        test: /\.woff(2)?$/,
        loaders: ['url-loader?limit=10000&mimetype=application/font-woff']
      },
      {
        test: /\.(ttf|eot|svg)$/,
        loaders: ['file-loader']
      },

      // style
      {
        test: /\.css$/,
        loaders: ['style-loader', 'css-loader']
      },

      // script
      {
        test: /\.(js|jsx)$/,
        loaders: ['babel-loader'],
        exclude: /node_modules/
      },
      {
        test: /\.json$/,
        loaders: ['json-loader']
      }
    ]
  },
  output: {
    filename: 'bundle.js',
    path: './app/browser/assets/bundle',
    publicPath: './assets/bundle/'
  },
  resolve: {
    extensions: [
      '',
      '.css',
      '.eot', '.svg', '.ttf', '.woff', '.woff2',
      '.js', '.json', '.jsx'
    ]
  },
  target: 'electron'
};
