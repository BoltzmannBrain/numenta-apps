// Copyright © 2016, Numenta, Inc. Unless you have purchased from
// Numenta, Inc. a separate commercial license for this software code, the
// following terms and conditions apply:
//
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU Affero Public License version 3 as published by
// the Free Software Foundation.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero Public License for
// more details.
//
// You should have received a copy of the GNU Affero Public License along with
// this program. If not, see http://www.gnu.org/licenses.
//
// http://numenta.org/licenses/

import {app, BrowserWindow, crashReporter, dialog, Menu} from 'electron';
import bunyan from 'bunyan';
import moment from 'moment';
import path from 'path';

import config from './ConfigService';
import database from './DatabaseService';
import fileService from './FileService';
import modelService from './ModelService';
import paramFinderService from './ParamFinderService';
import MainMenu from './MainMenu';
import ModelServiceIPC from './ModelServiceIPC';
import ParamFinderServiceIPC from './ParamFinderServiceIPC';
import {promisify} from '../common/common-utils';

const log = bunyan.createLogger({
  level: 'debug',  // @TODO higher for Production
  name: config.get('title')
});
const initialPage = path.join(__dirname, config.get('browser:entry'));

let activeModels = new Map();  // Active models and their event handlers
let mainWindow = null;  // global ref to keep window object from JS GC
let modelServiceIPC = null;
let paramFinderServiceIPC = null;


/**
 * Initialize the application populating local data on first run
 */
function initializeApplicationData() {
  // Check if running for the first time
  let initialized = config.get('initialized');
  if (!initialized) {
    // Load sample files from the file system
    promisify(::fileService.getSampleFiles)
      // Save all sample files to the database
      .then((files) => Promise.all(
        files.map((file) => promisify(::database.uploadFile, file)))
      )
      .then(() => {
        // Make sure to only run once
        config.set('initialized', true);
        config.save();
      })
      .catch((error) => {
        log.error(error);
        dialog.showErrorBox('Error', error);
      });
  }
}

/**
 * Handles model data event saving the results to the database
 * @param  {string} modelId Model receiving data
 * @param  {Array} data    model data in the following format:
 *                         [timestamp, metric_value, anomaly_score]
 */
function receiveModelData(modelId, data) {
  let [timestamp, value, score] = data; // eslint-disable-line
  let metricData = {
    metric_uid: modelId,
    timestamp: moment(timestamp).valueOf(),
    metric_value: value,
    anomaly_score: score
  };
  database.putModelData(metricData, (error) => {
    if (error) {
      log.error('Error saving model data', error, metricData);
    }
  });
}

/**
 * Handle application wide model services events
 */
function handleModelEvents() {
  // Attach event handler on model creation
  modelService.on('newListener', (modelId, listener) => {
    if (!activeModels.has(modelId)) {
      let listener = (command, data) => { // eslint-disable-line
        try {
          if (command === 'data') {
            // Handle model data
            receiveModelData(modelId, JSON.parse(data));
          }
        } catch (e) {
          log.error('Model Error', e, modelId, command, data);
        }
      };
      activeModels.set(modelId, listener);
      modelService.on(modelId, listener);
    }
  });

  // Detach event handler on model close
  modelService.on('removeListener', (modelId, listener) => {
    if (activeModels.has(modelId)) {
      let listener = activeModels.get(modelId);
      activeModels.delete(modelId);
      modelService.removeListener(modelId, listener);
    }
  });
}


/**
 * HTM Studio: Cross-platform Desktop Application to showcase basic HTM features
 *  to a user using their own data stream or files.
 *
 * Main Electron code Application entry point, initializes browser app.
 */

crashReporter.start({
  companyName: config.get('company'),
  productName: config.get('title'),
  submitURL: '' // @TODO https://discuss.atom.io/t/electron-crash-report-server/20563
});

app.on('window-all-closed', () => {
  app.quit();
});

// Electron finished init and ready to create browser window
app.on('ready', () => {
  // Initialize application data
  initializeApplicationData();

  // set main menu
  Menu.setApplicationMenu(Menu.buildFromTemplate(MainMenu));

  // create browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 720
    // @TODO fill out options
    //  https://github.com/atom/electron/blob/master/docs/api/browser-window.md
  });
  mainWindow.loadURL(`file://${initialPage}`);
  mainWindow.center();

  // browser window events
  mainWindow.on('closed', () => {
    mainWindow = null; // dereference single main window object
  });

  // browser window web contents events
  mainWindow.webContents.on('crashed', () => {
    dialog.showErrorBox('Error', 'Application crashed');
  });
  mainWindow.webContents.on('did-fail-load', () => {
    dialog.showErrorBox('Error', 'Application failed to load');
  });
  mainWindow.webContents.on('dom-ready', () => {
    log.info('Electron Main: Renderer DOM is now ready!');
  });

  // Handle model service events
  handleModelEvents();

  // Handle IPC communication for the ModelService
  modelServiceIPC = new ModelServiceIPC(modelService);
  modelServiceIPC.start(mainWindow.webContents);

  // Handle IPC communication for the ParamFinderService
  paramFinderServiceIPC = new ParamFinderServiceIPC(paramFinderService);
  paramFinderServiceIPC.start(mainWindow.webContents);
});
