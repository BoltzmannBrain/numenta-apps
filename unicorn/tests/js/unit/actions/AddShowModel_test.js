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

const assert = require('assert');

import {createMockActionContext} from 'fluxible/utils';
import instantiator from 'json-schema-instantiator';
import path from 'path';

import {ACTIONS} from '../../../../app/browser/lib/Constants';
import AddShowModelAction from '../../../../app/browser/actions/AddShowModel';
import {DBModelSchema} from '../../../../app/database/schema';
import {generateMetricId} from '../../../../app/main/generateId';
import ModelStore from '../../../../app/browser/stores/ModelStore';
import MockGATracker from './MockGATracker';

const MODEL_INSTANCE = instantiator.instantiate(DBModelSchema);

const FIXTURES = path.resolve(__dirname, '..', '..', 'fixtures');
const EXPECTED_FILENAME = path.join(FIXTURES, 'file.csv');
const EXPECTED_METRIC_ID = generateMetricId(EXPECTED_FILENAME, 'metric');
const EXPECTED_MODEL = Object.assign({}, MODEL_INSTANCE, {
  modelId: EXPECTED_METRIC_ID,
  filename: EXPECTED_FILENAME,
  timestampField: 'YYYY-MM-DD HH:MM:ssz',
  metric: EXPECTED_METRIC_ID
});

const EXPECTED_ERROR = {
  type: 'NotFoundError'
};

class MockDatabaseClient {
  putModel(model, callback) {
    if (model === null) {
      return callback(EXPECTED_ERROR);
    }
    return callback();
  }
}


/**
 * AddShowModel Action Unit Test
 */
describe('AddShowModelAction', () => {
  let actionContext;

  beforeEach(() => {
    actionContext = createMockActionContext({
      stores: [ModelStore]
    });
    actionContext['getDatabaseClient'] = () => {
      return new MockDatabaseClient();
    }
    actionContext['getGATracker'] = () => {
      return new MockGATracker();
    }
  });

  it('should dispatch ADD_MODEL', () => {
    return actionContext.executeAction(AddShowModelAction, EXPECTED_MODEL)
      .then(() => {
        let actual, dispatchCalls, store;
        assert.equal(actionContext.dispatchCalls.length, 1);
        dispatchCalls = actionContext.dispatchCalls[0];
        assert.equal(dispatchCalls.name, ACTIONS.ADD_MODEL);
        assert.deepEqual(dispatchCalls.payload, EXPECTED_MODEL);
        store = actionContext.getStore(ModelStore);
        actual = store.getModel(EXPECTED_MODEL.modelId);
        assert.deepEqual(actual, EXPECTED_MODEL);
      });
  });
  it('should dispatch ADD_MODEL_FAILED', () => {
    return actionContext.executeAction(AddShowModelAction, null)
      .catch((error) => {
        let dispatchCalls;
        assert.equal(actionContext.dispatchCalls.length, 1);
        dispatchCalls = actionContext.dispatchCalls[0];
        assert.equal(dispatchCalls.name, ACTIONS.ADD_MODEL_FAILED);
        assert.deepEqual(dispatchCalls.payload, {
          error: EXPECTED_ERROR,
          model: null
        });
      });
  });
});
