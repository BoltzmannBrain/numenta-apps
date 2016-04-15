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


import csv from 'csv-streamify';
import fs from 'fs';
import path from 'path';

import TimeAggregator from '../../../app/main/TimeAggregator';
const assert = require('assert');

const FILENAME = path.resolve(__dirname, '../fixtures/rec-center-15.csv');

/* eslint-disable max-nested-callbacks */

describe('TimeAggregator', () => {
  let stream;
  let parser = null;
  beforeEach(() => {
    stream = fs.createReadStream(FILENAME);
    parser = csv({objectMode:true, columns:true});
  });

  describe('Time internals', () => {
    let options = {
      timefield: 'timestamp',
      valuefield: 'kw_energy_consumption',
      function: 'count',
      interval: 1000
    };

    it('should group by 1 hour', (done) => {
      options.interval = 60 * 60 * 1000;
      let aggregator = new TimeAggregator(options);
      let actual = [];
      stream
        .pipe(parser)
        .pipe(aggregator)
        .on('data', (data) => {
          actual.push(data);
        })
        .once('end', () => {
          assert.equal(4, actual[0].kw_energy_consumption);
          done();
        });
    });

    it('should group by 1 day', (done) => {
      options.interval = 24 * 60 * 60 * 1000;
      let aggregator = new TimeAggregator(options);
      let actual = [];
      stream
        .pipe(parser)
        .pipe(aggregator)
        .on('data', (data) => {
          actual.push(data);
        })
        .once('end', () => {
          assert.equal(96, actual[0]['kw_energy_consumption']);
          done();
        });
    });
  });

  describe('Aggregation Functions', () => {
    let options = {
      timefield: 'timestamp',
      valuefield: 'kw_energy_consumption',
      function: 'count',
      interval: 24 * 60 * 60 * 1000
    };
    it('should calculate the min', (done) => {
      options.function = 'min';
      let aggregator = new TimeAggregator(options);
      let actual = [];
      stream
        .pipe(parser)
        .pipe(aggregator)
        .on('data', (data) => {
          actual.push(data);
        })
        .once('end', () => {
          assert.equal(1.1, actual[0]['kw_energy_consumption']);
          done();
        });
    });

    it('should calculate the max', (done) => {
      options.function = 'max';
      let aggregator = new TimeAggregator(options);
      let actual = [];
      stream
        .pipe(parser)
        .pipe(aggregator)
        .on('data', (data) => {
          actual.push(data);
        })
        .once('end', () => {
          assert.equal(12.9, actual[0]['kw_energy_consumption']);
          done();
        });
    });

    it('should calculate the sum', (done) => {
      options.function = 'sum';
      let aggregator = new TimeAggregator(options);
      let actual = [];
      stream
        .pipe(parser)
        .pipe(aggregator)
        .on('data', (data) => {
          actual.push(data);
        })
        .once('end', () => {
          assert.equal(670.0999999999999, actual[0]['kw_energy_consumption']);
          done();
        });
    });

    it('should calculate the avg', (done) => {
      options.function = 'avg';
      let aggregator = new TimeAggregator(options);
      let actual = [];
      stream
        .pipe(parser)
        .pipe(aggregator)
        .on('data', (data) => {
          actual.push(data);
        })
        .once('end', () => {
          assert.equal(6.9802083333333345, actual[0]['kw_energy_consumption']);
          done();
        });
    });

    it('should calculate the count', (done) => {
      options.function = 'count';
      let aggregator = new TimeAggregator(options);
      let actual = [];
      stream
        .pipe(parser)
        .pipe(aggregator)
        .on('data', (data) => {
          actual.push(data);
        })
        .once('end', () => {
          assert.equal(96, actual[0]['kw_energy_consumption']);
          done();
        });
    });
  });
});
