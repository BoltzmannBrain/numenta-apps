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

/**
 * Mock Google Analytics Tracker
 */
export default class MockGATracker {
  constructor() {
    this.category = null;
    this.action = null;
    this.label = null;
    this.value = null;

    this.description = null;
    this.fatal = false;

    this.name = null;
    this.title = null;
  }
  event(category, action, label, value) {
    this.category = category || null;
    this.action = action || null;
    this.label = label || null;
    this.value = value || null;
  }
  exception(description, fatal) {
    this.description = description || null;
    this.fatal = fatal || false;
  }
  pageView(name, title) {
    this.name = name || null;
    this.title = title || null;
  }
}
