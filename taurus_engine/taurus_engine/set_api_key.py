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

"""Applies the given Taurus REST API key as override for application.conf."""


import logging
import argparse

from nta.utils.config import Config

import taurus_engine
from taurus_engine import logging_support



g_log = logging.getLogger(__name__)



def main():
  logging_support.LoggingSupport().initTool()


  parser = argparse.ArgumentParser(description=__doc__)

  parser.add_argument(
    "--apikey",
    required=True,
    dest="apikey",
    metavar="API_KEY",
    help=("Taurus Engine's REST API key"))

  args = parser.parse_args()

  if not args.apikey:
    msg = "Missing or empty api key"
    g_log.error(msg)
    parser.error(msg)


  conf = taurus_engine.config

  assert conf.has_section("security"), (
    "Section 'security' is not in {}".format(conf))

  assert conf.has_option("security", "apikey"), (
    "security/apikey option is not in {}".format(conf))


  confWriter = Config(configName=conf.configName,
                      baseConfigDir=conf.baseConfigDir,
                      mode=Config.MODE_OVERRIDE_ONLY)

  if not confWriter.has_section("security"):
    confWriter.add_section("security")

  confWriter.set("security", "apikey", args.apikey)

  confWriter.save()

  g_log.info(
    "Override of Taurus Engine REST API key completed successfully via %r",
    confWriter)


if __name__ == "__main__":
  main()
