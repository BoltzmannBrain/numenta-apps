#!/usr/bin/env python
# ----------------------------------------------------------------------
# Numenta Platform for Intelligent Computing (NuPIC)
# Copyright (C) 2015, Numenta, Inc.  Unless you have purchased from
# Numenta, Inc. a separate commercial license for this software code, the
# following terms and conditions apply:
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero Public License version 3 as
# published by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
# See the GNU Affero Public License for more details.
#
# You should have received a copy of the GNU Affero Public License
# along with this program.  If not, see http://www.gnu.org/licenses.
#
# http://numenta.org/licenses/
# ----------------------------------------------------------------------

""" Integration tests for CustomDatasourceAdapter """

import datetime
import json
import os
import pkg_resources
import unittest
import uuid

from htmengine import repository
import htmengine.adapters.datasource as datasource_adapter_factory
import htmengine.exceptions as app_exceptions
from htmengine.htmengine_logging import getExtendedLogger
from htmengine.repository import schema
from htmengine.repository.queries import MetricStatus
from htmengine.runtime import scalar_metric_utils
from htmengine.test_utils.test_case_base import TestCaseBase
import htmengine.utils
from nta.utils.config import Config
from nta.utils.logging_support_raw import LoggingSupport


# Disable warning: Access to a protected member
# pylint: disable=W0212


g_log = None


g_config = Config("application.conf",
                  os.environ.get("APPLICATION_CONFIG_PATH"))


g_model_spec_schema = json.load(
  pkg_resources.resource_stream("htmengine.adapters.datasource",
                                "model_spec_schema.json"))

g_custom_metric_spec_schema = json.load(
  pkg_resources.resource_stream("htmengine.adapters.datasource.custom",
                                "custom_metric_spec_schema.json"))


def setUpModule():
  LoggingSupport.initTestApp()

  global g_log  # pylint: disable=W0603
  g_log = getExtendedLogger("custom_datasource_adapter_test")



