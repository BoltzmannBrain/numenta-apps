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

let uuid = require('node-uuid');

// Googe analytics API version
const API_VERSION = 1;

// Googe analytics endpoint
const API_ENDPOINT = 'https://www.google-analytics.com';

// Googe analytics debug endpoint
const API_DEBUG_ENDPOINT = 'https://www.google-analytics.com/debug';

// Google Analytics accepts only 20 hits per batch request.
const GA_BATCH_SIZE = 20;

// Memory cache size
const MAX_QUEUE_SIZE = 20;


/**
 * Get or create unique identifier representing the current user
 * @return {string} UUID representing the Anonymous Client ID
 */
function _getUserId() {
  // Get persisted User ID from local storage
  let user = localStorage.getItem('ga:userId');
  if (!user) {
    user = uuid.v4();
    localStorage.setItem('ga:userId', user);
  }
  return user;
}


/**
 * Wraps Google analytics API
 * See https://developers.google.com/analytics/devguides/collection/protocol/v1/devguide
 */
export default class GoogleAnalytics {
  /**
   * Construct new Google Analytics API wrapper
   * @param  {string} trackingId GoogleAnalytics tracing ID (i.e. UA-XXXXX)
   * @param  {string} appName    Application Name (i.e. "HTM Studio")
   * @param  {string} version    Application Verion (i.e. "1.0.0")
   * @param  {boolean} [debug=false] Whether or not to use debug endpoint
   */
  constructor(trackingId, appName, version, debug) {
    // Validate tracking Id
    if (!trackingId) {
      if (debug) {
        // Use fake tracking id in development
        trackingId = 'UA-DEBUG';
      } else {
        throw new Error('Invalid Google Analytics Tracking ID');
      }
    }

    // Required parameters sent with every hit
    this._header = `v=${API_VERSION}&tid=${trackingId}&cid=${_getUserId()}` +
                   `&an=${appName}&av=${version}`;
    // Memory queue
    this._queue = [];

    // Google Analytics endpoint used to send a single hit
    this._endpointCollect = debug ? `${API_DEBUG_ENDPOINT}/collect`
                                  : `${API_ENDPOINT}/collect`;
    // Google Analytics endpoint used for sending hits in batch
    this._endpointBatch = debug ? `${API_DEBUG_ENDPOINT}/collect`
                                : `${API_ENDPOINT}/batch`;

    // Initialize database
    this._db = null;
    new Promise((resolve, reject) => {
      let request = indexedDB.open('analytics');
      request.onsuccess = (event) => {
        let db = event.target.result;
        resolve(db);
      }
      request.onupgradeneeded = (event) => {
        let db = event.target.result;
        db.createObjectStore('pending', {autoIncrement: true});
      }
      request.onerror = (event) => {
        reject(event);
      }
    })
    .then((db) => {
      this._db = db;
      // synchronize any pending hits
      this.synchronize();
    });
  }

  /**
   * Track page view
   * @param {string} name    Page Name
   * @param {string} [title] Page title
   */
  pageView(name, title) {
    this._push(`${this._header}&t=pageView` +
      `&dp=${name}&dt=${title || ''}`);
  }

  /**
   * Track events
   * @param  {string} category Event Category
   * @param  {string} action   Event Action
   * @param  {string} [label='']  Event label
   * @param  {string} [value=0]  Specifies the event value. Values must be non-negative
   */
  event(category, action, label, value) {
    this._push(`${this._header}&t=event` +
      `&ec=${category}&ea=${action}&el=${label || ''}&ev=${value || 0}`);
  }

  /**
   * Track exceptions
   * @param  {string} description     Exception description (i.e. IOException)
   * @param  {boolean} [fatal=false]  Exception is fatal?
   */
  exception(description, fatal) {
    console.error(description); // eslint-disable-line
    this._push(`${this._header}&t=exception` +
      `&exd=${description}&exf=${fatal ? 1 : 0}`);
  }

