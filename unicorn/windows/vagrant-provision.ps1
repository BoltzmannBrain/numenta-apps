<#
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
# Script used to provision additional requirement not satisfied by image alone.

# Arguments:
#   1) node_version (i.e. "5.10.0")
#>
param (
    [string]$node_version = "5.10.0"
)

# Configure WinRM
winrm set winrm/config/winrs '@{MaxMemoryPerShellMB="2048"}'

Write-Host "Installing chocolatey ..."
$ChocoInstallPath = "$env:SystemDrive\ProgramData\Chocolatey\bin"
if (!(Test-Path $ChocoInstallPath)) {
    iex ((new-object net.webclient).DownloadString('https://chocolatey.org/install.ps1'))
}

chocolatey feature enable -n=allowGlobalConfirmation

# Install Python 2.7
choco install python2

# Install nodejs
choco install nodejs --version $node_version

# Install Visual C++ Build Tools 2015
choco install visualcppbuildtools

# Install VC for python
choco install vcpython27

# Install git
choco install git

chocolatey feature disable -n=allowGlobalConfirmation

# Mount shared folder to 'x:' drive
# Must match shared folder name in vagrant file
# See 'config.vm.synced_folder')
net use x: \\VBOXSVR\shared /PERSISTENT:YES
