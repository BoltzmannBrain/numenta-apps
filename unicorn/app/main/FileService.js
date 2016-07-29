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
import 'babel-polyfill' // Required  for 'Object.values' (node 5.1.1)

import convertNewline from 'convert-newline';
import csv from 'csv-streamify';
import fs from 'fs';
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
import {
  COMPOUND_TIMESTAMP_FORMATS,
  MAX_UNIX_TIMESTAMP_IN_SECONDS,
  UNIX_TIMESTAMP_SEC_MOMENT_FORMAT,
  UNIX_TIMESTAMP_MILLISEC_MOMENT_FORMAT
} from '../common/timestamp';
import {
  generateFileId, generateMetricId
} from './generateId';
import {NA_STRINGS} from '../config/na';

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

// Substrings of column names that are hints that the column might contain a
// timestamp
const TIMESTAMP_HEADER_SUBSTRINGS = ['time', 'date'];

const UNIX_TIMESTAMP_FORMATS = [
  UNIX_TIMESTAMP_SEC_MOMENT_FORMAT,
  UNIX_TIMESTAMP_MILLISEC_MOMENT_FORMAT
];


/**
 * Check if a value is a NA value (lowercase and removes whitespace)
 * @param {Object} entry : of the csv row to be checked against NA strings.
 * @return {boolean}  returns true if it is an NA string value
 *                    , and false otherwise.
 */
function isNA(entry) {
  if (typeof entry === 'undefined') {
    return true;
  }
  return NA_STRINGS.indexOf(entry.toString()
    .toLowerCase().replace(/\s+/g, '')) > -1
}

/**
 * Check if a row in the csv file has an empty or NA string in one of its
 * columns. (gets rid of all whitespace in the entry before checking for empty)
 * @param  {array}  row: entries of the csv row to be checked agaian NA string
 * @return {boolean}  returns true if there contains an empty or NA string value
 *                    in the array, and false otherwise.
 */
function containsNA(row) {
  return row.some((entry) => isNA(entry));
}

/**
 * Check if a row in the csv file is possibly a valid header row, based on its
 * lack of resemblance to a valid data row with a compound timestamp (exactly
 * one compound date and at least one numeric type and does not contain a
 * missing value)
 * @param  {array}  row: entries of the csv row to be validated
 * @return {boolean}  returns true if the row resembles a CSV header row and
 *                    false otherwise.
 */
function resemblesHeaderRow(row) {
  let numdates = row.map((entry) =>
                  (typeof guessCompoundTimestampFormat(entry) !== 'undefined'))
                  .reduce((curr,prev) => curr + prev);
  let hasNumeric = row.some((entry) => Number.isFinite(Number(entry)))
  return !(!containsNA(row) && numdates === 1 && hasNumeric);
}


/**
 * Check if the given value is a valid datetime value and returns the best
 * matching timestamp format defined in {@link COMPOUND_TIMESTAMP_FORMATS}
 * @param  {string}  timestamp Formatted timestamp string to validate
 * @return {string}            The best matching datetime format
 *                             or `null` if value is not a valid date
 */
function guessCompoundTimestampFormat(timestamp) {
  return COMPOUND_TIMESTAMP_FORMATS.find((format) => {
    return moment.utc(timestamp, format, true).isValid();
  });
}

/**
 * Check whether or not the given string can be converted into a valid
 *  {@link Date}
 * > NOTE: Based on 'Date.parse' which is browser and locale dependent and may
 * >       not work in all cases.
 * @param  {string}  value string value to chaeck
 * @return {Boolean}       true for valid date false otherwise
 */
function isDate(value) {
  if (value && value.length > 0) {
    // Check if the first char is numeric
    if (Number.isNaN(parseInt(value.charAt(0), 10))) {
      return false;
    }
    // Parse using JS builtin Date object
    return !Number.isNaN(Date.parse(value))
  }
  return false;
}

