#!/bin/bash
# ----------------------------------------------------------------------
# Numenta Platform for Intelligent Computing (NuPIC)
# Copyright (C) 2016, Numenta, Inc.  Unless you have purchased from
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
#

# Be extra verbose and sensitive to failures
set -o errexit
set -o pipefail
set -o verbose
set -o xtrace
set -o nounset

# Set collectorsdb MySQL credentials
taurus-set-collectorsdb-login \
  --host=${MYSQL_HOST} \
  --user=${MYSQL_USER} \
  --password=${MYSQL_PASSWD}

# Set rabbitmq credentials
taurus-collectors-set-rabbitmq \
  --host=${RABBITMQ_HOST} \
  --user=${RABBITMQ_USER} \
  --password=${RABBITMQ_PASSWD}

if [ "${OBLITERATE_DATABASE}" == "YES.  Delete everything." ]
then
  # Initialize database
  taurus-reset-collectorsdb \
    --suppress-prompt-and-obliterate-database
fi

# Run database migrations
pushd /opt/numenta/taurus_metric_collectors/taurus_metric_collectors/collectorsdb
python migrate.py
popd
