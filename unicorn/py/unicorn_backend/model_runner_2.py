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

"""
Implements Unicorn's ModelRunner interface, Phase-2 specification.

Date format resources:

* http://www.uai.cl/images/sitio/biblioteca/citas/ISO_8601_2004en.pdf

* NOTE: dateutil parser doesn't support decimal comma yet (in master, but not
released)

* https://www.ietf.org/rfc/rfc3339.txt

"""
from argparse import ArgumentParser
import csv
import json
import logging
import os
import pkg_resources
import sys
import traceback

import validictory

from nupic.algorithms.anomaly_likelihood import AnomalyLikelihood
from nupic.data import aggregator
from nupic.data import fieldmeta
from nupic.data import record_stream
from nupic.frameworks.opf.modelfactory import ModelFactory

from unicorn_backend.utils import date_time_utils
from unicorn_backend.utils import na


g_log = logging.getLogger(__name__)



class _CommandLineArgError(Exception):
  """ Error parsing command-line options """
  pass



class _Options(object):
  """Options returned by _parseArgs"""


  def __init__(self, inputSpec, aggSpec, modelSpec):
    """
    :param dict inputSpec: Input data specification per input_opt_schema.json
    :param dict aggSpec: Optional aggregation specification per
      agg_otp_schema.json or None if no aggregation is requested
    :param dict modelSpec: Model specification per model_opt_schema.json
    """
    self.inputSpec = inputSpec
    self.aggSpec = aggSpec
    self.modelSpec = modelSpec


def _parseArgs():
  """ Parse command-line args

  :rtype: _Options object
  :raises _CommandLineArgError: on command-line arg error
  """
  class SilentArgumentParser(ArgumentParser):
    def error(self, msg):
      """Override `error()` to prevent unstructured output to stderr"""
      raise _CommandLineArgError(msg)

  parser = SilentArgumentParser(description=("Start Unicorn ModelRunner that "
                                             "runs a single model."))

  parser.add_argument(
    "--input",
    type=str,
    dest="inputSpec",
    required=True,
    help=("REQUIRED: JSON object describing the input metric data per "
          "input_opt_schema.json"))

  parser.add_argument(
    "--agg",
    type=str,
    dest="aggSpec",
    required=False,
    default=None,
    help=("OPTIONAL: JSON object describing aggregation of the input metric "
          "data per agg_opt_schema.json; if omitted, aggregation of input data "
          "will be bypassed."))

  parser.add_argument(
    "--model",
    type=str,
    dest="modelSpec",
    required=True,
    help=("REQUIRED: JSON object describing the model per "
          "model_opt_schema.json."))

  options = parser.parse_args()


  # Input spec is required
  try:
    inputSpec = json.loads(options.inputSpec)
  except ValueError as exc:
    g_log.exception("JSON parsing of --input value failed")
    parser.error("--input option value failed JSON parsing: {}".format(exc))

  with pkg_resources.resource_stream(__name__,
                                     "input_opt_schema.json") as schemaFile:
    try:
      validictory.validate(inputSpec, json.load(schemaFile))
    except validictory.ValidationError as exc:
      g_log.exception("JSON schema validation of --input value failed")
      parser.error("JSON schema validation of --input value failed: {}"
                   .format(exc))


  # Aggregation spec is optional
  aggSpec = options.aggSpec
  if aggSpec is not None:
    try:
      aggSpec = json.loads(aggSpec)
    except ValueError as exc:
      g_log.exception("JSON parsing of --agg value failed")
      parser.error("--agg option value failed JSON parsing: {}".format(exc))

    with pkg_resources.resource_stream(__name__,
                                       "agg_opt_schema.json") as schemaFile:
      try:
        validictory.validate(aggSpec, json.load(schemaFile))
      except validictory.ValidationError as exc:
        g_log.exception("JSON schema validation of --agg value failed")
        parser.error("JSON schema validation of --agg value failed: {}"
                     .format(exc))


  # Model spec is required
  try:
    modelSpec = json.loads(options.modelSpec)
  except ValueError as exc:
    g_log.exception("JSON parsing of modelSpec failed")
    parser.error("--model option value failed JSON parsing: %r" % (exc,))

  with pkg_resources.resource_stream(__name__,
                                     "model_opt_schema.json") as schemaFile:
    try:
      validictory.validate(modelSpec, json.load(schemaFile))
    except validictory.ValidationError as exc:
      g_log.exception("JSON schema validation of --model value failed")
      parser.error("JSON schema validation of --model value failed: {}"
                   .format(exc))


  return _Options(inputSpec=inputSpec, aggSpec=aggSpec, modelSpec=modelSpec)



