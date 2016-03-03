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

/* eslint-disable max-nested-callbacks */
import Utils from '../../../js/main/Utils';

const assert = require('assert');
const FILENAME = 'file.csv';
const METRIC = 'value';
const TIMESTAMP = 1451635200000;
const EXPECTED_ID = 'abdde62d74437857e643d85dd32f2109fa780a6a';
const EXPECTED_FILE_ID = 'abdde62d74437857';
const EXPECTED_METRIC_ID = 'abdde62d74437857!f32b67c7e26342af';
const EXPECTED_METRICDATA_ID = 'abdde62d74437857!f32b67c7e26342af!1451635200000'; // eslint-disable-line


describe('Utils', () => {
  it('Utils#generateId', (done) => {
    let actual = Utils.generateId(FILENAME);
    assert.equal(actual, EXPECTED_ID)
    done();
  });
  it('Utils#generateFileId', (done) => {
    let actual = Utils.generateFileId(FILENAME);
    assert.equal(actual, EXPECTED_FILE_ID)
    done();
  });
  it('Utils#generateMetricId', (done) => {
    let actual = Utils.generateMetricId(FILENAME, METRIC);
    assert.equal(actual, EXPECTED_METRIC_ID)
    done();
  });
  it('Utils#generateMetricDataId', (done) => {
    let actual = Utils.generateMetricDataId(EXPECTED_METRIC_ID, TIMESTAMP);
    assert.equal(actual, EXPECTED_METRICDATA_ID)
    done();
  });
  it('Utils#trims', (done) => {
    let multiline = `1
2
3
4
5
6
7`;
    let actual = Utils.trims(multiline);
    assert.equal(actual, '1 2 3 4 5 6 7');
    done();
  });
  describe('Utils#promisify', () => {
    it('should resolve', (done) => {
      function callbackFunction(params, callback) {
        callback(null, params);
      }
      Utils.promisify(callbackFunction, FILENAME)
        .then((actual) => {
          assert.equal(actual, FILENAME);
          done();
        })
        .catch(() => assert.fail('it should not reject'));
    });
    it('should reject', (done) => {
      function callbackFunction(params, callback) {
        callback('error');
      }
      Utils.promisify(callbackFunction, FILENAME)
        .then(() => assert.fail('it should not resolve'))
        .catch((error) => {
          assert.equal(error, 'error');
          done();
        });
    });
  });
});
