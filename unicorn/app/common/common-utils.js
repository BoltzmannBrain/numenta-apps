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

import {ANOMALY_RED_VALUE, ANOMALY_YELLOW_VALUE} from '../browser/lib/Constants';

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
 * Return the given value using anomaly scale:
 *  - [0.99999, 1]  => 0.3
 *  - [0.9999, 0.99999) => 0.2
 *  - [0, 0.9999) => 0.1
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