/**
 * Guess field definitions from string values
 * @param  {string}   filename   Full path name
 * @param  {string[]} values     Array of field values
 * @param  {string[]} [names]    Optional Array of field names, usually the
 *                               first row on a CSV file. If not given the names
 *                               will be based on the data types, where datetime
 *                               field is named `timestamp` and numeric
 *                               fields are named `metricX`, ignoring all
 *                               other fields. Something like this:
 *
 *                                     timestamp, metric1, metric2, ...
 *
 * @return {Field[]}          Array of valid {@link Field} definitions or an
 *                            empty array if no valid field was found
 */
function guessFields(filename, values, names) {
  let fields = [];
  let fileId = generateFileId(filename);
  let metricX = 1;
  for (let index=0; index < values.length; index++) {
    let field = Object.assign({}, INSTANCES.METRIC, {
      file_uid: fileId,
      index
    });

    // Check for valid field types (date or number)
    let value = values[index].trim();
    if (value.length > 0) {
      let format = guessCompoundTimestampFormat(value);
      if (format) {
        field.type = 'date';
        field.format = format;
        if (names) {
          field.name = names[index];
        } else {
          field.name = 'timestamp';
        }
        field.uid = generateMetricId(filename, field.name);
        fields.push(field);
      } else if (Number.isFinite(Number(value))) {
        field.type = 'number';
        if (names) {
          field.name = names[index];
        } else {
          field.name = `metric${metricX}`;
          metricX++;
        }
        field.uid = generateMetricId(filename, field.name);
        fields.push(field);
      } else if (isDate(value)) {
        field.type = 'date';
        if (names) {
          field.name = names[index];
        } else {
          field.name = `timestamp${index+1}`;
        }
        field.uid = generateMetricId(filename, field.name);
        fields.push(field);
      }
    }
  }
  return fields;
}

/**
 * Checks if the field name could be that of a timestamp
 *
 * @param {string} name   Field name
 *
 * @return {boolean}      true if field name could be that of a timestamp
 */
function fieldNameCouldBeTimestamp(name) {
  name = name.toLowerCase();
  return TIMESTAMP_HEADER_SUBSTRINGS.some((v) => {
    return name.indexOf(v) >= 0;
  });
}


/**
 * HTM Studio: FileService - Respond to a FileClient over IPC, sharing our
 *  access to the Node layer of filesystem, so client can CRUD files.
 */
export class FileService {

  /**
   * Reads the entire contents of a file.
   * @param {string} filename - The absolute path of the CSV file to load
   * @param {Function} callback - Async callback: function (error, results)
   */
  getContents(filename, callback) {
    fs.readFile(filename, callback);
  }

