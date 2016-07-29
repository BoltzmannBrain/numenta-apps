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

""" Common SQLAlchemy table definitions for monitoring scripts. """

from sqlalchemy import (BINARY,
                        BOOLEAN,
                        Column,
                        DATETIME,
                        func,
                        Index,
                        INTEGER,
                        MetaData,
                        PrimaryKeyConstraint,
                        String,
                        Table,
                        Text)

from sqlalchemy.dialects import mysql


_MAX_MONITOR_ISSUES_ID_LEN = 40
MYSQL_CHARSET = "utf8"
MYSQL_COLLATE = MYSQL_CHARSET + "_unicode_ci"



metadata = MetaData()



def _createMonitorErrorFlagsSchema(schemaName, metadata):
  schema = Table(
    schemaName,
    metadata,

    # Issue UID
    Column("uid",
           mysql.VARCHAR(length=_MAX_MONITOR_ISSUES_ID_LEN),
           primary_key=True,
           nullable=False),

    PrimaryKeyConstraint("uid",
                         name=schemaName + "_pk"),

    # Issue name
    Column("name",
           mysql.VARCHAR(length=_MAX_MONITOR_ISSUES_ID_LEN),
           nullable=False),

    # Should report issue flag
    Column("should_report",
           BOOLEAN(),
           nullable=False),

    # Datetime of last issue occurrence
    Column("last_occurrence",
           DATETIME(),
           nullable=False,
           server_default=func.current_timestamp()),

    # Count of issue occurrences
    Column("occurrence_count",
           INTEGER,
           nullable=True,
           autoincrement=True),

    mysql_CHARSET=MYSQL_CHARSET,
    mysql_COLLATE=MYSQL_COLLATE,
  )
  return schema



# Error flag schema for Taurus models monitor
modelsMonitorErrorFlags = _createMonitorErrorFlagsSchema(
  "models_monitor_error_flags", metadata)



# Error flag schema for Taurus metric-order monitor
metricOrderMonitorErrorFlags = _createMonitorErrorFlagsSchema(
  "metric_order_monitor_error_flags", metadata)


# See monitor_dispatcher.py for use-case and coordinate any changes there
monitorDispatcherTable = Table("monitor_dispatcher",
                               metadata,
                               Column("checkFn",
                                      String(length=80),
                                      nullable=False,
                                      primary_key=True),
                               Column("excType",
                                      String(length=80),
                                      nullable=False,
                                      primary_key=True),
                               Column("excValueDigest",
                                      BINARY(length=20),
                                      primary_key=True),
                               Column("timestamp",
                                      DATETIME,
                                      nullable=False),
                               Column("excValue",
                                      Text()),
                               Index("timestamp_index",
                                     "timestamp"))



