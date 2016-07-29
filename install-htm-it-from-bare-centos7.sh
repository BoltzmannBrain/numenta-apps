#!/usr/bin/env bash
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


# ----------------------------------------------------------------------
#
# README
#
# ----------------------------------------------------------------------
# This is a convenience script to install HTM-IT onto a bare Centos 7 machine.
#
# It was tested against a Centos 7 instance in AWS on 9 July 2015:
#   AWS Marketplace: https://aws.amazon.com/marketplace/pp/B00O7WM7QW
#   AMI ID: ami-c7d092f7 in us-west-2
#
# To run this:
#
# 1. Launch a Centos 7 AMI or VM
# 2. scp /path/to/install-htm-it-from-bare-centos7.sh centos@<server_ip>:~
# 3. ssh centos@<server_ip>
# 4. chmod +x install-htm-it-from-bare-centos7.sh
# 5. ./install-htm-it-from-bare-centos7.sh
#
# ----------------------------------------------------------------------

set -o errexit
set -o pipefail

# Install base centos packages
sudo yum install gcc gcc-c++ -y
sudo rpm -iUvh http://dl.fedoraproject.org/pub/epel/7/x86_64/e/epel-release-7-6.noarch.rpm
sudo yum -y install python-pip python-devel libxml2-devel libxslt-devel

# Install MySQL and Rabbit
sudo rpm -Uvh http://dev.mysql.com/get/mysql-community-release-el7-5.noarch.rpm
sudo yum install mysql-server mysql mariadb-devel rabbitmq-server nginx git -y
sudo /usr/lib/rabbitmq/bin/rabbitmq-plugins enable rabbitmq_management

# Create /opt/numenta folder
sudo mkdir -p /opt/numenta
sudo chown centos:centos /opt/numenta

# Install NuPIC
pip install -I https://pypi.numenta.com/api/package/nupic/nupic-0.2.6-cp27-none-linux_x86_64.whl --user

# Clone Numenta Apps Repo
git clone https://github.com/numenta/numenta-apps.git /opt/numenta/numenta-apps

# Install HTM-IT
cd /opt/numenta/numenta-apps/
pip install paver==1.2.4 --user
pip install uwsgi==2.0.12 --user
pip install agamotto==0.5.1 --user
./install-htm-it.sh /home/centos/.local

# Start MySQL and Rabbit
sudo service mysqld start
sudo rabbitmq-server -detached

# Add Rabbit Admin scripts
sudo cp /opt/numenta/numenta-apps/infrastructure/saltcellar/rabbitmq/files/rabbitmqadmin /usr/local/bin

# Bootstrap HTM-IT
export HTM_IT_HOME=/opt/numenta/numenta-apps/htm-it
export APPLICATION_CONFIG_PATH="${HTM_IT_HOME}/conf"
export HTM_IT_LOG_DIR="${HTM_IT_HOME}/logs"

cd "${HTM_IT_HOME}"
mkdir -p "${HTM_IT_LOG_DIR}"/

python setup.py init

# Start Nginx and HTM-IT
sudo sysctl -w net.core.somaxconn=1024
sudo nginx -p . -c conf/htm-it-api.conf
supervisord -c conf/supervisord.conf

echo "HTM-IT is now running!"

########################
## Run Integration Tests
########################

#########################
## Set credentials per https://github.com/numenta/numenta-apps/tree/master/htm-it#setup-aws-credentials-for-integration-tests
#########################

# ./run_tests.sh --integration --language py --results xunit jenkins