  /**
   * Get a list of sample files embedded with the application.
   * @param {Function} callback - Async callback: function (error, results)
   */
  getSampleFiles(callback) {
    fs.readdir(SAMPLES_FILE_PATH, function (error, data) {
      if (error) {
        callback(error, null);
        return;
      }
      let files = data.map((item) => {
        let filename = path.resolve(SAMPLES_FILE_PATH, item);
        let record = Object.assign({}, INSTANCES.FILE, {
          uid: generateFileId(filename),
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
   * Get all field definitions for the given file, guessing header row and
   * data types based on first record, validating the file structure based on
   * the following criteria:
   * - The file must be valid CSV file
   * - The file must have one and only one date/time field
   * - The file must have at least one scalar fields
   * - Ignore all other fields
   *
   * If the first row only contain a combination of strings and/or numbers, then
   * use it as header row; otherwise, the header should be based on data type,
   * something like this:
   *
   * ```
   *   timestamp, metric1, metric2, ...
   * ```
   *
   * Where the datetime field is named `timestamp` and
   * numeric values are named `metricX`. All other fields are ignored.
   *
   * When the file passes all validations, this method will invoke the
   * `callback` function with the following results:
   *
   * ```
   * {
   *   fields: [metrics], // Array of Metric definitions. See "Metric.json"
   *   offset: 0 | 1   // index of first data row in CSV file; zero-based
   * }
   * ```
   *
   * Otherwise  the `callback` function will be called with the relevant errors
   * message.
   *
   * @param  {string}   filename  Full path name
   * @param  {Function} callback called when the operation is complete with
   *                             results or error message
   * @see Metric.json
   */
  getFields(filename, callback) {
    let stream = fs.createReadStream(filename , {encoding: 'utf8'});
    let offset = 0;
    let validRowCounter = 0; // a counter to keep track of how many rows we have
                             // attempted to determine fields from.
    let headers = null;
    let parser = csv({
      objectMode: true,
      columns: false
    });
    let newliner = convertNewline('lf').stream();
    stream.pipe(newliner)
      .pipe(parser)
      .on('data', (line) => {
        let values = Object.values(line);
        let isHeader = validRowCounter === 0 && resemblesHeaderRow(line);
        // could either be a header or a data row. If it is a data row, we only
        // want to use it to determine fields if it has no missing values.
        if (!isHeader && containsNA(line)) {
          validRowCounter++;
          return;
        }

        let fields = guessFields(filename, values, headers);
        // skip this code if it is a header, but don't if it isn't.
        if (fields.length !== 0 || offset !== 0) {
          let error = null;

          // Check if file has only one date field and at least one number
          let dateFields = fields.filter((field) => {
            return field.type === 'date';
          });
          if (dateFields.length === 0 && offset === 0) {
            // No date field in first row: assume it's the header row
          } else {
            if (dateFields.length === 0) {
              // No date field found in second row: check if any of the scalar
              // fields could be a unix timestamp by examining their field names
              for (let i in fields) {
                let field = fields[i];
                let valueStr = values[field.index].trim();
                if (field.type === 'number' &&  // eslint-disable-line max-depth
                    Number(valueStr) >= 0 &&
                    fieldNameCouldBeTimestamp(field.name)) {
                  // Convert field to timestamp
                  field.type = 'date';
                  // Check to see if the timestamp is beyond the range of
                  // MAX_UNIX_TIMESTAMP_IN_SECONDS. If it is, interpret is as a
                  // ms timestamp. To be clear we are taking the convention that
                  // we only support unix timestamps in seconds that are between
                  // 0 and strictly below 253402300800.0 (
                  // 10000-01-01T00:00:00+00:00). And we support unix timestamps
                  // in milliseconds that are at or above 253402300800 (unix
                  // timestamp in ms) which is 1978-01-11T21:31:40+00:00.
                  if (Number(valueStr) <= // eslint-disable-line max-depth
                      MAX_UNIX_TIMESTAMP_IN_SECONDS) {
                    field.format = UNIX_TIMESTAMP_SEC_MOMENT_FORMAT;
                  } else {
                    field.format = UNIX_TIMESTAMP_MILLISEC_MOMENT_FORMAT;
                  }
                }
              }

              dateFields = fields.filter((field) => {
                return field.type === 'date';
              });
            }

            if (dateFields.length !== 1) {
              error = 'The file should have one and only one date/time column';
            } else if (!dateFields[0].format) {
              error = `The date/time format used on column ` +
                      `${dateFields[0].index + 1} is not supported`;
            } else if (!fields.some((field) => field.type === 'number')) {
              error = 'The file should have at least one numeric value';
            }

            parser.removeAllListeners();
            stream.destroy();
            callback(error, {fields, offset});
            return;
          }
        }
        // Use first line as headers and wait for the second line
        headers = values;
        offset++;
        validRowCounter++;
      })
      .once('end', () => {
        // We reached the end of the csv and we did not find a row
        // without missing values
        callback('The CSV file must have at least one' +
                 ' row without missing values');
        return;
      });
  }

  /**
   * Get data from the given CSV file.
   * @param {string} filename - The absolute path of the CSV file to load
   * @param {Object} options - Optional settings
   *                    See https://github.com/klaemo/csv-stream#options
   *
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
   *                        // Number of rows to skip
   *                        offset: 0
   *
   *                        // Aggregation settings. See {TimeAggregator}
   *                        aggregation: {
   *                          // Name of the field representing 'time'
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
   *
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
    if (!('offset' in options)) {
      options.offset = 0;
    }

    let offset = options.offset;
    let row = 0;
    let limit = options.limit;
    let fileStream = fs.createReadStream(filename, {encoding: 'utf8'});
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
        row++;
        if (row <= offset) {
          return;
        }
        if (limit > 0) {
          callback(null, data); // eslint-disable-line callback-return
        }
        if (limit === 0) {
          lastStream.removeAllListeners();
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
   *
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
   *                     }
   *
   * @param {Function} callback - This callback will be called with the results
   *                              in the following format:
   *                              `function (error, stats)`
   *
   *                              stats = {
   *                                count: '100',
   *                                fields: {
   *                                  fieldName : {
   *                                    min: '0',
   *                                    max: '10',
   *                                    sum: '500',
   *                                    mean: '5',
   *                                    variance: '4',
   *                                    stdev: '2'
   *                                  }, ...
   *                                }
   *                              }
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

  /**
   *  Validate file making sure scalar and time data fields must be valid
   *  throughout the whole file returning field definitions and {@link File}
   *  object with row offset and the total number of records in the file.
   * ```
   * {
   *   file: File,
   *   fields: [metrics]
   * }
   * ```
   *
   * @param  {string}   filename  Full path name
   * @param  {Function} callback called when the operation is complete with
   *                             results, warning, or error message
   * @see {@link #getFields}
   * @see File.json
   * @see Metric.json
   */
  validate(filename, callback) {
    let file = Object.assign({}, INSTANCES.FILE, {
      uid: generateFileId(filename),
      name: path.basename(filename),
      filename: filename
    });

    // Validate fields
    this.getFields(filename, (error, validFields) => {
      let dataError = error;
      let dataWarning = null;

      // Update file and fields
      let fields = [];
      let offset = 0;
      if (validFields) {
        fields = validFields.fields;
        offset = validFields.offset;
      } else {
        callback (error, null, {file, fields});
        return;
      }

      // Load data
      let stream = fs.createReadStream(filename, {
        encoding: 'utf8'
      });
      let csvParser = csv({columns: false, objectMode: true});
      let newliner = convertNewline('lf').stream();
      let row = 0; // number of valid rows
      let timestampField = fields.find((field) => field.type === 'date');
      csvParser.on('data', (data) => {
        let validTimestamp = typeof timestampField !== 'undefined' &&
                             !isNA(data[timestampField.index]);
        // Skip header row offset and increment when
        // dataerror and timestamp isnt na.
        if (row < offset || (dataError && validTimestamp)) {
          row++;
          return;
        } else if (dataError) { // don't increment if the timestamp is not valid
          return;
        } else if (validTimestamp) { // increment and validate.
          row++;
        }

        let message;
        let valid = fields.every((field, index) => {
          let value = data[field.index];
          if (!isNA(value)) {
            switch (field.type) {
            case 'number':
              message = `Invalid number at row ${row}: ` +
                        `Found '${field.name}' = '${value}'`;
              return Number.isFinite(Number(value));
            case 'date':
              message = `Invalid date/time at row ${row}: ` +
                        `The date/time value is '${value}'`;
              if (field.format) {
                let current = moment().format(field.format);
                message += ' instead of having a format matching ' +
                           `'${field.format}'. For example: '${current}'`;
              }
              let isValid;
              if (UNIX_TIMESTAMP_FORMATS.indexOf(field.format) >= 0) {
                // Work around moment's failure to validate floating point
                // Unix Timestamp in strict mode
                isValid = moment.utc(value, field.format, false).isValid();
              } else {
                isValid = moment.utc(value, field.format, true).isValid();
              }
              return isValid;
            default:
              return true;
            }
          } else {
            return true;
          }
        });
        if (row > 20000) {
          dataWarning = 'The number of rows exceeds 20,000. While you can' +
           ' proceed with this file, note that HTM Studio will be' +
           ' unresponsive during the loading of very large files.'
        }
        if (!valid) {
          dataError = message;
          return;
        }
      })
      .once('error', callback)
      .once('end', () => {
        file.records = row;
        file.rowOffset = offset;
        if (file.records < 400 && !dataError) {
          dataError = 'The CSV file needs to have at least 400 rows with' +
                      ' a valid timestamp';
        }
        callback(dataError, dataWarning, {file, fields});
      });
      stream.pipe(newliner).pipe(csvParser);
    });
  }
}

// Returns singleton
const SERVICE = new FileService();
export default SERVICE;
