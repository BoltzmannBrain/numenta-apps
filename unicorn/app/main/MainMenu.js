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
 * Main top system menu (File/Open.., etc) for application
 */

const electron = require('electron');
const name = electron.app.getName();
const VERSION = electron.app.getVersion();

/* eslint-disable no-process-env */
const DEBUG = process.env.NODE_ENV === 'development';
/* eslint-enable no-process-env */

let crossPlatformMenu = [
  {
    label: name,
    submenu: [
      {
        label: `About ${name}`,
        click() {
          const BrowserWindow = electron.BrowserWindow;
          let win = new BrowserWindow({width: 350, height: 300, title: ''});
          win.loadURL(`file://${__dirname}/../browser/about.html`);
        }
      }
    ]
  },
  {
    label: 'Edit',
    submenu: [
      {
        label: 'Undo',
        accelerator: 'CmdOrCtrl+Z',
        role: 'undo'
      },
      {
        label: 'Redo',
        accelerator: 'Shift+CmdOrCtrl+Z',
        role: 'redo'
      },
      {
        type: 'separator'
      },
      {
        label: 'Cut',
        accelerator: 'CmdOrCtrl+X',
        role: 'cut'
      },
      {
        label: 'Copy',
        accelerator: 'CmdOrCtrl+C',
        role: 'copy'
      },
      {
        label: 'Paste',
        accelerator: 'CmdOrCtrl+V',
        role: 'paste'
      },
      {
        label: 'Select All',
        accelerator: 'CmdOrCtrl+A',
        role: 'selectall'
      }
    ]
  },
  {
    label: 'View',
    submenu: [
      {
        label: 'Toggle Full Screen',
        accelerator: process.platform === 'darwin' ? 'Ctrl+Command+F' : 'F11',
        click(item, focusedWindow) {
          if (focusedWindow)
            focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
        }
      }
    ]
  },
  {
    label: 'Window',
    role: 'window',
    submenu: [
      {
        label: 'Minimize',
        accelerator: 'CmdOrCtrl+M',
        role: 'minimize'
      },
      {
        label: 'Close',
        accelerator: 'CmdOrCtrl+W',
        role: 'close'
      }
    ]
  },
  {
    label: 'Help',
    role: 'help',
    submenu: [
      {
        label: 'Learn More',
        click() {
          let url = 'http://numenta.com/htm-studio';
          electron.shell.openExternal(url);
        }
      },
      {
        label: 'Frequently Asked Questions',
        click() {
          let url = 'http://numenta.com/htm-studio#faq';
          electron.shell.openExternal(url);
        }
      },
      {
        label: 'Provide Feedback',
        click() {
          let url = 'http://numenta.com/htm-studio#feedback';
          electron.shell.openExternal(url);
        }
      },
      {
        label: 'Report Bug',
        click() {
          let url = `mailto:htm-studio@numenta.com?subject=HTM Studio ${VERSION} bug&body=DO NOT REMOVE THIS INFORMATION: HTM Studio version ${VERSION}. Please describe the steps to reproduce the bug below. `; // eslint-disable-line
          electron.shell.openExternal(url);
        }
      }
    ]
  }
];


// Add developer tools to window menu in development mode
if (DEBUG) {
  let windowMenu = crossPlatformMenu.find((item) => item.role === 'window');
  windowMenu.submenu.push({
    label: 'Toggle Developer Tools',
    accelerator: process.platform === 'darwin' ? 'Alt+Command+I'
      : 'Ctrl+Shift+I',
    click(item, focusedWindow) {
      if (focusedWindow)
        focusedWindow.toggleDevTools();
    }
  });
}

// Add additional menu options for OSX
if (process.platform === 'darwin') {
  let aboutMenu = crossPlatformMenu.find((item) => item.label === name);

  aboutMenu.submenu.push(
    {
      type: 'separator'
    },
    {
      label: 'Services',
      role: 'services',
      submenu: []
    },
    {
      type: 'separator'
    },
    {
      label: `Hide ${name}`,
      accelerator: 'Command+H',
      role: 'hide'
    },
    {
      label: 'Hide Others',
      accelerator: 'Command+Alt+H',
      role: 'hideothers'
    },
    {
      label: 'Show All',
      role: 'unhide'
    },
    {
      type: 'separator'
    },
    {
      label: 'Quit',
      accelerator: 'Command+Q',
      click() {
        electron.app.quit();
      }
    }
  );
}

export default crossPlatformMenu;
