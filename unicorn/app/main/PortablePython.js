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

import process from 'process';
import UserError from './UserError'


/**
 * Thrown when portable python distribution is not found for this platform.
 */
export class PortablePythonNotFoundError extends UserError {
  constructor() {
    super(`No portable python found for platform: ${process.platform}.`);
  }
}

/**
 * Get path to platform specific portable python distribution.
 * See 'optionalDependencies' in 'package.json' for available platforms.
 * @throws {@link PortablePythonNotFoundError}
 * @returns {String} Path to portable python distribution
 */
export default function getPortablePython() {
  try {
    return require(`portable_python_${process.platform}`).EXECUTABLE; // eslint-disable-line
  } catch (err) {
    throw new PortablePythonNotFoundError();
  }
}
