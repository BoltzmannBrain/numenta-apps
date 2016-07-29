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
import bunyan from 'bunyan';
import config from './ConfigService';
import path from 'path';
import os from 'os';

const DEFAULT = {
  name: 'main',
  level: 'error',
  serializers: bunyan.stdSerializers
}

/**
 * Get Log location
 * @param  {string} filename Log file name
 * @return {string}          Log full path name. Usually relative to the
 *                           application data folder
 */
function _getLogLocation(filename) {
  let location = filename;
  if (!path.isAbsolute(location)) {
    try {
      const app = require('app'); // eslint-disable-line
      location = path.join(app.getPath('userData'), filename);
    } catch (error) {
      location = path.join(os.tmpdir(), filename);
    }
  }
  return location;
}

// Merge settings with default values
let settings = Object.assign({}, DEFAULT, config.get('logging'));

// Update log file path
if (settings.streams) {
  settings.streams = settings.streams.map((s) => {
    s.path = _getLogLocation(s.path);
    return s;
  });
}

const INSTANCE = bunyan.createLogger(settings);
export default INSTANCE;
