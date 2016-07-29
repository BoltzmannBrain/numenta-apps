# HTM Studio by Numenta

> Cross-platform Desktop Application to demonstrate basic HTM functionality to
> users using their own data files.

**WARNING! UNDER HEAVY DEVELOPMENT.**


## License

Dual Commercial and AGPLv3 License. See [LICENSE.txt](LICENSE.txt)
and http://numenta.org/licenses/.


## Repository

The `app/` directory contains Cross-platform Desktop Application GUI code,
running Javascript/HTML/CSS/etc. on [Node.js](https://nodejs.org/),
[Electron](https://github.com/atom/electron), and
[Google Chromium](https://www.chromium.org/Home). It also contains non-GUI logic
to run and manage HTM Models on the model runner.

The `py/` directory contains ModelRunner and supporting code
(Python / C++), which drives the main functionality of the app, which it is our
goal to demo to the user.

### Filesystem Tree

`tree` output last updated `Thu Apr  7 08:15:13 PDT 2016`:

```shell
./                          # Git Repo Root
├── .babelrc                # ES7 ES6 => JS transpiler global settings
├── .eslintrc               # JS/ES lint settings
├── .pylintrc               # Python lint settings
├── DEPENDENCIES.md         # Module dependency overview file
├── LICENSE.txt             # Dual: Commercial and AGPLv3
├── README.md               # This file. A project overview.
├── app/                    # Frontend+GUI that exposes NuPIC HTM models to User
│   ├── browser/            # JS+HTML+CSS as GUI in electron's Renderer Process
│   │   ├── actions/        # FLUX Fluxible Actions JS
│   │   ├── entry.js        # Fluxible Web GUI App entry, compiles to bundle.js  
│   │   ├── assets/         # Browser/GUI images, icons, and other assets
│   │   │   ├── bundle/     # Auto-generated WebPack output bundle target dir
│   │   │   ├── images/     # GUI imagery
│   │   │   └── styles/     # CSS for GUI (global-like styles, overrides, etc).
│   │   ├── components/     # FLUX React view components JSX
│   │   ├── index.html      # App main startup browser window contents
│   │   ├── lib/            # Library code for the browser, extensions, plugins
│   │   └── stores/         # FLUX Fluxible Stores JS
│   ├── config/             # JS Config files, both auto-init with nconf, more.
│   ├── database/           # File-based database storage (levelup + leveldown)
│   │   └── schema/         # Database definition schemas in JSONSchema Draft-3
│   ├── main/               # JS for Electron's "Main Process", App init startup
│   │   ├── index.js        # ES6 Electron App main entry, init GUI, run models
│   │   └── loader.js       # Electron App entry loader for main.js ES5 => ES6
│   ├── node_modules/       # Where npm installs packages for distribution
│   ├── package.json        # npm dependencies and config for distribution
│   └── samples/            # Sample .CSV data files to pre-load for user in GUI
├── build/                  # Distribution assets, images, icons, etc.
├── coverage/               # JS Unit+Integration test coverage output (!git)
├── dist/                   # Installers and disk images for distribution
├── docs/                   # Output dir for generated JS docs (not in git)
├── esdoc.json              # ESDoc configuration file
├── node_modules/           # Where npm installs packages for development
├── package.json            # npm dependencies and config for development
├── py/                     # ModelRunner and support Python/C++ code
│   └── README.md           # Python Backend instructions
├── scripts/                # Building and cross-platform Portability scripts
├── tests/                  # All tests, javascript, python, unit, integration
│   ├── data/               # Data tests, bad formats, etc.
│   ├── js/                 # JS tests, config,  unit and integration
│   └── py/                 # Python tests, config, unit and integration
└── webpack.config.babel.js # JS build tooling config
```


## Technology


### Backend

#### Stack

> See: `py/requirements.txt`

* Languages:
  * [Python](http://python.org)
  * [C++](https://isocpp.org/)
* Machine Intelligence:
  * [NuPIC](htts://github.com/numenta/nupic)

#### Description

The Machine Intelligence behind this app is a technology known as Hierarchical
Temporal Memory (HTM). NuPIC is Numenta's open source HTM engine. NuPIC runs
on streams of data, predicting future values, and detecting pattern anomalies.


### Frontend

#### Stack

> See: `package.json`

* Languages:
  * [ECMAScript 6](https://babeljs.io/docs/learn-es2015/) (Modern Javascript)
    * via [Babel](https://babeljs.io/)
    * Also a few [ECMAScript 7](https://babeljs.io/docs/usage/experimental/)
      features.
    * Some [ECMAScript 5.1](https://es5.github.io/), the Web compile target.
  * [HTML5](https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/HTML5)
  * [CSS3](https://developer.mozilla.org/en-US/docs/Web/CSS)
  * [JSONSchema](https://github.com/tdegrunt/jsonschema), Database definition
    schemas in `JSONSchema Draft-3`.
* Framework: [Electron](https://github.com/atom/electron)
  * Engines: [Chromium](https://www.chromium.org/Home),
      [Node.js](https://github.com/joyent/node)
    * Package Manager: [npm](https://www.npmjs.com/)
    * Module Loading and Bundling: [WebPack](https://github.com/webpack/webpack)
    * Configuration: [nconf](https://github.com/indexzero/nconf)
    * Documentation: [JSDoc](http://usejsdoc.org/) style,
      [ESDoc](https://esdoc.org/) generator.
    * Logging w/structured JSON: [bunyan](https://github.com/trentm/node-bunyan)
    * Database on filesystem: [LevelUp](https://github.com/Level/levelup)
      interface to [LevelDB](https://github.com/google/leveldb), with
      [leveldown](https://github.com/Level/leveldown) backend
  * User Interface / Browser:
    * Architecture: [Fluxible](http://fluxible.io/)
      ([Flux](https://facebook.github.io/flux/docs/overview.html#content)
      Uni-directional data flow)
    * View Components: [React](https://github.com/facebook/react),
      [JSX](https://facebook.github.io/jsx/)
    * Graphing and Charting: [DyGraphs](http://dygraphs.com/)
      * @TODO Alternatives? [react-chartjs](https://github.com/jhudson8/react-chartjs)
        Canvas, [react-d3](https://github.com/esbullington/react-d3) SVG
* Testing: [Mocha](https://github.com/mochajs/mocha)
* Linting: [eslint](http://eslint.org/)

#### Description

The Frontend contains code to manage Models on the Backend. It also contains
the Graphical User Interface that allows users to explore HTM Models on their
own data.

The GUI for this application is web code. `Javascript`, `HTML`, and `CSS` are
loaded into a browser. For Desktop, this browser is a bare-bones Chrome window
opened by the Electron framework. Electron also runs Node.js to connect with the
host Operating System, allowing for cross-platform native controls.

In the browser, we run a one-way Uni-directional data flow, an Architecture
known as "Flux".

Below is an example of tracing of our way through GUI initialization, GUI first
loop run, and GUI loop continuation:

1. Electron loads `app/main.js`
1. .. which (or Browser directly) loads `app/browser/index.html`
1. .. which loads `app/browser/app.js`
1. .. which inits Fluxible
1. .. and then Fluxible fires off an initial Action
1. .. which dispatches Events with state data to Stores
1. .. which then integrate state data into themselves
1. .. and then View Components tied to updated Stores render
1. .. and then The User interacts with the app firing off a new Action
1. .. GOTO #6, RINSE and REPEAT.

#### Guidelines

* ECMAScript Styleguide: `npm run lint`, Rules: `.eslintrc`
* HTML5 and JSX @TODO
* CSS3 @TODO


## Setup

IMPORTANT: These setup instructions are only about if you care about running
the full app with all its components (Electron app with packaged model
runner). If you care about the python only - for example - then change to
`unicorn/py` and follow the README instructions there.

Example of setting up development environment on Mac OS/X:

```shell
brew install git node chromedriver
git clone https://github.com/numenta/numenta-apps
cd numenta-apps/unicorn
python py/setup.py install
npm install
```


## Develop

### Lightweight

To install without the lengthy python bundle, assuming the desired python bundle
is already installed:

```shell
npm install --no-optional
```

### Backend

#### Install
Execute the following command after making changes to `unicorn_backend` code:
```shell
npm run install:backend
```
IMPORTANT: run this if you updated the python code in `py/unicorn_backend` and you
want these changes to take effect in the portable python distribution run
by the electron app.

### Run

```shell
npm run dev

# see pretty logs
npm run dev | `npm bin`/bunyan

# same thing, but explicit
NODE_ENV=development npm run dev
```

### Docs

Frontend code documentation can be generated and viewed by following the
directions below. Comments are in [JSDoc](http://usejsdoc.org/) format, with
output generated by [ESDoc](https://esdoc.org/).

```shell
npm run docs  # generate and open documentation
```

### Packaging and distribution

We use [electron-builder](https://www.npmjs.com/package/electron-builder) to build and package the application for distribution. The authors of `electron-builder` strongly recommend to use two `package.json` files.

#### Two `package.json` structure:

1. For development
In the root of the project. Here you declare dependencies for your development environment, tests and build scripts.

2. For your application
In the app directory. Only this directory is distributed with real application.

### `npm` Scripts

Here are the `npm` scripts available via `npm run <script-name>`. Please see
`package.json` for more info.

* `build:osx`: Run all steps required to build the application (OSX)
* `build:win`: Run all steps required to build the application (Windows)
* `clean`: Clean all build an runtime artifacts
  * `clean:backend`: Delete `python` backend packages
  * `clean:dist`: Delete all build artifacts
  * `clean:osx`: Delete build artifacts (OSX)
  * `clean:win`: Delete build artifacts (Windows)
  * `clean:db:osx`: Delete database files (OSX)
  * `clean:docs`: Delete documentation
  * `clean:npm`: Delete `npm` installed packages
  * `clean:portable_python:osx`: Delete cached `portable_python` package (OSX)
  * `clean:portable_python:win`: Delete cached `portable_python` package (Windows)
  * `clean:python`: Delete `python` build artifacts
  * `clean:webpack`: Clean compiled/packaged JS code
* `dev`: Launch Desktop application
* `dev:debug`: Launch in debug mode. See
  [Electron Documentation]( https://github.com/atom/electron/blob/master/docs/tutorial/debugging-main-process.md)
  for instructions on how to use the debugger
* `dev:inspect`: Launch `node-inspector` used to debug Electron application.
  See [Electron Documentation]( https://github.com/atom/electron/blob/master/docs/tutorial/debugging-main-process.md)
  for detailed instructions on how to use the debugger
* `docs`: Build documentation (esdoc)
* `dist:osx`: Build Mac OSX distribution artifacts
* `dist:win`: Build Windows distribution artifacts
* `electron`: Launch Electron
* `electron:debug`: Launch Electron in debug mode. See
  [Electron Documentation]( https://github.com/atom/electron/blob/master/docs/tutorial/debugging-main-process.md)
  for instructions on how to use the debugger
* `electron:packager`: Build installable packages
* `esfmt`: Format JS code (esformatter)
* `lint`: Lint JS code (eslint)
* `pack:osx`: Package the electron app as a Mac OSX Application
* `pack:win`: Package the electron app as a Windows Application
* `prepare`: Prepare code for packaging
* `test`: Run all JS tests using developer options. See
  [mocha.opts](tests/js/mocha.opts)
  * `test:integration`: Run all JS integration tests
  * `test:unit`: Run all JS unit tests
  * `test:functional`: Run all JS functional tests
* `test:pipeline`: Run all JS tests using pipeline options. See
  [mocha.opts](tests/js/mocha.pipeline.opts)
  * `test:pipeline:integration`:  Run all JS integration tests
  * `test:pipeline:unit`: Run all JS unit tests
* `test:coverage`: Run test coverage on all JS unit+integration tests, and
  open reports when done in browser.

### Problems?

* Maybe the DB stored bad data? `npm run clean:db:osx`.
* Sometimes `node_modules/` directory can become corrupted, try cleaning and
  reinstalling (*slow*): `npm run clean ; npm install`.
* Local Git repo can get stuck with out-of-date JS somehow, so back up your
  current repo, and try again on a fresh repo clone.

### Development Notes

* Do not upgrade the following node/npm packages without syncing with the
  rest of the team first. The Mac build box is dependent on these versions,
  and must be upgraded in parallel:
  * `node`, `npm`, `electron-packager`, `electron-prebuilt`
* Make sure to update packages often, especially after pulling an update into
  your branch:
  * `npm oudated -depth 0`
  * `pip list --outdated`
* Lint your code before creating pull requests: `npm run lint`
* Manual access to LevelDB file database from
  [Lev](https://github.com/hij1nx/lev) command-line tool (Mac OS/X):
  * `` `npm bin`/lev $HOME/Library/Application\ Support/unicorn/database/ ``
* Remember, this is cross-platform. We need to support all main operating
  systems. Windows has no environment variables, etc. Paths should not be
  defined manually, but use the `path` library helper instead.


## Test

### Unit and Integration Tests

Write **Unit** and **Integration** tests using
[mocha](https://github.com/mochajs/mocha) test framework.

Write **Functional** or **e2e** tests using
[selenium](http://docs.seleniumhq.org/) and [webdriverio](http://webdriver.io/)
test automation frameworks.

```shell
npm run test              # all
npm run test:unit         # unit tests only
npm run test:integration  # integration tests only
npm run test:functional   # functional tests only
```
To run the (python) backend integration tests with the portable python distribution run:
```shell
npm run test:integration:backend
```
> Optional: you might want to run a `npm run clean && npm install` before running the test to make
> you have an up-to-date portable python distribution.

This will make sure (among other things) that the model_runner and param_finder
are giving results that are compatible with the NAB ones. That is to say:
* Make sure that the new system (param_finder + model_runner) detects the same set of anomalies as NAB.
* It is ok for the new system to detect anomalies earlier than the NAB results.
* It is not OK for the new system to have significantly more false positives than the NAB detections.

### Pipeline Tests

To generate reults appropriate for the **pipeline** `mocha` needs to run
with a different set of options
(see [mocha.pipeline.opts](tests/js/mocha.pipeline.opts)).

```shell
npm run test:pipeline               # pipeline all
npm run test:pipeline:unit          # pipeline unit tests only
npm run test:pipeline:integration   # pipeline integration tests only
```

### Test Coverage

Use the following to generate JS Unit and Integration test code coverage
results, build the reports, and open them in browser for display. Output
data is in the untracked `./coverage/` directory.

```shell
npm run test:coverage     # run code coverage on js unit+int tests
```

### Common Test Problems

#### Python Path

**Problem:**
```shell
Uncaught AssertionError: Fatal Python error: PyThreadState_Get: no current thread
```

**Solution:**
```shell
unset PYTHONPATH
```


## Build

### Mac OS/X

Build the electron app with:

```shell
npm run build:osx

# same thing, but explicit
NODE_ENV=production npm run build:osx
```

The resulting artifacts can be found in `dist/`

### Windows

```shell
npm run build:win

# same thing, but explicit
NODE_ENV=production npm run build:win
```

The resulting artifacts can be found in `dist/`


## Release

### Signing

* You need a certificate type of “Developer ID Application” from Apple. This
  certificate usually has a common name in the form of
  `Developer ID Application: YourCompany, Inc. (ABCDEFGHIJK)`.
* Set the environment variable `CSC_NAME` and sign the app:
  `export CSC_NAME="Developer ID Application: Numenta, Inc. (ABCDEFGHIJK)"`
* Now when you package with `npm run build:osx`, the app will
  be signed.
* See [electron-builder#code-signing](https://github.com/electron-userland/electron-builder#code-signing) for more info.

### Google Analytics

* Set the environment variable `GA_TRACKING_ID` with Google Analytics tracking ID. See https://analytics.google.com/analytics for correct ID. It should be something like this:

```shell
export GA_TRACKING_ID="UA-XXXXXXXX-X"
```

### App Store

* Currently, the instructions to release an Electron app on the app store can
  be found here:
  http://www.saschawise.com/blog/2015/08/12/electron-for-the-mac-app-store.html


## Debug

```shell
npm run dev:debug  # open http://localhost:5858 in browser
```

### Backend

* @TODO Python, NuPIC, Models, debugging etc.

### Node.js system-level

* [Electron with node-inspector](https://github.com/atom/electron/blob/master/docs/tutorial/debugging-main-process.md)
* [Node debugger](https://nodejs.org/api/debugger.html)
* Low level [Bunyan and DTrace](https://github.com/trentm/node-bunyan#runtime-log-snooping-via-dtrace)

### Command-line

* [Electron debugging switches](https://github.com/atom/electron/blob/master/docs/tutorial/debugging-main-process.md)
* [Chrome switches supported in Electron](http://electron.atom.io/docs/v0.31.0/api/chrome-command-line-switches/)
* Manual access to LevelDB file database from
  [Lev](https://github.com/hij1nx/lev) command-line tool (Mac OS/X):
  * `` `npm bin`/lev $HOME/Library/Application\ Support/unicorn/database/ ``

### Frontend + Browser

***Warning***: [React Chrome DevTools](http://electron.atom.io/docs/v0.31.0/tutorial/devtools-extension/)
does [not yet work with Electron](https://github.com/atom/electron/issues/915).

* [Electron + Chrome debug shortcuts](https://github.com/sindresorhus/electron-debug)
* [Chrome DevTools plugin](http://electron.atom.io/docs/v0.31.0/tutorial/devtools-extension/)

### Other

* [Electron and Windows Debug Symbol Server](http://electron.atom.io/docs/v0.31.0/development/setting-up-symbol-server/)

# Release management

## How to create a release?

* Create a branch called "htm-studio-vX" where X is the version number
* Update `app/package.json` with new version number
* The convention for version numbers is [semantic versioning](http://semver.org/)
* For example, we have a branch called [`htm-studio-v0.0.1`](https://github.com/numenta/numenta-apps/tree/htm-studio-v0.0.1)

## Automatic Updates

HTM Studio uses Electron built-in support for automatic updates based on [Squirrel.Mac](https://github.com/Squirrel/Squirrel.Mac) and [Squirrel.Windows](https://github.com/Squirrel/Squirrel.Windows). For more information see http://electron.atom.io/docs/api/auto-updater/

### Mac OSX (darwin)

1. Create update package using `npm run build:osx`
1. Upload update package `dist/HTM Studio-darwin-x64/HTM Studio-version-mac.zip` to update site.
  > The update site URL is composed of the update URL specified in `app/config/default.json` under `update:url` key and the platform name. For example, if the update URL points to http://public.numenta.com/updates/htmstudio then the darwin version should be uploaded to http://public.numenta.com/updates/htmstudio/darwin.

1. Upload manifest to update site. The update manifest should be named after the old version describing the new version. For example, if updating from version `0.0.1` to version `0.0.2` then the update manifest should be named `update.0.0.1.json` and point to `HTM Studio-0.0.2-mac.zip`. For more information on the `update.version.json` format see https://github.com/Squirrel/Squirrel.Mac#update-json-format.

  Sample manifest file:
  * *update.0.0.2.json*
  ```javascript
  {
    "url": "http://public.numenta.com/updates/htmstudio/darwin/HTM%20Studio-0.0.3-mac.zip",
    "name": "0.0.3",
    "notes": "* Automatic Updates \n* Improved Charts \n* Fix timezone when exporting results",
    "pub_date": "2016-02-02T21:51:58Z"
  }
  ```
  These variables can be used to format the update [dialog](https://github.com/electron/electron/blob/master/docs/api/dialog.md#dialogshowmessageboxbrowserwindow-options-callback) shown to the user once a new update is available. See  `app/config/default.json` under `update:message` and `update:detail`.

    Here is a sample message formatting:
    ```javascript
    "update": {
        "message": "A new version of HTM Studio (%name) is available",
        "detail": "What's new in version %name:\n%notes",
        ...
    }
    ```
