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


/**
 * Base UserError class
 * Overcomes the fact babel have problems inheriting from builtin objects:
 * @TODO http://stackoverflow.com/questions/3108980
 */
export default class UserError extends Error {
  /**
   * @param {string} message - Error message for user
   */
  constructor(message, ...args) {
    super(message, ...args);
    this._message = message;
    this._stack = (new Error()).stack;
    this.stack = this._stack;
    this.name = this.constructor.name;
  }
}

/**
 * Thrown when having trouble getting data from Database
 */
export class DatabaseGetError extends UserError {
  /**
   * @param {string} message - Error message for user
   */
  constructor(message) {
    super(message || 'Could not perform GET operation from Database');
  }
}

/**
 * Thrown when having trouble putting data into Database
 */
export class DatabasePutError extends UserError {
  /**
   * @param {string} message - Error message for user
   */
  constructor(message) {
    super(message || 'Could not perform PUT operation into Database');
  }
}

/**
 * Thrown when having trouble getting data from Filesystem
 */
export class FilesystemGetError extends UserError {
  /**
   * @param {string} message - Error message for user
   */
  constructor(message) {
    super(message || 'Could not perform READ operation on Filesystem');
  }
}
