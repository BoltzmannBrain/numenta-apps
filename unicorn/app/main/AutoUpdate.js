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

import {
  app, autoUpdater, dialog
} from 'electron';
import config from './ConfigService';
import os from 'os';
import path from 'path';
import childProcess from 'child_process';
import log from './Logger'

// Squirrel Windows update process name
const UPDATE_EXE =
        path.resolve(path.dirname(process.execPath), '..', 'Update.exe');

/**
 * Execute the squirrel's windows "Update.exe" process and exit
 * @param  {array} args command line arguments to the "Update.exe" process
 */
function _updateWin32(args) {
  try {
    childProcess.spawn(UPDATE_EXE, args, {detached: true})
      .on('close', app.quit);
  } catch (err) {
    log.error({err, args}, 'Update Error');
    dialog.showErrorBox('Update Error', err);
    app.quit();
  }
}

/**
 * Adds support for automatic Updates using Electron's AutoUpdater
 */
export default class AppUpdater {

  constructor(browserWindow) {
    this._window = browserWindow;
    let updateUrl = config.get('update:url');
    let feedUrl = `${updateUrl}/${os.platform()}`;
    // Squirrel.Windows appends '/RELEASES' to the url
    if (os.platform() === 'darwin') {
      // Squirrel.Mac expects JSON response with update information
      feedUrl += `/update.${app.getVersion()}.json`;
    }
    autoUpdater.setFeedURL(feedUrl);

    autoUpdater.addListener('error', (event, error) => {
      // Ingore auto update errors.
      // See https://github.com/electron/electron/issues/4699
    });

    // Per UNI-551/UNI-552
    // Disable update dialog for now as it can take several minutes to complete
    // the update without any progress shown to the user.
    // Uncomment this line to re-enable.
    // autoUpdater.addListener('update-downloaded', this._handleUpdateDownloaded.bind(this));
  }

  _handleUpdateDownloaded(event, notes, name, pubDate, url) {
    let title = config.get('update:readyTitle');

    // Format release notes if given. May not be avaialbe on all platforms
    let detail = config.get('update:detail')
                   .replace('%url', url)
                   .replace('%name', name)
                   .replace('%notes', notes)
                   .replace('%pub_date', pubDate);

    // Format update message
    let message = config.get('update:message')
                        .replace('%url', url)
                        .replace('%name', name)
                        .replace('%notes', notes)
                        .replace('%pub_date', pubDate);

    // Ask the user whether or not we should quit and install the new version
    let buttons = [
      config.get('update:button:yes'),
      config.get('update:button:no')];

    dialog.showMessageBox(this._window, {
      buttons, title, message, detail,
      type: 'question', defaultId: 0, cancelId: 1
    }, (response) => {
      // Check if the user replied "Yes"
      if (response === 0) {
        // Force quit and install the new version
        setTimeout(() => {
          autoUpdater.quitAndInstall();
        });
      }
    });
  }

  /**
   * Checks for and download new updates using Electron's AutoUpdater
   */
  checkForUpdates() {
    if (this._handleSquirrelWindowsEvents()) {
      return;
    }
    autoUpdater.checkForUpdates();
  }

  /**
   * Handle squirrel windows start up process as described in
   * `electron/windows-installer`
   * See https://github.com/electron/windows-installer#handling-squirrel-events
   * for more information
   * @return {boolean} Whether or not an update was applied at start up
   */
  _handleSquirrelWindowsEvents() {
    if (process.platform === 'win32') {
      if (process.argv.length === 1) {
        // No update event was passed at start up
        return false;
      }
      let target = path.basename(process.execPath);

      const squirrelEvent = process.argv[1];
      switch (squirrelEvent) {
      case '--squirrel-install': // fallthrough
      case '--squirrel-updated':
        _updateWin32(['--createShortcut', target]);
        return true;

      case '--squirrel-uninstall':
        _updateWin32(['--removeShortcut', target]);
        return true;

      case '--squirrel-obsolete':
        app.quit();
        return true;

      default:
        return false;
      }
    }
    return false;
  }
}
