// Copyright © 2016, Numenta, Inc. Unless you have purchased from
// Numenta, Inc. a separate commercial license for this software code, the
// following terms and conditions apply:
//
// This program is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero Public License version 3 as published by the
// Free Software Foundation.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
// FOR A PARTICULAR PURPOSE. See the GNU Affero Public License for more details.
//
// You should have received a copy of the GNU Affero Public License along with
// this program. If not, see http://www.gnu.org/licenses.
//
// http://numenta.org/licenses/


/* eslint-disable no-var, object-shorthand, prefer-arrow-callback */

import convertNewline from 'convert-newline';
import csv from 'csv-streamify';
import filesystem from 'fs';
import instantiator from 'json-schema-instantiator';
import moment from 'moment';
import path from 'path';
import {Validator} from 'jsonschema';

import config from './ConfigService';
import {
  DBFileSchema, DBMetricSchema,
  MRAggregationSchema, MRInputSchema, MRModelSchema,
  PFInputSchema, PFOutputSchema
} from '../database/schema';
import TimeAggregator from './TimeAggregator';
import {TIMESTAMP_FORMATS} from '../config/timestamp';
import Utils from './Utils';

const INSTANCES = {
  FILE: instantiator.instantiate(DBFileSchema),
  METRIC: instantiator.instantiate(DBMetricSchema)
};
const SAMPLES_FILE_PATH = path.join(__dirname, config.get('samples:path'));
const SCHEMAS = [
  DBFileSchema, DBMetricSchema,
  MRAggregationSchema, MRInputSchema, MRModelSchema,
  PFInputSchema, PFOutputSchema
];
const VALIDATOR = new Validator();
SCHEMAS.forEach((schema) => {
  VALIDATOR.addSchema(schema);
});


/**
 * Unicorn: FileService - Respond to a FileClient over IPC, sharing our access to
 *  the Node layer of filesystem, so client can CRUD files.
 */
export class FileService {
  constructor() {
  }

  /**
   * Reads the entire contents of a file.
   * @param {string} filename - The absolute path of the CSV file to load
   * @param {Function} callback - Async callback: function (error, results)
   */
  getContents(filename, callback) {
    filesystem.readFile(filename, callback);
  }

  /**
   * Get a list of sample files embedded with the application.
   * @param {Function} callback - Async callback: function (error, results)
   */
  getSampleFiles(callback) {
    filesystem.readdir(SAMPLES_FILE_PATH, function (error, data) {
      let files;
      if (error) {
        callback(error, null);
        return;
      }
      files = data.map((item) => {
        let filename = path.resolve(SAMPLES_FILE_PATH, item);
        let record = Object.assign({}, INSTANCES.FILE, {
          uid: Utils.generateFileId(filename),
          description: '',
          timestampFormat: 'MM-DD-YY HH:mm',
          name: path.basename(item),
          filename: filename,
          type: 'sample'
        });
        let validation = VALIDATOR.validate(record, DBFileSchema);
        if (validation.errors.length) {
          return callback(validation.errors, null);
        }
        return record;
      });
      return callback(null, files);
    });
  }

  /**
   * Get all field definitions for the give file guessing data types based on
   *  first record.
   * @param {string} filename - The absolute path of the CSV file
   * @param {Object} options -  Optional settings. See #getData()
   * @param {Function} callback - Called with an array of field definitions in the
   *  following format:
   *  <code> { name:'fieldName', type:'number', date:'string' } </code>
   */
  getFields(filename, options, callback) {
    let fields = [];
    let fieldName, newliner, stream, validation;

    // "options" is optional
    if (typeof callback == 'undefined' && typeof options == 'function') {
      callback = options;
      options = {};
    }
    // Update default values
    if (!('columns' in options)) {
      options.columns = true;
    }
    options.objectMode = true;

    stream = filesystem.createReadStream(
      path.resolve(filename),
      {encoding: 'utf8'}
    );
    newliner = convertNewline('lf').stream();
    stream.pipe(newliner)
      .pipe(csv(options))
      .once('data', function (data) {
        if (data) {
          for (fieldName in data) {
            const val = data[fieldName];
            let field = Object.assign({}, INSTANCES.METRIC, {
              uid: Utils.generateMetricId(filename, fieldName),
              file_uid: Utils.generateFileId(filename),
              name: fieldName
            });
            if (Number.isFinite(Number(val))) {
              field.type = 'number';
            } else if (Number.isFinite(Date.parse(val))) {
              field.type = 'date';
              // Guess timestamp format
              field.format = TIMESTAMP_FORMATS.find((format) => {
                return moment(val, format, true).isValid();
              });
            }
            validation = VALIDATOR.validate(field, DBMetricSchema);
            if (validation.errors.length) {
              return callback(validation.errors, null);
            }
            fields.push(field);
          }
          stream.unpipe();
          stream.destroy();
          return callback(null, fields);
        } // if data
      }) // on data
      .once('error', callback)
      .once('end', callback);
  }

