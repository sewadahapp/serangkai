#!/bin/sh
set -eu

# Named/bind-mounted volumes are commonly created as root. Prepare the
# persistent directory before dropping privileges for the application.
mkdir -p /app/data /app/data/files
chown -R node:node /app/data

exec su -s /bin/sh node -c 'exec node .output/server/index.mjs'
