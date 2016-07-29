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

mkdir -p logs
mkdir -p conf/ssl/

if [ ! -f "conf/ssl/localhost.crt" ]; then
  subj=`echo "
  C=US
  ST=CA
  O=${SSL_ORG_NAME}
  localityName=${SSL_LOCALITY}
  commonName=${SSL_DOMAIN_NAME}
  organizationalUnitName=${SSL_ORGANIZATIONAL_UNIT_NAME}
  emailAddress=${SSL_EMAIL_ADDRESS}
  " | sed -e 's/^[ \t]*//'`

  PASSWD=`openssl passwd $RANDOM`

  # Generate the server private key
  openssl genrsa \
    -des3 \
    -out conf/ssl/localhost.key \
    -passout pass:${PASSWD} \
    1024

  # Generate the CSR
  openssl req \
      -new \
      -batch \
      -subj "$(echo -n "${subj}" | tr "\n" "/")" \
      -key conf/ssl/localhost.key \
      -out conf/ssl/localhost.csr \
      -passin pass:${PASSWD}
  cp \
    conf/ssl/localhost.key \
    conf/ssl/localhost.key.bak

  # Strip the password so we don't have to type it every time we restart nginx
  openssl rsa \
    -in conf/ssl/localhost.key.bak \
    -out conf/ssl/localhost.key \
    -passin pass:${PASSWD}

  # Generate the cert (good for 1 year)
  openssl x509 \
    -req \
    -days 365 \
    -in conf/ssl/localhost.csr \
    -signkey conf/ssl/localhost.key \
    -out conf/ssl/localhost.crt
fi

taurus-set-rabbitmq \
  --host=${RABBITMQ_HOST} \
  --user=${RABBITMQ_USER} \
  --password=${RABBITMQ_PASSWD}

taurus-set-sql-login \
  --host=${MYSQL_HOST} \
  --user=${MYSQL_USER} \
  --password=${MYSQL_PASSWD}

if [ "${OBLITERATE_DATABASE}" == "YES.  Delete everything." ]
then
  # Initialize database
  taurus-create-db \
    --suppress-prompt-and-continue-with-deletion
fi

# Set dynamodb credentials
taurus-set-dynamodb \
  --host=${DYNAMODB_HOST} \
  --port=${DYNAMODB_PORT} \
  --table-suffix=${DYNAMODB_TABLE_SUFFIX} \
  ${DYNAMODB_EXTRAS} &&

# Set Taurus API key
taurus-set-api-key --apikey=${TAURUS_API_KEY}

# Run database migrations
pushd taurus_engine/repository
python migrate.py
popd
