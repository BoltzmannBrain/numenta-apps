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

const MOMENT_TO_STRPTIME = require('../config/momentjs_to_datetime_strptime.json'); // eslint-disable-line

/**
 * List of supported timestamp formats mapped to python dateutil format
 * @type {string}
 * @see ../config/momentjs_to_datetime_strptime.json
 */
export const TIMESTAMP_FORMAT_PY_MAPPING =
   MOMENT_TO_STRPTIME.reduce((prev, cur) => {
     return Object.assign(prev, cur.mappings);
   }, {});

/**
 * List of supported timestamp formats
 * @type {string}
 */
export const TIMESTAMP_FORMATS = Object.keys(TIMESTAMP_FORMAT_PY_MAPPING);
