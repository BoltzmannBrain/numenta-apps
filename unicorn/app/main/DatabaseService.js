// Copyright © 2016, Numenta, Inc. Unless you have purchased from
// Numenta, Inc. a separate commercial license for this software code, the
// following terms and conditions apply:
//
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU Affero Public License version 3 as published by
// the Free Software Foundation.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero Public License for
// more details.
//
// You should have received a copy of the GNU Affero Public License along with
// this program. If not, see http://www.gnu.org/licenses.
//
// http://numenta.org/licenses/

import Batch from 'level-sublevel/batch';
import fs from 'fs';
import instantiator from 'json-schema-instantiator';
import isElectronRenderer from 'is-electron-renderer';
import json2csv from 'json2csv-stream';
import leveldown from 'leveldown';
import levelup from 'levelup';
import os from 'os';
import path from 'path';
import sublevel from 'level-sublevel';
import {Validator} from 'jsonschema';
import {mapAnomalyText} from '../common/common-utils';
import {
  parseTimestampFallbackUtc, parseIsoTimestampFallbackUtc, getNaiveTime
} from '../common/timestamp';

import config from './ConfigService';
import fileService from './FileService';
import {
  generateMetricDataId, generateFileId
} from '../main/generateId';
import {promisify} from '../common/common-utils';

// Schemas
import {
  DBFileSchema, DBMetricDataSchema, DBMetricSchema,
  DBModelDataSchema, DBModelSchema,
  MRAggregationSchema, MRInputSchema, MRModelSchema,
  PFInputSchema, PFOutputSchema
} from '../database/schema';

const SCHEMAS = [
  DBFileSchema, DBMetricDataSchema, DBMetricSchema,
  DBModelDataSchema, DBModelSchema,
  MRAggregationSchema, MRInputSchema, MRModelSchema,
  PFInputSchema, PFOutputSchema
];

import {NA_STRINGS} from '../config/na';
/**
 * determine if a value is NA.
 * @param  {string} field : the field to test for NA.
 * @return {boolean} true if it is NA, false otherwise
 */
function isNA(field) {
  return (NA_STRINGS.indexOf(field.toLowerCase()) > -1);
}

/** samples location */
const SAMPLES_FILE_PATH = path.join(__dirname, config.get('samples:path'));

/**
 * Calculate default database location. If running inside `Electron` then use
 * the application user data folder.
 * See https://github.com/atom/electron/blob/master/docs/api/app.md
 * @return {string} Full path name
 */
function _getDefaultDatabaseLocation() {
  let location = path.join(os.tmpdir());
  if (!isElectronRenderer) {
    try {
      // This module is only available inside 'Electron' main process
      const app = require('app'); // eslint-disable-line
      location = path.join(app.getPath('userData'), 'database2');
    } catch (error) { /* no-op */ }
  }
  return location;
}

/**
 * Calculate file cache location. If running inside `Electron` then use
 * the application user data folder.
 * See https://github.com/atom/electron/blob/master/docs/api/app.md
 * @return {string} Full path name
 */
function _getDefaultFileCacheLocation() {
  let location = path.join(os.tmpdir());
  if (!isElectronRenderer) {
    try {
      // This module is only available inside 'Electron' main process
      const app = require('app'); // eslint-disable-line
      location = path.join(app.getPath('userData'), 'files');
    } catch (error) { /* no-op */ }
  }
  return location;
}

/**
 * Helper function used to stringify the callback results. This is required when
 * transmiting objects via Electron's `remote` function.
 * @param  {Function} callback The original callback
 * @return {Function}          A callback that will call the original callback
 *                             with the results stringified
 */
function stringifyResultsCallback(callback) {
  return (error, data) => callback(error, JSON.stringify(data));
}

/**
 * HTM Studio: DatabaseService - Respond to a DatabaseClient over IPC.
 *  For sharing our access to a file-based NodeJS database system.
 *  Meant for heavy persistence.
 * @param {string} [path] - Database location path (optional)
 * @param {string} [fileCachePath] - File cache location path (optional)
 */
export class DatabaseService {

