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

import muiTheme from './MaterialUI/HTMStudioTheme';
import {ANOMALY_RED_VALUE, ANOMALY_YELLOW_VALUE} from './Constants'


/**
 * Generic Javascript functions that can only be used on the `browser` process.
 * These functions can access objects available from the `browser` process but
 * should not depend on node`
 */


/**
 * Format value for display for Dygraph Chart Y axis label, or Legend display.
 * @param {Number} value - Number to display (5, 6.23, 2.3232342, etc).
 * @return {Number} - Display value (cut long decimals, locale-ize)
 */
export function formatDisplayValue(value) {
  if (Number.isInteger(value)) {
    return value.toLocaleString();
  }
  return (value.toFixed(2)).toLocaleString();
}

/**
 * Map Anomaly value to bar color (Red/Yellow/Green)
 * @param {Number} anomaly - Anomaly value
 * @returns {String} - String for Color to use
 */
export function mapAnomalyColor(anomaly) {
  if (anomaly === null) {
    return muiTheme.palette.disabledColor;
  }
  if (anomaly >= ANOMALY_RED_VALUE) {
    return muiTheme.palette.dangerColor;
  } else if (anomaly >= ANOMALY_YELLOW_VALUE) {
    return muiTheme.palette.warnColor;
  }
  return muiTheme.palette.safeColor;
}
