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

const CONFIG_FILE = 'default.json';
const CONFIG_PATH = path.join('js', 'config');

const Defaults = {
  NODE_ENV: 'development',
  TEST_HOST: 'http://localhost',
  TEST_PATH: '',
  TEST_PORT: 8008
};


/**
 * Unicorn: ConfigService - Respond to a ConfigClient over IPC, sharing our
 *  access to the Node-layer config settings.
 * @return {Object} - Configuration data handler object
 */
function createConfigService() {
  const config = nconf.env().argv().defaults(Defaults);

  // Set first file/store to user settings
  let location = path.join(CONFIG_PATH, 'user.settings.json');
  if (!isElectronRenderer) {
    try {
      const app = require('app'); // eslint-disable-line
      location = path.join(app.getPath('userData'), 'settings.json')
    } catch (error) { /* no-op */ }
  }
  // User settings
  config.file('user', location);

  // Global environment
  config.file(path.join(CONFIG_PATH, CONFIG_FILE));
  config.file(
    'environment',
    path.join(CONFIG_PATH, `environment.${config.get('NODE_ENV')}.json`)
  );

  return config;
}


// Returns singleton
const INSTANCE = createConfigService();
export default INSTANCE;
