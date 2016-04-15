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

const assert = require('assert');
const config = require('../../../app/config/default.json');
const options = require('./webdriver.options');
const webdriverio = require('webdriverio');

let client  = webdriverio.remote(options);


describe('Start Application', () => {
  before((done) => {
    client.init().then(() => done());
  })

  it('should start the application', (done) => {
    client.getTitle()
      .then((title) => {
        assert.equal(title, 'HTM Studio | Numenta');
      })
      .call(done);
  });
  it('should have Logo', (done) => {
    client.getText('//main/div/header')
      .then((text) => {
        assert.equal(text, config.title);
      })
      .call(done);
  });
  it('should have "ADD FILE" button', (done) => {
    client.getText('//main/div/div/button')
      .then((text) => {
        assert.equal(text, config.button.add.toUpperCase());
      })
      .call(done);
  });
  it('should have "Your data" section', (done) => {
    client.getText('//main/div/nav/div[1]/div[1]')
      .then((text) => {
        assert.equal(text, config.heading.data.user);
      })
      .call(done);
  });
  it('should not have "Your data" files', (done) => {
    client.getText('//main/div/nav/div[1]/div/span')
      .then((text) => {
        assert.equal(text, config.heading.data.empty);
      })
      .call(done);
  });
  it('should have "Sample Data" section', (done) => {
    client.getText('//main/div/nav/div[2]/div[1]')
      .then((text) => {
        assert.equal(text, config.heading.data.sample);
      })
      .call(done);
  });
  it('should have 1 sample file', (done) => {
    client.elements('//main/div/nav/div[2]/div/span')
      .then((response) => {
        assert.equal(response.value.length, 1);
      })
      .call(done);
  });

  after((done) => {
    client.end().then(() => done());
  });
});
