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
 * Fluxible Action keys
 *
 * - Application
 *  - START_APPLICATION: {@StartApplication}
 *
 * - File
 *  - DELETE_FILE: {@link DeleteFile}
 *  - LIST_FILES: {@link ListFiles}
 *  - UPLOADED_FILE: {@link FileUpload}
 *  - UPDATE_FILE: {@link FileUpdate}
 *  - VALIDATE_FILE: {@link FileValidate}
 *
 * - File Errors
 *  - LIST_FILES_FAILURE
 *  - UPLOADED_FILE_FAILED
 *  - UPDATE_FILE_FAILED
 *  - DELETE_FILE_FAILED
 *  - VALIDATE_FILE_FAILED
 *
 * - Metric
 *  - LIST_METRICS: {@link ListMetrics}
 *  - LIST_METRICS_FAILURE
 *
 * - Metric Data
 *  - LOAD_METRIC_DATA: {@link LoadMetricData}
 *  - LOAD_METRIC_DATA_FAILED: {@link LoadMetricData}
 *  - UNLOAD_METRIC_DATA: {@link UnloadMetricData}
 *
 * - Model
 *  - ADD_MODEL: {@link AddModel}
 *  - LIST_MODELS: {@link ListModels}
 *  - DELETE_MODEL: {@link DeleteModel}
 *  - START_MODEL: {@link StartModel}
 *  - STOP_MODEL: {@link StopModel}
 *  - SHOW_MODEL: {@link ShowModel}
 *  - HIDE_MODEL: {@link HideModel}
 *  - EXPORT_MODEL_RESULTS: {@link ExportModelResults}
 *  - ADD_MODEL_FAILED
 *  - LIST_MODELS_FAILURE
 *  - DELETE_MODEL_FAILED
 *  - START_MODEL_FAILED
 *  - STOP_MODEL_FAILED
 *  - EXPORT_MODEL_RESULTS_FAILED: {@link ExportModelResults}
 *  - UNKNOWN_MODEL_FAILURE
 *
 * - Model Data
 *  - RECEIVE_MODEL_DATA: {@link ReceiveModelData}
 *
 * - Param Finder
 *   - START_PARAM_FINDER: {@link StartParamFinder}
 *   - STOP_PARAM_FINDER: {@link StopParamFinder}
 *   - START_PARAM_FINDER_FAILED {@link ParamFinderError}
 *   - STOP_PARAM_FINDER_FAILED {@link ParamFinderError}
 *   - UNKNOWN_PARAM_FINDER_FAILURE {@link ParamFinderError}
 *
 * - Param Finder Data
 *   - RECEIVE_PARAM_FINDER_DATA: {@link ReceiveParamFinderData}
 *
 * - UI File Detail Menu
 *  - SHOW_FILE_DETAILS: {@link ShowFileDetails}
 *  - HIDE_FILE_DETAILS: {@link HideFileDetails}
 *
 * - UI Create Model Dialog
 *  - SHOW_CREATE_MODEL_DIALOG: {@link ShowCreateModelDialog}
 *  - HIDE_CREATE_MODEL_DIALOG: {@link HideCreateModelDialog}
 *
 * - UI Chart update view position
 *  - CHART_UPDATE_VIEWPOINT: {@link ChartUpdateViewpoint}
 */
