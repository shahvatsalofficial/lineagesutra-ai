@echo off
cd /d "%~dp0.."
node packages/cli/index.mjs doctor
