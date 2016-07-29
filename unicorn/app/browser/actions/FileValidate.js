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

import {ACTIONS} from '../lib/Constants';
/**
 * Validate the file
 *
 * @param {FluxibleContext} actionContext FluxibleContext
 * @param  {string} filename      File full path name
 * @return {Promise}
 */
export default function (actionContext, filename) {
  actionContext.getGATracker().event('ACTION', ACTIONS.VALIDATE_FILE);

  return new Promise((resolve, reject) => {
    let fs = actionContext.getFileClient();
    let db = actionContext.getDatabaseClient();

    db.getFileByName(filename, (err, dbfile) => { // eslint-disable-line
      if (dbfile) {
        let file = JSON.parse(dbfile);
        actionContext.getGATracker().exception(ACTIONS.VALIDATE_FILE_FAILED);
        actionContext.dispatch(ACTIONS.VALIDATE_FILE_FAILED, {
          error: 'File already exists', warning: null, file, fields: []
        });
      } else {
        fs.validate(filename, (error, warning, results) => {
          if (error) {
            actionContext.getGATracker()
              .exception(ACTIONS.VALIDATE_FILE_FAILED);
            actionContext.dispatch(ACTIONS.VALIDATE_FILE_FAILED, {
              error, warning, ...results
            });
          } else if (warning) {
            actionContext.dispatch(ACTIONS.VALIDATE_FILE_WARNING, {
              error, warning, ...results
            });
          } else {
            actionContext.dispatch(ACTIONS.VALIDATE_FILE, results);
          }
        });
      }
    });
  });
}
