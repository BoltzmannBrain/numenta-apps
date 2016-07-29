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

/**
 * Floor value for 'red' anomalies
 * @type {Number}
 */
// See NAB threshold:
// https://github.com/numenta/NAB/blob/master/config/thresholds.json#L27
export const ANOMALY_RED_VALUE = 0.5125976562500002;

/**
 * Floor value for 'yellow' anomalies
 * @type {Number}
 */
export const ANOMALY_YELLOW_VALUE = 0.4;

/** Number of records under which the metric is considered probationary
 * @type {Number}
 */
export const PROBATION_LENGTH = 390;
