
Numenta HTM Engine
==================

`htmengine` is a python package that comprises a set of long-running services, upon which a scalable, real-time, and production-ready scalar anomaly detection application may be built.  The ideal use-case for `htmengine` is a scenario where there is a continuous stream of data for many metrics, each with a relatively low sample rate e.g. 5-minute intervals.

Tutorial Application
--------------------

An [example application of HTM Engine](https://github.com/nupic-community/htmengine-traffic-tutorial) is available with an [accompanying screencast](https://www.youtube.com/watch?v=lzJd_a6y6-E).

[![YouTube Screenshot of HTM Engine Tutorial](http://img.youtube.com/vi/lzJd_a6y6-E/hqdefault.jpg)](https://www.youtube.com/watch?v=lzJd_a6y6-E)
> A walkthrough of the HTM Engine with an example application of New York City live traffic speeds.

Installation
------------

First, install [`nta.utils`](../nta.utils).  Then, to install `htmengine`:

    python setup.py develop [OPTIONS]

- See `python setup.py develop --help` for options that may be helpful for your specific environment.

### Requirements

- [rabbitmq](https://www.rabbitmq.com/download.html) 3.5 (or higher)
- [mysql](http://dev.mysql.com/downloads/mysql/) 5.6 (or higher)

Usage
-----

In order to use `htmengine`, there are some additional steps you MUST do to create a fully functional application.  The below instructions include the details for scaffolding an application for use with `htmengine`.  For a TL;DR version and concrete example in which the following has been done for you, see https://github.com/nupic-community/skeleton-htmengine-app for a simple, fully-functional application upon which you may base your own.

### Configuration

Create a `conf/` directory, and use the following files as templates for your own configuration. Carefully review each file, and fill in or replace any values that are specific to your application. In your own environment, you MUST set the `APPLICATION_CONFIG_PATH` environment variable to the absolute path of this `conf/` directory.

- `conf/application.conf`

  Replace `APPLICATION_NAME` in the template below with the name of your application.  Add database credentials in the `[repository]` section with values that match your own MySQL database.

  ```
  [debugging]
  # Controls whether to log performance profiling information: true or false
  profiling = false

  # MySQL database connection parameters
  [repository]
  db =
  host =
  user =
  passwd =
  port =

  [metric_streamer]
  # Exchange to push model results
  results_exchange_name = APPLICATION_NAME.model.results
  # Max records per batch to stream to model
  chunk_size = 1440

  [metric_collector]
  # How often to poll metrics for data in seconds
  poll_interval = 60
  # Metric error grace period seconds after which the metric will be promoted to
  # ERROR state if it continues to encounter errors
  metric_error_grace_period = 10800

  [metric_listener]
  # Port to listen on for plaintext protocol messages
  plaintext_port = 2003
  queue_name = APPLICATION_NAME.metric.custom.data

  [anomaly_likelihood]
  # Minimal sample size for statistic calculation
  statistics_min_sample_size=100
  # How often to refresh the anomaly statistics in rows
  # We refresh once every two hours (ideally we would do this every record)
  statistics_refresh_rate=24
  # Sample size to be used for the statistic calculation
  # We keep a max of one month of history (assumes 5 min metric period)
  statistics_sample_size=8640
  ```

- `conf/model-checkpoint.conf`

  Replace `/ABSOLUTE/PATH/ON/LOCAL/FILESYSTEM/model_checkpoints` with the absolute path to a location where you will store model checkpoints created by `htmengine`.

  ```
  # Model Checkpoint Manager Configuration

  [storage]
  # The root directory of the model checkpoint archive.
  # May use environment variables; MUST expand to absolute path
  root = /ABSOLUTE/PATH/ON/LOCAL/FILESYSTEM/model_checkpoints
  ```

- `conf/model-swapper.conf`

  Replace `APPLICATION_NAME` with the name of your application in the template below.

  ```
  # Model Swapper Configuration

  [debugging]
  # Controls whether to log performance profiling information: true or false
  profiling = false


  # Model Swapper Interface Bus
  [interface_bus]

  # Name of the queue for model command and inference results
  results_queue = APPLICATION_NAME.mswapper.results

  # A model's input queue name is the concatenation of this prefix and model id
  model_input_queue_prefix = APPLICATION_NAME.mswapper.model.input.

  # Name of the Model Scheduler notification queue
  scheduler_notification_queue = APPLICATION_NAME.mswapper.scheduler.notification


  [model_runner]
  # The target number of model input request objects to be processed per
  # checkpoint. This may span multiple batches, until the number of requests
  # reaches or exceeds this value. Since it always processes all requests in a
  # batch, the actual number of requests processed before checkpointing the model
  # may be higher than this number.
  target_requests_per_checkpoint = 500
  ```

- `conf/supervisord.conf`

  Replace `/ABSOLUTE/PATH/TO/THIS/APPLICATION/conf` in the template below to the location of the application `conf/` directory containing the files you just created.  Replace `/ABSOLUTE/PATH/TO/htmengine` with the absolute path to the htmengine source.

  ```
  ; Sample supervisor config file.
  ;
  ; For more information on the config file, please see:
  ; http://supervisord.org/configuration.html
  ;
  ; Note: shell expansion ("~" or "$HOME") is not supported.  Environment
  ; variables can be expanded using this syntax: "%(ENV_HOME)s".

  [unix_http_server]
  file=%(here)s/../supervisor.sock   ; (the path to the socket file)

  [inet_http_server]
  port=127.0.0.1:9001

  [supervisord]
  pidfile=%(here)s/../supervisord.pid
  identifier=APPLICATION_NAME-supervisor
  logfile=%(here)s/../logs/supervisord.log
  # NOTE: logfile_maxbytes=0 turns off supervisor log rotation
  logfile_maxbytes=50MB
  logfile_backups=10
  loglevel=info
  nodaemon=false
  minfds=1024
  minprocs=200

  [rpcinterface:supervisor]
  supervisor.rpcinterface_factory = supervisor.rpcinterface:make_main_rpcinterface

  [supervisorctl]
  serverurl=http://:


  [include]
  files = /ABSOLUTE/PATH/TO/htmengine/conf/supervisord-base.conf
  ```


### Repository

`htmengine` uses MySQL to cache data locally at various stages of processing and has a very specific schema (included below) that it requires to be implemented:

```
CREATE TABLE instance_status_history (
    server VARCHAR(100) DEFAULT '' NOT NULL,
    timestamp DATETIME NOT NULL,
    status VARCHAR(32) DEFAULT '' NOT NULL,
    PRIMARY KEY (server, timestamp)
);

CREATE TABLE `lock` (
    name VARCHAR(40) NOT NULL,
    PRIMARY KEY (name)
);

INSERT INTO `lock` (`name`) VALUES('metrics');

CREATE TABLE metric (
    uid VARCHAR(40) NOT NULL,
    datasource VARCHAR(100),
    name VARCHAR(255),
    description VARCHAR(200),
    server VARCHAR(100),
    location VARCHAR(200),
    parameters TEXT,
    status INTEGER DEFAULT '0',
    message TEXT,
    collector_error TEXT,
    last_timestamp DATETIME NULL DEFAULT NULL,
    poll_interval INTEGER DEFAULT '60',
    tag_name VARCHAR(200),
    model_params TEXT,
    last_rowid INTEGER,
    PRIMARY KEY (uid)
);

CREATE INDEX datasource_idx ON metric (datasource);

CREATE INDEX location_idx ON metric (location);

CREATE INDEX server_idx ON metric (server);

CREATE TABLE metric_data (
    uid VARCHAR(40) DEFAULT '' NOT NULL,
    rowid INTEGER DEFAULT '0' NOT NULL,
    timestamp DATETIME NOT NULL,
    metric_value DOUBLE NOT NULL,
    raw_anomaly_score DOUBLE,
    anomaly_score DOUBLE,
    display_value INTEGER,
    PRIMARY KEY (uid, rowid),
    CONSTRAINT metric_data_to_metric_fk FOREIGN KEY(uid) REFERENCES metric (uid) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX anomaly_score_idx ON metric_data (anomaly_score);

CREATE INDEX timestamp_idx ON metric_data (timestamp);
```

### Logs

`htmengine` services write out log data to `logs/` from the base of the application directory.  Create it, if it does not exist.

```
mkdir -p logs
```

Services
--------

[Supervisor](http://supervisord.org/) is used to start, and keep running, a set of processes that implement a processing pipeline for incoming scalar data for the purpose of calculating and reporting on [NuPIC Anomaly Scores](https://github.com/numenta/nupic/wiki/Anomaly-Detection-and-Anomaly-Scores).  [RabbitMQ](https://www.rabbitmq.com/) brokers messages between these processes.

### Metric Listener

`htmengine.runtime.metric_listener` implements a [Graphite](http://graphite.readthedocs.org/en/latest/feeding-carbon.html#feeding-in-your-data)-compatible API to accept plain-text metric data over a TCP connection on port 2003.  Metric data is accepted in the following format:

```
name value timestamp\n
```

- `name` is the metric name, typically composed of a hierarchical period-delimited path.
- `value` is the metric value, which can be any scalar value
- `timestamp` is the unix timestamp associated with the metric sample.

For example:

```
foo.bar.stats 21 1443197361
```

Multiple metric samples may be sent over a single connection, as long as the above format is used, and metric samples are sent one-per-line.  Metric samples will be processed in the order they are sent, so if you are sending a batch of data at once, be sure to sort it by timestamp!

### Metric Storer

`htmengine.runtime.metric_storer` stores the metric samples in a local MySQL database, and is separate from the Metric Listener so as to not block clients of the API on database I/O.

### Model Scheduler

`htmengine.model_swapper.model_scheduler_service` implements the "Model Swapping" process that allows `htmengine` to scale to hundreds, and possibly even thousands, of NuPIC anomaly models on a single instance.  This works by regularly checkpointing models to disk, and reloading them on-demand.  Incoming samples are buffered until the model can be loaded and as a result, there is a short, but undefined latency associated with the processing of any given metric sample.

### Anomaly Service

`htmengine.runtime.anomaly_service` calculates the final Anomaly Likelihood score and publishes the results to an exchange for later processing by the user-defined application, if necessary.  The results are also saved to the local MySQL database.

API
---

### Sending data

You may also programatticaly send data directly to RabbitMQ, bypassing the Metric Listener TCP service:

```python
import json
from nta.utils import message_bus_connector

msg = json.dumps(dict(protocol="plain", data=["foo.bar.stats 21 1443197361"]))
bus = message_bus_connector.MessageBusConnector()
bus.publish(mqName=MESSAGE_QUEUE_NAME, body=msg, persistent=True)
```

### Creating a model

Inbound data is only cached until a model is specifically created for that metric.  There is an API for monitoring a specific metric:

```python
from htmengine.adapters.datasource import createDatasourceAdapter

modelSpec = {
  "datasource": "custom",
  "metricSpec": {
    "metric": "foo.bar.stats"
  },
  "modelParams": {
    "min": 0,  # optional
    "max": 100  # optional
  }
}

adapter = createDatasourceAdapter(modelSpec["datasource"])
modelId = adapter.monitorMetric(modelSpec)
```

### Post-processing the results

The results are cached in the MySQL database, in the `metric_data` table.  `htmengine` uses [sqlalchemy](http://www.sqlalchemy.org/) to access the database, and provides a high-level function to query the data directly from the database.  For example, the following python snippet queries the repository for, and prints metric data:

```python
import calendar
from htmengine import repository
from htmengine.repository import schema
from nta.utils.config import Config

METRIC_NAME = "foo.bar.stats"

appConfig = Config("application.conf", os.environ["APPLICATION_CONFIG_PATH"])

with repository.engineFactory(appConfig).connect() as conn:
  metricObj = repository.getCustomMetricByName(conn,
                                               METRIC_NAME,
                                               fields=[schema.metric.c.uid])

  fields = (schema.metric_data.c.metric_value,
            schema.metric_data.c.timestamp,
            schema.metric_data.c.rowid,
            schema.metric_data.c.anomaly_score)
  sort = schema.metric_data.c.timestamp.asc()

  result = repository.getMetricData(conn,
                                    metricId=metricObj.uid,
                                    fields=fields,
                                    sort=sort)

  for row in result:
    print METRIC_NAME,
    print str(row.metric_value),
    print str(calendar.timegm(row.timestamp.timetuple())),
    print str(row.anomaly_score)))
```

### Real-time results

You may also process the results in real-time by creating a queue bound to the results exchange:

```python
import os

from nta.utils import amqp
from nta.utils.config import Config

from htmengine import htmengineerrno
from htmengine.runtime.anomaly_service import AnomalyService



appConfig = Config("application.conf", os.environ["APPLICATION_CONFIG_PATH"])

modelResultsExchange = appConfig.get("metric_streamer",
                                     "results_exchange_name")
queueName = "APPLICATION_NAME_results"



def declareExchanges(amqpClient):
  """ Declares model results and non-metric data exchanges
  """
  amqpClient.declareExchange(exchange=modelResultsExchange,
                             exchangeType="fanout",
                             durable=True)


def declareQueueAndBindToExchanges(amqpClient):
  """ Declares queue and binds to model results.
  """
  result = amqpClient.declareQueue(queueName, durable=True)

  amqpClient.bindQueue(exchange=modelResultsExchange,
                       queue=result.queue, routingKey="")


def configChannel(amqpClient):
  amqpClient.requestQoS(prefetchCount=1)



def handleModelInferenceResults(body):
  """ Model results batch handler.

  :param body: Serialized message payload; the message is compliant with
    htmengine/runtime/json_schema/model_inference_results_msg_schema.json.
  :type body: str
  """
  try:
    batch = AnomalyService.deserializeModelResult(body)
  except Exception:
    print "Error deserializing model result"
    raise

  metricId = batch["metric"]["uid"]
  metricName = batch["metric"]["name"]

  print "Handling %d model result(s) for %s - %s" % (len(batch["results"]),
                                                     metricId,
                                                     metricName)

  if not batch["results"]:
    print "Empty results in model inference results batch; model=%s" % metricId
    return

  print metricId, batch["results"]


def handleModelCommandResult(body):
  """ ModelCommandResult handler.  Handles model creation/deletion events

  :param body: Incoming message payload
  :type body: str
  """
  try:
    modelCommandResult = AnomalyService.deserializeModelResult(body)
  except Exception:
    print "Error deserializing model command result"
    raise

  if modelCommandResult["status"] != htmengineerrno.SUCCESS:
    return # Ignore...

  if modelCommandResult["method"] == "defineModel":
    print "Handling `defineModel` for %s" % modelCommandResult.get("modelId")
    print modelCommandResult

  elif modelCommandResult["method"] == "deleteModel":
    print "Handling `deleteModel` for %s" % modelCommandResult.get("modelId")
    print modelCommandResult


def messageHandler(message):
  """ Inspect all inbound model results

  We will key off of routing key to determine specific handler for inbound
  message.  If routing key is `None`, attempt to decode message using
  `AnomalyService.deserializeModelResult()`.

  :param amqp.messages.ConsumerMessage message: ``message.body`` is one of:
      Serialized batch of model inference results generated in
        ``AnomalyService`` and must be deserialized using
        ``AnomalyService.deserializeModelResult()``. Per
        htmengine/runtime/json_schema/model_inference_results_msg_schema.json

      Serialized ``ModelCommandResult`` generated in ``AnomalyService``
        per model_command_result_amqp_message.json and must be deserialized
        using ``AnomalyService.deserializeModelResult()``
  """
  if message.methodInfo.routingKey is None:
    print "Unrecognized routing key."
  else:
    dataType = (message.properties.headers.get("dataType")
                if message.properties.headers else None)
    if not dataType:
      handleModelInferenceResults(message.body)
    elif dataType == "model-cmd-result":
      handleModelCommandResult(message.body)
    else:
      print "Unexpected message header dataType=%s" % dataType

  message.ack()


if __name__ == "__main__":
  with amqp.synchronous_amqp_client.SynchronousAmqpClient(
      amqp.connection.getRabbitmqConnectionParameters(),
      channelConfigCb=configChannel) as amqpClient:

    declareExchanges(amqpClient)
    declareQueueAndBindToExchanges(amqpClient)
    consumer = amqpClient.createConsumer(queueName)

    # Start consuming messages
    for evt in amqpClient.readEvents():
      if isinstance(evt, amqp.messages.ConsumerMessage):
        messageHandler(evt)
      elif isinstance(evt, amqp.consumer.ConsumerCancellation):
        # Bad news: this likely means that our queue was deleted externally
        msg = "Consumer cancelled by broker: %r (%r)" % (evt, consumer)
        raise Exception(msg)
      else:
        print "Unexpected amqp event=%r" % evt
```

Running HTMEngine Integration Tests
-----------------------------------

The HTM engine has a basic skeleton application exclusively for running tests.
To run the tests, you must have MySQL, RabbitMQ, and Supervisor running.

Make sure that `APPLICATION_CONFIG_PATH` is set to point to `tests/support/skeleton-app/conf`
For example:
```export APPLICATION_CONFIG_PATH=/Users/{name}/nta/numenta-apps/htmengine/tests/support/skeleton-app/conf```
(alternatively you can use the `APPLICATION_CONFIG_PATH` from an app based off
of the HTMEngine, just be careful to not reset an existing MySQL database)

With MySQL already started start/restart RabbitMQ:
`rabbitmq-server -detached`

Setup the htmengine MySQL database:
(don't do this if you're testing on HTM-IT, Taurus, or another HTMEngine application)
`./tests/support/skeleton-app/reset_db.py`

Start `supervisord`:
```cd tests/support/skeleton-app```
```supervisord -c conf/supervisord.conf```
*NOTE: Be sure to run `mkdir logs` within the `skeleton-app` directory so
supervisor has a place to store its logs*

Run the integration tests:
`py.test tests/integration`
