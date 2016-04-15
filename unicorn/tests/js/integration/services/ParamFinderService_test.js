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
import {ParamFinderService} from '../../../../app/main/ParamFinderService';
const assert = require('assert');

const FIXTURES = path.resolve(__dirname, '..', '..', 'fixtures');
const METRIC_ID = '1';
const CSV_FILE = path.join(FIXTURES, 'rec-center.csv');
const PARAM_FINDER_INPUT = require('../../fixtures/param_finder_input.json');
const PARAM_FINDER_OUTPUT = require('../../fixtures/param_finder_output.json');

PARAM_FINDER_INPUT['csv'] = CSV_FILE;

/* eslint-disable max-nested-callbacks, no-console */

describe('ParamFinderService2', () => {
  let service = new ParamFinderService();
  let metricId = METRIC_ID;
  let inputOpt = PARAM_FINDER_INPUT;

  beforeEach(() => {
    service.createParamFinder(metricId, inputOpt);
  });

  afterEach(() => {
    try {
      service.removeParamFinder(metricId);
    } catch (ignore) {
      console.log(`INFO: tried to remove param finder with
        metricId ${metricId} but got exception`, ignore.name);
      /* It may be closed by the test itself */
    }
  });

  after(() => {
    assert.equal(service.getParamFinders().length, 0,
                 'No param finder should be running');
  });

  describe('#getParamFinders()', () => {
    it('Check param finder exists', (done) => {
      let paramFinders = service.getParamFinders();
      assert(paramFinders.find((id) => (id) === metricId),
        'Param Finder not found');
      done();
    });
  });

  describe('Param Finder Events', () => {
    it('Param Finder Runner should expected results', (done) => {
      service.on(metricId, (type, data) => {
        assert.notEqual(type, 'error', data);
        if (type === 'data') {
          assert.deepEqual(JSON.parse(data), PARAM_FINDER_OUTPUT,
            'Param finder is not retuning the right result.');
          service.removeAllListeners(metricId);
          done();
        }
      });
    });
  });

  describe('Param Finder concurrency', () => {
    it('Create param finder past max concurrency', (done) => {
      assert.equal(service.availableSlots(metricId), 0,
        'No more slots available for this metric');
      // Extra param finder
      assert.throws(() => {
        service.createParamFinder(metricId, inputOpt);
      }, /More than 1 param finder/);
      done();
    });
  });

  describe('Param Finder error handler', () => {
    it('Should return an error', (done) => {
      let badDataMetricId = 'badDataMetric';
      service.createParamFinder(badDataMetricId, {blah: 'blah'});
      service.on(badDataMetricId, (type, data) => {
        assert.equal(type, 'error', data);
        // cleanup
        service.removeParamFinder(badDataMetricId);
        done();
      });
    });
  });
});
