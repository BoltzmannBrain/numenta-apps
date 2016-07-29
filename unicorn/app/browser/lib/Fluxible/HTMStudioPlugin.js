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


/**
 * Fluxible HTM Studio Plugin: plugin exposing HTM Studio clients from contexts
 * @see https://github.com/yahoo/fluxible/blob/master/docs/api/Plugins.md
 */
export default {
  name: 'HTM Studio',

  plugContext(options, context, app) {
    let {
      configClient, logger, databaseClient, fileClient, modelClient,
      paramFinderClient, gaTracker
    } = options;

    return {
      plugActionContext(actionContext, context, app) {
        actionContext.getConfigClient = function () {
          return configClient;
        };
        actionContext.getLogger = function () {
          return logger;
        };
        actionContext.getDatabaseClient = function () {
          return databaseClient;
        };
        actionContext.getFileClient = function () {
          return fileClient;
        };
        actionContext.getModelClient = function () {
          return modelClient;
        };
        actionContext.getParamFinderClient = function () {
          return paramFinderClient;
        };
        actionContext.getGATracker = function () {
          return gaTracker;
        };
      },

      plugComponentContext(componentContext, context, app) {
        componentContext.getConfigClient = function () {
          return configClient;
        };
        componentContext.getLogger = function () {
          return logger;
        };
        componentContext.getDatabaseClient = function () {
          return databaseClient;
        };
        componentContext.getFileClient = function () {
          return fileClient;
        };
        componentContext.getModelClient = function () {
          return modelClient;
        };
        componentContext.getParamFinderClient = function () {
          return paramFinderClient;
        };
        componentContext.getGATracker = function () {
          return gaTracker;
        };
      },

      plugStoreContext(storeContext, context, app) {
        storeContext.getConfigClient = function () {
          return configClient;
        };
        storeContext.getLogger = function () {
          return logger;
        };
        storeContext.getDatabaseClient = function () {
          return databaseClient;
        };
        storeContext.getFileClient = function () {
          return fileClient;
        };
        storeContext.getModelClient = function () {
          return modelClient;
        };
        storeContext.getParamFinderClient = function () {
          return paramFinderClient;
        };
        storeContext.getGATracker = function () {
          return gaTracker;
        };
      }
    };
  } // plugContext
} // HTMStudioPlugin
