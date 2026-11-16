#!/usr/bin/env sh
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
node packages/cli/index.mjs doctor
printf "Use: node packages/cli/index.mjs install --host claude --target /absolute/project\n"
