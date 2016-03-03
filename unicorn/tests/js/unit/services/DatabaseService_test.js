// Copyright (C) 2016, Numenta, Inc.  Unless you have purchased from
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

/* eslint-disable max-len, prefer-reflect, max-nested-callbacks */

import fs from 'fs';
import instantiator from 'json-schema-instantiator';
import path from 'path';
import os from 'os';

import {DatabaseService} from '../../../../js/main/DatabaseService';
import Utils from '../../../../js/main/Utils';
import {
  DBFileSchema,
  DBMetricSchema, DBMetricDataSchema,
  DBModelSchema, DBModelDataSchema
} from '../../../../js/database/schema';


const assert = require('assert');

const INSTANCES = {
  File: instantiator.instantiate(DBFileSchema),
  Metric: instantiator.instantiate(DBMetricSchema),
  MetricData: instantiator.instantiate(DBMetricDataSchema),
  Model: instantiator.instantiate(DBModelSchema),
  ModelData: instantiator.instantiate(DBModelDataSchema)
};

const AGG_OPTIONS = require('../fixtures/model_runner_agg.json');
const MODEL_OPTIONS = require('../fixtures/model_runner_model.json');
const INPUT_OPTIONS = require('../fixtures/param_finder_input.json');

const EXPECTED_FILENAME = path.resolve(__dirname, '../fixtures/file.csv');
const EXPECTED_FILENAME_ID = Utils.generateFileId(EXPECTED_FILENAME);
const EXPECTED_METRIC_ID = Utils.generateMetricId(EXPECTED_FILENAME, 'metric');
const EXPECTED_TIMESTAMP_ID = Utils.generateMetricId(EXPECTED_FILENAME, 'timestamp');

const EXPECTED_FILE = Object.assign({}, INSTANCES.File, {
  filename: EXPECTED_FILENAME,
  name: path.basename(EXPECTED_FILENAME),
  type: 'uploaded',
  uid: EXPECTED_FILENAME_ID
});

const EXPECTED_MODEL = Object.assign({}, INSTANCES.Model, {
  modelId: `${EXPECTED_FILENAME_ID}!${EXPECTED_METRIC_ID}`,
  filename: EXPECTED_FILENAME,
  timestampField: 'YYYY-MM-DD HH:MM:ssz',
  metric: EXPECTED_METRIC_ID
});

const EXPECTED_METRIC = Object.assign({}, INSTANCES.Metric, {
  uid: EXPECTED_METRIC_ID,
  file_uid: EXPECTED_FILENAME_ID,
  name: 'metric',
  type: 'number'
});

const EXPECTED_TIMESTAMP =  Object.assign({}, INSTANCES.Metric, {
  uid: EXPECTED_TIMESTAMP_ID,
  file_uid: EXPECTED_FILENAME_ID,
  name: 'timestamp',
  type: 'date',
  format: 'YYYY-MM-DDTHH:mm:ssZ'
});

const EXPECTED_METRICS = [EXPECTED_TIMESTAMP, EXPECTED_METRIC];

const EXPECTED_METRIC_DATA = [
  {metric_uid: EXPECTED_METRIC_ID, timestamp: '2015-08-26T19:46:31+17:00', metric_value: 21},
  {metric_uid: EXPECTED_METRIC_ID, timestamp: '2015-08-26T19:47:31+17:00', metric_value: 17},
  {metric_uid: EXPECTED_METRIC_ID, timestamp: '2015-08-26T19:48:31+17:00', metric_value: 22},
  {metric_uid: EXPECTED_METRIC_ID, timestamp: '2015-08-26T19:49:31+17:00', metric_value: 21},
  {metric_uid: EXPECTED_METRIC_ID, timestamp: '2015-08-26T19:50:31+17:00', metric_value: 16},
  {metric_uid: EXPECTED_METRIC_ID, timestamp: '2015-08-26T19:51:31+17:00', metric_value: 19}
];

const EXPECTED_METRIC_WITH_INPUT = Object.assign({}, EXPECTED_METRIC, {
  input_options: INPUT_OPTIONS
});

const EXPECTED_METRIC_WITH_AGGREGATION =  Object.assign({}, EXPECTED_METRIC, {
  aggregation_options: AGG_OPTIONS
});

const EXPECTED_METRIC_WITH_MODEL = Object.assign({}, EXPECTED_METRIC, {
  model_options: MODEL_OPTIONS
});

const EXPECTED_METRIC_WITH_INPUT_AGG_MODEL = Object.assign({}, EXPECTED_METRIC, {
  input_options: INPUT_OPTIONS,
  aggregation_options: AGG_OPTIONS,
  model_options: MODEL_OPTIONS
});

