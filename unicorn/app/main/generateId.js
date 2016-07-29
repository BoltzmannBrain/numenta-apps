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
import path from 'path';


/**
 * Genereate unique hashed UID based on seed string and SHA1.
 * @param  {string} seed - Seed string to hash
 * @return {string} Unique id
 */
export function generateId(seed) {
  const hash = crypto.createHash('sha1');
  return hash.update(seed).digest('hex');
}

/**
 * Genereate unique file ID
 * @param  {string} filename - The absolute path
 * @return {string} Unique id
 */
export function generateFileId(filename) {
  // Use only basename when generating File ID. See UNI-527
  let basename = path.basename(filename);
  // Use 64 bit hash
  return generateId(basename).substr(0,16);
}

/**
 * Genereate unique metric uid based on the filename and metric name
 *  via hashing.
 * @param  {string} filename - The absolute path
 * @param  {string} metric - Metric name
 * @return {string} Unique id
 */
export function generateMetricId(filename, metric) {
  let fileId = generateFileId(filename);
  // Use 64 bit hash
  let metricId = generateId(metric).substr(0,16);
  return `${fileId}!${metricId}`;
}

/**
 * Genereate unique metric data id based on the metric id and timestamp
 * @param  {string} metricId - Metric ID
 * @param  {number} index  - Row number of the data record
 * @return {string} Unique id
 */
export function generateMetricDataId(metricId, index) {
  let indexString = `000000000000${index}`.substr(-13);
  return `${metricId}!${indexString}`;
}