export const ACTIONS = Object.freeze({
  // Application
  START_APPLICATION: 'START_APPLICATION',

  // File
  DELETE_FILE: 'DELETE_FILE',
  LIST_FILES: 'LIST_FILES',
  UPLOADED_FILE: 'UPLOADED_FILE',
  UPDATE_FILE: 'UPDATE_FILE',
  VALIDATE_FILE: 'VALIDATE_FILE',
  DELETE_FILE_FAILED: 'DELETE_FILE_FAILED',
  LIST_FILES_FAILURE: 'LIST_FILES_FAILURE',
  UPLOADED_FILE_FAILED: 'UPLOADED_FILE_FAILED',
  UPDATE_FILE_FAILED: 'UPDATE_FILE_FAILED',
  VALIDATE_FILE_FAILED: 'VALIDATE_FILE_FAILED',

  // Metric
  LIST_METRICS: 'LIST_METRICS',
  LIST_METRICS_FAILURE: 'LIST_METRICS_FAILURE',

  // Metric Data
  LOAD_METRIC_DATA: 'LOAD_METRIC_DATA',
  LOAD_METRIC_DATA_FAILED: 'LOAD_METRIC_DATA_FAILED',
  UNLOAD_METRIC_DATA: 'UNLOAD_METRIC_DATA',

  // Model
  ADD_MODEL: 'ADD_MODEL',
  DELETE_MODEL: 'DELETE_MODEL',
  LIST_MODELS: 'LIST_MODELS',
  START_MODEL: 'START_MODEL',
  STOP_MODEL: 'STOP_MODEL',
  SHOW_MODEL: 'SHOW_MODEL',
  HIDE_MODEL: 'HIDE_MODEL',
  EXPORT_MODEL_RESULTS: 'EXPORT_MODEL_RESULTS',
  ADD_MODEL_FAILED: 'ADD_MODEL_FAILED',
  DELETE_MODEL_FAILED: 'DELETE_MODEL_FAILED',
  LIST_MODELS_FAILURE: 'LIST_MODELS_FAILURE',
  START_MODEL_FAILED: 'START_MODEL_FAILED',
  STOP_MODEL_FAILED: 'STOP_MODEL_FAILED',
  EXPORT_MODEL_RESULTS_FAILED: 'EXPORT_MODEL_RESULTS_FAILED',
  UNKNOWN_MODEL_FAILURE: 'UNKNOWN_MODEL_FAILURE',

  // Model Data
  RECEIVE_MODEL_DATA: 'RECEIVE_MODEL_DATA',
  LOAD_MODEL_DATA: 'LOAD_MODEL_DATA',
  LOAD_MODEL_DATA_FAILED: 'LOAD_MODEL_DATA_FAILED',

  // Param Finder
  START_PARAM_FINDER: 'START_PARAM_FINDER',
  STOP_PARAM_FINDER: 'STOP_PARAM_FINDER',
  START_PARAM_FINDER_FAILED: 'START_PARAM_FINDER_FAILED',
  STOP_PARAM_FINDER_FAILED: 'STOP_PARAM_FINDER_FAILED',
  UNKNOWN_PARAM_FINDER_FAILURE: 'UNKNOWN_PARAM_FINDER_FAILURE',

  // Param Finder Data
  RECEIVE_PARAM_FINDER_DATA: 'RECEIVE_PARAM_FINDER_DATA',

  // UI File Detail Menu
  SHOW_FILE_DETAILS: 'SHOW_FILE_DETAILS',
  HIDE_FILE_DETAILS: 'HIDE_FILE_DETAILS',

  // UI Create Model Dialog
  SHOW_CREATE_MODEL_DIALOG: 'SHOW_CREATE_MODEL_DIALOG',
  HIDE_CREATE_MODEL_DIALOG: 'HIDE_CREATE_MODEL_DIALOG',

  // UI Chart update view position
  CHART_UPDATE_VIEWPOINT: 'CHART_UPDATE_VIEWPOINT'
});


/**
 * Database Errors. Use to check database error names returned by callbacks.
 * 	- NOT_FOUND: Record not found
 * @type {string}
 */
export const DATABASE_ERRORS = Object.freeze({
  NOT_FOUND: 'NotFoundError'
});


/**
 * Source Data array index map: [0=Timestamp, 1=Value, 2=Anomaly].
 * @type {Number}
 */
export const DATA_FIELD_INDEX = Object.freeze({
  DATA_INDEX_TIME: 0,
  DATA_INDEX_VALUE: 1,
  DATA_INDEX_ANOMALY: 2
});

/**
 * Floor value for 'red' anomalies
 * @type {Number}
 */
// See NAB threshold:
// https://github.com/numenta/NAB/blob/master/config/thresholds.json#L27
export const ANOMALY_RED_VALUE = 0.5125976562500002;

/**
 * Floor value for 'yellow' anomalies
 * @type {Number}
 */
export const ANOMALY_YELLOW_VALUE = 0.4;
