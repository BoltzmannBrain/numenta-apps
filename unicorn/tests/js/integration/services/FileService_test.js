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

import moment from 'moment';
import path from 'path';

import service from '../../../../app/main/FileService';
import {
  generateMetricId, generateFileId
} from '../../../../app/main/generateId';
import {
  DBFileSchema, DBMetricSchema
} from '../../../../app/database/schema';

function createFileInstance(filename, properties) {
  return Object.assign({}, FILE_INSTANCE, {
    filename,
    uid: generateFileId(filename),
    name: path.basename(filename)
  }, properties);
}

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

const FIXTURES = path.resolve(__dirname, '..', '..', 'fixtures');
const FILENAME_SMALL = path.join(FIXTURES, 'file.csv');
const FILENAME_LARGE =  path.join(FIXTURES, 'rec-center-15.csv');

// Expected fields
const FILENAME_SMALL_ID = generateFileId(FILENAME_SMALL);
const METRIC_INSTANCE = instantiator.instantiate(DBMetricSchema);
const FILE_INSTANCE = instantiator.instantiate(DBFileSchema);
const EXPECTED_FIELDS = [
  Object.assign({}, METRIC_INSTANCE, {
    uid: generateMetricId(FILENAME_SMALL, 'timestamp'),
    file_uid: FILENAME_SMALL_ID,
    name: 'timestamp',
    index: 0,
    type: 'date',
    format: 'YYYY-MM-DDTHH:mm:ssZ'
  }),
  Object.assign({}, METRIC_INSTANCE, {
    uid: generateMetricId(FILENAME_SMALL, 'metric'),
    file_uid: FILENAME_SMALL_ID,
    index: 1,
    name: 'metric',
    type: 'number'
  })
];

const INVALID_CSV_FILE = path.join(FIXTURES, 'invalid.csv');
const TWO_DATES_FILE = path.join(FIXTURES, 'two-dates.csv');
const NO_DATES_FILE = path.join(FIXTURES, 'no-dates.csv');
const INVALID_DATE_FILE = path.join(FIXTURES, 'invalid-date.csv');
const INVALID_DATE_CONTENT_FILE = path.join(FIXTURES, 'invalid-date-content.csv'); // eslint-disable-line
const INVALID_DATE_FORMAT_FILE = path.join(FIXTURES, 'invalid-date-format.csv');
const INVALID_NUMBER_FILE = path.join(FIXTURES, 'invalid-number.csv');
const NO_SCALAR_FILE = path.join(FIXTURES, 'no-scalar.csv');
const NO_HEADER_CSV_FILE = path.join(FIXTURES, 'no-header.csv');
const NO_HEADER_CSV_FILE_ID = generateFileId(NO_HEADER_CSV_FILE);
const EXPECTED_FIELDS_NO_HEADER_CSV_FILE = [
  Object.assign({}, METRIC_INSTANCE, {
    uid: generateMetricId(NO_HEADER_CSV_FILE, 'timestamp'),
    file_uid: NO_HEADER_CSV_FILE_ID,
    name: 'timestamp',
    index: 0,
    type: 'date',
    format: 'YYYY-MM-DDTHH:mm:ssZ'
  }),
  Object.assign({}, METRIC_INSTANCE, {
    uid: generateMetricId(NO_HEADER_CSV_FILE, 'metric1'),
    file_uid: NO_HEADER_CSV_FILE_ID,
    index: 1,
    name: 'metric1',
    type: 'number'
  }),
  Object.assign({}, METRIC_INSTANCE, {
    uid: generateMetricId(NO_HEADER_CSV_FILE, 'metric2'),
    file_uid: NO_HEADER_CSV_FILE_ID,
    index: 2,
    name: 'metric2',
    type: 'number'
  })
];

const IGNORE_FIELDS_FILE = path.join(FIXTURES, 'ignored-fields.csv');
const IGNORE_FIELDS_FILE_ID = generateFileId(IGNORE_FIELDS_FILE);
const EXPECTED_FIELDS_IGNORED = [
  Object.assign({}, METRIC_INSTANCE, {
    uid: generateMetricId(IGNORE_FIELDS_FILE, 'timestamp'),
    file_uid: IGNORE_FIELDS_FILE_ID,
    name: 'timestamp',
    index: 1,
    type: 'date',
    format: 'YYYY-MM-DDTHH:mm:ssZ'
  }),
  Object.assign({}, METRIC_INSTANCE, {
    uid: generateMetricId(IGNORE_FIELDS_FILE, 'metric1'),
    file_uid: IGNORE_FIELDS_FILE_ID,
    index: 4,
    name: 'metric1',
    type: 'number'
  })
];

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
const EXPECTED_SAMPLE_FILES = ['home_data.csv', 'machine_data.csv',
  'nyc_taxi.csv', 'server_data.csv'];

