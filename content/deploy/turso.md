---
title: Turso and Vercel
description: Use a remote libSQL database, and deploy to Vercel with external storage.
order: 3
---

# Turso and Vercel

## Turso

Serangkai can store its rows in Turso or any libSQL server instead of the local
SQLite file, on every runtime:

```dotenv
DATABASE_DRIVER=turso
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-database-token
```

The URL may use `libsql://`, `https://`, or `http://`; an unauthenticated
self-hosted libSQL server can omit the token. Turso takes priority over a
Cloudflare D1 binding, and configuration or connection errors are reported
rather than falling back to a local database.

::SCallout{type="warning" title="Existing data is not copied"}
Switching an existing installation does not move its data. Back up the SQLite
database and import it into Turso first, and keep the same object store and
secrets.
::

## Vercel

The Vercel build uses Nitro's `vercel` preset on the Node 24 runtime. Vercel's
filesystem is ephemeral, so durable data needs an external database and object
storage: pair `DATABASE_DRIVER=turso` with `STORAGE_DRIVER=s3`.

```sh
bun run build:vercel
```
