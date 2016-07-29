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


# This script will create a portable python distribution with
# nupic and nupic.bindings installed.

set -o errexit
set -o pipefail
set -o xtrace

OSX_VERSION=$(sw_vers -productVersion | awk -F '.' '{print $1 "." $2}')
echo "==> System version: $OSX_VERSION"
PYTHON_SH="Miniconda-latest-MacOSX-x86_64.sh"
CAPNP="capnproto-c++-0.5.3"
WORKING_DIR=${PWD}
SCRIPT_PATH=$(cd "$(dirname "${BASH_SOURCE[0]}")"; pwd)
UNICORN_BACKEND_REQUIREMENTS_TXT=${SCRIPT_PATH}/../../py/requirements.txt
NUPIC_CORE=${WORKING_DIR}/nupic.core
NUPIC=${WORKING_DIR}/nupic
NUPIC_MODULES=${NUPIC}/.nupic_modules
PREFIX=${WORKING_DIR}/portable_python
PATH_VALUE=${PREFIX}/bin:${PREFIX}/include

echo "==> Current working directory: $WORKING_DIR"
echo "==> Python will be installed in: $PREFIX"
echo "==> Setting up environment variables ..."
# The env variable PATH has to be extended otherwise
# nupic.bindings won't be installed properly.
export PATH=$PATH_VALUE:$PATH
echo "--> PATH: $PATH"

echo "==> Cleaning up ..."
rm $PYTHON_SH || true
echo "--> Removed: $PYTHON_SH"
rm -rf $PREFIX
echo "--> Removed: $PREFIX"
rm -rf $CAPNP || true
echo "--> Removed: $CAPNP"
rm $CAPNP.tar.gz || true
echo "--> Removed: $CAPNP.tar.gz"
rm -rf $NUPIC_CORE || true
echo "--> Removed: $NUPIC_CORE"
rm -rf $NUPIC || true
echo "--> Removed: $NUPIC"

echo "==> Downloading Miniconda ..."
curl -O https://repo.continuum.io/miniconda/$PYTHON_SH

echo "==> Installing Miniconda ..."
bash $PYTHON_SH -b -p $PREFIX

echo "--> Updating 'libpython' shared library search path"
install_name_tool -id  @executable_path/../lib/libpython2.7.dylib $PREFIX/lib/libpython2.7.dylib


echo "==> Downloading Capnp ..."
curl -O https://capnproto.org/$CAPNP.tar.gz

echo "==> Installing Capnp ..."
tar zxf $CAPNP.tar.gz
pushd $CAPNP
./configure --disable-shared --prefix=$PREFIX
make -j6 check && make install
popd

echo "==> Getting nupic version from ${UNICORN_BACKEND_REQUIREMENTS_TXT}..."
NUPIC_VER=$(grep "^nupic==" "${UNICORN_BACKEND_REQUIREMENTS_TXT}" | cut -d "=" -f 3)
echo "Got nupic version to install: ${NUPIC_VER}"

# Next, get nupic of the desired version and get the commitish of the matching nupic.core
echo "==> Cloning nupic at version ${NUPIC_VER}..."
git clone https://github.com/numenta/nupic.git
(cd "${NUPIC}" && git reset --hard "${NUPIC_VER}")

echo "==> Getting nupic.core committish from ${NUPIC_MODULES}"
NUPIC_CORE_COMMITISH=$(grep "^NUPIC_CORE_COMMITISH =" "${NUPIC_MODULES}" | cut -d "'" -f 2)
echo "Got nupic.core commitish: ${NUPIC_CORE_COMMITISH}"

echo "==> Cloning nupic.core at commitish ${NUPIC_CORE_COMMITISH} ..."
git clone https://github.com/numenta/nupic.core.git
(cd "${NUPIC_CORE}" && git reset --hard "${NUPIC_CORE_COMMITISH}")

echo "==> Installing nupic.core requirements ..."
rm -rf $NUPIC_CORE/build
mkdir -p $NUPIC_CORE/build/scripts
$PREFIX/bin/pip install -r $NUPIC_CORE/bindings/py/requirements.txt --no-cache-dir
# Install pycapnp since it is not in nupic.core requirements.txt.
# Note: to install pycapnpn on Yosemite you have to set MACOSX_DEPLOYMENT_TARGET.
# More on this issue: https://github.com/numenta/nupic/issues/2061
export MACOSX_DEPLOYMENT_TARGET=$OSX_VERSION
$PREFIX/bin/pip install pycapnp --no-cache-dir

echo "==> Building nupic.core ..."
pushd $NUPIC_CORE/build/scripts
BUILD_CMD="cmake $NUPIC_CORE -DCMAKE_INCLUDE_PATH=${PREFIX}/include -DCMAKE_LIBRARY_PATH=${PREFIX}/lib -DCMAKE_PREFIX_PATH=${PREFIX} -DCMAKE_INSTALL_PREFIX=${PREFIX} -DPY_EXTENSIONS_DIR=${NUPIC_CORE}/bindings/py/nupic/bindings -DPYTHON_EXECUTABLE:FILEPATH=${PREFIX}/bin/python2.7 -DPYTHON_INCLUDE_DIR:PATH=${PREFIX}/include/python2.7 -DPYTHON_LIBRARY:FILEPATH=${PREFIX}/lib/libpython2.7.dylib"
$BUILD_CMD

echo "==> Installing nupic.core ..."
make
make install
popd

echo "==> Installing nupic.core python bindings ..."
pushd $NUPIC_CORE/bindings/py
export ARCHFLAGS="-arch x86_64"
$PREFIX/bin/python setup.py install
popd

echo "==> Installing nupic ..."
pushd $NUPIC
# Clean up nupic  datafiles
rm -rf src/nupic/datafiles
$PREFIX/bin/pip install -r external/common/requirements.txt --no-cache-dir
$PREFIX/bin/python setup.py install
popd

echo "==> Cleaning up ..."
rm $PYTHON_SH
echo "--> Removed: $PYTHON_SH"
rm -rf ${CAPNP}*
echo "--> Removed: $CAPNP $CAPNP.tar.gz"
rm -rf $NUPIC_CORE
echo "--> Removed: $NUPIC_CORE"
rm -rf $NUPIC
echo "--> Removed: $NUPIC"

# Check that it worked
$PREFIX/bin/python -c "import nupic.algorithms.anomaly_likelihood"
$PREFIX/bin/python -c "import nupic.bindings.math"

# Create the artifact
echo "--> Creating artifact: ${WORKING_DIR}/portable_python.tar.gz"

# Package for NPM consumption. Just call 'npm install portable_python.tar.gz'

# Remove symbolic links. NPM does not support symbolic links
cp -RL $PREFIX $PREFIX.npm
rm -rf $PREFIX

pushd $PREFIX.npm

# Clean up miniconda
./bin/python ./bin/conda clean --packages --source-cache --index-cache --tarballs --lock -y

# Remove development headers
rm -fr ./include

# Remove python sources
find . -name "*.py" -delete

# Remove test binaries
rm ./bin/*test
rm ./bin/*tests
rm ./bin/hello*

# Remove development binaries
rm ./bin/capnp*
rm ./lib/libnupic_core.a

# Copy NPM package information
cp ${SCRIPT_PATH}/index.js .
cp ${SCRIPT_PATH}/package.json .

tar -chzf ${WORKING_DIR}/portable_python.tar.gz .
popd

# Clean up
rm -rf $PREFIX.npm
