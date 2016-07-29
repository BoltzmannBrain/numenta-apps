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

import Checkbox from 'material-ui/lib/checkbox';
import CheckboxIcon from 'material-ui/lib/svg-icons/toggle/check-box';
import CheckboxOutline from 'material-ui/lib/svg-icons/toggle/check-box-outline-blank';
import IconButton from 'material-ui/lib/icon-button';
import ListItem from 'material-ui/lib/lists/list-item';
import TextField from 'material-ui/lib/text-field';
import RadioButton from 'material-ui/lib/radio-button';
import RadioButtonGroup from 'material-ui/lib/radio-button-group';
import React from 'react';
import moment from 'moment';
import _ from 'lodash';


import OverrideParamFinderResults from '../actions/OverrideParamFinderResults';
import ToggleAggregateData from '../actions/ToggleAggregateData';

/**
 * Advanced Settings
 */
export default class AdvancedSettings extends React.Component {

  static contextTypes = {
    executeAction: React.PropTypes.func,
    getConfigClient: React.PropTypes.func,
    muiTheme: React.PropTypes.object
  };

  constructor(props, context) {
    super(props, context);
    this._config = this.context.getConfigClient();
    this.state = {};

    let muiTheme = this.context.muiTheme;
    this._styles = {
      checkbox: {
        label: {
          paddingLeft: '50px'
        }
      },
      advancedSection: {
        minHeight: '200px',
        marginTop: '10px',
        fontSize: 14,
        label: {
          paddingLeft: '50px'
        }
      },
      aggregateData: {
        marginLeft: '75px',
        label: {
          display: 'block',
          marginTop: '10px',
          color: muiTheme.rawTheme.palette.accent3Color,
          fontSize: 14
        },
        aggWindowField: {
          width: '30px',
          marginRight: '5px',
          input: {
            textAlign: 'center'
          }
        },
        windowSize: {
          margin: '15px',
          span: {
            margin: '0 15px 0 0',
            fontSize: 14
          }
        },
        radioGroup: {
          margin: '15px',
          radioButton: {
            display: 'inline-block',
            width: '20%'
          }
        },
        tooltipIcon: {
          display: 'inline-block',
          verticalAlign: 'middle',
          width: '20px',
          height: '20px',
          padding: '0 0 0 10px',
          fill: muiTheme.rawTheme.palette.accent3Color
        },
        tooltip: {
          fontSize: 14,
          zIndex: '1000px'
        },
        listItemWrapper: {
          display: 'inline-block',
          verticalAlign: 'middle'
        },
        disabled: {
          color: muiTheme.rawTheme.palette.disabledColor
        }
      }
    };
  }


  _handleAggregateDataOption() {
    let {aggregateData} = this.props;
    this.context.executeAction(OverrideParamFinderResults);

    let payload = {aggregateData: !aggregateData};
    this.context.executeAction(ToggleAggregateData, payload);
  }

  _handleAggregationWindow() {
    let duration = moment.duration({
      hours: this.aggWindowHours.getValue() % 99,
      minutes: this.aggWindowMinutes.getValue() % 60,
      seconds: this.aggWindowSeconds.getValue() % 60
    });
    let payload = {};
    _.set(payload, 'aggInfo.windowSize', duration.asSeconds());

    this.context.executeAction(OverrideParamFinderResults, payload);
  }

  _handleAggregationMethod(event, value) {
    let payload = {};
    _.set(payload, 'aggInfo.func', value);

    this.context.executeAction(OverrideParamFinderResults, payload);
  }

  _handleWeeklyPatternOption() {
    let {modelRunnerParams} = this.props;
    let weeklyEncoder = {
      dayOfWeek: [21, 3],
      fieldname: 'c0',
      type: 'DateEncoder',
      name: 'c0'
    };

    let payload = {};

    if (_.get(modelRunnerParams, 'modelInfo.modelConfig.modelParams.' +
                                 'sensorParams.encoders.c0_dayOfWeek')) {
      _.set(payload, 'modelInfo.modelConfig.modelParams.' +
                     'sensorParams.encoders.c0_dayOfWeek', null);
    } else {
      _.set(payload, 'modelInfo.modelConfig.modelParams.' +
                     'sensorParams.encoders.c0_dayOfWeek', weeklyEncoder);
    }

    this.context.executeAction(OverrideParamFinderResults, payload);
  }

