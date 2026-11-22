---
title: Configuration
description: Environment variables for the owner account, secrets, storage, and limits.
order: 3
---

# Configuration

## Required

These four must stay the same across redeployments:

| Variable | Purpose |
| --- | --- |
| `ADMIN_USERNAME` | The owner login name. Changing it renames the same account. |
| `ADMIN_PASSWORD` | The owner password. Changing it rotates the stored hash on restart. |
| `JWT_SECRET` | Root secret for the browser session. Rotating it signs everyone out. |
| `SHARE_SECRET` | Signs unlisted share links. Rotating it invalidates existing links. |

On Cloudflare Workers, also set `NUXT_APP_SECRET`. Docker and Node derive it from
`JWT_SECRET`.

## Optional

| Variable | Purpose |
| --- | --- |
| `PUBLIC_BASE_URL` | Public origin for OAuth metadata and audience checks, when a proxy rewrites `Host` |
| `DATABASE_PATH` | SQLite file location. Default `./data/serangkai.db` (`/data/serangkai.db` in Docker) |
| `STORAGE_PATH` | Local file store. Default `./data/files` (`/data/files` in Docker) |
| `DATABASE_DRIVER` | Set to `turso` to use Turso or libSQL, with `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` |
| `STORAGE_DRIVER` | `local` (default on Docker and Node), `s3`, or `r2-binding` (default on Workers) |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Object storage settings for `STORAGE_DRIVER=s3` |
| `R2_BINDING` | R2 binding name on Workers. Default `RANGKA` |
| `STORAGE_LIMIT` | Hard storage cap, such as `10GB` or `8GiB`. Writes past it are refused |
| `TRUST_PROXY`, `TRUSTED_PROXY_IPS` | Let rate limiting read `X-Forwarded-For` behind a reverse proxy |

## Rate limits

`SERANGKAI_LOGIN_RATE_LIMIT` and `SERANGKAI_LOGIN_RATE_WINDOW_MS` tune the
login throttle. `SERANGKAI_OAUTH_REGISTER_RATE_LIMIT`,
`SERANGKAI_OAUTH_AUTHORIZE_RATE_LIMIT`, and `SERANGKAI_OAUTH_DEVICE_RATE_LIMIT`
tune OAuth throttling.

## Settings in the app

The owner can also set a storage limit lower than `STORAGE_LIMIT`, choose
whether reaching it warns or refuses writes, and choose how many versions to
keep per rangka, all in **Settings → Storage**.
