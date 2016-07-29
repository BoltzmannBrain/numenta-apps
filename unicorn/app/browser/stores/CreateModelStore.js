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
import BaseStore from 'fluxible/addons/BaseStore';
import _ from 'lodash';

export default class CreateModelStore extends BaseStore {
  static get storeName() {
    return 'CreateModelStore';
  }
  /**
   * @listens {SHOW_CREATE_MODEL_DIALOG}
   * @listens {HIDE_CREATE_MODEL_DIALOG}
   * @listens {START_PARAM_FINDER}
   * @listens {RECEIVE_PARAM_FINDER_DATA}
   */
  static get handlers() {
    return {
      SHOW_CREATE_MODEL_DIALOG: '_handleShowCreateModelDialog',
      HIDE_CREATE_MODEL_DIALOG: '_handleHideCreateModelDialog',
      START_PARAM_FINDER: '_handleStartParamFinder',
      RECEIVE_PARAM_FINDER_DATA: '_handleReceiveParamFinderData',
      OVERRIDE_PARAM_FINDER_RESULTS: '_handleOverrideParamFinderResults',
      TOGGLE_AGGREGATE_DATA: '_handleToggleAggregateData',
      START_PARAM_FINDER_FAILED: '_handleParamFinderError',
      STOP_PARAM_FINDER_FAILED: '_handleParamFinderError',
      UNKNOWN_PARAM_FINDER_FAILURE: '_handleParamFinderError'
    }
  }
  constructor(dispatcher) {
    super(dispatcher);
    this._reset();
  }

  modelRunnerParams() {
    return _.merge({}, this.paramFinderResults, this.userParamOverrides);
  }

  recommendAggregation() {
    return Boolean(_.get(this.paramFinderResults, 'aggInfo'));
  }

  _reset() {
    // CreateModelDialog
    this.fileName = null;
    this.metricId = null;
    this.metricName = null;
    this.aggregateData = false;
    // Param Finder
    this.paramFinderResults = null;
    this.userParamOverrides = null;
    this.inputOpts = null;
    this.paramFinderError = null;
  }

  _setDefaultOverrides() {
    let defaultOverrides = {
      aggInfo: {
        windowSize: 0,
        func: 'mean'
      }
    };
    this.userParamOverrides = _.merge({},
                                      this.userParamOverrides,
                                      defaultOverrides)
  }


  _handleStartParamFinder(payload) {
    this.metricId = payload.metricId;
    this.inputOpts = payload.inputOpts;
    this.emitChange();
  }

  _handleShowCreateModelDialog(payload) {
    this.fileName = payload.fileName;
    this.metricName = payload.metricName;
    this.emitChange();
  }

  _handleHideCreateModelDialog() {
    this._reset();
    this.emitChange();
  }

  _handleReceiveParamFinderData(payload) {
    this.paramFinderResults = JSON.parse(payload.paramFinderResults);
    this.aggregateData = this.recommendAggregation();
    this.metricId = payload.metricId;
    this.emitChange();
  }

  _handleOverrideParamFinderResults(payload) {
    if (!_.get(this.paramFinderResults, 'aggInfo') &&
        !_.get(this.userParamOverrides, 'aggInfo')) {
      this._setDefaultOverrides();
    }
    this.userParamOverrides = _.merge({}, this.userParamOverrides, payload);
    this.emitChange();
  }

  _handleToggleAggregateData(payload) {
    this.aggregateData = payload.aggregateData;
    this.emitChange();
  }

  _handleParamFinderError(payload) {
    this.paramFinderError = payload.error;
    this.emitChange();
  }
}
