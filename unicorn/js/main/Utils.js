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

import crypto from 'crypto';

import muiTheme from '../browser/lib/MaterialUI/UnicornTheme';


export default class Utils {

  /**
   * Genereate unique hashed UID based on seed string and SHA1.
   * @param  {string} seed - Seed string to hash
   * @return {string} Unique id
   */
  static generateId(seed) {
    const hash = crypto.createHash('sha1');
    return hash.update(seed).digest('hex');
  }

  /**
   * Genereate unique file ID
   * @param  {string} filename - The absolute path
   * @return {string} Unique id
   */
  static generateFileId(filename) {
    // Use 64 bit hash
    return Utils.generateId(filename).substr(0,16);
  }

  /**
   * Genereate unique metric uid based on the filename and metric name
   *  via hashing.
   * @param  {string} filename - The absolute path
   * @param  {string} metric - Metric name
   * @return {string} Unique id
   */
  static generateMetricId(filename, metric) {
    let fileId = Utils.generateFileId(filename);
    // Use 64 bit hash
    let metricId = Utils.generateId(metric).substr(0,16);
    return `${fileId}!${metricId}`;
  }

  /**
   * Genereate unique metric data id based on the metric id and timestamp
   * @param  {string} metricId - Metric ID
   * @param  {Date} timestamp  - timestamp for the data record
   * @return {string} Unique id
   */
  static generateMetricDataId(metricId, timestamp) {
    if (!(timestamp instanceof Date)) {
      timestamp = new Date(timestamp);
    }
    return `${metricId}!${timestamp.getTime()}`;
  }

  /**
   * Map Anomaly value/height to bar color (Red/Yellow/Green)
   * @param {Number} index - Integer for current count of anomaly height
   * @param {Number} total - Integer for max possible anomaly height
   * @returns {String} - String for Color to use
   */
  static mapAnomalyColor(index, total) {
    let color = muiTheme.palette.safeColor;
    if (index > (total/4)) {
      color = muiTheme.palette.warnColor;
    }
    if (index > (total/2)) {
      color = muiTheme.palette.dangerColor;
    }
    return color;
  }

  /**
   * Template String to trim extra spaces from multiline es6 strings.
   * @param {Array} strings - Input string literals for es6 template string.
   * @param {...Array} [values] - Template string filler values.
   * @returns {String} - Completed and filled string.
   */
  static trims(strings, ...values) {
    let result = '';
    let i = 0;
    let tmp;

    while (i < strings.length) {
      tmp = strings[i];
      tmp = tmp.replace(/\n/g, ' ');
      tmp = tmp.replace(/\s+/g, ' ');
      result += tmp;

      if (i < values.length) {
        result += values[i];
      }
      i++;
    }
    return result;
  }

  /**
   * Convert callback style function into {@link Promise}.
   * When calling methods make sure to bind the method to the instance.
   * @param  {Function} fn  callback style function
   * @param  {Array} args   function arguments
   * @return {Promise} Promise wrapping the callback base function
   */
  static promisify(fn, ...args) {
    return new Promise((resolve, reject) => {
      fn(...args, (error, data) => {
        if (error) {
          reject(error);
        } else {
          resolve(data);
        }
      })
    });
  }
}
