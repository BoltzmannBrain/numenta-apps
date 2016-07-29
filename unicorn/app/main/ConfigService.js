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

import nconf from 'nconf';
import path from 'path';
import isElectronRenderer from 'is-electron-renderer';

import DEFAULT_CONFIG_FILE from '../config/default.json';
import DEVELOPMENT_CONFIG_FILE from '../config/environment.development.json';
import PRODUCTION_CONFIG_FILE from '../config/environment.production.json';
const CONFIG_PATH = path.join(__dirname, '..', 'config');

/**
 * HTM Studio: ConfigService - Respond to a ConfigClient over IPC, sharing our
 *  access to the Node-layer config settings.
 * @return {Object} - Configuration data handler object
 */
function createConfigService() {
  const config = nconf.env().argv();

  // Global environment
  config.defaults(DEFAULT_CONFIG_FILE);

  /* eslint-disable no-process-env */
  if (process.env.NODE_ENV === 'development') {
    config.overrides(DEVELOPMENT_CONFIG_FILE);
  } else {
    config.overrides(PRODUCTION_CONFIG_FILE);
  }
  /* eslint-ensable no-process-env */

  // Set first file/store to user settings
  let location = path.join(CONFIG_PATH, 'user.settings.json');
  if (!isElectronRenderer) {
    try {
      const app = require('app'); // eslint-disable-line
      location = path.join(app.getPath('userData'), 'settings2.json');
    } catch (error) { /* no-op */ }
  }
  // User settings
  config.file('user', location);

  return config;
}


// Returns singleton
const INSTANCE = createConfigService();
export default INSTANCE;
