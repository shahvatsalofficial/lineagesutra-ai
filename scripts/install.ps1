$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
node packages/cli/index.mjs doctor
Write-Output 'Use: node packages/cli/index.mjs install --host claude --target C:\project'
