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

const assert = require('assert');
import moment from 'moment';

import {
  ALL_TIMESTAMP_FORMAT_PY_MAPPINGS, COMPOUND_TIMESTAMP_FORMATS
} from '../../../../app/common/timestamp';


/* eslint-disable max-nested-callbacks */
describe('timestamp', () => {
  describe('#ALL_TIMESTAMP_FORMAT_PY_MAPPINGS', () => {
    it('keys should be recognized by momementjs as formats', (done) => {
      let allFormats = Object.keys(ALL_TIMESTAMP_FORMAT_PY_MAPPINGS);
      let utcNow = moment.utc()
      allFormats.map((format) => {
        let formattedNow = utcNow.format(format);
        assert(moment.utc(formattedNow, format, true).isValid(),
               `now=${utcNow}; fmt=${format}; formatted=${formattedNow}`);
        assert.equal(moment.utc(formattedNow, format, true).format(format),
                     formattedNow);
      });
      done();
    });
  });

  describe('#COMPOUND_TIMESTAMP_FORMATS', () => {
    it('elements should be recognized by momementjs as formats', (done) => {
      let utcNow = moment.utc()
      COMPOUND_TIMESTAMP_FORMATS.map((format) => {
        let formattedNow = utcNow.format(format);
        assert(moment.utc(formattedNow, format, true).isValid(),
               `now=${utcNow}; fmt=${format}; formatted=${formattedNow}`);
        assert.equal(moment.utc(formattedNow, format, true).format(format),
                     formattedNow);
      });
      done();
    });
  });
});
