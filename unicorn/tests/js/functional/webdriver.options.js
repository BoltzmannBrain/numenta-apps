const electron = require('electron-prebuilt');

export default {
  host: 'localhost', // Use localhost as chrome driver server
  port: 9515,        // "9515" is the port opened by chrome driver.
  desiredCapabilities: {
    browserName: 'chrome',
    chromeOptions: {
      binary: electron,
      args: ['app=.']
    }
  }
};
