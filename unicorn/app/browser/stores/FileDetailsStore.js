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


import BaseStore from 'fluxible/addons/BaseStore';


/**
 * HTM Studio: File Details Store backing {FileDetails} Component
 */
export default class FileDetailsStore extends BaseStore {
  static get storeName() {
    return 'FileDetailsStore';
  }

  /**
   * @listens {SHOW_FILE_DETAILS}
   * @listens {HIDE_FILE_DETAILS}
   * @listens {UPLOADED_FILE}
   */
  static get handlers() {
    return {
      SHOW_FILE_DETAILS: '_showFileDetails',
      HIDE_FILE_DETAILS: '_hideFileDetails',
      VALIDATE_FILE_FAILED: '_handleFileValidate',
      VALIDATE_FILE: '_handleFileValidate',
      VALIDATE_FILE_WARNING: '_handleFileValidate'
    }
  }
  constructor(dispatcher) {
    super(dispatcher);
    this._file = null;
    this._fields = null;
    this._error = null;
    this._warning = null;
    this._visible = false;
    this._newFile = false;
  }

  /**
   * The current selected file
   * @return {File} The current selected file or null
   */
  getFile() {
    return this._file ;
  }
  /**
   * Fields from current selected file sorted by 'index'
   * @return {Metric[]} Fields from current selected file or null
   */
  getFields() {
    return this._fields ? this._fields.sort((a, b) => a.index - b.index) : null;
  }
  /**
   * @return {Boolean} Whether or not the Details page should be visible
   */
  isVisible() {
    return this._file !== null && this._visible;
  }

  /**
   * The current validation error
   * @return {string} The current validation error or null
   */
  getError() {
    return this._error;
  }

  /**
   * The current validation warning
   * @return {string} The current validation warning or null
  */
  getWarning() {
    return this._warning;
  }
  /**
   * @return {Boolean} Whether or not showing a new file
   */
  isNewFile() {
    return this._file !== null && this._newFile;
  }

  /**
   * Handle  {ShowFileDetails} action
   * @param  {object} results The file, fields and error to show
   */
  _showFileDetails(results) {
    let {file, fields, error, warning} = results;
    this._file = file;
    this._fields = fields;
    this._error = error;
    this._warning = warning;
    this._visible = true;
    this._newFile = false;
    this.emitChange();
  }
  /**
   * Handle {HideFileDetails} actions
   */
  _hideFileDetails() {
    this._visible = false;
    this._newFile = false;
    this._file = null;
    this._fields = null;
    this._error = null;
    this._warning = null;
    this.emitChange();
  }

  /**
   * Handle {FileValidate} action
   * @param  {object} results Validation results.
   *                          See {@link FileService#validate}
   */
  _handleFileValidate(results) {
    this._visible = true;
    this._newFile = true;
    this._error = results.error;
    this._warning = results.warning;
    this._file = results.file;
    this._fields = results.fields;
    this.emitChange();
  }
}
