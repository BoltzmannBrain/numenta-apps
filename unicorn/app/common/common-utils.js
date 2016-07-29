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

import {ANOMALY_RED_VALUE, ANOMALY_YELLOW_VALUE} from './Constants';

/**
 * Generic Javascript functions that can be used on either the `main` process or
 * the `browser` process. These functions should be pure Javascript and not
 * depend on either `node` or `DOM`
 */

/**
 * Template String to trim extra spaces from multiline es6 strings.
 * @param {Array} strings - Input string literals for es6 template string.
 * @param {...Array} [values] - Template string filler values.
 * @returns {String} - Completed and filled string.
 */
export function trims(strings, ...values) {
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
export function promisify(fn, ...args) {
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

/**
 * Return the given value using anomaly scale.
 * @param {float} value anomaly value [0 .. 1]
 * @return {float} scaled value
 */
export function anomalyScale(value) {
  if (value >= ANOMALY_RED_VALUE) {
    return 0.3;
  }
  if (value >= ANOMALY_YELLOW_VALUE) {
    return 0.2;
  }
  return 0.1;
}

/**
 * Binary Search sorted array for a given key
 * @param  {Array} array Sorted array to search elements
 * @param  {Object} key  Element key to search
 * @param  {function} compare Comparison function in the following format:
 *                            ```
 *                            compare(current, key) => {
 *                            	if (current < key) return -1;
 *                            	if (current > key) return 1;
 *                            	if (current === key) return 0;
 *                            }
 *                            ```
 * @return {integer} element index if found,
 *                   or 2s complement of the insertion index if not found
 */
export function binarySearch(array, key, compare) {
  let max = array.length - 1;
  let min = 0;
  let current,  mid, res;
  while (min <= max) {
    mid = (min + max) >>> 1;
    current = array[mid];
    res = compare(current, key);
    if (res < 0) {
      min = mid + 1;
    } else if (res > 0) {
      max = mid - 1;
    } else {
      return mid;
    }
  }
  return ~max; // Insertion index
}

/**
 * Map Anomaly value to text (HIGH / MEDIUM / LOW)
 * @param {Number} anomaly - Anomaly value
 * @returns {String} - Anomaly text
 */
export function mapAnomalyText(anomaly) {
  if (anomaly === null) {
    return 'N/A';
  }
  if (anomaly >= ANOMALY_RED_VALUE) {
    return 'HIGH';
  } else if (anomaly >= ANOMALY_YELLOW_VALUE) {
    return 'MEDIUM';
  }
  return 'LOW';
}
