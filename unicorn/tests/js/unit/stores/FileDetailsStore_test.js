// Numenta Platform for Intelligent Computing (NuPIC)
// Copyright (C) 2015, Numenta, Inc.  Unless you have purchased from
// Numenta, Inc. a separate commercial license for this software code, the
// following terms and conditions apply:
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero Public License version 3 as
// published by the Free Software Foundation.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
// See the GNU Affero Public License for more details.
//
// You should have received a copy of the GNU Affero Public License
// along with this program.  If not, see http://www.gnu.org/licenses.
//
// http://numenta.org/licenses/

import instantiator from 'json-schema-instantiator';
import path from 'path';
import {
  DBFileSchema, DBMetricSchema
} from '../../../../app/database/schema';
import FileDetailsStore from '../../../../app/browser/stores/FileDetailsStore';
import {
  generateMetricId, generateFileId
} from '../../../../app/main/generateId';

const assert = require('assert');
const METRIC_INSTANCE = instantiator.instantiate(DBMetricSchema);
const FILE_INSTANCE = instantiator.instantiate(DBFileSchema);
function createFileInstance(filename, properties) {
  return Object.assign({}, FILE_INSTANCE, {
    filename,
    uid: generateFileId(filename),
    name: path.basename(filename)
  }, properties);
}

const EXPECTED_FILE = createFileInstance('/file.csv');

const EXPECTED_FIELDS = [
  Object.assign({}, METRIC_INSTANCE, {
    uid: generateMetricId(EXPECTED_FILE.filename, 'timestamp'),
    file_uid: EXPECTED_FILE.uid,
    name: 'timestamp',
    index: 1,
    type: 'date',
    format: 'YYYY-MM-DDTHH:mm:ssZ'
  }),
  Object.assign({}, METRIC_INSTANCE, {
    uid: generateMetricId(EXPECTED_FILE.filename, 'metric1'),
    file_uid: EXPECTED_FILE.uid,
    index: 4,
    name: 'metric1',
    type: 'number'
  })
];

describe('FileDetailsStore', () => {
  let store;

  beforeEach(() => {
    store = new FileDetailsStore();
  });
  it('#_showFileDetails', (done) => {
    store._showFileDetails({file: EXPECTED_FILE, fields: EXPECTED_FIELDS});
    assert.deepEqual(EXPECTED_FILE, store.getFile());
    assert.deepEqual(EXPECTED_FIELDS, store.getFields());
    assert.equal(null, store.getError());
    assert.equal(true, store.isVisible());
    assert.equal(false, store.isNewFile());
    done();
  });
  it('#_hideFileDetails', (done) => {
    store._hideFileDetails();
    assert.equal(null, store.getFile());
    assert.equal(null, store.getFields());
    assert.equal(null, store.getError());
    assert.equal(false, store.isVisible());
    assert.equal(false, store.isNewFile());
    done();
  });
  it('#_handleFileValidate', (done) => {
    store._handleFileValidate({file: EXPECTED_FILE, fields: EXPECTED_FIELDS});
    assert.equal(EXPECTED_FILE, store.getFile());
    assert.equal(EXPECTED_FIELDS, store.getFields());
    assert.equal(true, store.isVisible());
    assert.equal(true, store.isNewFile());
    assert.equal(null, store.getError());
    done();
  });
  it('#_handleFileValidate with error', (done) => {
    store._handleFileValidate({
      file: EXPECTED_FILE, fields: EXPECTED_FIELDS, error: 'error'
    });
    assert.equal(EXPECTED_FILE, store.getFile());
    assert.equal(EXPECTED_FIELDS, store.getFields());
    assert.equal(true, store.isVisible());
    assert.equal(true, store.isNewFile());
    assert.equal('error', store.getError());
    done();
  });
});
