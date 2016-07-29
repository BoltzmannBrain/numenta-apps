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

# See http://peak.telecommunity.com/DevCenter/setuptools#namespace-packages
try:
  __import__("pkg_resources").declare_namespace(__name__)
except ImportError:
  from pkgutil import extend_path
  __path__ = extend_path(__path__, __name__)


from optparse import OptionParser
import os
from pkg_resources import get_distribution

from nta.utils import logging_support_raw
from nta.utils.config import Config



logging_support = logging_support_raw

distribution = get_distribution(__name__)
TAURUS_MONITORS_HOME = os.path.abspath(distribution.location)

CONF_DIR = os.environ.get("TAURUS_MONITORS_DB_CONFIG_PATH")
if CONF_DIR is None:
  CONF_DIR = os.path.join(TAURUS_MONITORS_HOME, "conf")

LOG_DIR = os.path.join(TAURUS_MONITORS_HOME, "logs")
logging_support.setLogDir(LOG_DIR)



class TaurusMonitorError(Exception):
  pass



def loadConfig(options):
  """ Load, and return a Config object given a OptionParser object

  :param object options: Object having `monitorConfPath` attr representing the
    path to a configuration file.
  :returns: Config object
  :rtype: nta.utils.config.Config
  """
  confDir = os.path.dirname(options.monitorConfPath)
  confFileName = os.path.basename(options.monitorConfPath)
  return Config(confFileName, confDir)



def loadEmailParamsFromConfig(config):
  """ Extract email-related configuration directives from a Config object

  :params nta.utils.config.Config config:
  :returns: Dict having `senderAddress`, `recipients`, `awsRegion`,
    `sesEndpoint`, `awsAccessKeyId`, and `awsSecretAccessKey` keys.
  """
  return dict(
    senderAddress=(
      config.get("S1", "MODELS_MONITOR_EMAIL_SENDER_ADDRESS")),
    recipients=config.get("S1", "MODELS_MONITOR_EMAIL_RECIPIENTS"),
    awsRegion= config.get("S1", "MODELS_MONITOR_EMAIL_AWS_REGION"),
    sesEndpoint=config.get("S1", "MODELS_MONITOR_EMAIL_SES_ENDPOINT"),
    awsAccessKeyId=None,
    awsSecretAccessKey=None
  )



class MonitorOptionParser(OptionParser):
  """ OptionParser subclass that implements a --monitorConfPath default
  option and adds a parse_options() helper function to enforce behavior with
  respect to positional arguments.  Monitors that accept command line arguments
  should use this instead of the standard OptionParser class for consistency.
  """

  def __init__(self, *args, **kwargs):
    OptionParser.__init__(self, *args, **kwargs)
    self.add_option("--monitorConfPath",
                    help=("Specify full path to ConfigParser-compatible"
                          " monitor conf file, containing a [S1] section and"
                          " the following configuration directives:\n\n"
                          "MODELS_MONITOR_EMAIL_SENDER_ADDRESS\n"
                          "MODELS_MONITOR_EMAIL_RECIPIENTS\n"
                          "MODELS_MONITOR_EMAIL_AWS_REGION\n"
                          "MODELS_MONITOR_EMAIL_SES_ENDPOINT"))
    self.add_option("--loggingLevel",
                    help=("Specify logging level: DEBUG, INFO, WARNING, ERROR,"
                          " or CRITICAL"),
                    default="INFO")


  def parse_options(self, *args, **kwargs):
    """ Parse and return command line options.  Enforcing a common convention
    in which positional arguments are not allowed, allowing only named
    arguments

    :returns: First result of OptionParser.parse_args()
    :rtype: object
    """
    (options, args) = OptionParser.parse_args(self, *args, **kwargs)

    if args:
      self.error("Unexpected positional arguments: {}".format(repr(args)))

    return options
