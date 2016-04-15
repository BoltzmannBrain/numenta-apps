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
 * HTM Studio: FileClient - Talk to a FileService over IPC or HTTP, gaining
 *  access to the Node/io.js layer of filesystem, so we can CRUD files.
 *  Connects via HTTP or IPC adapter. FileClientIPC adpater is currently a
 *  pseudo-library, using the magic of Electron's `remote` module.
 */

let remote = require('remote'); // eslint-disable-line
let client = remote.require('./FileService').default; // Get singleton
export default client;
