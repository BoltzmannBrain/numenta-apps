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
 * File type stored in the {@link FileStore}
 * @see ../database/schema/File.json
 *
 * @typedef {Object} FileStore.File
 * @property {string} name Short File Name
 * @property {string} filename Full file path
 * @property {string} type File type ('upoaded' | 'sample')
 */

/**
 * File Store,
 * it maintains a collection of {@link FileStore.File}
 */
export default class FileStore extends BaseStore {

  static get storeName() {
    return 'FileStore';
  }

  /**
   * @listens {DELETE_FILE}
   * @listens {UPDATE_FILE}
   * @listens {UPLOADED_FILE}
   * @listens {LIST_FILES}
   * @listens {SET_FILE_EXPANDED_STATE}
   */
  static get handlers() {
    return {
      DELETE_FILE: '_handleDeleteFile',
      UPDATE_FILE: '_handleSetFile',
      UPLOADED_FILE: '_handleUploadedFile',
      LIST_FILES: '_handleListFiles',
      SET_FILE_EXPANDED_STATE: '_handleSetFileExpandedState'
    }
  }

  constructor(dispatcher) {
    super(dispatcher);
    this._files = new Map();
  }

  getFiles() {
    return Array.from(this._files.values());
  }

  /**
   * Get file from store
   *
   * @param  {string} filename File Name
   * @return {FileStore.File} The file object.
   */
  getFile(filename) {
    return this._files.get(filename);
  }

  _handleDeleteFile(filename) {
    if (this._files.delete(filename)) {
      this.emitChange();
    }
  }

  /**
   * Initialize FileStore from the given list of files
   *
   * Algorithm for determinining the initial expanded/collapsed state of files:
   *
   *   If there are no files of type `uploaded` (i.e. only sample files), then
   *   collapse all the sample files except the first one in the list
   *
   *   If there is at least one file of type `uploaded`, then collapse
   *   everything
   *
   * @param  {Array} files - List of FileStore.File objects
   */
  _handleListFiles(files) {
    if (files) {
      let haveUploadedFiles = false;

      files.forEach((file) => {
        this._files.set(file.filename, Object.assign({expanded: false},file));
        if (file.type === 'uploaded') {
          haveUploadedFiles = true;
        }
      });

      if (!haveUploadedFiles) {
        // Assumes that getFiles returns array in display order
        this._files.get(this.getFiles()[0].filename).expanded = true;
      }

      this.emitChange();
    }
  }

  _handleSetFile(file) {
    this._files.set(file.filename, Object.assign({},file));
    this.emitChange();
  }

  /**
   * Set expanded/collapsed view state of file.
   *
   * @param {object} payload - Action payload
   * @param {String} payload.filename - File Name
   * @param {Boolean} payload.expanded - true for expanded file view; false for
   *   collapsed
   */
  _handleSetFileExpandedState(payload) {
    this._files.get(payload.filename).expanded = payload.expanded;
    this.emitChange()
  }

  _handleUploadedFile(file) {
    this._files.set(file.filename, Object.assign({expanded: true},file));
    this.emitChange();
  }


}
