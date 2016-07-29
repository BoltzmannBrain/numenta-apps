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
import logging
import os
import sys
import marshal

try:
    import paver.tasks
except ImportError:
    from os.path import exists
    if exists("paver-minilib.zip"):
        import sys
        sys.path.insert(0, os.path.join(os.path.split(__file__)[0],
                                        "paver-minilib.zip"))
    import paver.tasks

import psutil



g_log = logging.getLogger("htm.it.setup")



def logEntry():
    """ Log command line and ancestor processes to help debug when something
    unintended gets called
    """
    proc = psutil.Process(os.getpid())
    parent = proc.parent
    parentPid = parent.pid
    try:
        parentCmdline = parent.cmdline
    except Exception as e:
        # Typically AccessDenied
        parentCmdline = "ERROR: " + repr(e)
    grandparent = parent.parent
    if grandparent is not None:
        grandparentPid = grandparent.pid
        try:
            grandparentCmdline = grandparent.cmdline
        except Exception as e:
            # Typically AccessDenied
            grandparentCmdline = "N/A: " + repr(e)
    else:
        grandparentPid = None
        grandparentCmdline = None

    g_log.info("%s called: pid=%s, cmdline=%r; "
             "parentPid=%s, parentCmdline=%r; "
             "grandparentPid=%s, grandparentCmdline=%r",
             sys.argv[0], proc.pid, proc.cmdline,
             parentPid, parentCmdline,
             grandparentPid, grandparentCmdline)



logEntry()

try:
    paver.tasks.main()
except:
    g_log.exception("paver.tasks.main() failed")
    raise