  constructor(path, fileCachePath) {
    let location = path || _getDefaultDatabaseLocation();
    this._fileCachePath = fileCachePath || _getDefaultFileCacheLocation();

    // Create File Cache directory
    this._createFileCacheDir()

    // Configure schema validator
    this.validator = new Validator();
    SCHEMAS.forEach((schema) => {
      this.validator.addSchema(schema);
    });

    this.levelup = levelup(location, {
      db: leveldown,
      valueEncoding: 'json'
    });
    this._root = sublevel(this.levelup);
    this._files = this._root.sublevel('File');
    this._metrics = this._root.sublevel('Metric');
    this._metricData = this._root.sublevel('MetricData');
    this._models = this._root.sublevel('Model');
    this._modelData = this._root.sublevel('ModelData');
  }

  /**
   * Get a single File.
   * @param {string} uid Unique ID of file to get
   * @param {Function} callback Async callback function(error, results).
   *                            The results will be JSON.stringified
   */
  getFile(uid, callback) {
    this._files.get(uid, stringifyResultsCallback(callback));
  }

  /**
   * Get a single File by name.
   * @param {string} filename Unique ID of file to get
   * @param {Function} callback Async callback function(error, results).
   *                            The results will be JSON.stringified
   */
  getFileByName(filename, callback) {
    let fileid = generateFileId(filename);
    this._files.get(fileid, stringifyResultsCallback(callback));
  }

  /**
   * Get all Files.
   * @param {Function} callback Async callback function(error, results)
   *                            The results will be JSON.stringified
*/
  getAllFiles(callback) {
    let results = [];
    this._files.createValueStream()
      .on('data', (file) => {
        results.push(file);
      })
      .on('error', callback)
      .on('end', () => {
        let remoteCallback = stringifyResultsCallback(callback);
        remoteCallback(null, results);
      });
  }

  /**
   * Get a single Metric.
   * @param {string} uid - Unique ID of metric to get
   * @param {Function} callback Async callback function(error, results)
   *                            The results will be JSON.stringified
   */
  getMetric(uid, callback) {
    this._metrics.get(uid, stringifyResultsCallback(callback));
  }

  /**
   * Get all Metrics.
   * @param {Function} callback Async callback function(error, results)
   *                            The results will be JSON.stringified
   */
  getAllMetrics(callback) {
    let results = [];
    this._metrics.createValueStream()
      .on('data', (metric) => {
        results.push(metric);
      })
      .on('error', callback)
      .on('end', () => {
        let remoteCallback = stringifyResultsCallback(callback);
        remoteCallback(null, results);
      });
  }

  /**
   * Get all metrics of the given file Id
   * @param {string}   fileId    The ID of the file to get metrics
   * @param {Function} callback Async callback function(error, results)
   *                            The results will be JSON.stringified
   */
  getMetricsByFile(fileId, callback) {
    let results = [];
    // Metric UID is based on file Id. See Util.generateMetricId
    this._metrics.createValueStream({
      gte: `${fileId}`,
      lt: `${fileId}\xff`
    })
    .on('data', (metric) => {
      results.push(metric);
    })
    .on('error', callback)
    .on('end', () => {
      let remoteCallback = stringifyResultsCallback(callback);
      remoteCallback(null, results);
    });
  }

  /**
   * Get a single Model.
   * @param {string} modelId - Unique ID of model to get
   * @param {Function} callback Async callback function(error, results)
   *                            The results will be JSON.stringified
   */
  getModel(modelId, callback) {
    this._models.get(modelId, stringifyResultsCallback(callback));
  }

  /**
   * Get all Models.
   * @param {Function} callback Async callback function(error, results)
   *                            The results will be JSON.stringified
   */
  getAllModels(callback) {
    let results = [];
    this._models.createValueStream()
      .on('data', (model) => {
        results.push(model);
      })
      .on('error', callback)
      .on('end', () => {
        let remoteCallback = stringifyResultsCallback(callback);
        remoteCallback(null, results);
      });
  }

  /**
   * Get all/queried ModelData records.
   * @callback
   * @param {string} metricId - Metric ID
   * @param {number} offset - If non-null, only fetch records after this index
   * @param {Function} callback - Async callback: function (error, results)
   *                              The results will be JSON.stringified
   */
  getModelData(metricId, offset, callback) {
    let start = generateMetricDataId(metricId, offset || 0);
    let end = `${metricId}\xff`;

    let results = [];
    // Metric Data ID is based on metricId. See Util.generateMetricDataId
    this._modelData.createValueStream({
      gte: start,
      lt: end
    })
    .on('data', (metric) => {
      results.push([
        metric.naive_time, metric.metric_value, metric.anomaly_score
      ]);
    })
    .on('error', callback)
    .on('end', () => {
      let remoteCallback = stringifyResultsCallback(callback);
      remoteCallback(null, results);
    });
  }