  _handleDailyPatternOption() {
    let {modelRunnerParams} = this.props;
    let dailyEncoder = {
      fieldname: 'c0',
      timeOfDay: [21, 9],
      type: 'DateEncoder',
      name: 'c0'
    };

    let payload = {};

    if (_.get(modelRunnerParams, 'modelInfo.modelConfig.modelParams.' +
                                 'sensorParams.encoders.c0_timeOfDay')) {
      _.set(payload, 'modelInfo.modelConfig.modelParams.' +
                     'sensorParams.encoders.c0_timeOfDay', null);
    } else {
      _.set(payload, 'modelInfo.modelConfig.modelParams.' +
                     'sensorParams.encoders.c0_timeOfDay', dailyEncoder);
    }

    this.context.executeAction(OverrideParamFinderResults, payload);
  }

  componentDidMount() {
    let {modelRunnerParams} = this.props;
    let payload = {
      aggregateData: Boolean(modelRunnerParams.aggInfo)
    };
    this.context.executeAction(ToggleAggregateData, payload);
  }

  render() {
    let {aggregateData, modelRunnerParams} = this.props;
    let checkboxColor = this.context.muiTheme.rawTheme.palette.primary1Color;
    let windowSizeSeconds = (modelRunnerParams.aggInfo &&
                             modelRunnerParams.aggInfo.windowSize) || 0;
    let windowSize = moment.duration(windowSizeSeconds, 'seconds');
    let aggregationMethod;
    if (modelRunnerParams.aggInfo && modelRunnerParams.aggInfo.func) {
      aggregationMethod = modelRunnerParams.aggInfo.func;
    } else {
      aggregationMethod = 'mean';
    }
    let dayOfWeek =  'modelInfo.modelConfig.modelParams.' +
                     'sensorParams.encoders.c0_dayOfWeek';
    let weeklyAggregation = Boolean(_.get(modelRunnerParams, dayOfWeek));
    let timeOfDay = 'modelInfo.modelConfig.modelParams.' +
                    'sensorParams.encoders.c0_timeOfDay';
    let dailyAggregation = Boolean(_.get(modelRunnerParams, timeOfDay));
    let labelStyle = this._styles.aggregateData.label;
    let windowSizeStyle = this._styles.aggregateData.windowSize;
    if (!aggregateData) {
      labelStyle = _.merge({}, labelStyle, this._styles.aggregateData.disabled);
      windowSizeStyle = _.merge({},
                                windowSizeStyle,
                                this._styles.aggregateData.disabled);
    }

    return (
      <div style={this._styles.advancedSection}>
        <div style={this._styles.aggregateData.listItemWrapper}>
          <ListItem
            leftCheckbox={<Checkbox
                            checked={aggregateData}
                            checkedIcon={<CheckboxIcon color={checkboxColor}
                                                       viewBox="0 0 30 30"
                                          />}
                            onCheck={this._handleAggregateDataOption.bind(this)}
                            style={this._styles.checkbox}
                            unCheckedIcon={<CheckboxOutline
                                             color={checkboxColor}
                                             viewBox="0 0 30 30"
                                           />}
                          />}
            primaryText={
              this._config.get('dialog:model:create:advanced:aggData:label')}
            style={this._styles.checkbox.label}
          />
        </div>
        <IconButton
          style={this._styles.aggregateData.tooltipIcon}
          tooltipStyles={this._styles.aggregateData.tooltip}
          tooltip={this._config.get('dialog:model:create:advanced:' +
                                    'aggData:tooltip')}
          tooltipPosition="top-right"
        >
          <img src="assets/images/tooltip.svg" alt="Tooltip" />
        </IconButton>
        <div style={this._styles.aggregateData}>
          <label style={labelStyle}>
            {this._config.get('dialog:model:create:advanced:aggWindow:label')}
            <IconButton
              style={this._styles.aggregateData.tooltipIcon}
              tooltipStyles={this._styles.aggregateData.tooltip}
              tooltip={this._config.get('dialog:model:create:advanced:' +
                                        'aggWindow:tooltip')}
              tooltipPosition="top-right"
            >
              <img src="assets/images/tooltip.svg" alt="Tooltip" />
            </IconButton>
          </label>
          <div style={windowSizeStyle}>
            <TextField
              style={this._styles.aggregateData.aggWindowField}
              inputStyle={this._styles.aggregateData.aggWindowField.input}
              value={windowSize.hours()}
              ref={(ref) => this.aggWindowHours = ref}
              onChange={this._handleAggregationWindow.bind(this)}
              maxLength="2"
              disabled={!aggregateData}
            />
                <span style={this._styles.aggregateData.windowSize.span}>
                  Hours
                </span>
            <TextField
              style={this._styles.aggregateData.aggWindowField}
              inputStyle={this._styles.aggregateData.aggWindowField.input}
              value={windowSize.minutes()}
              ref={(ref) => this.aggWindowMinutes = ref}
              onChange={this._handleAggregationWindow.bind(this)}
              maxLength="2"
              disabled={!aggregateData}
            />
                <span style={this._styles.aggregateData.windowSize.span}>
                  Minutes
                </span>
            <TextField
              style={this._styles.aggregateData.aggWindowField}
              inputStyle={this._styles.aggregateData.aggWindowField.input}
              value={windowSize.seconds()}
              ref={(ref) => this.aggWindowSeconds = ref}
              onChange={this._handleAggregationWindow.bind(this)}
              maxLength="2"
              disabled={!aggregateData}
            />
                <span style={this._styles.aggregateData.windowSize.span}>
                  Seconds
                </span>
          </div>

          <label style={labelStyle}>
            {this._config.get('dialog:model:create:advanced:aggMethod:label')}
            <IconButton
              style={this._styles.aggregateData.tooltipIcon}
              tooltipStyles={this._styles.aggregateData.tooltip}
              tooltip={this._config.get('dialog:model:create:advanced:' +
                                        'aggMethod:tooltip')}
              tooltipPosition="top-right"
            >
              <img src="assets/images/tooltip.svg" alt="Tooltip" />
            </IconButton>
          </label>
          <RadioButtonGroup name="aggregationMethod"
                            defaultSelected="mean"
                            valueSelected={aggregationMethod}
                            style={this._styles.aggregateData.radioGroup}
                            onChange={this._handleAggregationMethod.bind(this)}
          >
            <RadioButton
              value="mean"
              label="Average"
              style={this._styles.aggregateData.radioGroup.radioButton}
              disabled={!aggregateData}
            />
            <RadioButton
              value="sum"
              label="Sum"
              style={this._styles.aggregateData.radioGroup.radioButton}
              disabled={!aggregateData}
            />
          </RadioButtonGroup>
        </div>
        <ListItem
          leftCheckbox={<Checkbox
                          checked={dailyAggregation}
                          checkedIcon={<CheckboxIcon color={checkboxColor}
                                                     viewBox="0 0 30 30"
                                        />}
                          onCheck={this._handleDailyPatternOption.bind(this)}
                          style={this._styles.checkbox}
                          unCheckedIcon={<CheckboxOutline color={checkboxColor}
                                                          viewBox="0 0 30 30"
                                         />}
                      />}
          primaryText={this._config.get('dialog:model:create:advanced:daily')}
          style={this._styles.checkbox.label}
        />
        <ListItem
          leftCheckbox={<Checkbox
                          checked={weeklyAggregation}
                          checkedIcon={<CheckboxIcon color={checkboxColor}
                                                     viewBox="0 0 30 30"
                                        />}
                          onCheck={this._handleWeeklyPatternOption.bind(this)}
                          style={this._styles.checkbox}
                          unCheckedIcon={<CheckboxOutline color={checkboxColor}
                                                          viewBox="0 0 30 30"
                                         />}
                      />}
          primaryText={this._config.get('dialog:model:create:advanced:weekly')}
          style={this._styles.checkbox.label}
        />
      </div>
    )
  }
}
