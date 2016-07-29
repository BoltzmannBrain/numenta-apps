# ----------------------------------------------------------------------
# Numenta Platform for Intelligent Computing (NuPIC)
# Copyright (C) 2015, Numenta, Inc.  Unless you have purchased from
# Numenta, Inc. a separate commercial license for this software code, the
# following terms and conditions apply:
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License version 3 as
# published by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
# See the GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see http://www.gnu.org/licenses.
#
# http://numenta.org/licenses/
# ----------------------------------------------------------------------
import os
from setuptools import setup, find_packages
from setuptools.command.test import test as TestCommand
import sys



requirements = [str.strip(ln) for ln in open("requirements.txt").readlines()]



name = "taurus_monitoring"



class PyTest(TestCommand):
  user_options = [("pytest-args=", "a", "Arguments to pass to py.test")]


  def initialize_options(self):
    TestCommand.initialize_options(self)
    self.pytest_args = [] # pylint: disable=W0201


  def finalize_options(self):
    TestCommand.finalize_options(self)
    self.test_args = []
    self.test_suite = True


  def run_tests(self):
    import pytest
    cwd = os.getcwd()
    try:
      os.chdir("tests")
      errno = pytest.main(self.pytest_args)
    finally:
      os.chdir(cwd)
    sys.exit(errno)



setup(
  name = name,
  description = "Monitors Database",
  packages = find_packages(),
  install_requires = requirements,
  cmdclass = {"test": PyTest},
  entry_points = {
    "console_scripts": [
      "taurus-reset-monitorsdb = %s.monitorsdb:resetMonitorsdbMain" % name,
      ("taurus-set-monitorsdb-login = "
       "%s.monitorsdb.set_monitorsdb_login:main" % name),
      ("taurus-models-monitor = "
       "%s.models_monitor.taurus_models_monitor:main" % name),
      ("taurus-metric-order-monitor = "
       "%s.metric_order_monitor.metric_order_monitor:main" % name),
      ("taurus-server-supervisor-monitor = "
       "%s.supervisord_monitor.taurus_server_supervisord_monitor:main" % name),
      ("taurus-collector-supervisor-monitor = "
       "%s.supervisord_monitor.taurus_collector_supervisord_monitor:main" % name),
      ("taurus-model-latency-monitor = "
       "%s.latency_monitor.model_latency_monitor:main" % name),
      ("taurus-clear-monitor-notifications = "
       "%s.monitor_dispatcher:MonitorDispatcher.clearAllNotificationsInteractiveConsoleScriptEntryPoint" % name),
    ]
  }
)
