#! /usr/bin/env node
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
/* eslint-disable strict */
/* eslint-disable no-sync */

/**
 * This script will download the portable_python package from the ARTIFACT_URL
 * if its not avaialble locally
 */
'use strict'
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

// Package file name
const FILE_NAME = 'portable_python.tar.gz';

// Location of the latest artifact based on current platform and architecture
const ARTIFACT_URL = `https://ci.numenta.com/browse/UN-UN/latestSuccessful/artifact/shared/portable_python-${os.platform()}/${FILE_NAME}`

// portable_python location based on platform
const PORTABLE_PYTHON_LOCATIONS = {
  darwin:{
    x64: path.join(__dirname, 'OSX')
  },
  win32:{
    x64: path.join(__dirname, 'Windows64'),
    // FIXME: Create ia32 build scripts
    ia32: path.join(__dirname, 'Windows64')
  }
};

// Local Package location
const LOCAL_PATH = PORTABLE_PYTHON_LOCATIONS[os.platform()][os.arch()];
const LOCAL_FILE_PATH = path.join(LOCAL_PATH, FILE_NAME);

// HTTP Request Timeout after 5 minutes
const HTTP_TIMEOUT = 5*60*1000;

// Mimics system 'shasum'
function shasum(filename) {
  const data = fs.readFileSync(filename);
  const hash = crypto.createHash('sha1').update(data).digest('hex');
  return `${hash}  ${filename}`;
}

// Download artifact asynchronous returning Promise
function downloadPortablePython(artifactUrl, destination) {
  return new Promise((resolve, reject) => {
    let file = fs.createWriteStream(destination);
    let request = https.get(artifactUrl, (response) => {
      // check if response is success
      if (response.statusCode !== 200) {
        return reject(`HTTP Response status: ${response.statusCode} ${response.statusMessage}`);
      }
      // Save response to file
      response.pipe(file);

      file.on('finish', () => {
        file.close(resolve);  // close() is async, resolve after close completes.
      });

      file.on('error', (error) => {
        // Delete partially downloaded file
        fs.unlink(destination);
        return reject(`I/O Error: ${error}`);
      });
    });

    // Timeout after 5 minutes.
    request.setTimeout(HTTP_TIMEOUT, () => {
      request.abort();
    });

    request.on('error', (error) => {
      // Delete partially downloaded file
      fs.unlink(destination);
      return reject(`HTTP Error: ${error}`);
    });
  });
}

console.log(`Looking for local "portable_python" in ${LOCAL_FILE_PATH}`);
if (fs.existsSync(LOCAL_FILE_PATH)) {
  console.log(shasum(LOCAL_FILE_PATH));
  process.exit(0);
}

console.log(`local "portable_python" was not found, downloading from ${ARTIFACT_URL}`);
downloadPortablePython(ARTIFACT_URL, LOCAL_FILE_PATH)
  .then(() => {
    if (fs.existsSync(LOCAL_FILE_PATH)) {
      console.log(shasum(LOCAL_FILE_PATH));
      process.exit(0);
    }
  })
  .then(() => {
    if (fs.existsSync(LOCAL_FILE_PATH)) {
      console.log(shasum(LOCAL_FILE_PATH));
      process.exit(0);
    }
    // Unable to build portable_python
    console.error(`Unable to find or download portable_python for ${os.platform()}-${os.arch()}`);
    process.exit(-1);
  })
  .catch((error) => {
    console.error(`Failed to find or download portable_python: ${error}`);
    process.exit(-1);
  });
