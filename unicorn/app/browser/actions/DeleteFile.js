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


import {ACTIONS} from '../lib/Constants';


/**
 * Delete file and its models from the database
 * @param  {FluxibleContext} actionContext -
 * @param  {string} filename - The name of the file to delete.
 *                             Must be in the {@link FileStore
 * @emits {DELETE_FILE}
 * @emits {DELETE_FILE_FAILED}
 * @return {Promise}
 */
export default function (actionContext, filename) {
  actionContext.getGATracker().event('ACTION', ACTIONS.DELETE_FILE);

  return new Promise((resolve, reject) => {
    let database = actionContext.getDatabaseClient();
    // Delete file and its data
    database.deleteFile(filename, (error) => {
      if (error) {
        actionContext.getGATracker().exception(ACTIONS.DELETE_FILE_FAILED);
        actionContext.dispatch(ACTIONS.DELETE_FILE_FAILED, {filename, error});
        reject(error);
      } else {
        actionContext.dispatch(ACTIONS.DELETE_FILE, filename);
        resolve(filename);
      }
    });
  });
}