  /**
   * @callback
   * Get MetricData values for the given metric.
   * @param {string} metricId Metric ID
   * @param {Function} callback Async callback: function (error, results)
   *                            The results will be JSON.stringified
   */
  getMetricData(metricId, callback) {
    let results = [];
    // Metric Data ID is based on metricId. See Util.generateMetricDataId
    this._metricData.createValueStream({
      gte: `${metricId}`,
      lt: `${metricId}\xff`
    })
    .on('data', (metric) => {
      results.push([metric.naive_time, metric.metric_value]);
    })
    .on('error', callback)
    .on('end', () => {
      let remoteCallback = stringifyResultsCallback(callback);
      remoteCallback(null, results);
    });
  }

  /**
   * Put a single File to DB.
   * @param {Object} file - Data object of File info to save
   * @param {Function} callback - Async done callback: function(error, results)
   */
  putFile(file, callback) {
    if (typeof file === 'string') {
      file = JSON.parse(file);
    }

    const validation = this.validator.validate(file, DBFileSchema);

    if (validation.errors.length) {
      callback(validation.errors, null);
      return;
    }

    this._files.put(file.uid, file, callback);
  }

  /**
   * Put multiple Files into DB.
   * @callback
   * @param {Array} files - List of File objects to insert
   * @param {Function} callback - Async done handler: function (error, results)
   */
  putFileBatch(files, callback) {
    if (typeof files === 'string') {
      files = JSON.parse(files);
    }

    for (let i = 0; i < files.length; i++) {
      const validation = this.validator.validate(files[i], DBFileSchema);
      if (validation.errors.length) {
        callback(validation.errors, null);
        return;
      }
    }

    let ops = files.map((file) => {
      return {
        type: 'put',
        key: file.uid,
        value: file
      };
    });

    this._files.batch(ops, callback);
  }

  /**
   * Put a single Metric to DB.
   * @param {Object} metric - Data object of Metric info to save
   * @param {Function} callback - Async done callback: function(error, results)
   */
  putMetric(metric, callback) {
    if (typeof metric === 'string') {
      metric = JSON.parse(metric);
    }

    const validation = this.validator.validate(metric, DBMetricSchema);
    if (validation.errors.length) {
      callback(validation.errors, null);
      return;
    }

    this._metrics.put(metric.uid, metric, callback);
  }

  /**
   * Put multiple Metrics into DB.
   * @param {Array} metrics - Data objects of Metrics info to save
   * @param {Function} callback - Async done callback: function(error, results)
   */
  putMetricBatch(metrics, callback) {
    if (typeof metrics === 'string') {
      metrics = JSON.parse(metrics);
    }

    for (let i = 0; i < metrics.length; i++) {
      const validation = this.validator.validate(metrics[i], DBMetricSchema);
      if (validation.errors.length) {
        callback(validation.errors, null);
        return;
      }
    }

    let ops = metrics.map((metric) => {
      return {
        type: 'put',
        key: metric.uid,
        value: metric
      };
    });

    this._metrics.batch(ops, callback);
  }


  /**
   * Put a single Model to DB.
   * @param {Object} model - Data object of Model info to save
   * @param {Function} callback - Async done callback: function(error, results)
   */
  putModel(model, callback) {
    if (typeof metric === 'string') {
      model = JSON.parse(model);
    }

    const validation = this.validator.validate(model, DBModelSchema);
    if (validation.errors.length) {
      callback(validation.errors, null);
      return;
    }

    this._models.put(model.modelId, model, callback);
  }

  /**
   * Put multiple Models into DB.
   * @param {Array} models - Data objects of Models info to save
   * @param {Function} callback - Async done callback: function(error, results)
   */
  putModelBatch(models, callback) {
    if (typeof models === 'string') {
      models = JSON.parse(models);
    }

    for (let i = 0; i < models.length; i++) {
      const validation = this.validator.validate(models[i], DBModelSchema);
      if (validation.errors.length) {
        callback(validation.errors, null);
        return;
      }
    }

    let ops = models.map((model) => {
      return {
        type: 'put',
        key: model.modelId,
        value: model
      };
    });

    this._models.batch(ops, callback);
  }