class CustomDatasourceAdapterTest(TestCaseBase):


  @classmethod
  def setUpClass(cls):
    cls.engine = repository.engineFactory(g_config)


  def setUp(self):
    g_log.setLogPrefix("<%s> " % (self.id(),))  # pylint: disable=E1103

    self.config = g_config


  @classmethod
  def tearDownClass(cls):
    cls.engine.dispose()


  @classmethod
  def _validateModelSpec(cls, modelSpec):
    """ Validate custom modelSpec against schema

    :param dict modelSpec:
    """
    try:
      htmengine.utils.validate(modelSpec, g_model_spec_schema)
      htmengine.utils.validate(modelSpec["metricSpec"],
                               g_custom_metric_spec_schema)

    except Exception:
      g_log.exception("Failed validation of custom modelSpec=%r", modelSpec)
      raise


  def testCreateMetric(self):
    """ Test creation of custom metric """
    metricName = "test-" + uuid.uuid1().hex

    adapter = datasource_adapter_factory.createCustomDatasourceAdapter()

    g_log.info("Creating htmengine custom metric; name=%s", metricName)
    metricId = adapter.createMetric(metricName)
    self.addCleanup(adapter.deleteMetricByName, metricName)

    with self.engine.connect() as conn:
      metricObj = repository.getMetric(conn,
                                       metricId,
                                       fields=[schema.metric.c.name,
                                               schema.metric.c.datasource,
                                               schema.metric.c.status])

    self.assertEqual(metricObj.name, metricName)
    self.assertEqual(metricObj.datasource, "custom")
    self.assertEqual(metricObj.status, MetricStatus.UNMONITORED)


  def testCreateMetricThatAlreadyExists(self):
    """ Creating a custom metric with name that already exists should raise """
    metricName = "test-" + uuid.uuid1().hex

    adapter = datasource_adapter_factory.createCustomDatasourceAdapter()

    g_log.info("Creating htmengine custom metric; name=%s", metricName)
    metricId = adapter.createMetric(metricName)
    self.addCleanup(adapter.deleteMetricByName, metricName)

    with self.assertRaises(app_exceptions.MetricAlreadyExists) as cm:
      adapter.createMetric(metricName)

    self.assertEqual(cm.exception.uid, metricId)


  def testDeleteMetricByNameUnmonitored(self):
    """ Test deletion of unmonitored metric """
    metricName = "test-" + uuid.uuid1().hex

    adapter = datasource_adapter_factory.createCustomDatasourceAdapter()

    g_log.info("Creating htmengine custom metric; name=%s", metricName)
    metricId = adapter.createMetric(metricName)

    g_log.info("Deleteing unmonitored htmengine custom metric; name=%s",
               metricName)
    adapter.deleteMetricByName(metricName)
    g_log.info("Waiting for model to complete deletion")
    self.checkModelDeleted(metricId)


  def testDeleteMetricWithModel(self):
    """ Test monitorMetric with user-provided min/max that activates a model """
    metricName = "test-" + uuid.uuid1().hex

    adapter = datasource_adapter_factory.createCustomDatasourceAdapter()

    g_log.info("Creating htmengine custom metric: name=%s", metricName)
    metricId = adapter.createMetric(metricName)
    try:
      # Turn on monitoring
      modelSpec = {
        "datasource": "custom",

        "metricSpec": {
          "metric": metricName
        },

        "modelParams": {
          "min": 0,  # optional
          "max": 100  # optional
        }
      }

      adapter.monitorMetric(modelSpec)

      g_log.info("Waiting for model to become active")
      self.checkModelIsActive(metricId)

      g_log.info("Deleteing htmengine custom metric with active model: "
                 "name=%s",
                 metricName)
      adapter.deleteMetricByName(metricName)
      g_log.info("Waiting for model to complete deletion")
      self.checkModelDeleted(metricId)

    except:  # pylint: disable=W0702
      g_log.exception("Something went wrong")
      adapter.deleteMetricByName(metricName)


  def testMonitorMetricPendingData(self):
    """ Test monitorMetric that leaves the metric in PENDING_DATA state """
    metricName = "test-" + uuid.uuid1().hex

    adapter = datasource_adapter_factory.createCustomDatasourceAdapter()

    g_log.info("Creating htmengine custom metric; name=%s", metricName)
    metricId = adapter.createMetric(metricName)
    self.addCleanup(adapter.deleteMetricByName, metricName)

    # Turn on monitoring
    modelSpec = {
      "datasource": "custom",

      "metricSpec": {
        "metric": metricName
      }
    }

    adapter.monitorMetric(modelSpec)

    with self.engine.connect() as conn:
      metricObj = repository.getMetric(conn,
                                       metricId,
                                       fields=[schema.metric.c.parameters,
                                               schema.metric.c.status])

    self.assertEqual(metricObj.status, MetricStatus.PENDING_DATA)
    self.assertEqual(json.loads(metricObj.parameters), modelSpec)

    self._validateModelSpec(json.loads(metricObj.parameters))


  def testMonitorMetricWithResource(self):
    """Test monitorMetric that includes an explicit resource string."""
    metricName = "test-" + uuid.uuid1().hex
    resource = "Test Resource"

    adapter = datasource_adapter_factory.createCustomDatasourceAdapter()

    g_log.info("Creating htmengine custom metric; name=%s", metricName)
    metricId = adapter.createMetric(metricName)
    self.addCleanup(adapter.deleteMetricByName, metricName)

    # Turn on monitoring
    modelSpec = {
      "datasource": "custom",

      "metricSpec": {
        "metric": metricName,
        "resource": resource,
      }
    }

    adapter.monitorMetric(modelSpec)

    with self.engine.connect() as conn:
      metricObj = repository.getMetric(conn,
                                       metricId,
                                       fields=[schema.metric.c.parameters,
                                               schema.metric.c.status,
                                               schema.metric.c.server])

    self.assertEqual(metricObj.status, MetricStatus.PENDING_DATA)
    self.assertEqual(json.loads(metricObj.parameters), modelSpec)
    self.assertEqual(metricObj.server, resource)

    self._validateModelSpec(json.loads(metricObj.parameters))


  def testMonitorMetricWithUserInfo(self):
    """Test monitorMetric that includes an explicit userInfo property in
    metricSpec.
    """
    metricName = "test-" + uuid.uuid1().hex
    userInfo = {
      "symbol": "test-user-info"
    }

    adapter = datasource_adapter_factory.createCustomDatasourceAdapter()

    g_log.info("Creating htmengine custom metric; name=%s", metricName)
    metricId = adapter.createMetric(metricName)
    self.addCleanup(adapter.deleteMetricByName, metricName)

    # Turn on monitoring
    modelSpec = {
      "datasource": "custom",

      "metricSpec": {
        "metric": metricName,
        "userInfo": userInfo
      }
    }

    adapter.monitorMetric(modelSpec)

    with self.engine.connect() as conn:
      metricObj = repository.getMetric(conn,
                                       metricId,
                                       fields=[schema.metric.c.parameters,
                                               schema.metric.c.status,
                                               schema.metric.c.server])

    self.assertEqual(metricObj.status, MetricStatus.PENDING_DATA)
    self.assertEqual(json.loads(metricObj.parameters), modelSpec)

    self._validateModelSpec(json.loads(metricObj.parameters))


  def testMonitorMetricWithEnoughDataForStats(self):
    """ monitorMetric should create a model when there is enough data rows """
    metricName = "test-" + uuid.uuid1().hex

    adapter = datasource_adapter_factory.createCustomDatasourceAdapter()

    g_log.info("Creating htmengine custom metric; name=%s", metricName)
    metricId = adapter.createMetric(metricName)
    self.addCleanup(adapter.deleteMetricByName, metricName)

    # Add enough data to force activation of model
    data = [
      (offset, datetime.datetime.utcnow() + datetime.timedelta(minutes=offset))
      for offset in xrange(
        0,
        scalar_metric_utils.MODEL_CREATION_RECORD_THRESHOLD * 5,
        5)
    ]
    self.assertEqual(len(data),
                     scalar_metric_utils.MODEL_CREATION_RECORD_THRESHOLD)

    with self.engine.connect() as conn:
      repository.addMetricData(conn, metricId, data)

    # Turn on monitoring
    modelSpec = {
      "datasource": "custom",

      "metricSpec": {
        "metric": metricName
      },
    }

    adapter.monitorMetric(modelSpec)

    with self.engine.connect() as conn:
      metricObj = repository.getMetric(conn,
                                       metricId,
                                       fields=[schema.metric.c.status])

    self.assertIn(metricObj.status, (MetricStatus.CREATE_PENDING,
                                     MetricStatus.ACTIVE))

    g_log.info("Waiting for model to become active")
    self.checkModelIsActive(metricId)

    g_log.info("Waiting at least one model result")
    self.checkModelResultsSize(metricId, 1, atLeast=True)


  def testMonitorMetricWithMinMax(self):
    """ Test monitorMetric with user-provided min/max that activates a model """
    metricName = "test-" + uuid.uuid1().hex

    adapter = datasource_adapter_factory.createCustomDatasourceAdapter()

    g_log.info("Creating htmengine custom metric; name=%s", metricName)
    metricId = adapter.createMetric(metricName)
    self.addCleanup(adapter.deleteMetricByName, metricName)

    # Turn on monitoring
    modelSpec = {
      "datasource": "custom",

      "metricSpec": {
        "metric": metricName
      },

      "modelParams": {
        "min": 0,  # optional
        "max": 100  # optional
      }
    }

    adapter.monitorMetric(modelSpec)

    with self.engine.connect() as conn:
      metricObj = repository.getMetric(conn,
                                       metricId,
                                       fields=[schema.metric.c.status,
                                               schema.metric.c.parameters])
    self.assertIn(metricObj.status, (MetricStatus.CREATE_PENDING,
                                     MetricStatus.ACTIVE))
    self.assertEqual(json.loads(metricObj.parameters), modelSpec)

    self._validateModelSpec(json.loads(metricObj.parameters))

    g_log.info("Waiting for model to become active")
    self.checkModelIsActive(metricId)
    self.checkEncoderResolution(metricId, 0, 100)


  @staticmethod
  def _openTestDataFile(filename):
    """ Opens specified test data file in the htmengine integration test data
    dir. """
    basePath = os.path.split(os.path.abspath(__file__))[0]
    dataDirPath = os.path.join(basePath, "../../../data")
    knownDataFilePath = os.path.join(dataDirPath, filename)
    return open(knownDataFilePath, "rb")


  def testMonitorMetricWithCompleteModelParams(self):
    """ Test monitorMetric with complete set of user-provided model parameters
    that activates a model """
    metricName = "test-" + uuid.uuid1().hex

    adapter = datasource_adapter_factory.createCustomDatasourceAdapter()

    g_log.info("Creating htmengine custom metric; name=%s", metricName)
    metricId = adapter.createMetric(metricName)
    self.addCleanup(adapter.deleteMetricByName, metricName)

    fileName = "custom_datasource_adapter_test_model_config.json"
    with self._openTestDataFile(fileName) as modelConfigFile:
      modelConfig = json.load(modelConfigFile)

    # Turn on monitoring
    modelSpec = {
      "datasource": "custom",
      "metricSpec": {
        "metric": metricName
      },
      "completeModelParams": {
        "modelConfig": modelConfig,
        "inferenceArgs": {"predictionSteps": [1], "predictedField": "bar",
                          "inputPredictedField": "auto"},
        "timestampFieldName": "foo",
        "valueFieldName": "bar"
      }
    }

    adapter.monitorMetric(modelSpec)

    with self.engine.connect() as conn:
      metricObj = repository.getMetric(conn,
                                       metricId,
                                       fields=[schema.metric.c.status,
                                               schema.metric.c.parameters])

    self._validateModelSpec(json.loads(metricObj.parameters))

    self.assertIn(metricObj.status, (MetricStatus.CREATE_PENDING,
                                     MetricStatus.ACTIVE))
    self.assertEqual(json.loads(metricObj.parameters), modelSpec)

    g_log.info("Waiting for model to become active")
    self.checkModelIsActive(metricId)


  def testMonitorMetricModelParamsAndCompleteModelParams(self):
    """ Test monitorMetric() raises ValueError for mutually exclusive model
     params input options. """
    metricName = "test-" + uuid.uuid1().hex

    adapter = datasource_adapter_factory.createCustomDatasourceAdapter()

    fileName = "custom_datasource_adapter_test_model_config.json"
    with self._openTestDataFile(fileName) as modelConfigFile:
      modelConfig = json.load(modelConfigFile)

    modelSpec = {
      "datasource": "custom",
      "metricSpec": {
        "metric": metricName
      },
      "completeModelParams": {
        "modelConfig": modelConfig,
        "inferenceArgs": {"predictionSteps": [1], "predictedField": "bar",
                          "inputPredictedField": "auto"},
        "timestampFieldName": "foo",
        "valueFieldName": "bar"
      },
      "modelParams": {
        "min": 0,
        "max": 100
      }
    }

    with self.assertRaises(ValueError) as excCtx:
      adapter.monitorMetric(modelSpec)

    excArgZero = excCtx.exception.args[0]
    initialMsg = excArgZero[0: len(
      scalar_metric_utils._MUTEX_MODEL_SPEC_MSG)]
    self.assertEqual(initialMsg,
                     scalar_metric_utils._MUTEX_MODEL_SPEC_MSG)


  def testMonitorMetricCompleteModelParamsNoValueFieldName(self):
    """ Test monitorMetric() raises ValueError with completeModelParams but
    not valueFieldName. """
    metricName = "test-" + uuid.uuid1().hex

    adapter = datasource_adapter_factory.createCustomDatasourceAdapter()

    fileName = "custom_datasource_adapter_test_model_config.json"
    with self._openTestDataFile(fileName) as modelConfigFile:
      modelConfig = json.load(modelConfigFile)

    modelSpec = {
      "datasource": "custom",
      "metricSpec": {
        "metric": metricName
      },
      "completeModelParams": {
        "modelConfig": modelConfig,
        "inferenceArgs": {"predictionSteps": [1], "predictedField": "bachman",
                          "inputPredictedField": "auto"},
        "timestampFieldName": "erlich"
      }
    }

    with self.assertRaises(ValueError) as excCtx:
      adapter.monitorMetric(modelSpec)

    excArgZero = excCtx.exception.args[0]
    initialMsg = excArgZero[0: len(
      scalar_metric_utils._NO_VALUE_FIELD_NAME_MSG)]
    self.assertEqual(initialMsg,
                     scalar_metric_utils._NO_VALUE_FIELD_NAME_MSG)


  def testMonitorMetricCompleteModelParamsNoTimestampFieldName(self):
    """ Test monitorMetric() raises ValueError with completeModelParams but
    not timestampFieldName. """
    metricName = "test-" + uuid.uuid1().hex

    adapter = datasource_adapter_factory.createCustomDatasourceAdapter()

    fileName = "custom_datasource_adapter_test_model_config.json"
    with self._openTestDataFile(fileName) as modelConfigFile:
      modelConfig = json.load(modelConfigFile)

    modelSpec = {
      "datasource": "custom",
      "metricSpec": {
        "metric": metricName
      },
      "completeModelParams": {
        "modelConfig": modelConfig,
        "inferenceArgs": {"predictionSteps": [1], "predictedField": "snow",
                          "inputPredictedField": "auto"},
        "valueFieldName": "snow"
      }
    }

    with self.assertRaises(ValueError) as excCtx:
      adapter.monitorMetric(modelSpec)

    excArgZero = excCtx.exception.args[0]
    initialMsg = excArgZero[0: len(
      scalar_metric_utils._NO_TIMESTAMP_FIELD_NAME_MSG)]
    self.assertEqual(initialMsg,
                     scalar_metric_utils._NO_TIMESTAMP_FIELD_NAME_MSG)


  def testMonitorMetricCompleteModelParamsNoInferenceArgs(self):
    """ Test monitorMetric() raises ValueError with completeModelParams but
    not inferenceArgs. """
    metricName = "test-" + uuid.uuid1().hex

    adapter = datasource_adapter_factory.createCustomDatasourceAdapter()

    fileName = "custom_datasource_adapter_test_model_config.json"
    with self._openTestDataFile(fileName) as modelConfigFile:
      modelConfig = json.load(modelConfigFile)

    modelSpec = {
      "datasource": "custom",
      "metricSpec": {
        "metric": metricName
      },
      "completeModelParams": {
        "modelConfig": modelConfig,
        "timestampFieldName": "jon",
        "valueFieldName": "snow"
      }
    }

    with self.assertRaises(ValueError) as excCtx:
      adapter.monitorMetric(modelSpec)

    excArgZero = excCtx.exception.args[0]
    initialMsg = excArgZero[0: len(
      scalar_metric_utils._NO_INFERENCE_ARGS_MSG)]
    self.assertEqual(initialMsg,
                     scalar_metric_utils._NO_INFERENCE_ARGS_MSG)


  def testMonitorMetricNameMismatch(self):
    """ Test monitorMetric() raises ValueError when inferenceArgs-predictedField
    doesn't match valueFieldName. """
    metricName = "test-" + uuid.uuid1().hex

    adapter = datasource_adapter_factory.createCustomDatasourceAdapter()

    fileName = "custom_datasource_adapter_test_model_config.json"
    with self._openTestDataFile(fileName) as modelConfigFile:
      modelConfig = json.load(modelConfigFile)

    modelSpec = {
      "datasource": "custom",
      "metricSpec": {
        "metric": metricName
      },
      "completeModelParams": {
        "modelConfig": modelConfig,
        "inferenceArgs": {"predictionSteps": [1], "predictedField": "baz",
                          "inputPredictedField": "auto"},
        "timestampFieldName": "snorf",
        "valueFieldName": "bar"
      }
    }

    with self.assertRaises(ValueError) as excCtx:
      adapter.monitorMetric(modelSpec)

    excArgZero = excCtx.exception.args[0]
    initialMsg = excArgZero[0: len(
      scalar_metric_utils._INCONSISTENT_PREDICTED_FIELD_NAME_MSG)]
    self.assertEqual(initialMsg,
                     scalar_metric_utils._INCONSISTENT_PREDICTED_FIELD_NAME_MSG)


  def testMonitorMetricWithMinResolution(self):
    """
    Test monitorMetric with user-provided min/max and minResolution
    that activates a model.
    Make sure resolution doesn't drop below minResolution.
    """
    metricName = "test-" + uuid.uuid1().hex

    adapter = datasource_adapter_factory.createCustomDatasourceAdapter()

    g_log.info("Creating htmengine custom metric; name=%s", metricName)
    metricId = adapter.createMetric(metricName)
    self.addCleanup(adapter.deleteMetricByName, metricName)

    # Turn on monitoring
    modelSpec = {
      "datasource": "custom",

      "metricSpec": {
        "metric": metricName
      },

      "modelParams": {
        "min": 0,  # optional
        "max": 1,  # optional
        "minResolution": 0.5 # optional
      }
    }

    adapter.monitorMetric(modelSpec)

    with self.engine.connect() as conn:
      metricObj = repository.getMetric(conn,
                                       metricId,
                                       fields=[schema.metric.c.status,
                                               schema.metric.c.parameters])
    self.assertIn(metricObj.status, (MetricStatus.CREATE_PENDING,
                                     MetricStatus.ACTIVE))
    self.assertEqual(json.loads(metricObj.parameters), modelSpec)
    #print metricObj.parameters

    self._validateModelSpec(json.loads(metricObj.parameters))

    g_log.info("Waiting for model to become active")
    self.checkModelIsActive(metricId)
    self.checkEncoderResolution(metricId, 0, 1, minResolution=0.5)


  def testMonitorMetricThatIsAlreadyMonitored(self):
    """ monitorMetric should raise if already monitored """
    metricName = "test-" + uuid.uuid1().hex

    adapter = datasource_adapter_factory.createCustomDatasourceAdapter()

    g_log.info("Creating htmengine custom metric; name=%s", metricName)
    adapter.createMetric(metricName)
    self.addCleanup(adapter.deleteMetricByName, metricName)

    # Turn on monitoring
    modelSpec = {
      "datasource": "custom",

      "metricSpec": {
        "metric": metricName
      }
    }

    modelId = adapter.monitorMetric(modelSpec)

    with self.assertRaises(app_exceptions.MetricAlreadyMonitored) as cm:
      adapter.monitorMetric(modelSpec)

    self.assertEqual(cm.exception.uid, modelId)


  def testActivateModel(self):
    """ Test activateModel """
    metricName = "test-" + uuid.uuid1().hex

    adapter = datasource_adapter_factory.createCustomDatasourceAdapter()

    g_log.info("Creating htmengine custom metric; name=%s", metricName)
    metricId = adapter.createMetric(metricName)
    self.addCleanup(adapter.deleteMetricByName, metricName)

    # Turn on monitoring
    modelSpec = {
      "datasource": "custom",

      "metricSpec": {
        "metric": metricName
      },
    }

    adapter.monitorMetric(modelSpec)

    with self.engine.connect() as conn:
      metricObj = repository.getMetric(conn,
                                       metricId,
                                       fields=[schema.metric.c.status])
    self.assertEqual(metricObj.status, MetricStatus.PENDING_DATA)

    # Add some data
    data = [
      (0, datetime.datetime.utcnow() - datetime.timedelta(minutes=5)),
      (100, datetime.datetime.utcnow())
    ]
    with self.engine.connect() as conn:
      repository.addMetricData(conn, metricId, data)

    # Activate model
    adapter.activateModel(metricId)

    with self.engine.connect() as conn:
      metricObj = repository.getMetric(conn,
                                       metricId,
                                       fields=[schema.metric.c.status])
    self.assertIn(metricObj.status, (MetricStatus.CREATE_PENDING,
                                     MetricStatus.ACTIVE))

    g_log.info("Waiting for model to become active")
    self.checkModelIsActive(metricId)

    g_log.info("Waiting at least one model result")
    self.checkModelResultsSize(metricId, 1, atLeast=True)


  def testUnmonitorMetricPendingData(self):
    """ Test unmonitorMetric on metric in PENDING_DATA state """
    metricName = "test-" + uuid.uuid1().hex

    adapter = datasource_adapter_factory.createCustomDatasourceAdapter()

    g_log.info("Creating htmengine custom metric; name=%s", metricName)
    metricId = adapter.createMetric(metricName)
    self.addCleanup(adapter.deleteMetricByName, metricName)

    # Turn on monitoring
    modelSpec = {
      "datasource": "custom",

      "metricSpec": {
        "metric": metricName
      }
    }

    adapter.monitorMetric(modelSpec)

    with self.engine.connect() as conn:
      metricObj = repository.getMetric(conn,
                                       metricId,
                                       fields=[schema.metric.c.parameters,
                                               schema.metric.c.status])
    self.assertEqual(metricObj.status, MetricStatus.PENDING_DATA)
    self.assertEqual(json.loads(metricObj.parameters), modelSpec)

    self._validateModelSpec(json.loads(metricObj.parameters))

    # Turn off monitoring
    adapter.unmonitorMetric(metricId)

    self.checkMetricUnmonitoredById(metricId)


  def testUnmonitorMetricWithModel(self):
    """ Test unmonitorMetric on metric with active model """
    metricName = "test-" + uuid.uuid1().hex

    adapter = datasource_adapter_factory.createCustomDatasourceAdapter()

    g_log.info("Creating htmengine custom metric: name=%s", metricName)
    metricId = adapter.createMetric(metricName)
    self.addCleanup(adapter.deleteMetricByName, metricName)

    # Turn on monitoring
    modelSpec = {
      "datasource": "custom",

      "metricSpec": {
        "metric": metricName
      },

      "modelParams": {
        "min": 0,  # optional
        "max": 100  # optional
      }
    }

    adapter.monitorMetric(modelSpec)

    g_log.info("Waiting for model to become active")
    self.checkModelIsActive(metricId)

    # Turn off monitoring
    g_log.info("Unmonitoring htmengine custom metric with active model: "
               "name=%s",
               metricName)
    adapter.unmonitorMetric(metricId)
    self.checkMetricUnmonitoredById(metricId)


  def testExportImport(self):
    metricName = "test-" + uuid.uuid1().hex

    adapter = datasource_adapter_factory.createCustomDatasourceAdapter()

    g_log.info("Creating htmengine custom metric; name=%s", metricName)
    metricId = adapter.createMetric(metricName)
    self.addCleanup(adapter.deleteMetricByName, metricName)

    # Add some data
    # NOTE: we discard the fractional part because it gets eliminated
    # in the database, and we will want to compare against retrieved
    # items later.
    now = datetime.datetime.utcnow().replace(microsecond=0)
    data = [
      (0, now - datetime.timedelta(minutes=5)),
      (100, now)
    ]

    with self.engine.connect() as conn:
      repository.addMetricData(conn, metricId, data)

    # Turn on monitoring
    modelSpec = {
      "datasource": "custom",

      "metricSpec": {
        "metric": metricName
      },
    }

    adapter.monitorMetric(modelSpec)

    def checkExportSpec(exportSpec):
      self.assertEqual(exportSpec["datasource"], modelSpec["datasource"])
      self.assertEqual(exportSpec["metricSpec"], modelSpec["metricSpec"])
      self.assertSequenceEqual(exportSpec["data"], data)

    # Export
    exportSpec = adapter.exportModel(metricId)
    checkExportSpec(exportSpec)

    # Delete metric
    adapter.deleteMetricByName(metricName)
    self.checkModelDeleted(metricId)

    # Import
    metricId = adapter.importModel(
      htmengine.utils.jsonDecode(htmengine.utils.jsonEncode(exportSpec)))

    with self.engine.connect() as conn:
      metricObj = repository.getMetric(conn,
                                       metricId,
                                       fields=[schema.metric.c.parameters,
                                               schema.metric.c.status])
    self.assertEqual(metricObj.status, MetricStatus.PENDING_DATA)
    self.assertEqual(json.loads(metricObj.parameters), modelSpec)

    self._validateModelSpec(json.loads(metricObj.parameters))

    # Export again
    exportSpec = adapter.exportModel(metricId)
    checkExportSpec(exportSpec)


  def testExportImportCompleteModelParams(self):
    metricName = "test-" + uuid.uuid1().hex

    adapter = datasource_adapter_factory.createCustomDatasourceAdapter()

    g_log.info("Creating htmengine custom metric; name=%s", metricName)
    metricId = adapter.createMetric(metricName)
    self.addCleanup(adapter.deleteMetricByName, metricName)

    # Add some data
    # NOTE: we discard the fractional part because it gets eliminated
    # in the database, and we will want to compare against retrieved
    # items later.
    now = datetime.datetime.utcnow().replace(microsecond=0)
    data = [
      (0, now - datetime.timedelta(minutes=5)),
      (100, now)
    ]

    with self.engine.connect() as conn:
      repository.addMetricData(conn, metricId, data)

    fileName = "custom_datasource_adapter_test_model_config.json"
    with self._openTestDataFile(fileName) as modelConfigFile:
      modelConfig = json.load(modelConfigFile)

    # Turn on monitoring
    modelSpec = {
      "datasource": "custom",
      "metricSpec": {
        "metric": metricName
      },
      "completeModelParams": {
        "modelConfig": modelConfig,
        "inferenceArgs": {"predictionSteps": [1], "predictedField": "bar",
                          "inputPredictedField": "auto"},
        "timestampFieldName": "foo",
        "valueFieldName": "bar"
      }
    }

    adapter.monitorMetric(modelSpec)

    def checkExportSpec(exportSpec):
      self.assertEqual(exportSpec["datasource"], modelSpec["datasource"])
      self.assertEqual(exportSpec["metricSpec"], modelSpec["metricSpec"])
      self.assertSequenceEqual(exportSpec["data"], data)

    # Export
    exportSpec = adapter.exportModel(metricId)
    checkExportSpec(exportSpec)

    # Delete metric
    adapter.deleteMetricByName(metricName)
    self.checkModelDeleted(metricId)

    # Import
    metricId = adapter.importModel(
      htmengine.utils.jsonDecode(htmengine.utils.jsonEncode(exportSpec)))

    with self.engine.connect() as conn:
      metricObj = repository.getMetric(conn,
                                       metricId,
                                       fields=[schema.metric.c.parameters,
                                               schema.metric.c.status])
    self.assertIn(metricObj.status, (MetricStatus.CREATE_PENDING,
                                     MetricStatus.ACTIVE))
    self.assertEqual(json.loads(metricObj.parameters), modelSpec)

    self._validateModelSpec(json.loads(metricObj.parameters))

    # Export again
    exportSpec = adapter.exportModel(metricId)
    checkExportSpec(exportSpec)



if __name__ == "__main__":
  unittest.main()
