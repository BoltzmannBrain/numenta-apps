/* -----------------------------------------------------------------------------
 * Copyright © 2015, Numenta, Inc. Unless you have purchased from
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

'use strict';

import ModelServer from '../../../frontend/lib/ModelServer';
const assert = require('assert');

const STATS = '{"min": 0, "max": 10}';
const INPUT_DATA = '[1438649711, 835.93679]\n';
const EXPECTED_RESULTS = '[0, 0.5]\n';

describe('ModelServer', () => {
  let server = new ModelServer();;
  let modelId = null;

  beforeEach(function () {
    server.addModel(STATS, (error, data) => {
      assert.ifError(error);
      modelId = data.modelId;
    });
  });

  describe('makeSureModelExists', () => {
    it('Check model ID', (done) => {
      assert(modelId, 'Model ID is null');
      done();
    });
  });

  describe('#writeData()', () => {
    it('Write data to child process stdin', (done) => {
      server.addData(modelId, INPUT_DATA, (error, data) => {
        assert.ifError(error);
        assert.equal(data.inputData, INPUT_DATA);
        done();
      });
    });
  });


  describe('#onData()', () => {
    it('Read data from child process', (done) => {
      server.onData(modelId, (error, data) => {
        assert.ifError(error);
        assert.equal(data.outputData, EXPECTED_RESULTS);
        done();
      });
    });
  });
});