  /**
   * Put a single ModelData record to DB.
   * @param {string} modelId - Unique model ID
   * @param {number} recordIndex - Result index
   * @param {Object} modelData - ModelData object to save
   * @param {Function} callback - Async done callback: function(error, results)
   */
  putModelData(modelId, recordIndex, modelData, callback) {
    const validation = this.validator.validate(modelData, DBModelDataSchema);
    if (validation.errors.length) {
      callback(validation.errors, null);
      return;
    }
    let key = generateMetricDataId(modelId, recordIndex);
    this._modelData.put(key, modelData, callback);
  }

  /**
   * Put multiple ModelData records into DB.
   * @param {string} modelId - Unique metric ID
   * @param {number} firstRecordIndex - Starting index for this batch
   * @param {Array} data - List of ModelData objects to save
   * @param {Function} callback - Async done callback: function(error, results)
   */
  putModelDataBatch(modelId, firstRecordIndex, data, callback) {
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }

    for (let i = 0; i < data.length; i++) {
      const validation = this.validator.validate(data[i], DBModelDataSchema);
      if (validation.errors.length) {
        callback(validation.errors, null);
        return;
      }
    }

    let ops = data.map((value, i) => {
      let recordIndex = firstRecordIndex + i;
      let key = generateMetricDataId(modelId, recordIndex);
      return {
        type: 'put', key, value
      };
    });