  /**
   * Upload pending hits to server
   * @return {Promise}  Returns promise that could be used to check for errors
   */
  _upload() {
    // Get all pending hits from database
    return this._getAllPening()
      .then((records) => {
        while (records.length > 0) {
          // Batch at most GA_BATCH_SIZE hits per request
          let batch = records.splice(0, GA_BATCH_SIZE);
          let values = batch.map((item) => item.value);
          let keys = batch.map((item) => item.key);
          // Post cached hits and delete successfuly uploaded hits from database
          this._post(values).then(() => this._deletePending(keys));
        }
      });
  }

  /**
   * Synchronize local data with server.
   * Keep pending hits in local database until they are successfuly uploaded
   * @return {Promise}  Returns promise that could be used to check for errors
   */
  synchronize() {
    // Empty memory queue
    let hits = this._queue.splice(0);
    // Persist hits before uploading to server in case of network error
    return this._savePending(hits).then(() => this._upload());
  }

  /**
   * Push new event to queue synchronizing with GA server when necessary
   * @param  {string} payload Single Google Analytics payload
   */
  _push(payload) {
    this._queue.push(encodeURI(payload));
    if (this._queue.length >= MAX_QUEUE_SIZE) {
      this.synchronize();
    }
  }

  /**
   * Save pending hits to database
   * @param  {array} hits Array of hits to save
   * @return {Promise} Promise wrapping database transaction.
   *                           `resolve` : transaction completed successfuly
   *                           `reject`: transaction failed
   */
  _savePending(hits) {
    return new Promise((resolve, reject) => {
      if (hits.length === 0) {
        resolve(); // Nothing to add
      } else if (this._db) {
        // Add all hits in a single transaction
        let transaction = this._db.transaction(['pending'], 'readwrite');
        transaction.oncomplete = resolve;
        transaction.onerror = reject;
        let store = transaction.objectStore('pending');
        hits.forEach((item) => store.add(item));
      } else {
        reject(new Error('Unable to open database'));
      }
    });
  }

  /**
   * Get all pending hits stored in the database
   * @return {Promise} Promise wrapping database transaction.
   *                           `resolve` : With all pending hits on success
   *                           `reject`: transaction failed
   */
  _getAllPening() {
    return new Promise((resolve, reject) => {
      if (this._db) {
        // Get all hits from database
        let hits = [];
        let transaction = this._db.transaction(['pending'], 'readonly');
        transaction.onerror = (error) => {
          reject(error);
        };
        let store = transaction.objectStore('pending');
        let request = store.openCursor();
        request.onsuccess = (event) => {
          let cursor = event.target.result;
          if (cursor) {
            hits.push({key: cursor.key, value: cursor.value});
            cursor.continue();
          } else {
            resolve(hits);
          }
        };
        request.onerror = (error) => {
          reject(error);
        };
      } else {
        reject(new Error('Unable to open database'));
      }
    });
  }

  /**
   * _deletePending pending hits from database
   * @param  {array} hits Array of hits to delete
   * @return {Promise} Promise wrapping database transaction.
   *                           `resolve` : transaction completed successfuly
   *                           `reject`: transaction failed
   */
  _deletePending(hits) {
    return new Promise((resolve, reject) => {
      if (hits.length === 0) {
        resolve(); // Nothing to delete
      } else if (this._db) {
        // Delete all hits in a single transaction
        let transaction = this._db.transaction(['pending'], 'readwrite');
        transaction.oncomplete = resolve;
        transaction.onerror = reject;
        let store = transaction.objectStore('pending');
        hits.forEach((item) => store.delete(item));
      } else {
        reject(new Error('Unable to open database'));
      }
    });
  }

  /**
   * Post paylod to Google analytics server
   * @param {array} payload Array of 'hits' to send
   * @return {Promise}  Returns promise that could be used to check for errors
   * @see https://developers.google.com/analytics/devguides/collection/protocol/v1/devguide
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
   */
  _post(payload) {
    if (payload.length > 0) {
      let url;
      // Check if sending batched hits
      if (payload.length === 1) {
        url = this._endpointCollect;
      } else {
        url = this._endpointBatch;
      }
      return fetch(url, {
        method: 'POST',
        body: payload.join('\n'),
        mode: 'no-cors'
      });
    }
    // Nothing to send
    return Promise.resolve();
  }
}
