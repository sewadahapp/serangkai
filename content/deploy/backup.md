---
title: Backup and restore
description: Back up the database, files, and secrets together.
order: 4
---

# Backup and restore

Back up the database and the object store together, and keep the secrets
(`JWT_SECRET`, `SHARE_SECRET`, and on Workers `NUXT_APP_SECRET`) stable.
Rotating them signs everyone out and invalidates existing unlisted links.

## Docker and SQLite

Everything lives under `/data`: `serangkai.db` plus the `files/` object store.
Stop the container and copy the volume, or take a hot SQLite backup:

```sh
sqlite3 /data/serangkai.db ".backup '/backup/serangkai.db'"
```

Copy `files/` alongside it. To restore, mount the same `/data` volume.

## Cloudflare D1

```sh
wrangler d1 export <database> --output backup.sql
wrangler d1 execute <database> --file backup.sql
```

D1 Time Travel also offers point-in-time recovery.

## Object storage

Sync R2 with `wrangler r2 object` commands or `rclone sync`, and Backblaze B2
with `b2 sync` or `rclone sync` against its S3 endpoint. Keep buckets private:
rangka bytes are meaningless without the matching database rows.

A restore is consistent only when the database and object store come from the
same point in time and the secrets match the ones in use when the backup was
taken.
