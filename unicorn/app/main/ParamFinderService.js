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

import childProcess from 'child_process';
import EventEmitter from 'events';
import getPortablePython from './PortablePython';
import UserError from './UserError';
import log from './Logger'

const PYTHON_EXECUTABLE = getPortablePython();


/**
 * Thrown when attempting to create more than 1 param finder per metric
 */
export class MaximumConcurrencyError extends UserError {
  constructor() {
    super('More than 1 param finder process is running');
  }
}

/**
 * Thrown when attempting to create a param finder with a metric ID
 *  already taken.
 */
export class DuplicateIDError extends UserError {
  constructor() {
    super('Duplicate metric ID');
  }
}

/**
 * Thrown when attempting to perform an operation on an unknown param finder.
 */
export class ParamFinderNotFoundError extends UserError {
  constructor() {
    super('Param Finder not found');
  }
}


/**
 * HTM Studio: ParamFinderService - Respond to a ParamFinderService over IPC,
 *  sharing our access to HTM Studio Backend Param Finder Runner python and
 *  NuPIC processes.
 */
export class ParamFinderService extends EventEmitter {

  constructor(...args) {
    super(...args);
    this._paramFinders = new Map();
  }

  /**
   * Returns the number of slots available to run new param finders.
   * @param {String} metricId - ID string for Metric to use
   * @return {number} - Maximum available number of param finders allowed to run at the same time for one metric
   */
  availableSlots(metricId) {
    if (this._paramFinders.has(metricId)) {
      return 0; // only one param finder allowed per metric
    }
    return 1;
  }

  /**
   * Creates new Param Finder.
   * @param  {String} metricId - ID of the metric the param finder will be run against.
   * @param  {Object} inputOpt - Input options. See 'input_opt_schema_param_finder.json'
   * @throws {@link MaximumConcurrencyError}, {@link DuplicateIDError}
   */
  createParamFinder(metricId, inputOpt) {
    if (this.availableSlots(metricId) <= 0) {
      let err = new MaximumConcurrencyError();
      log.error({err, metricId, inputOpt});
      throw err;
    }

    if (this._paramFinders.has(metricId)) {
      let err = new DuplicateIDError();
      log.error({err, metricId, inputOpt});
      throw err;
    }

    const params = [
      '-E',
      '-m', 'unicorn_backend.param_finder_runner',
      '--input', JSON.stringify(inputOpt)
    ];
    const child = childProcess.spawn(PYTHON_EXECUTABLE, params);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.on('error', (err) => {
      log.error({err, metricId, inputOpt});
      this.emit(metricId, 'error', err);
    });

    child.stderr.on('data', (err) => {
      log.error({err, metricId, inputOpt});
      this.emit(metricId, 'error', err);
    });

    child.stdout.on('data', (data) => {
      this.emit(metricId, 'data', data);
    });

    child.once('close', (code) => {
      if (code) {
        log.error({metricId, inputOpt, event:'close', code});
      }
      this._paramFinders.delete(metricId);
      this.emit(metricId, 'close', code);
    });

    this._paramFinders.set(metricId, {
      inputOpt, child
    });
  }

  /**
   * Returns a list of active param finders.
   * @return {Array} - List of metric IDs with the active param finders
   */
  getParamFinders() {
    return Array.from(this._paramFinders.keys());
  }

  /**
   * Stops and remove the param finder.
   * @param {string} metricId - The ID of the param finder to stop
   */
  removeParamFinder(metricId) {
    if (!this._paramFinders.has(metricId)) {
      let err = new ParamFinderNotFoundError();
      log.error({err, metricId});
      throw err;
    }

    const paramFinder = this._paramFinders.get(metricId);
    this._paramFinders.delete(metricId);
    paramFinder.child.kill();
    this.removeAllListeners(metricId);
  }

}

const INSTANCE = new ParamFinderService()
export default INSTANCE;
