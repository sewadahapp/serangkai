#!/bin/sh
set -eu

# Named/bind-mounted volumes are commonly created as root. Prepare the
# persistent directory, then run the app as the image's unprivileged user.
mkdir -p /app/data /app/data/files
chown -R bun:bun /app/data

exec su bun -s /bin/sh -c 'exec bun .output/server/index.mjs'