const EXPECTED_MODEL_DATA = Object.assign({}, INSTANCES.ModelData, {
  metric_uid: EXPECTED_METRIC_ID,
  timestamp: '2015-01-01 00:00:00Z',
  metric_value: 1,
  anomaly_score: 1
});

const EXPECTED_EXPORTED_RESULTS =
`timestamp,metric_value,anomaly_score
2015-01-01 00:00:00Z,1,1
2015-01-01 00:00:01Z,1,1
2015-01-01 00:00:02Z,1,1
2015-01-01 00:00:03Z,1,1`;

const TEMP_DIR = path.join(os.tmpDir(), 'unicorn_db');
const EXPORTED_FILENAME = path.join(TEMP_DIR, 'file.csv');


describe('DatabaseService:', () => {
  let service;

  before(() => {
    service = new DatabaseService(TEMP_DIR);
  });
  after(() => {
    service.close((err) => assert.ifError(err));
    service.destroy((err) => assert.ifError(err));
  });
  afterEach(() => {
    // Delete all records
    let db = service.levelup;
    let batch = db.batch();
    db.createReadStream()
      .on('data', (value) => batch.del(value.key))
      .on('error', assert.ifError)
      .on('end', () => batch.write(assert.ifError));
  });

  describe('Schema Validation:', () => {
    it('should validate "File"', (done) => {
      let results = service.validator.validate(EXPECTED_FILE, DBFileSchema);
      assert(results.errors.length === 0, JSON.stringify(results.errors));
      done();
    });
    it('should validate "Metric"', (done) => {
      let results = service.validator.validate(EXPECTED_METRIC, DBMetricSchema);
      assert(results.errors.length === 0, JSON.stringify(results.errors));
      done();
    });
    it('should validate "Metric" with input, aggregation and model options', (done) => {
      let results = service.validator.validate(EXPECTED_METRIC_WITH_INPUT_AGG_MODEL, DBMetricSchema);
      assert(results.errors.length === 0, JSON.stringify(results.errors));
      done();
    });
    it('should validate "MetricData"', (done) => {
      let results = service.validator.validate(EXPECTED_METRIC_DATA[0], DBMetricDataSchema);
      assert(results.errors.length === 0, JSON.stringify(results.errors));
      done();
    });
    it('should validate "Model"', (done) => {
      let results = service.validator.validate(EXPECTED_MODEL, DBModelSchema);
      assert(results.errors.length === 0, JSON.stringify(results.errors));
      done();
    });
    it('should validate "ModelData"', (done) => {
      let results = service.validator.validate(EXPECTED_MODEL_DATA, DBModelDataSchema);
      assert(results.errors.length === 0, JSON.stringify(results.errors));
      done();
    });
  });

  describe('File:', () => {
    it('should add a single file to the database', (done) => {
      service.putFile(EXPECTED_FILE, (error) => {
        assert.ifError(error);
        service.getFile(EXPECTED_FILE.uid, (error, actual) => {
          assert.ifError(error);
          assert.deepStrictEqual(JSON.parse(actual), EXPECTED_FILE);
          done();
        });
      });
    });
    it('should not add invalid file to the database', (done) => {
      let invalid = Object.assign({}, EXPECTED_FILE);
      delete invalid.uid;
      service.putFile(invalid, (error) => {
        assert(error, 'Invalid file was created');
        done();
      });
    });
    it('should add multiple files to the database', (done) => {
      let batch = Array.from(['file1', 'file2'], (uid) => {
        return Object.assign({}, EXPECTED_FILE, {uid});
      });
      service.putFileBatch(batch, (error) => {
        assert.ifError(error);
        service.getAllFiles((error, actual) => {
          assert.ifError(error);
          assert.deepStrictEqual(JSON.parse(actual), batch);
          done();
        });
      });
    });
    it('should load a single file from the database', (done) => {
      let batch = Array.from(['file1', 'file2'], (uid) => {
        return Object.assign({}, EXPECTED_FILE, {uid});
      });
      service.putFileBatch(batch, (error) => {
        assert.ifError(error);
        service.getFile(batch[0].uid, (error, actual) => {
          assert.ifError(error);
          assert.deepStrictEqual(JSON.parse(actual), batch[0]);
          done();
        });
      });
    });
    it('should upload file to the database', (done) => {
      service.uploadFile(EXPECTED_FILENAME, (error, file) => {
        assert.ifError(error);
        service.getFile(EXPECTED_FILENAME_ID, (error, actual) => {
          assert.ifError(error);
          assert.deepStrictEqual(JSON.parse(actual), EXPECTED_FILE);
          assert.ifError(error);
          service.getMetricsByFile(EXPECTED_FILENAME_ID, (error, actual) => {
            assert.ifError(error);
            assert.deepStrictEqual(JSON.parse(actual), EXPECTED_METRICS);
            service.getMetricData(EXPECTED_METRIC_ID, (error, actual) => {
              assert.ifError(error);
              let metric =  JSON.parse(actual);
              assert.equal(metric.length, EXPECTED_METRIC_DATA.length);
              assert.deepStrictEqual(metric, EXPECTED_METRIC_DATA);
              done();
            })
          });
        });
      });
    });
    it('should delete file by name from the database', (done) => {
      service.uploadFile(EXPECTED_FILENAME, (error, file) => {
        assert.ifError(error);
        service.deleteFile(EXPECTED_FILENAME, (error) => {
          assert.ifError(error);
          service.getFile(EXPECTED_FILENAME_ID, (error, actual) => {
            assert(error && error.type === 'NotFoundError',
              'File was not deleted');
            service.getMetricsByFile(EXPECTED_FILENAME_ID, (error, actual) => {
              assert.ifError(error);
              assert.equal(JSON.parse(actual).length, 0);
              service.getMetricData(EXPECTED_METRIC_ID, (error, actual) => {
                assert.ifError(error);
                assert.equal(JSON.parse(actual).length, 0);
                done();
              });
            });
          });
        })
      });
    });
    it('should delete file by id from the database', (done) => {
      service.uploadFile(EXPECTED_FILENAME, (error, file) => {
        service.uploadFile(EXPECTED_FILENAME, (error, file) => {
          assert.ifError(error);
          service.deleteFileById(EXPECTED_FILENAME_ID, (error) => {
            assert.ifError(error);
            service.getFile(EXPECTED_FILENAME_ID, (error, actual) => {
              assert(error && error.type === 'NotFoundError',
                'File was not deleted');
              service.getMetricsByFile(EXPECTED_FILENAME_ID, (error, actual) => {
                assert.ifError(error);
                assert.equal(JSON.parse(actual).length, 0);
                service.getMetricData(EXPECTED_METRIC_ID, (error, actual) => {
                  assert.ifError(error);
                  assert.equal(JSON.parse(actual).length, 0);
                  done();
                });
              });
            });
          })
        });
      });
    });
  });

  describe('Metric:', () => {
    it('should add a single metric to the database', (done) => {
      service.putMetric(EXPECTED_METRIC, (error) => {
        assert.ifError(error);
        service.getMetric(EXPECTED_METRIC.uid, (error, actual) => {
          assert.ifError(error);
          assert.deepStrictEqual(JSON.parse(actual), EXPECTED_METRIC);
          done();
        });
      });
    });
    it('should not add invalid metric to the database', (done) => {
      let invalid = Object.assign({}, EXPECTED_METRIC);
      delete invalid.uid;
      service.putMetric(invalid, (error) => {
        assert(error, 'Invalid Metric was created');
        done();
      });
    });
    it('should add multiple metrics to the database', (done) => {
      let batch = Array.from(['file1!metric1', 'file1!metric2'], (uid) => {
        return Object.assign({}, EXPECTED_METRIC, {uid});
      });
      service.putMetricBatch(batch, (error) => {
        assert.ifError(error);
        service.getAllMetrics((error, actual) => {
          assert.ifError(error);
          assert.deepStrictEqual(JSON.parse(actual), batch);
          done();
        });
      });
    });
    it('should load a single metric from the database', (done) => {
      let batch = Array.from(['file1!metric1', 'file1!metric2'], (uid) => {
        return Object.assign({}, EXPECTED_METRIC, {uid});
      });
      service.putMetricBatch(batch, (error) => {
        assert.ifError(error);
        service.getMetric(batch[0].uid, (error, actual) => {
          assert.ifError(error);
          assert.deepStrictEqual(JSON.parse(actual), batch[0]);
          done();
        });
      });
    });
    it('should get metrics by file from the database', (done) => {
      let batch = Array.from([
        'file1!metric1', 'file1!metric2',
        'file2!metric1', 'file2!metric2'
      ], (uid) => {
        return Object.assign({}, EXPECTED_METRIC, {uid});
      });
      let expected = batch.filter((metric) => {
        return metric.uid.startsWith('file1');
      });
      service.putMetricBatch(batch, (error) => {
        assert.ifError(error);
        service.getMetricsByFile('file1', (error, actual) => {
          assert.ifError(error);
          assert.deepStrictEqual(JSON.parse(actual), expected);
          done();
        });
      });
    })
    it('should delete metric from the database', (done) => {
      // Add metric
      service.putMetric(EXPECTED_METRIC, (error) => {
        assert.ifError(error);
        // Add data
        service.putMetricDataBatch(EXPECTED_METRIC_DATA, (error) => {
          assert.ifError(error);
          // Delete metric
          service.deleteMetric(EXPECTED_METRIC.uid, (error) => {
            assert.ifError(error);
            service.getMetric(EXPECTED_METRIC.uid, (error, actual) => {
              // Make sure metric was deleted
              assert(
                error && error.type === 'NotFoundError',
                'Metric was not deleted'
              );
              // Make sure data was deleted
              service.getMetricData(EXPECTED_METRIC.uid, (error, actual) => {
                assert(JSON.parse(actual).length === 0, 'MetricData was not deleted');
                done();
              });
            });
          });
        });
      });
    });
    it('should delete metrics by file from the database', (done) => {
      // Add metric
      service.putMetric(EXPECTED_METRIC, (error) => {
        assert.ifError(error);
        // Add data
        service.putMetricDataBatch(EXPECTED_METRIC_DATA, (error) => {
          assert.ifError(error);
          // Delete metric
          service.deleteMetricsByFile(EXPECTED_METRIC.file_uid, (error) => {
            assert.ifError(error);
            service.getMetric(EXPECTED_METRIC.uid, (error, actual) => {
              // Make sure metric was deleted
              assert(
                error && error.type === 'NotFoundError',
                'Metric was not deleted'
              );
              done();
            });
          });
        });
      });
    });
    it('should update metric aggregation options for metric', (done) => {
      // Add metric
      service.putMetric(EXPECTED_METRIC, (error) => {
        assert.ifError(error);
        service.setMetricAggregationOptions(EXPECTED_METRIC.uid, AGG_OPTIONS, (error) => {
          assert.ifError(error);
          service.getMetric(EXPECTED_METRIC.uid, (error, actual) => {
            assert.deepStrictEqual(JSON.parse(actual), EXPECTED_METRIC_WITH_AGGREGATION);
            done();
          });
        });
      });
    });
    it('should update model options for metric', (done) => {
      // Add metric
      service.putMetric(EXPECTED_METRIC, (error) => {
        assert.ifError(error);
        service.setMetricModelOptions(EXPECTED_METRIC.uid, MODEL_OPTIONS, (error) => {
          assert.ifError(error);
          service.getMetric(EXPECTED_METRIC.uid, (error, actual) => {
            assert.deepStrictEqual(JSON.parse(actual), EXPECTED_METRIC_WITH_MODEL);
            done();
          });
        })
      });
    });
    it('should update input options for metric', (done) => {
      // Add metric
      service.putMetric(EXPECTED_METRIC, (error) => {
        assert.ifError(error);
        service.setMetricInputOptions(EXPECTED_METRIC.uid, INPUT_OPTIONS, (error) => {
          assert.ifError(error);
          service.getMetric(EXPECTED_METRIC.uid, (error, actual) => {
            assert.deepStrictEqual(JSON.parse(actual), EXPECTED_METRIC_WITH_INPUT);
            done();
          });
        })
      });
    });
  });

  describe('MetricData:', () => {
    it('should add a single MetricData record to the database', (done) => {
      service.putMetricData(EXPECTED_METRIC_DATA[0], (error) => {
        assert.ifError(error);
        done();
      });
    });
    it('should not add invalid MetricData record to the database', (done) => {
      let invalid = Object.assign({}, EXPECTED_METRIC_DATA[0]);
      delete invalid.timestamp;
      service.putMetricData(invalid, (error) => {
        assert(error, 'Invalid MetricData was created');
        done();
      });
    });
    it('should add multiple MetricData records to the database', (done) => {
      service.putMetricDataBatch(EXPECTED_METRIC_DATA, (error) => {
        assert.ifError(error);
        done();
      });
    });
    it('should load multiple MetricData records from the database', (done) => {
      service.putMetricDataBatch(EXPECTED_METRIC_DATA, (error) => {
        assert.ifError(error);
        service.getMetricData(EXPECTED_METRIC_ID, (error, actual) => {
          assert.ifError(error);
          assert.deepStrictEqual(JSON.parse(actual), EXPECTED_METRIC_DATA);
          done();
        });
      });
    });
    it('should delete MetricData from the database', (done) => {
      // Add data
      service.putMetricDataBatch(EXPECTED_METRIC_DATA, (error) => {
        assert.ifError(error);
        // Make sure data exist
        service.getMetricData(EXPECTED_METRIC_ID, (error, actual) => {
          assert.ifError(error);
          assert.deepStrictEqual(JSON.parse(actual), EXPECTED_METRIC_DATA);
          // Delete data
          service.deleteMetricData(EXPECTED_METRIC_ID, (error) => {
            assert.ifError(error);
            // Make sure data was deleted
            service.getMetricData(EXPECTED_METRIC_ID, (error, actual) => {
              assert.ifError(error);
              assert.equal(JSON.parse(actual).length, 0);
              done();
            });
          });
        });
      });
    });
  });

  describe('ModelData:', () => {
    it('should add a single ModelData record to the database', (done) => {
      service.putModelData(EXPECTED_MODEL_DATA, (error) => {
        assert.ifError(error);
        done();
      });
    });
    it('should not add invalid ModelData record to the database', (done) => {
      let invalid = Object.assign({}, EXPECTED_MODEL_DATA);
      delete invalid.anomaly_score;
      service.putModelData(invalid, (error) => {
        assert(error, 'Invalid ModelData was created');
        done();
      });
    });
    it('should add multiple ModelData records to the database', (done) => {
      let batch = Array.from([
        '2015-01-01 00:00:00Z',
        '2015-01-01 00:00:01Z',
        '2015-01-01 00:00:02Z',
        '2015-01-01 00:00:03Z'
      ], (timestamp) => {
        return Object.assign({}, EXPECTED_MODEL_DATA, {timestamp});
      });
      service.putModelDataBatch(batch, (error) => {
        assert.ifError(error);
        done();
      });
    });
    it('should load multiple ModelData records from the database', (done) => {
      let batch = Array.from([
        '2015-01-01 00:00:00Z',
        '2015-01-01 00:00:01Z',
        '2015-01-01 00:00:02Z',
        '2015-01-01 00:00:03Z'
      ], (timestamp) => {
        return Object.assign({}, EXPECTED_MODEL_DATA, {timestamp});
      });
      service.putModelDataBatch(batch, (error) => {
        assert.ifError(error);
        service.getModelData(EXPECTED_MODEL_DATA.metric_uid, (error, actual) => {
          assert.ifError(error);
          assert.deepStrictEqual(JSON.parse(actual), batch);
          done();
        });
      });
    });
    it('should export ModelData from the database', (done) => {
      after(() => {
        fs.unlinkSync(EXPORTED_FILENAME); // eslint-disable-line no-sync
      });

      let batch = Array.from([
        '2015-01-01 00:00:00Z',
        '2015-01-01 00:00:01Z',
        '2015-01-01 00:00:02Z',
        '2015-01-01 00:00:03Z'
      ], (timestamp) => {
        return Object.assign({}, EXPECTED_MODEL_DATA, {timestamp});
      });
      service.putModelDataBatch(batch, (error) => {
        assert.ifError(error);
        service.exportModelData(EXPECTED_MODEL_DATA.metric_uid, EXPORTED_FILENAME, (error, res) => {
          assert.ifError(error);
          fs.readFile(EXPORTED_FILENAME, 'utf8', (error, data) => {
            assert.ifError(error);
            assert.equal(data, EXPECTED_EXPORTED_RESULTS);
            done();
          });
        });
      });
    });
    it('should delete ModelData from the database', (done) => {
      let batch = Array.from([
        '2015-01-01 00:00:00Z',
        '2015-01-01 00:00:01Z',
        '2015-01-01 00:00:02Z',
        '2015-01-01 00:00:03Z'
      ], (timestamp) => {
        return Object.assign({}, EXPECTED_MODEL_DATA, {timestamp});
      });

      // Add data
      service.putModelDataBatch(batch, (error) => {
        assert.ifError(error);
        // Make sure data exist
        service.getModelData(EXPECTED_MODEL_DATA.metric_uid, (error, actual) => {
          assert.ifError(error);
          assert.deepStrictEqual(JSON.parse(actual), batch);
          // Delete data
          service.deleteModelData(EXPECTED_MODEL_DATA.metric_uid, (error) => {
            assert.ifError(error);
            // Make sure data was deleted
            service.getModelData(EXPECTED_MODEL_DATA.metric_uid, (error, actual) => {
              assert.ifError(error);
              assert.equal(JSON.parse(actual).length, 0);
              done();
            });
          });
        });
      });
    });
  });
});
