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
 * - Application
 *  - START_APPLICATION: {@StartApplication}
 * - File
 *  - DELETE_FILE: {@link DeleteFile}
 *  - LIST_FILES: {@link ListFiles}
 *  - UPLOADED_FILE: {@link FileUpload}
 *  - UPDATE_FILE: {@link FileUpdate}
 *
 * - File Errors
 *  - LIST_FILES_FAILURE
 *  - UPLOADED_FILE_FAILED
 *  - UPDATE_FILE_FAILED
 *  - DELETE_FILE_FAILED
 *
 * - Model
 *  - ADD_MODEL: {@link AddModel}
 *  - DELETE_MODEL: {@link DeleteModel}
 *  - START_MODEL: {@link StartModel}
 *  - STOP_MODEL: {@link StopModel}
 *  - SHOW_MODEL: {@link ShowModel}
 *  - HIDE_MODEL: {@link HideModel}
 *  - EXPORT_MODEL_RESULTS: {@link ExportModelResults}
 *  - EXPORT_MODEL_RESULTS_FAILED: {@link ExportModelResults}
 *
 * - Model Data
 *  - RECEIVE_MODEL_DATA: {@link ReceiveModelData}
 *
 * - Model Errors
 *  - START_MODEL_FAILED
 *  - STOP_MODEL_FAILED
 *  - DELETE_MODEL_FAILED
 *  - UNKNOWN_MODEL_FAILURE
 *
 * - Param Finder
 *   - START_PARAM_FINDER: {@link StartParamFinder}
 *   - STOP_PARAM_FINDER: {@link StopParamFinder}
 *
 * - Param Finder Data
 *   - RECEIVE_PARAM_FINDER_DATA: {@link ReceiveParamFinderData}
 *
 * - Param Finder Errors
 *   - START_PARAM_FINDER_FAILED {@link ParamFinderError}
 *   - STOP_PARAM_FINDER_FAILED {@link ParamFinderError}
 *   - UNKNOWN_PARAM_FINDER_FAILURE {@link ParamFinderError}
 *
 * - File Detail
 *  - SHOW_FILE_DETAILS: {@link ShowFileDetails}
 *  - HIDE_FILE_DETAILS: {@link HideFileDetails}
 *
 * - Create Model Dialog
 *  - SHOW_CREATE_MODEL_DIALOG: {@link ShowCreateModelDialog}
 *  - HIDE_CREATE_MODEL_DIALOG: {@link HideCreateModelDialog}
 *
 * - Metric
 *  - LIST_METRICS: {@link ListMetrics}
 *  - LIST_METRICS_FAILURE
 *
 * - Metric Data
 *  - LOAD_METRIC_DATA: {@link LoadMetricData}
 *  - LOAD_METRIC_DATA_FAILED: {@link LoadMetricData}
 *  - UNLOAD_METRIC_DATA: {@link UnloadMetricData}
 */
export const ACTIONS = Object.freeze({
  // Application
  START_APPLICATION: 'START_APPLICATION',

  // File
  DELETE_FILE: 'DELETE_FILE',
  LIST_FILES: 'LIST_FILES',
  UPLOADED_FILE: 'UPLOADED_FILE',
  UPDATE_FILE: 'UPDATE_FILE',

  LIST_FILES_FAILURE: 'LIST_FILES_FAILURE',
  UPLOADED_FILE_FAILED: 'UPLOADED_FILE_FAILED',
  UPDATE_FILE_FAILED: 'UPDATE_FILE_FAILED',
  DELETE_FILE_FAILED: 'DELETE_FILE_FAILED',

  // Model
  ADD_MODEL: 'ADD_MODEL',
  DELETE_MODEL: 'DELETE_MODEL',
  START_MODEL: 'START_MODEL',
  STOP_MODEL: 'STOP_MODEL',
  SHOW_MODEL: 'SHOW_MODEL',
  HIDE_MODEL: 'HIDE_MODEL',
  EXPORT_MODEL_RESULTS: 'EXPORT_MODEL_RESULTS',

  // Model Data
  RECEIVE_MODEL_DATA: 'RECEIVE_MODEL_DATA',
  LOAD_MODEL_DATA: 'LOAD_MODEL_DATA',
  LOAD_MODEL_DATA_FAILED: 'LOAD_MODEL_DATA_FAILED',

  // Model Errors
  START_MODEL_FAILED: 'START_MODEL_FAILED',
  STOP_MODEL_FAILED: 'STOP_MODEL_FAILED',
  DELETE_MODEL_FAILED: 'DELETE_MODEL_FAILED',
  UNKNOWN_MODEL_FAILURE: 'UNKNOWN_MODEL_FAILURE',
  EXPORT_MODEL_RESULTS_FAILED: 'EXPORT_MODEL_RESULTS_FAILED',

  // Param Finder
  START_PARAM_FINDER: 'START_PARAM_FINDER',
  STOP_PARAM_FINDER: 'STOP_PARAM_FINDER',

  // Param Finder Data
  RECEIVE_PARAM_FINDER_DATA: 'RECEIVE_PARAM_FINDER_DATA',

  // Param Finder Errors
  START_PARAM_FINDER_FAILED: 'START_PARAM_FINDER_FAILED',
  STOP_PARAM_FINDER_FAILED: 'STOP_PARAM_FINDER_FAILED',
  UNKNOWN_PARAM_FINDER_FAILURE: 'UNKNOWN_PARAM_FINDER_FAILURE',

  // Create Model Dialog
  SHOW_CREATE_MODEL_DIALOG: 'SHOW_CREATE_MODEL_DIALOG',
  HIDE_CREATE_MODEL_DIALOG: 'HIDE_CREATE_MODEL_DIALOG',

  // File Detail
  SHOW_FILE_DETAILS: 'SHOW_FILE_DETAILS',
  HIDE_FILE_DETAILS: 'HIDE_FILE_DETAILS',

  // Metric
  LIST_METRICS: 'LIST_METRICS',
  LIST_METRICS_FAILURE: 'LIST_METRICS_FAILURE',

  // Metric Data
  LOAD_METRIC_DATA: 'LOAD_METRIC_DATA',
  LOAD_METRIC_DATA_FAILED: 'LOAD_METRIC_DATA_FAILED',
  UNLOAD_METRIC_DATA: 'UNLOAD_METRIC_DATA'
});

/**
 * Database Errors. Use to check database error names returned by callbacks.
 * 	- NOT_FOUND: Record not found
 *
 * @type {string}
 */
export const DATABASE_ERRORS = {
  NOT_FOUND: 'NotFoundError'
};
