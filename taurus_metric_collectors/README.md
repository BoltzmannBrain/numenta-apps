taurus_metric_collectors
========================

`taurus_metric_collectors` implements metric collection agents for twitter and
xignite data sources which forward data to a running Taurus instance.

Installation
------------

### First, install `nta.utils`.  Then, to install `taurus_metric_collectors`:

    python setup.py develop --install-dir=<site-packages in $PYTHONPATH> --script-dir=<somewhere in $PATH>

- `--install-dir` must specify a location in your PYTHONPATH, typically
  something that ends with "site-packages".  If not specified, system default
  is used.
- `--script-dir` must specify a location in your PATH.  The Taurus installation
  defines and installs some CLI utilities into this location.  If not
  specified, the generated scripts go into the location specified in
  `--install-dir`.

`install-taurus-metric-collectors.sh` is included at the root of the `numenta-apps` repository as a
convenient alternative:

    `./install-taurus-metric-collectors.sh <site-packages in $PYTHONPATH> <somewhere in $PATH>`

- e.g., `./install-taurus-metric-collectors.sh /opt/numenta/anaconda/lib/python2.7/site-packages/ /opt/numenta/anaconda/bin/`


### Set collectors opmode

- for active (collecting and forwarding): `taurus-collectors-set-opmode active`
- for hot-standby (collecing and storing, but not forwarding): `taurus-collectors-set-opmode hot_standby`


### Set up `collectorsdb` sql database connection

1. The configuration in `conf/collectors-sqldb.conf` defaults to host=localhost with the default user/password for mysql. To override mysql host, username and password, use the following command, substituting the appropriate strings for HOST, USER and PASSWORD:
```
    >>> taurus-set-collectorsdb-login --host=HOST --user=USER --password=PASSWORD
```

### Set up rabbitmq connection and authentication
```
    >>> taurus-collectors-set-rabbitmq --host=HOST --user=USER --password=PASSWORD
```

### Run the folowing to obliterate/create a new collectorsdb (without options, it presents a confirmation prompt; execute with  `--help` to get the option that bypasses the prompt for use with scripting automation):
```
    >>> taurus-reset-collectorsdb
```

### Create a cron job that invokes taurus-process-tweet-deletions periodically

  e.g., every 10 minutes
  `*/10 * * * * taurus-process-tweet-deletions`

### Create a cron job that invokes taurus-check-twitter-screen-names periodically

  e.g., every hour
  `@hourly source /opt/numenta/numenta-apps/taurus_metric_collectors/env.sh; /opt/numenta/anaconda/bin/taurus-check-twitter-screen-names 2>&1 | logger -t taurus-check-twitter-screen-names`

This script will send email notifications to report unmapped screen names, if they haven't already been reported.

**This script depends on the following environment variables:**

* TAURUS_TWITTER_CONSUMER_KEY: Twitter consumer key.
* TAURUS_TWITTER_CONSUMER_SECRET: Twitter consumer secret.
* TAURUS_TWITTER_ACCESS_TOKEN: Twitter access token.
* TAURUS_TWITTER_ACCESS_TOKEN_SECRET: Twitter access token secret
* ERROR_REPORT_EMAIL_AWS_REGION: AWS region for error report email.
* ERROR_REPORT_EMAIL_SES_ENDPOINT: SES endpoint for error report email.
* ERROR_REPORT_EMAIL_SENDER_ADDRESS: Sender address for error report email.
* ERROR_REPORT_EMAIL_RECIPIENTS: Recipients error report email. Email addresses need to be coma separated. Example: `'recipient1@numenta.com, recipient2@numenta.com'`
* AWS_ACCESS_KEY_ID: AWS access key ID for error report email.
* AWS_SECRET_ACCESS_KEY: AWS secret access key for error report email.

### Create a cron job that invokes taurus-check-company-symbols periodically

  e.g., every day
  `@daily source /opt/numenta/numenta-apps/taurus_metric_collectors/env.sh; /opt/numenta/anaconda/bin/taurus-check-company-symbols 2>&1 | logger -t taurus-check-company-symbols`

This script will send email notifications to report invalid stock symbols, if they haven't already been reported.

**This script depends on the following environment variables:**

* XIGNITE_API_TOKEN: XIgnite API Token
* ERROR_REPORT_EMAIL_AWS_REGION: AWS region for error report email.
* ERROR_REPORT_EMAIL_SES_ENDPOINT: SES endpoint for error report email.
* ERROR_REPORT_EMAIL_SENDER_ADDRESS: Sender address for error report email.
* ERROR_REPORT_EMAIL_RECIPIENTS: Recipients error report email. Email addresses need to be coma separated. Example: `'recipient1@numenta.com, recipient2@numenta.com'`
* AWS_ACCESS_KEY_ID: AWS access key ID for error report email.
* AWS_SECRET_ACCESS_KEY: AWS secret access key for error report email.


Environment Variables
---------------------

Environment variables for `taurus-check-twitter-screen-names` and
`taurus-check-company-symbols` are defined in their respective Installation
sub-sections.

This section documents the environment variables used by the core
taurus.metric_collector application modules:

`TAURUS_HTM_SERVER`: IP address or host name of the corresponding Taurus server
where metric data samples as well as non-metric data (e.g., tweets) are
forwarded

`TAURUS_API_KEY`: API Key of the corresponding Taurus server

`TAURUS_METRIC_COLLECTORS_LOG_DIR`: Path of the directory where logs are to be
stored; defaults to <numenta-apps/taurus_metric_collectors/logs/>

`TAURUS_TWITTER_ACCESS_TOKEN`: Twitter oAuth access token for Twitter's public API

`TAURUS_TWITTER_ACCESS_TOKEN_SECRET`: Twitter oAuth access token secret for Twitter's public API

`TAURUS_TWITTER_CONSUMER_KEY`: Twitter oAuth consumer key for Twitter's public API

`TAURUS_TWITTER_CONSUMER_SECRET`: Twitter oAuth consumer secret for Twitter's public API

`XIGNITE_API_TOKEN`: API token for accessing Xignite API


Usage
-----

Metric collection agents are executed as supervisord services.

### Start services with `supervisord`:

    supervisord -c conf/supervisord.conf

You can inspect, stop, amd start taurus services using `supervisorctl`.  For
example:

- `supervisorctl status` for the status of all services.
- `supervisorctl shutdown` to stop all services and shutdown supervisord.
- `supervisorctl restart all` restart all services.

Supervisor also exposes a web interface at http://localhost:9001/ that you may
use in lieu of the command line interface.


Renaming a stock (symbol)
-----

### Follow these steps

- Update the  file `taurus_metric_collectors/metric_csv_archive/metrics.csv` to
  use the correct symbol and then run
    `python taurus_metric_collectors/gen_metrics_config.py taurus_metric_collectors/metric_csv_archive/metrics.csv > conf/metrics.json`
  to generate the metrics.json file with updated metric names.
- Push changes to Taurus Metric Collector server.
- Restart Taurus Metric Collector services. metric_maintenance_agent.py service does the rest.
  For more info, see taurus_metric_collectors/taurus_metric_collectors/common_services/metric_maintenance_agent.py.

Taurus Metric Collectors and Docker
-----------------------------------

A [Dockerfile](https://docs.docker.com/engine/reference/builder/) is included
to support a docker-based workflow.  To build a docker image, run the following
command from the root of the `numenta-apps` repository (the parent directory
of `taurus_metric_collectors/`):

```
docker build -t taurus-collector:latest -f taurus_metric_collectors/Dockerfile .
```

See `Dockerfile` for specific environment variable configuration directives.
