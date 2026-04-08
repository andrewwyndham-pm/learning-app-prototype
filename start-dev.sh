#!/bin/sh
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
cd "$(dirname "$0")/my-aws-srs-app"
exec ./node_modules/.bin/next dev
