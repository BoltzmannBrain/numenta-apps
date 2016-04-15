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
   */
  static get handlers() {
    return {
      DELETE_FILE: '_handleDeleteFile',
      UPDATE_FILE: '_handleSetFile',
      UPLOADED_FILE: '_handleSetFile',
      LIST_FILES: '_handleListFiles'
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

  _handleListFiles(files) {
    if (files) {
      files.forEach((file) => {
        this._files.set(file.filename, Object.assign({},file));
      });
      this.emitChange();
    }
  }

  _handleSetFile(file) {
    this._files.set(file.filename, Object.assign({},file));
    this.emitChange();
  }
}