class _ModelRunner(object):
  """ Use OPF Model to process metric data samples from stdin and and emit
  anomaly likelihood results to stdout
  """


  def __init__(self, inputFileObj, inputSpec, aggSpec, modelSpec):
    """
    :param inputFileObj: A file-like object that contains input metric data
    :param dict inputSpec: Input data specification per input_opt_schema.json
    :param dict aggSpec: Optional aggregation specification per
      agg_opt_schema.json or None if no aggregation is requested
    :param dict modelSpec: Model specification per model_opt_schema.json
    """
    self._inputSpec = inputSpec

    self._aggSpec = aggSpec

    self._modelSpec = modelSpec

    if "modelId" in modelSpec:
      self._modelId = modelSpec["modelId"]
    else:
      self._modelId = "Unknown"


    inputRecordSchema = (
      fieldmeta.FieldMetaInfo(modelSpec["timestampFieldName"],
                              fieldmeta.FieldMetaType.datetime,
                              fieldmeta.FieldMetaSpecial.timestamp),
      fieldmeta.FieldMetaInfo(modelSpec["valueFieldName"],
                              fieldmeta.FieldMetaType.float,
                              fieldmeta.FieldMetaSpecial.none),
    )

    self._aggregator = aggregator.Aggregator(
      aggregationInfo=dict(
        fields=([(modelSpec["valueFieldName"], aggSpec["func"])]
                if aggSpec is not None else []),
        seconds=aggSpec["windowSize"] if aggSpec is not None else 0
      ),
      inputFields=inputRecordSchema)

    self._modelRecordEncoder = record_stream.ModelRecordEncoder(
      fields=inputRecordSchema)

    self._model = self._createModel(modelSpec=modelSpec)

    self._anomalyLikelihood = AnomalyLikelihood()

    self._csvReader = self._createCsvReader(inputFileObj)


  @staticmethod
  def _createModel(modelSpec):
    """Instantiate and configure an OPF model

    :param dict modelSpec: Model specification per model_opt_schema.json

    :returns: OPF Model instance
    """

    model = ModelFactory.create(modelConfig=modelSpec["modelConfig"])
    model.enableLearning()
    model.enableInference(modelSpec["inferenceArgs"])

    return model


  @staticmethod
  def _createCsvReader(fileObj):
    # We'll be operating on csvs with arbitrarily long fields
    csv.field_size_limit(2**27)

    # Make sure readline() works on windows too
    os.linesep = "\n"

    return csv.reader(fileObj, dialect="excel")


  @classmethod
  def _emitOutputMessage(cls, dataRow, anomalyProbability):
    """Emit output message to stdout

    :param list dataRow: the two-tuple data row on which anomalyProbability was
      computed, whose first element is datetime timestamp and second element is
      the float scalar value
    :param float anomalyProbability: computed anomaly probability value
    """

    message = "%s\n" % (json.dumps([dataRow[0].isoformat(),
                                    dataRow[1],
                                    anomalyProbability]),)

    sys.stdout.write(message)
    sys.stdout.flush()


  def _computeAnomalyProbability(self, fields):
    """ Compute anomaly log likelihood score

    :param tuple fields: Two-tuple input metric data row
      (<datetime-timestamp>, <float-scalar>)

    :returns: Log-scaled anomaly probability
    :rtype: float
    """
    # Generate raw anomaly score
    inputRecord = self._modelRecordEncoder.encode(fields)
    rawAnomalyScore = self._model.run(inputRecord).inferences["anomalyScore"]

    # Generate anomaly likelihood score
    anomalyProbability = self._anomalyLikelihood.anomalyProbability(
      value=fields[1],
      anomalyScore=rawAnomalyScore,
      timestamp=fields[0])

    return self._anomalyLikelihood.computeLogLikelihood(anomalyProbability)


  def run(self):
    """ Run the model: ingest and process the input metric data and emit output
    messages containing anomaly scores
    """

    numRowsToSkip = self._inputSpec["rowOffset"]
    datetimeFormat = self._inputSpec["datetimeFormat"]
    inputRowTimestampIndex = self._inputSpec["timestampIndex"]
    inputRowValueIndex = self._inputSpec["valueIndex"]

    g_log.info("Processing model=%s", self._modelId)

    for inputRow in self._csvReader:
      g_log.debug("Got inputRow=%r", inputRow)

      if numRowsToSkip > 0:
        numRowsToSkip -= 1
        g_log.debug("Skipping header row %s; %s rows left to skip",
                    inputRow, numRowsToSkip)
        continue
      
      if len(inputRow) > inputRowValueIndex:
        if not (na.isNA(str(inputRow[inputRowValueIndex])) or
         na.isNA(str(inputRow[inputRowTimestampIndex]))):
          # Extract timestamp and value
          # NOTE: the order must match the `inputFields` that we passed to the
          # Aggregator constructor
  
          fields = [
            date_time_utils.parseDatetime(inputRow[inputRowTimestampIndex],
                                          datetimeFormat),
            float(inputRow[inputRowValueIndex])
          ]
  
          # Aggregate
          aggRow, _ = self._aggregator.next(fields, None)
          g_log.debug("Aggregator returned %s for %s", aggRow, fields)
          if aggRow is not None:
            self._emitOutputMessage(
              dataRow=aggRow,
              anomalyProbability=self._computeAnomalyProbability(aggRow))


    # Reap remaining data from aggregator
    aggRow, _ = self._aggregator.next(None, curInputBookmark=None)
    g_log.debug("Aggregator reaped %s in final call", aggRow)
    if aggRow is not None:
      self._emitOutputMessage(
        dataRow=aggRow,
        anomalyProbability=self._computeAnomalyProbability(aggRow))



