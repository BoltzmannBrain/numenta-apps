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

var moment = require('moment');  // eslint-disable-line no-var
var Transform = require('stream').Transform; // eslint-disable-line no-var
var util = require('util'); // eslint-disable-line no-var


/**
 * Creates a stream {@link Transform} class used to aggregate the data stream.
 * @param {Object} options - Aggregation settings:
 * @param {string} options.timefield - Name of the field representing 'time'
 * @param {string} options.valuefield - Name of the field containing the 'value'
 * @param {string} options.function - Aggregation function to use: 'sum',
 *                                  	'count', 'avg', 'min', 'max'
 * @param {number} options.interval - Time interval in milliseconds
 */
function TimeAggregator(options) {
  this._options = Object.assign({}, options, {objectMode: true});
  Transform.call(this, this._options); // eslint-disable-line prefer-reflect
  this._timebucket = 0;
  this._interval = this._options.interval || 60000;
  this._valuefield = this._options.valuefield;
  this._timefield = this._options.timefield;
  this._function = this._options.function || 'count';
  this._bucket = {timestamp: 0, value: 0};
  this._count = 0;
  this._reset();
}
util.inherits(TimeAggregator, Transform);

TimeAggregator.prototype._transform = function (data, encoding, done) {
  if (this._timefield in data) {
    let timestamp = moment.utc(data[this._timefield]).valueOf();
    if (this._timebucket === 0) {
      this._timebucket = timestamp + this._interval;
    } else if (timestamp >= this._timebucket) {
      this._publish();
    }
    this._update(data);
  }
  done();
};

TimeAggregator.prototype._flush = function (done) {
  this._publish();
  done();
};

TimeAggregator.prototype._reset = function () {
  let value;
  switch (this._function) {
  case 'min':
    value = Number.MAX_VALUE;
    break;
  case 'max':
    value = Number.MIN_VALUE;
    break;
  case 'sum':
    /* fall through */
  case 'avg':
    /* fall through */
  case 'count':
    /* fall through */
  default:
    value = 0;
  }
  this._bucket = {
    timestamp: this._timebucket,
    value
  };
  this._count = 0;
};

TimeAggregator.prototype._update = function (data) {
  if (this._valuefield in data) {
    this._count++;
    let value = parseFloat(data[this._valuefield]);
    switch (this._function) {
    case 'sum':
      this._bucket.value += value;
      break;
    case 'avg':
      this._bucket.value += (value - this._bucket.value) / this._count;
      break;
    case 'count':
      this._bucket.value = this._count;
      break;
    case 'min':
      this._bucket.value = value < this._bucket.value
                          ? value : this._bucket.value;
      break;
    case 'max':
      this._bucket.value = value > this._bucket.value
                          ? value : this._bucket.value;
      break;
    default:
    }
  }
};

TimeAggregator.prototype._publish = function () {
  let data = {};
  if (this._count > 0) {
    data[this._timefield] = this._bucket.timestamp;
    data[this._valuefield] = this._bucket.value;
    this.push(data);
  }
  this._timebucket += this._interval;
  this._reset();
};

export default TimeAggregator;