    this._modelData.batch(ops, callback);
  }

  /**
   * Put a single MetricData record to DB.
   * @param {string} metricId - Unique metric ID
   * @param {number} recordIndex - Index for this row
   * @param {Object} metricData - Data object of MetricData info to save
   * @param {Function} callback - Async done callback: function(error, results)
   */
  putMetricData(metricId, recordIndex, metricData, callback) {
    if (typeof metricData === 'string') {
      metricData = JSON.parse(metricData);
    }
    const validation = this.validator.validate(metricData, DBMetricDataSchema);

    if (validation.errors.length) {
      callback(validation.errors, null);
      return;
    }

    let key = generateMetricDataId(metricId, recordIndex);
    this._metricData.put(key, metricData, callback);
  }

  /**
   * Put multiple MetricData records into DB.
   * @param {string} metricId - Unique metric ID
   * @param {number} firstRecordIndex - Starting index for this batch
   * @param {Array} data - List of Metric Data objects of MetricDatas to save
   * @param {Function} callback - Async done callback: function(error, results)
   */
  putMetricDataBatch(metricId, firstRecordIndex, data, callback) {
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }

    for (let i = 0; i < data.length; i++) {
      const validation = this.validator.validate(data[i], DBMetricDataSchema);
      if (validation.errors.length) {
        callback(validation.errors, null);
        return;
      }
    }

    let ops = data.map((value, i) => {
      let recordIndex = firstRecordIndex + i;
      let key = generateMetricDataId(metricId, recordIndex);
      return {
        type: 'put', key, value
      };
    });

    this._metricData.batch(ops, callback);
  }

  /**
   * Completely remove an existing database directory.
   * @param  {Function} callback called when the destroy operation is complete,
   *                             with a possible error argument
   */
  destroy(callback) {
    leveldown.destroy(this.levelup.location, callback);
  }

  /**
   * Closes the underlying LevelDB store.
   * @param {Function} callback - Receive any error encountered during closing
   *  as the first argument.
   */
  close(callback) {
    this.levelup.db.close(callback);
  }

  /**
   * Exports model results into a CSV file
   * @param  {string}   metricId The metric from which to export results
   * @param  {string}   filename Full path name for the destination file (.csv)
   * @param  {string}   timestampFormat Format of the timestamp
   * @param  {number}   probationLength Number of records under probation
   * @param  {Function} callback called when the export operation is complete,
   *                             with a possible error argument
   */
  exportModelData(metricId, filename, timestampFormat, probationLength,
      callback) {
    const output = fs.createWriteStream(filename);
    const parser = json2csv();
    parser.pipe(output);
    let idx = 0;

    // Metric Data id is based on metric Id. See Util.generateMetricDataId
    let inputStream = this._modelData.createValueStream({
      gte: `${metricId}`,
      lt: `${metricId}\xff`
    })
    .on('error', (error) => {
      parser.destroy();
      callback(error);
    })
    .on('data', (result) => {
      let score, timestamp;
      if (++idx <= probationLength) {
        score = null;
      } else {
        score = result.anomaly_score;
      }

      if (timestampFormat) {
        let [m] = parseIsoTimestampFallbackUtc(result.iso_timestamp);
        timestamp = m.format(timestampFormat);
      } else {
        timestamp = result.iso_timestamp;
      }

      let data = {
        timestamp,
        metric_value: result.metric_value,
        anomaly_level: mapAnomalyText(score),
        raw_anomaly_score: result.anomaly_score
      };
      parser.write(JSON.stringify(data));
    })
    .on('end', () => {
      parser.end();
      callback();
    });

    output.on('error', (error) => {
      inputStream.destroy();
      callback(error);
    })
  }

  /**
   * Delete raw data for the given metric
   * @param  {string}   metricId Metric to delete data
   * @param  {Function} callback called when the operation is complete,
   *                             with a possible error argument
   */
  deleteMetricData(metricId, callback) {
    let batch = new Batch(this._metricData);
    this._metricData.createKeyStream({
      gte: `${metricId}`,
      lt: `${metricId}\xff`
    })
    .on('data', (uid) => {
      batch.del(uid);
    })
    .on('error', callback)
    .on('end', () => {
      batch.write(callback);
    });
  }

  /**
   * Delete model data for the given metric
   * @param  {string}   metricId Metric to delete model data
   * @param  {Function} callback called when the operation is complete,
   *                             with a possible error argument
   */
  deleteModelData(metricId, callback) {
    let batch = new Batch(this._modelData);
    this._modelData.createKeyStream({
      gte: `${metricId}`,
      lt: `${metricId}\xff`
    })
    .on('data', (uid) => {
      batch.del(uid);
    })
    .on('error', callback)
    .on('end', () => {
      batch.write(callback);
    });
  }

  /**
   * Delete metric and associated data from database.
   * @param  {string}   metricId Metric to delete
   * @param  {Function} callback called when the operation is complete,
   *                             with a possible error argument
   */
  deleteMetric(metricId, callback) {
    this._metrics.del(metricId, (error) => {
      if (error) {
        callback(error);
        return;
      }
      this.deleteMetricData(metricId, (error) => {
        if (error) {
          callback(error);
          return;
        }
        this.deleteModel(metricId, callback);
      });
    })
  }

  /**
   * Delete model and associated data from database.
   * @param  {string}   modelId Model to delete
   * @param  {Function} callback called when the operation is complete,
   *                             with a possible error argument
   */
  deleteModel(modelId, callback) {
    this._models.del(modelId, (error) => {
      if (error) {
        callback(error);
        return;
      }
      this.deleteModelData(modelId, callback);
    })
  }

  /**
   * Delete all metrics for the given file
   * @param {string}   fileId    The ID of the file to delete the metrics from
   * @param  {Function} callback called when the operation is complete,
   *                             with a possible error argument
   */
  deleteMetricsByFile(fileId, callback) {
    let metrics = [];
    this._metrics.createKeyStream({
      gte: `${fileId}`,
      lt: `${fileId}\xff`
    })
    .on('data', (id) => {
      metrics.push(id);
    })
    .on('error', callback)
    .on('end', () => {
      let metricsDeleted = 0;
      for (let i = 0; i < metrics.length; i++) {
        this.deleteMetric(metrics[i], (error) => {
          if (error) {
            callback(error);
            return;
          }
          if (++metricsDeleted === metrics.length) {
            callback();
            return;
          }
        });
      }
    });
  }

  /**
   * Delete metric and associated metrics from database.
   * @param  {string}   filename   File to delete
   * @param  {Function} callback called when the operation is complete,
   *                             with a possible error argument
   */
  deleteFile(filename, callback) {
    this._deleteFileFromCache(filename);
    let fileId = generateFileId(filename);
    this._files.del(fileId, (error) => {
      if (error) {
        callback(error);
        return;
      }
      this.deleteMetricsByFile(fileId, callback);
    });
  }

  /**
   * Update aggregation options for the given metric. Usually this value is
   * obtained via the {@link ParamFinderService}
   *
   * @param {string} metricId  Metric to update
   * @param {object} options   Aggregation options, usually obtained via
   *                             {@link ParamFinderService}
   * @param  {Function} callback called when the operation is complete,
   *                             with a possible error argument
   */
  setMetricAggregationOptions(metricId, options, callback) {
    if (typeof options === 'string') {
      options = JSON.parse(options);
    }

    this._metrics.get(metricId, (error, metric) => {
      if (error) {
        callback(error);
        return;
      }
      metric['aggregation_options'] = options;
      this.putMetric(metric, callback);
    });
  }

  /**
   * Update model options for the given metric. Usually this value is
   * obtained via the {@link ParamFinderService}
   * @param {String} metricId - Metric to update
   * @param {Object} options - Model option to use for the given metric.
   *                           Usually obtained via {@link ParamFinderService}
   * @param {Function} callback - Called when the operation is complete,
   *                              with a possible error argument.
   */
  setMetricModelOptions(metricId, options, callback) {
    if (typeof options === 'string') {
      options = JSON.parse(options);
    }

    this._metrics.get(metricId, (error, metric) => {
      if (error) {
        callback(error);
        return;
      }
      metric['model_options'] = options;
      this.putMetric(metric, callback);
    });
  }

  /**
   * Update input options for the given metric. Usually this value is
   * obtained via the {@link ParamFinderService}
   * @param {String} metricId - Metric to update
   * @param {Object} options - Input option to use for the given metric.
   *                           Usually obtained via {@link ParamFinderService}
   * @param {Function} callback - Called when the operation is complete,
   *                              with a possible error argument.
   */
  setMetricInputOptions(metricId, options, callback) {
    if (typeof options === 'string') {
      options = JSON.parse(options);
    }

    this._metrics.get(metricId, (error, metric) => {
      if (error) {
        callback(error);
        return;
      }
      metric['input_options'] = options;
      this.putMetric(metric, callback);
    });
  }

  /**
   * Update model with the given properties
   * @param  {string}   modelId    Model to update
   * @param  {object}   properties Properties to update,
   *                               must be a valid Model property.
   *                               If properties includes 'modelId' it will be
   *                               ignored and replaced be the given 'modelId'
   * @param  {Function} callback   called when the operation is complete with
   *                               the updated model record or error
   */
  updateModel(modelId, properties, callback) {
    if (typeof properties === 'string') {
      properties = JSON.parse(properties);
    }

    this._models.get(modelId, (error, model) => {
      if (error) {
        return callback(error);
      }

      let newModel = Object.assign({}, model, properties);
      newModel.modelId = modelId;

      const validation = this.validator.validate(newModel, DBModelSchema);
      if (validation.errors.length) {
        return callback(validation.errors, null);
      }

      this.putModel(newModel, (error) => callback(error, newModel));
    });
  }

  /**
   * Update metric with the given properties
   * @param  {string}   metricId   Metric to update
   * @param  {object}   properties Properties to update,
   *                               must be a valid Metric property.
   *                               If properties includes 'uid' it will be
   *                               ignored and replaced be the given 'metricId'
   * @param  {Function} callback   called when the operation is complete with
   *                               the updated metric record or error
   */
  updateMetric(metricId, properties, callback) {
    if (typeof properties === 'string') {
      properties = JSON.parse(properties);
    }
    this._metrics.get(metricId, (error, metric) => {
      if (error) {
        return callback(error);
      }
      let newMetric = Object.assign({}, metric, properties);
      newMetric.uid = metricId;

      const validation = this.validator.validate(newMetric, DBMetricSchema);
      if (validation.errors.length) {
        return callback(validation.errors, null);
      }
      this.putMetric(newMetric, (error) => callback(error, newMetric));
    });
  }

  /**
   * Upload a new file to the database performing the following steps:
   * - Save file metadata
   * - Save fields/metrics metadata
   * - Save metric data (that is not NA)
   *
   * > NOTE: It assumes the file passed validation. See {@link FileService#validate}
   *
   * @param  {string|File}   fileToUpload  Full path name or preconfigured File object. See {@link DBFileSchema}
   * @param  {Function} callback called when the operation is complete with the
   *                             uploaded file record or error
   */
  uploadFile(fileToUpload, callback) {
    let file = fileToUpload;
    if (typeof file === 'string') {
      file = instantiator.instantiate(DBFileSchema);
      file.uid = generateFileId(fileToUpload);
      file.name = path.basename(fileToUpload);
      file.filename = path.join(this._fileCachePath, file.name);
    } else {
      // Validate file object
      const validation = this.validator.validate(file, DBFileSchema);
      if (validation.errors.length) {
        callback(validation.errors);
        return;
      }
      // Get file to upload original name from 'file' object
      fileToUpload = file.filename;
    }

    new Promise((resolve, reject) => {
      if (path.dirname(fileToUpload) === SAMPLES_FILE_PATH) {
        // Do not copy sample files
        resolve();
        return;
      }

      // Copy file to cache
      let source = fs.createReadStream(fileToUpload);
      let target = fs.createWriteStream(file.filename);
      source.on('error', reject);
      target.on('error', reject);
      target.on('finish', resolve);
      source.pipe(target);
    }).then(() => promisify(::fileService.getFields, file.filename))
      .then((results) => {
        let {offset, fields} = results;
        file.rowOffset = offset;
        // Save metrics
        return promisify(::this.putMetricBatch, fields)
          .then(() => Promise.resolve(fields));
      })
      .then((metrics) => {
        // Find timestamp field
        let timestampField = metrics.find((field) => field.type === 'date');

        // Load data from file
        let records = file.rowOffset;
        let options = {
          objectMode: true,
          columns: false,
          offset : file.rowOffset
        };

        let recordIndex = 0;
        fileService.getData(file.filename, options, ((error, data) => {
          if (error) {
            throw error;
          }
          if (data) {
            let validTimestamp = !isNA(data[timestampField.index].toString());
            // dont store data with invalid timestamps and don't increment records.
            if (validTimestamp) {
              records++;
              metrics.forEach((field) => {
                // Collect data for each numeric field
                let validField = !isNA(data[field.index].toString());
                if (field.type === 'number' && validField) {
                  let [m, hasTimeZone] = parseTimestampFallbackUtc(
                    data[timestampField.index], timestampField.format);
                  let metricData = {
                    iso_timestamp: m.format(hasTimeZone
                                            ? 'YYYY-MM-DDTHH:mm:ss.SSSSSSZ'
                                            : 'YYYY-MM-DDTHH:mm:ss.SSSSSS'),
                    naive_time: getNaiveTime(m),
                    metric_value: parseFloat(data[field.index])
                  };
                  // Save data
                  this.putMetricData(field.uid, recordIndex, metricData,
                                     (error) => { // eslint-disable-line max-nested-callbacks
                                       if (error) {
                                         throw error;
                                       }
                                     });
                }
              });
            }
          } else {
            // No more data
            file.records = records;
            this.putFile(file, (error) => {
              callback(error, file);
            });
            return;
          }

          recordIndex++;
        }));
      })
      .catch((error) => {
        // Delete file from cache
        this._deleteFileFromCache(file.filename);
        callback(error);
      });
  }

  /**
   * Create File cache dir if it does not exist
   * @param  {Function} callback Async callback
   */
  _createFileCacheDir(callback) {
    fs.mkdir(this._fileCachePath, (err) => {
      if (callback) {
        if (err) {
          // Ignore 'EEXIST: file already exists'
          if (err.code && err.code === 'EEXIST') {
            callback();
            return;
          }
          callback(err);
          return;
        }
        callback();
        return;
      }
    });
  }

  /**
   * Delete file from cache
   * @param  {filename} filename File to delete
   * @param {Function} callback Async callback function(error, )
  */
  _deleteFileFromCache(filename, callback) {
    // Delete file from cache
    if (path.dirname(filename) === this._fileCachePath) {
      fs.access(filename, (err) => {
        if (!err) {
          fs.unlink(filename, callback);
        } else if (callback) {
          callback(err)
          return;
        }
      });
    } else if (callback) {
      callback()
      return;
    }
  }
}

// Returns singleton
const INSTANCE = new DatabaseService();
export default INSTANCE;
