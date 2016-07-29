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

/* eslint-disable callback-return */

const assert = require('assert');
import {createMockActionContext} from 'fluxible/utils';
import FileStore from '../../../../app/browser/stores/FileStore';
import DeleteFileAction from '../../../../app/browser/actions/DeleteFile';
import {ACTIONS} from '../../../../app/browser/lib/Constants';
import MockGATracker from './MockGATracker';

const EXPECTED_ERROR = {
  type:'NotFoundError'
};

class MockDatabaseClient {
  deleteFile(filename, callback) {
    if (filename === null) {
      callback(EXPECTED_ERROR);
    } else {
      callback();
    }
  }
}

describe('DeleteFileAction', () => {
  let actionContext, gaTracker;

  beforeEach(() => {
    actionContext = createMockActionContext({
      stores: [FileStore]
    });
    gaTracker = new MockGATracker();
    actionContext['getDatabaseClient'] = () => {
      return new MockDatabaseClient();
    }
    actionContext['getGATracker'] = () => {
      return gaTracker;
    }
  });

  it('should dispatch DELETE_FILE', (done) => {
    actionContext.executeAction(DeleteFileAction, 'expected_filename')
      .then((filename) => {
        assert.equal(actionContext.dispatchCalls.length, 1);
        let dispatchCalls = actionContext.dispatchCalls[0];
        assert.equal(dispatchCalls.name, ACTIONS.DELETE_FILE);
        assert.equal(dispatchCalls.payload, 'expected_filename');
        // Check store
        let store = actionContext.getStore(FileStore);
        let actual = store.getFile('expected_filename');
        assert.equal(actual, null);
        done();
      });
  });
  it('should dispatch DELETE_FILE_FAILED', (done) => {
    actionContext.executeAction(DeleteFileAction, null)
      .catch((error) => {
        assert.equal(actionContext.dispatchCalls.length, 1);
        let dispatchCalls = actionContext.dispatchCalls[0];
        assert.equal(dispatchCalls.name, ACTIONS.DELETE_FILE_FAILED);
        assert.deepEqual(dispatchCalls.payload, {
          filename: null, error: EXPECTED_ERROR
        });
        done();
      });
  });
});