class _UnbufferedLineIterInputFile(object):
  """Enable unbuffered line iteration from a file.

  This wrapper class enables line-level iteration over a file without waiting
  for a "hidden" buffer in file I/O to be filled, thus facilitating full-duplex
  operation. Example usage:

  for line in _UnbufferedLineIterInputFile(sys.stdin):
    print line

  Without this helper class, `for line in sys.stdin: print line` blocks to fill
  a hiden buffer in file I/O before returning any lines
  """


  def __init__(self, fileObj):
    self.fileObj = fileObj


  def __iter__(self):
    return self


  def next(self):
    line = self.fileObj.readline()
    if not line:
      raise StopIteration

    return line


  def __getattr__(self, attr):
    return getattr(self.fileObj, attr)



def main():
  # Use NullHandler for now to avoid getting the unwanted unformatted warning
  # message from logger on stderr "No handlers could be found for logger".
  #
  # NOTE We add the handler to the root logger to avoid having the default
  # StreamHandler implictly added by python logging when something logs via
  # `logging.debug`, `logging.info`, etc.
  g_log.root.addHandler(logging.NullHandler())
  inputFileObj = None
  try:
    options = _parseArgs()

    # Create an input file object with the desired properties
    if "csv" in options.inputSpec:
      inputFileObj = open(options.inputSpec["csv"], mode="rU")
    else:
      inputFileObj = os.fdopen(os.dup(sys.stdin.fileno()), "rU")

    # Invoke the model runner
    _ModelRunner(
      inputFileObj=inputFileObj,
      inputSpec=options.inputSpec,
      aggSpec=options.aggSpec,
      modelSpec=options.modelSpec).run()
  except Exception as ex:  # pylint: disable=W0703
    g_log.exception("ModelRunner failed")

    errorMessage = json.dumps({
      "errorText": str(ex) or repr(ex),
      "diagnosticInfo": traceback.format_exc()
    })

    errorMessage = "{}\n".format(errorMessage)

    try:
      sys.stderr.write(errorMessage)
      sys.stderr.flush()
    except Exception:  # pylint: disable=W0703
      g_log.exception("Failed to emit error message to stderr; msg=%s",
                      errorMessage)

    # Use os._exit to abort the process instead of an exception to prevent
    # the python runtime from dumping traceback to stderr (since we dump a json
    # message to stderr, and don't want the extra text to interfere with parsing
    # in the Front End)
    os._exit(1)  # pylint: disable=W0212
  finally:
    if inputFileObj is not None:
      inputFileObj.close()



if __name__ == "__main__":
  main()
