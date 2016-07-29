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
# Script used to build win32 version of Unicorn.
# Arguments:
#   1) nupic_version (i.e. "0.5.0")
#   2) CSC_LINK. See https://github.com/electron-userland/electron-builder/wiki/Code-Signing
#   3) CSC_KEY_PASSWORD. See https://github.com/electron-userland/electron-builder/wiki/Code-Signing
#   4) GA_TRACKING_ID. See https://analytics.google.com/analytics
#>
param (
    [string]$nupic_version = "0.5.0",
    [string]$CSC_LINK = "",
    [string]$CSC_KEY_PASSWORD = "",
    [string]$GA_TRACKING_ID = ""
)
Write-Host "Configure WinRM"
winrm set winrm/config/winrs '@{MaxMemoryPerShellMB="2048"}'

Write-Host "Configure npm"
npm config set msvs_version 2015

Write-Host "Mount shared folder to 'x:' drive"
# Must match shared folder name in vagrant file
# See 'config.vm.synced_folder')
net use x: \\VBOXSVR\shared /PERSISTENT:YES
pushd x:\

Write-Host "Build python and nupic"
pushd scripts\Windows64
powershell.exe -ExecutionPolicy RemoteSigned .\simple_build_portable_python_with_nupic.ps1 -nupic_version=$nupic_version
popd

Write-Host "Set environment variables"
$env:CSC_LINK = $CSC_LINK
$env:CSC_KEY_PASSWORD = $CSC_KEY_PASSWORD
$env:GA_TRACKING_ID = $GA_TRACKING_ID

Write-Host "Clean, install, build and package windows version"
npm run clean
npm install
npm run build:win
