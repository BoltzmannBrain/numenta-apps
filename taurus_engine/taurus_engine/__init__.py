import os
from pkg_resources import get_distribution

from nta.utils import logging_support_raw
from nta.utils.config import Config

import htmengine



distribution = get_distribution(__name__)

# See setup.py for constant
__version__ = distribution.version  # pylint: disable=E1101

TAURUS_HOME = distribution.location  # pylint: disable=E1101

logging_support = logging_support_raw  # pylint: disable=C0103
logging_support.setLogDir(os.environ.get("APPLICATION_LOG_DIR",
                                         os.path.join(TAURUS_HOME, "logs")))

config = htmengine.APP_CONFIG