  /**
   * Get data from the given CSV file.
   * @param {string} filename - The absolute path of the CSV file to load
   * @param {Object} options - Optional settings
   *                    See https://github.com/klaemo/csv-stream#options
   *                    ```
   *                     {
   *                        delimiter: ',', // comma, semicolon, whatever
   *                        newline: '\n', // newline delimiter
   *                        quote: '"', // what's considered a quote
   *                        empty: '', // empty fields are replaced by this,
   *
   *                        // if true, emit array of {Object}s
   *                        // instead of array of strings
   *                        objectMode: false,
   *
   *                        // if set to true, uses first row as keys ->
   *                        // [ { column1: value1, column2: value2 , ...]}
   *                        columns: true,
   *
   *                        // Max Number of records to process
   *                        limit: Number.MAX_SAFE_INTEGER,
   *
   *                        // Aggregation settings. See {TimeAggregator}
   *                        aggregation: {
   *                       		// Name of the field representing 'time'
   *                          'timefield' : {String},
   *                          // Name of the field containing the 'value'
   *                          'valuefield': {String},
   *                          // Aggregation function to use:
   *                          //   'sum', 'count', 'avg', 'min', 'max'
   *                          'function' : {String},
   *                          // Time interval in milliseconds
   *                          'interval' : {number}
   *                        }
   *                      }
   *                    ```
   * @param {Function} callback - This callback to be called on every record.
   *                              `function (error, data)`
   */
  getData(filename, options, callback) {
    // "options" is optional
    if (typeof callback == 'undefined' && typeof options == 'function') {
      callback = options;
      options = {};
    }
    // Update default values
    if (!('columns' in options)) {
      options.columns = true;
    }
    if (!('limit' in options)) {
      options.limit = Number.MAX_SAFE_INTEGER;
    }

    let limit = options.limit;
    let fileStream = filesystem.createReadStream(
      path.resolve(filename),
      {encoding: 'utf8'}
    );
    let newliner = convertNewline('lf').stream();
    let csvParser = csv(options);
    let lastStream = csvParser;
    let aggregator;
    if ('aggregation' in options) {
      aggregator = new TimeAggregator(options['aggregation']);
      lastStream = aggregator;
    }
    lastStream
      .on('data', function (data) {
        if (limit > 0) {
          callback(null, data); // eslint-disable-line callback-return
        }
        if (limit === 0) {
          fileStream.unpipe();
          fileStream.destroy();
          callback(); // eslint-disable-line callback-return
        }
        limit -= 1;
      })
      .once('error', callback)
      .once('close', callback)
      .once('end', callback);

    if (aggregator) {
      fileStream.pipe(newliner).pipe(csvParser).pipe(aggregator);
    } else {
      fileStream.pipe(newliner).pipe(csvParser);
    }
  }

  /**
   * @param {string} filename - The absolute path of the CSV file
   * @param {Object} options - Optional settings
   *                    See https://github.com/klaemo/csv-stream#options
   *                    <code>
   *                     {
   *                       delimiter: ',', // comma, semicolon, whatever
   *                       newline: '\n', // newline delimiter
   *                       quote: '"', // what's considered a quote
   *                       empty: '', // empty fields are replaced by this,
   *
   *                       // if set to true, uses first row as keys ->
   *                       // [ { column1: value1, column2: value2 , ...]}
   *                       columns: true,
   *                       // Max Number of records to process
   *                       limit: Number.MAX_SAFE_INTEGER
   *                      }
   *                    </code>
   * @param {Function} callback - This callback will be called with the results in
   *                              the following format:
   *                              `function (error, stats)`
   *                              ```
   *                              stats = {
   *                              	count: '100',
   *                              	fields: {
   *                              		fieldName : {
   *                              		  min: '0',
   *                              		  max: '10',
   *                              		  sum: '500',
   *                              		  mean: '5',
   *                              		  variance: '4',
   *                              		  stdev: '2'
   *                              	  }, ...
   *                              	}
   *                              }
   *                              ```
   */
  getStatistics(filename, options, callback) {
    // "options" is optional
    if (typeof callback == 'undefined' && typeof options == 'function') {
      callback = options;
      options = {};
    }

    let stats = {
      count: 0,
      fields: {}
    };
    let fields = stats.fields;

    options.objectMode = true;
    this.getData(filename, options, function (error, data) {
      if (error) {
        callback(error);
        return;
      } else if (data) {
        // Update stats on every record
        stats.count++;
        for (let name in data) {
          let max, min, newMean, oldMean;
          let val = new Number(data[name]);

          if (isNaN(val)) {
            continue;
          } else {
            val = val.valueOf();
          }
          if (!(name in fields)) {
            fields[name] = {
              min: Number.MAX_VALUE,
              max: Number.MIN_VALUE,
              sum: 0.0,
              mean: val,
              variance: 0.0,
              stdev: 0.0
            };
          }

          min = fields[name].min;
          max = fields[name].max;
          fields[name].min = val < min ? val : min;
          fields[name].max = val > max ? val : max;
          fields[name].sum += val;

          // Compute variance based on online algorithm from
          // D. Knuth, The Art of Computer Programming, Vol 2, 3rd ed, p.232
          if (stats.count > 1) {
            oldMean = fields[name].mean;
            newMean = oldMean + (val - oldMean) / stats.count;
            fields[name].mean = newMean;
            fields[name].variance += (val - oldMean) * (val - newMean);
          }
        }
      } else {
        // Finished reading data
        for (let name in fields) {
          if (stats.count > 1) {
            fields[name].variance /= (stats.count - 1);
            fields[name].stdev = Math.sqrt(fields[name].variance);
          }
        }
        callback(null, stats);
        return;
      }
    });
  }
}


// Returns singleton
const SERVICE = new FileService();
export default SERVICE;
