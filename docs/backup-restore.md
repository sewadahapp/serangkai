# Backup and restore

Back up the database and the object store together, and keep the secrets
(`JWT_SECRET`, `SHARE_SECRET`, and on Workers `NUXT_APP_SECRET`) stable:
rotating them invalidates sessions and existing unlisted links.

**Docker / SQLite.** Everything lives under `/data` (`serangkai.db` plus the
`files/` object store). Stop the container and copy the volume, or take a hot
SQLite backup with `sqlite3 /data/serangkai.db ".backup '/backup/serangkai.db'"`
and copy `files/` alongside it. Restore by mounting the same `/data` volume.

**Cloudflare D1.** Export with `wrangler d1 export <database> --output backup.sql`
(or use D1 Time Travel for point-in-time recovery). Restore into a database with
`wrangler d1 execute <database> --file backup.sql`.

**Object storage.** R2: sync with `wrangler r2 object` commands or `rclone sync`.
Backblaze B2: `b2 sync` or `rclone sync` against the S3 endpoint. Keep the bucket
private; rangka bytes are meaningless without the matching database rows.

A restore is only consistent if the database and object store come from the same
point in time, and the secrets match the ones in use when the backup was taken.
