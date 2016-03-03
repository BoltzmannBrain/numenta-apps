# Numenta Unicorn

> Cross-platform Desktop Application to demonstrate basic HTM functionality to
> users using their own data files.

**WARNING! UNDER HEAVY DEVELOPMENT.**


## License

Dual Commercial and AGPLv3 License. See [LICENSE.txt](LICENSE.txt)
and http://numenta.org/licenses/.


## Repository

The `js/` directory contains Cross-platform Desktop Application GUI code,
running Javascript/HTML/CSS/etc. on [Node.js](https://nodejs.org/),
[Electron](https://github.com/atom/electron), and
[Google Chromium](https://www.chromium.org/Home). It also contains non-GUI logic
to run and manage HTM Models on the Unicorn model runner.

The `py/` directory contains Unicorn ModelRunner and supporting code
(Python / C++), which drives the main functionality of the app, which it is our
goal to demo to the user.

### Filesystem Tree

`tree` output last updated `Sun Feb 28 13:47:32 PST 2016`:

```shell
./                          # Git Repo Root
├── .babelrc                # ES7 ES6 => JS transpiler global settings
├── .eslintrc               # JS/ES lint settings
├── .pylintrc               # Python lint settings
├── DEPENDENCIES.md         # Module dependency overview file
├── LICENSE.txt             # Dual: Commercial and AGPLv3
├── README.md               # This file. A project overview.
├── js/                     # Frontend+GUI that exposes NuPIC HTM models to User
│   ├── assets/             # System/native-level assets, images, icons, etc.
│   ├── browser/            # JS+HTML+CSS as GUI in electron's Renderer Process
│   │   ├── actions/        # FLUX Fluxible Actions JS
│   │   ├── app.js          # Fluxible Web GUI App entry, compiles to bundle.js  
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
│   ├── docs/               # Output dir for generated JS docs (not in git)
│   └── main/               # JS for Electron's "Main Process", App init startup
│       ├── index.js        # ES6 Electron App main entry, init GUI, run models
│       └── loader.js       # Electron App entry loader for main.js ES5 => ES6
├── node_modules/           # Where `npm` installs packages to (not in git)
├── package.json            # Node.js `npm` packages, dependencies, and config
├── py/                     # Unicorn ModelRunner and support Python/C++ code
│   └── README.md           # Python Backend instructions
├── samples/                # Sample .CSV data files to pre-load for user in GUI
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

The Frontend contains code to manage Models on the Backend. It also contians
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

1. Electron loads `js/main.js`
1. .. which (or Browser directly) loads `js/browser/index.html`
1. .. which loads `js/browser/js/app.js`
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
brew install git node
git clone https://github.com/numenta/numenta-apps
cd numenta-apps/unicorn
pip install -r py/requirements.txt
npm install
unset PYTHONPATH  # force usage of our custom internal Python
```


## Develop

### Lightweight Install

To install without the lengthy python bundle, assuming the desired python bundle
is already installed:

```shell
npm install --no-optional
```

### Unicorn backend install

Execute the following command after making changes to `unicorn_backend` code:
```shell
npm run install:backend
```

### Run

```shell
npm run dev

# see pretty logs
npm run dev | `npm bin`/bunyan

# same thing, but explicit
NODE_ENV=development npm run dev
```

### Code Docs

Frontend code documentation can be generated and viewed by following the
directions below. Comments are in [JSDoc](http://usejsdoc.org/) format, with
output generated by [ESDoc](https://esdoc.org/).

```shell
npm run docs  # generate and open documentation
```

### `npm` tooling scripts

Here are the `npm` scripts available via `npm run <script-name>`. Please see
`package.json` for more info.

* `build`: Run all steps required to build the application
* `clean`: Clean all Unicorn build an runtime artifacts
  * `clean:build`: Delete Unicorn build artifacts
  * `clean:db:osx`: Delete Unicorn database files (OSX)
  * `clean:docs`: Delete Unicorn documentation
  * `clean:npm`: Delete `npm` installed packages installed locally
  * `clean:webpack`: Clean compiled/packaged JS code
* `dev`: Launch Unicorn Desktop application
* `dev:debug`: Launch Unicorn in debug mode. See
  [Electron Documentation]( https://github.com/atom/electron/blob/master/docs/tutorial/debugging-main-process.md)
  for instructions on how to use the debugger
* `dev:inspect`: Launch `node-inspector` used to debug Electron application.
  See [Electron Documentation]( https://github.com/atom/electron/blob/master/docs/tutorial/debugging-main-process.md)
  for detailed instructions on how to use the debugger
* `docs`: Build Unicorn documentation (esdoc)
* `electron`: Launch Electron
* `electron:debug`: Launch Electron in debug mode. See
  [Electron Documentation]( https://github.com/atom/electron/blob/master/docs/tutorial/debugging-main-process.md)
  for instructions on how to use the debugger
* `electron:packager`: Build Unicorn installable packages
* `esfmt`: Format JS code (esformatter)
* `lint`: Lint JS code (eslint)
* `prepare`: Prepare Unicorn code for packaging
* `test`: Run all JS tests using developer options. See
  [mocha.opts](tests/js/mocha.opts)
  * `test:integration`: Run all JS integration tests
  * `test:unit`: Run all JS unit tests
* `test:pipeline`:Run all JS tests using pipeline options. See
  [mocha.opts](tests/js/mocha.pipeline.opts)
  * `test:pipeline:integration`:  Run all JS integration tests
  * `test:pipeline:unit`: Run all JS unit tests

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

Write **Unit** and **Integration** tests using
[mocha](https://github.com/mochajs/mocha) test framework.

```shell
npm run test              # all
npm run test:unit         # unit tests only
npm run test:integration  # integration tests only
```

### Pipeline

To generate reults appropriate for the **pipeline** `mocha` needs to run
with a different set of options
(see [mocha.pipeline.opts](tests/js/mocha.pipeline.opts)).

```shell
npm run test:pipeline               # pipeline all
npm run test:pipeline:unit          # pipeline unit tests only
npm run test:pipeline:integration   # pipeline integration tests only
```


## Build

### Mac OS/X

Build the electron app with:

```shell
npm run build

# same thing, but explicit
NODE_ENV=production npm run build
```

The resulting `.app` can be found in `unicorn/Unicorn-darwin-x64/`

### Windows

@TODO


## Release

### Signing

* You need a certificate type of “Developer ID Application” from Apple. This
  certificate usually has a common name in the form of
  `Developer ID Application: YourCompany, Inc. (ABCDEFGHIJK)`.
* Set the environment variable `UNICORN_CERT_DEV_APPLE` and sign the app:
  `export UNICORN_CERT_DEV_APPLE="Developer ID Application: Numenta, Inc. (ABCDEFGHIJK)"`
* Now when you package Unicorn with `npm run electron:packager`, the app will
  be signed.
* Useful blog post about signing Electron apps:
  http://jbavari.github.io/blog/2015/08/14/codesigning-electron-applications

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
