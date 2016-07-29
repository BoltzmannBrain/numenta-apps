Taurus
======

Taurus is a server application that implements HTM Engine for the purpose of
collecting and reporting on company metrics.  Custom metrics are used for
Stock Price, Stock Volume, and Twitter handle tweet volume.  A RESTful API is
provided to support the Taurus Mobile application.

Installation
------------

First, install `nta.utils`, `htmengine` and `taurus_metric_collectors`.  Then, to install `taurus`:

    python setup.py develop --install-dir=<site-packages in $PYTHONPATH> --script-dir=<somewhere in $PATH>

- `--install-dir` must specify a location in your PYTHONPATH, typically
  something that ends with "site-packages".  If not specified, system default
  is used.
- `--script-dir` must specify a location in your PATH.  The Taurus installation
  defines and installs some CLI utilities into this location.  If not
  specified, the generated scripts go into the location specified in
  `--install-dir`.

`install-taurus.sh` is included at the root of the `numenta-apps` repository as a
convenient alternative:

    ./install-taurus.sh <PREFIX>

The configuration files for production reside in `conf/`.  It is recommended
that you copy and rename this directory so that you may make the required
local changes without conflicts:

    cp -r conf conf-user

- Additionally ensure that APPLICATION_CONFIG_PATH is set in your environment.
- If running with local dynamodb emulation, edit `conf-user/supervisord.conf` to
  uncomment the lines for the DynamoDB local test tool and create an empty
  `.dynamodb` directory:

    `mkdir $HOME/.dynamodb`

Create an empty taurus `logs` directory:

    mkdir logs
    

With `taurus` installed, and configuration updated, run `taurus-create-db` to
initialize the database.

TODO: Create a console script (see setup.py) that automates the above for
development environment (https://jira.numenta.com/browse/TAUR-516).

### Application config overrides

In a production or otherwise automated setting, it's best to use the included
console scripts (where available) for setting configuration overrides.  This
will ensure that proper validation is applied, eliminate potential syntax
errors or typos, and supports an automated workflow.

- `taurus-set-api-key` to set Taurus REST API Key.
    ```
    taurus-set-api-key --apikey API_KEY
    ```

- `taurus-set-rabbitmq` to set Taurus rabbitmq connection and authentication.
    ```
    taurus-set-rabbitmq --host=HOST --user=USER --password=PASSWORD
    ```

- `taurus-set-sql-login` to set Taurus MySQL credentials.

    ```
    taurus-set-sql-login --host=<host> --user=<user> --password=<password>
    ```

- `taurus-set-dynamodb` to set Taurus DynamoDB details.

  Note: host and port must be blank for live DynamoDB API usage.

  Production:

    ```
    taurus-set-dynamodb --host= --port= --table-suffix=.production
    ```

  Staging:

    ```
    taurus-set-dynamodb --host= --port= --table-suffix=.staging
    ```

  Local (Emulation Tool):

    ```
    taurus-set-dynamodb --host=127.0.0.1 --port=8300 --table-suffix=.local --security-off
    ```
  Note: security must be off for DynamoDB Local Emulation Tool.

- Generate self-signed SSL certificate

    ```
    pushd conf-user/ssl
    openssl genrsa -des3 -out localhost.key 1024
    openssl req -new -key localhost.key -out localhost.csr
    cp localhost.key localhost.key.org
    openssl rsa -in localhost.key.org -out localhost.key
    openssl x509 -req -days 365 -in localhost.csr -signkey localhost.key -out localhost.crt
    popd
    ```


Environment Variables
---------------------

`APPLICATION_CONFIG_PATH`: directory path where active Taurus configuration
files are located

`APPLICATION_LOG_DIR`: directory path where Taurus application logs should be
stored

`TAURUS_RMQ_METRIC_DEST`: The RabbitMQ metric data sample destination (e.g.,
"1.6.1.numenta.com:2003") must be specified via this environment variable. This
is passed by `superviosrd.conf` to `rmq_metric_collector_agent` as the value of
its `--metric-addr` command-line option. NOTE: we don't hardcode the value in
`supervisord.conf` in order to avoid having undersirable metric data samples
accidentally forwarded from developer laptops and other test machines to the
production "htm-it" application server.

`TAURUS_RMQ_METRIC_PREFIX`: This defines the prefix to be used for metrics
sent to the HTM-IT server.  It is passed by `supervisord.conf` to
`rmq_metric_collector_agent` as the value of its `--metric-prefix` command-line
option. NOTE: we don't hardcode the value in `supervisord.conf` in order to
avoid accidently corrupting metric data on an existing HTM-IT installation. This
allows having a single HTM-IT instance monitor multiple Taurus instances
(e.g., Production and Staging)

*NOTE:* If `TAURUS_RMQ_METRIC_DEST` and `TAURUS_RMQ_METRIC_PREFIX` env vars
aren't set, then supervisord will fail to start with an error similar to:
```
Error: Format string 'python -m htmengine.monitors.rmq_metric_collector_agent --metric-addr=%(ENV_TAURUS_RMQ_METRIC_DEST)s --metric-prefix=TAURUS' for 'command' contains names which cannot be expanded
```

The following must be set for production or staging but can be omitted for
development setups:

`AWS_ACCESS_KEY_ID`: The AWS acces key

`AWS_SECRET_ACCESS_KEY`: The AWS secret key

Usage
-----

### Start MySQL

Individual configurations may vary.  Be sure to start MySQL however best works
with the installation path you followed.

### Start RabbitMQ

    rabbitmq-server -detached

#### Reset RabbitMQ

If you have an old copy of htm-it then you need to clean up RabbitMQ queues.

    rabbitmqctl stop_app
    rabbitmqctl reset
    rabbitmqctl start_app

### Start nginx:

    sudo nginx -p . -c conf-user/nginx-taurus.conf

Should you need to run nginx as a specific user and group, do so with the use
of the `NGINX_GLOBAL_PARAMS` environment var, specifying "-g" options per
http://nginx.org/en/docs/switches.html.

For example:

    export NGINX_GLOBAL_PARAMS="-g 'user root root;'"

### Start Taurus services with `supervisord`:

    supervisord -c conf-user/supervisord.conf

You can inspect, stop, amd start taurus services using `supervisorctl`.  For
example:

- `supervisorctl status` for the status of all services.
- `supervisorctl shutdown` to stop all services and shutdown supervisord.
- `supervisorctl stop taurus:taurus-api_00` to stop only the web services, but
  keep everything else running.
- `supervisorctl tail -f htmengine:metric_storer` to actively monitor the
  metric storer service
- `supervisorctl restart all` restart all services.

Supervisor also exposes a web interface at http://localhost:9001/ that you may
use in lieu of the command line interface.

Updating Taurus
---------------

When there are updates in those packages, you should run the
installation commands in each of the respective packages and in `taurus` even
if they are already technically installed so that `setuptools` metadata is
applied correctly, and any updates to dependencies are taken into
consideration.

Taurus and Docker
-----------------

A [Dockerfile](https://docs.docker.com/engine/reference/builder/) is included
to support a docker-based workflow.  To build a docker image, run the following
command from the root of the `numenta-apps` repository (the parent directory
of `taurus_engine/`):

```
docker build -t taurus:latest -f taurus_engine/Dockerfile .
```

See `Dockerfile` for specific environment variable configuration directives.
