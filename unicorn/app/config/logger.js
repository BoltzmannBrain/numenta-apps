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

import bunyan from 'bunyan';


/**
 * Logger settings
 */
export default {
  name: 'HTMStudio:Renderer',
  streams: [{ // @TODO hardcoded to Dev right now, needs Prod mode. Refactor.
    level: 'debug',  // @TODO higher for Production
    stream: {
      write(rec) {
        let name = bunyan.nameFromLevel[rec.level];
        let method = (name === 'debug') ? 'log' : name;
        console[method]('[%s]: %s', name, rec.msg); // eslint-disable-line
      }
    },
    type: 'raw'
  }]
};
