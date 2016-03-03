// Numenta Platform for Intelligent Computing (NuPIC)
// Copyright (C) 2015, Numenta, Inc.  Unless you have purchased from
// Numenta, Inc. a separate commercial license for this software code, the
// following terms and conditions apply:
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero Public License version 3 as
// published by the Free Software Foundation.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
// See the GNU Affero Public License for more details.
//
// You should have received a copy of the GNU Affero Public License
// along with this program.  If not, see http://www.gnu.org/licenses.
//
// http://numenta.org/licenses/


const assert = require('assert');
import instantiator from 'json-schema-instantiator';

import path from 'path';

import service from '../../../../js/main/FileService';
import Utils from '../../../../js/main/Utils';
import {DBMetricSchema} from '../../../../js/database/schema';

// Contents of 'fixture/file.csv'
const EXPECTED_CONTENT =
`timestamp,metric
2015-08-26T19:46:31+17:00,21
2015-08-26T19:47:31+17:00,17
2015-08-26T19:48:31+17:00,22
2015-08-26T19:49:31+17:00,21
2015-08-26T19:50:31+17:00,16
2015-08-26T19:51:31+17:00,19
`;

// Expected data
const EXPECTED_DATA = [
  {timestamp: '2015-08-26T19:46:31+17:00', metric: '21'},
  {timestamp: '2015-08-26T19:47:31+17:00', metric: '17'},
  {timestamp: '2015-08-26T19:48:31+17:00', metric: '22'},
  {timestamp: '2015-08-26T19:49:31+17:00', metric: '21'},
  {timestamp: '2015-08-26T19:50:31+17:00', metric: '16'},
  {timestamp: '2015-08-26T19:51:31+17:00', metric: '19'}
];

const FILENAME_SMALL = path.resolve(__dirname, '../fixtures/file.csv');
const FILENAME_LARGE = path.resolve(__dirname, '../fixtures/rec-center-15.csv');

// Expected fields
const FILENAME_SMALL_ID = Utils.generateFileId(FILENAME_SMALL);
const METRIC_INSTANCE = instantiator.instantiate(DBMetricSchema);
const EXPECTED_FIELDS = [
  Object.assign({}, METRIC_INSTANCE, {
    uid: Utils.generateMetricId(FILENAME_SMALL, 'timestamp'),
    file_uid: FILENAME_SMALL_ID,
    name: 'timestamp',
    type: 'date',
    format: 'YYYY-MM-DDTHH:mm:ssZ'
  }),
  Object.assign({}, METRIC_INSTANCE, {
    uid: Utils.generateMetricId(FILENAME_SMALL, 'metric'),
    file_uid: FILENAME_SMALL_ID,
    name: 'metric',
    type: 'number'
  })];

// Expected statistics for the whole file
const EXPECTED_MIN = 16;
const EXPECTED_MAX = 22;
const EXPECTED_SUM = 116;
const EXPECTED_MEAN = 19.333333333333332;
const EXPECTED_COUNT = 6;
const EXPECTED_VARIANCE = 5.866666666666665 ;
const EXPECTED_STDEV = 2.422120283277993 ;

// Expected statistics for the first 2 lines
const EXPECTED_MIN_PARTIAL = 17;
const EXPECTED_MAX_PARTIAL = 21;

// Keep this list up to date with file names in "samples/"
const EXPECTED_SAMPLE_FILES = ['gym.csv'];


/* eslint-disable max-nested-callbacks */
describe('FileService', () => {
  describe('#getSampleFiles()', () => {
    it('should list sample files', (done) => {
      service.getSampleFiles((error, files) => {
        assert.ifError(error);
        assert.deepEqual(files.map((f) => {
          return f.name;
        }), EXPECTED_SAMPLE_FILES, 'Got unexpected file names');
        assert(files.every((f) => {
          return f.type === 'sample';
        }), 'Expecting "sample" files only');
        done();
      });
    });
  });

  describe('#getContents', () => {
    it('should get File Contents', (done) => {
      service.getContents(FILENAME_SMALL, (error, data) => {
        assert.ifError(error);
        assert.equal(data, EXPECTED_CONTENT, 'Got different file content');
        done();
      });
    });
  });

  describe('#getFields', () => {
    it('should get fields using default options', (done) => {
      service.getFields(FILENAME_SMALL, (error, fields) => {
        assert.ifError(error);
        assert.deepEqual(fields, EXPECTED_FIELDS);
        done();
      });
    });
  });

  describe('#getData', () => {
    it('should get data using default options', (done) => {
      let i = 0;
      service.getData(FILENAME_SMALL, (error, data) => {
        assert.ifError(error);
        if (data) {
          let row = JSON.parse(data);
          assert.deepEqual(row, EXPECTED_DATA[i++]);
        } else {
          done();
        }
      });
    });

    it('should get data with limit=1', (done) => {
      service.getData(FILENAME_SMALL, {limit: 1}, (error, data) => {
        assert.ifError(error);
        if (data) {
          let row = JSON.parse(data);
          assert.deepEqual(row, EXPECTED_DATA[0]);
        } else {
          done();
        }
      });
    });

    it('should get aggregated data', (done) => {
      let options = {
        limit: 1,
        aggregation: {
          timefield: 'timestamp',
          valuefield: 'kw_energy_consumption',
          function: 'count',
          interval: 24 * 60 * 60 * 1000
        }
      };
      service.getData(FILENAME_LARGE, options, (error, data) => {
        assert.ifError(error);
        if (data) {
          let row = JSON.parse(data);
          assert.equal(row['kw_energy_consumption'], 96);
        } else {
          done();
        }
      });
    });
  });

  describe('#getStatistics', () => {
    it('should get statistics for the whole file', (done) => {
      service.getStatistics(FILENAME_SMALL, (error, data) => {
        assert.ifError(error);
        assert.equal(data.count, EXPECTED_COUNT, 'Got different "Count"');
        assert.equal(data.fields['metric'].min, EXPECTED_MIN,
                                                'Got different "Min"');
        assert.equal(data.fields['metric'].max, EXPECTED_MAX,
                                                'Got different "Max"');
        assert.equal(data.fields['metric'].sum, EXPECTED_SUM,
                                                'Got different "Sum"');
        assert.equal(data.fields['metric'].mean, EXPECTED_MEAN,
                                          'Got different "Mean"');
        assert.equal(data.fields['metric'].variance, EXPECTED_VARIANCE,
                                              'Got different "Variance"');
        assert.equal(data.fields['metric'].stdev, EXPECTED_STDEV,
                                          'Got different "Standard Deviation"');
        done();
      });
    });

    it('should get statistics for some records of the file', (done) => {
      service.getStatistics(FILENAME_SMALL, {limit: 2}, (error, data) => {
        assert.ifError(error);
        assert.equal(data.fields['metric'].min, EXPECTED_MIN_PARTIAL);
        assert.equal(data.fields['metric'].max, EXPECTED_MAX_PARTIAL);
        done();
      });
    });
  });
});
