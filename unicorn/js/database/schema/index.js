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

import DBFileSchema from './File.json';
import DBMetricDataSchema from './MetricData.json';
import DBMetricSchema from './Metric.json';
import DBModelDataSchema from './ModelData.json';
import DBModelSchema from './Model.json';

import MRAggregationSchema from '../../../py/unicorn_backend/agg_opt_schema.json';
import MRInputSchema from '../../../py/unicorn_backend/input_opt_schema.json';
import MRModelSchema from '../../../py/unicorn_backend/model_opt_schema.json';

import PFInputSchema from '../../../py/unicorn_backend/input_opt_schema_param_finder.json';
import PFOutputSchema from '../../../py/unicorn_backend/param_finder_output_schema.json';


/**
 * Module containing all JSON schemas used by Unicorn.
 *
 * - Database Schemas
 * 	- DBFileSchema: Represents `File` in the database
 * 	- DBMetricDataSchema: Represents 'MetricData' in the database
 * 	- DBMetricSchema: Represents `Metric` in the database
 * 	- DBModelDataSchema: Represents 'ModelData' in the database
 * 	- DBModelSchema: Represents 'Model' in the database
 *
 * - Model Runner Schemas
 * 	- MRAggOptSchema: `--agg` command-line option object passed to ModelRunner; describes the aggregation
 * 	- MRInputOptSchema: `--input` command-line option object passed to ModelRunner
 * 	- MRModelOptSchema: `--model` command-line option object passed to ModelRunner
 *
 * - Param Finder Schemas:
 * 	- PFInputSchema: param_finder input argument option
 * 	- PFOutputSchema: param_finder output results
 */
export {
  DBFileSchema,
  DBMetricDataSchema,
  DBMetricSchema,
  DBModelDataSchema,
  DBModelSchema,

  MRAggregationSchema,
  MRInputSchema,
  MRModelSchema,

  PFInputSchema,
  PFOutputSchema
};