// Use this date to Mock moment now
const EXPECTED_DATE = '2016-03-15T15:09:05-07:00';

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
    it('should get fields from file with header fields', (done) => {
      service.getFields(FILENAME_SMALL, (error, results) => {
        assert.ifError(error);
        assert.equal(results.offset, 1);
        assert.deepEqual(results.fields, EXPECTED_FIELDS);
        done();
      });
    });
    it('should not get fields from non-csv files', (done) => {
      service.getFields(INVALID_CSV_FILE, (error, fields) => {
        assert.equal(error, 'Invalid CSV file');
        done();
      });
    });
    it('should get fields from file without header fields', (done) => {
      service.getFields(NO_HEADER_CSV_FILE, (error, results) => {
        assert.ifError(error);
        assert.equal(results.offset, 0);
        assert.deepEqual(results.fields, EXPECTED_FIELDS_NO_HEADER_CSV_FILE);
        done();
      });
    });
    it('should not validate files with more than one date/time field', (done) => { // eslint-disable-line
      service.getFields(TWO_DATES_FILE, (error, results) => {
        assert.equal(error,
          'The file should have one and only one date/time column');
        done();
      });
    });
    it('should have one date/time field', (done) => {
      service.getFields(NO_DATES_FILE, (error, results) => {
        assert.equal(error,
          'The file should have one and only one date/time column');
        done();
      });
    });
    it('should not validate files with invalid date format', (done) => {
      service.getFields(INVALID_DATE_FILE, (error, results) => {
        assert.equal(error,
          'The date/time format used on column 1 is not supported');
        done();
      });
    });
    it('should have at least one scalar fields', (done) => {
      service.getFields(NO_SCALAR_FILE, (error, results) => {
        assert.equal(error, 'The file should have at least one numeric value');
        done();
      });
    });
    it('should ignore string fields', (done) => {
      service.getFields(IGNORE_FIELDS_FILE, (error, results) => {
        assert.ifError(error);
        assert.deepEqual(results.fields, EXPECTED_FIELDS_IGNORED);
        done();
      });
    });
  });
  describe('#validate', () => {
    let saveDateNow = Date.now;
    before((done) => {
      // Mock 'Date.now' to always return 'EXPECTED_DATE'
      let mockTimeMs = moment(EXPECTED_DATE).valueOf();
      Date.now = function () {
        return mockTimeMs;
      };
      done();
    });
    after((done) => {
      // Restore original 'Date.now' function
      Date.now = saveDateNow;
      done();
    });

    it('should accept valid file', (done) => {
      service.validate(FILENAME_SMALL, (error, results) => {
        assert.ifError(error);
        assert.deepEqual(results.fields, EXPECTED_FIELDS);
        assert.deepEqual(results.file,
          createFileInstance(FILENAME_SMALL, {
            rowOffset: 1,
            records: 7
          }));
        done();
      });
    });
    it('should reject invalid CSV file', (done) => {
      service.validate(INVALID_CSV_FILE, (error, results) => {
        assert.equal(error, 'Invalid CSV file');
        done();
      });
    });
    it('should reject invalid date', (done) => {
      service.validate(INVALID_DATE_CONTENT_FILE, (error, results) => {
        assert.equal(error,
          "Invalid date/time at row 5: The date/time value is 'Not a Date' " +
          "instead of having a format matching 'YYYY-MM-DDTHH:mm:ssZ'. For " +
          `example: '${EXPECTED_DATE}'`
        )
        assert.deepEqual(results.file,
          createFileInstance(INVALID_DATE_CONTENT_FILE, {
            rowOffset: 1,
            records: 7
          }));
        done();
      });
    });
    it('should reject invalid format', (done) => {
      service.validate(INVALID_DATE_FORMAT_FILE, (error, results) => {
        assert.equal(error,
          'Invalid date/time at row 5: The date/time value is ' +
          "'08/26/2015 19:50' instead of having a format matching " +
          `'YYYY-MM-DDTHH:mm:ssZ'. For example: '${EXPECTED_DATE}'`);
        assert.deepEqual(results.file,
          createFileInstance(INVALID_DATE_FORMAT_FILE, {
            rowOffset: 1,
            records: 7
          }));
        done();
      });
    });
    it('should reject invalid number', (done) => {
      service.validate(INVALID_NUMBER_FILE, (error, results) => {
        assert.equal(error, "Invalid number at row 5: Found 'metric' = 'A21'");
        assert.deepEqual(results.file,
          createFileInstance(INVALID_NUMBER_FILE, {
            rowOffset: 1,
            records: 7
          }));
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
    it('should get data with offset=1', (done) => {
      let i = 1;
      service.getData(FILENAME_SMALL, {offset: 1}, (error, data) => {
        assert.ifError(error);
        if (data) {
          let row = JSON.parse(data);
          assert.deepEqual(row, EXPECTED_DATA[i++]);
        } else {
          done();
        }
      });
    });
    it('should get data with offset=1 and limit=1', (done) => {
      service.getData(FILENAME_SMALL, {offset: 1, limit: 1}, (error, data) => {
        assert.ifError(error);
        if (data) {
          let row = JSON.parse(data);
          assert.deepEqual(row, EXPECTED_DATA[1]);
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
