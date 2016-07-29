/* -----------------------------------------------------------------------------
 * Copyright © 2016, Numenta, Inc. Unless you have purchased from
 * Numenta, Inc. a separate commercial license for this software code, the
 * following terms and conditions apply:
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Affero Public License version 3 as published by
 * the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero Public License for
 * more details.
 *
 * You should have received a copy of the GNU Affero Public License along with
 * this program. If not, see http://www.gnu.org/licenses.
 *
 * http://numenta.org/licenses/
 * -------------------------------------------------------------------------- */

import path from 'path';
import {ModelService} from '../../../../app/main/ModelService';
const assert = require('assert');

const FIXTURES = path.resolve(__dirname, '..', '..', 'fixtures');
const MODEL_ID = '1';
const CSV_FILE = path.join(FIXTURES, 'rec-center.csv');

const MODEL_RUNNER_INPUT = require('../../fixtures/model_runner_input.json');
MODEL_RUNNER_INPUT['csv'] = CSV_FILE;
const MODEL_RUNNER_AGG = require('../../fixtures/model_runner_agg.json');
const MODEL_RUNNER_MODEL = require('../../fixtures/model_runner_model.json');

/* eslint-disable max-nested-callbacks */

describe('ModelService', () => {
  let service = new ModelService();
  let modelId = MODEL_ID;
  let inputOpt = MODEL_RUNNER_INPUT;
  let aggregationOpt = MODEL_RUNNER_AGG;
  let modelOpt = MODEL_RUNNER_MODEL;
  beforeEach(() => {
    service.createModel(modelId, inputOpt, aggregationOpt, modelOpt);
  });
  afterEach(() => {
    try {
      service.removeModel(MODEL_ID);
    } catch (ignore) {
      /* It may be closed by the test itself */
    }
  });

  describe('#getModels()', () => {
    it('Check model exists', (done) => {
      let models = service.getModels();
      assert(models.find((id) => (id) === MODEL_ID), 'Model not found');
      done();
    });
  });

  describe('Model Events', () => {
    it('Model Runner should return an index + ModelData pair', (done) => {
      service.on(MODEL_ID, (type, data) => {
        assert.notEqual(type, 'error', data);
        if (type === 'data') {
          let [index, modelData] = data;
          assert.equal(0, index);
          assert('iso_timestamp' in modelData);
          assert('naive_time' in modelData);
          assert('metric_value' in modelData);
          assert('anomaly_score' in modelData);
          service.removeAllListeners(MODEL_ID);
          done();
        }
      });
    });
  });

  describe('Model concurrency', () => {
    it('Create models up to max concurrency', (done) => {
      let max = service.availableSlots();
      // The first model was created in 'beforeEach'
      for (let i = 1; i <= max; i++) {
        service.createModel(MODEL_ID + i, inputOpt, aggregationOpt, modelOpt);
      }
      // Cleanup
      for (let i = 1; i <= max; i++) {
        service.removeModel(MODEL_ID + i);
      }
      done();
    });
    it('Create models past max concurrency', (done) => {
      let max = service.availableSlots();
      // The first model was created in 'beforeEach'
      for (let i = 1; i <= max; i++) {
        service.createModel(MODEL_ID + i, inputOpt, aggregationOpt, modelOpt);
      }
      // Extra model
      assert.throws(() => {
        service.createModel('extra', inputOpt, aggregationOpt, modelOpt);
      }, /Too many models/);
      // Cleanup
      for (let i = 1; i <= max; i++) {
        service.removeModel(MODEL_ID + i);
      }
      done();
    });
  });
});
