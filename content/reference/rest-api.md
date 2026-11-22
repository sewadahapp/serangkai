---
title: REST API
description: HTTP endpoints for rangka, folders, versions, sharing, and tokens.
order: 2
---

# REST API

Every endpoint accepts a browser session or a bearer token:

```sh
curl -H "Authorization: Bearer $SERANGKAI_API_TOKEN" https://<your-host>/api/rangka
```

Reads need the `read` scope and writes need `write`. Some management endpoints
accept only a browser session, as noted below.

## Rangka

| Method | Path | Does |
| --- | --- | --- |
| `GET` | `/api/rangka` | List rangka, with filters |
| `POST` | `/api/rangka` | Create a rangka from text content |
| `POST` | `/api/rangka/upload` | Multipart upload: Markdown, HTML, JSON, PDF, images, or a ZIP bundle |
| `GET` | `/api/rangka/:id` | Read a rangka |
| `PUT` | `/api/rangka/:id` | Update content, visibility, or folder |
| `DELETE` | `/api/rangka/:id` | Delete a rangka |
| `GET` | `/api/rangka/:id/download` | Download the original source |
| `POST` | `/api/rangka/:id/duplicate` | Copy as a new private rangka |
| `POST` | `/api/rangka/:id/share` | Build a public or signed unlisted share URL |

Content updates require `baseVersion`. A missing value returns `400`; a stale
one returns `409` with `data.currentVersion`.

## Versions

| Method | Path | Does |
| --- | --- | --- |
| `GET` | `/api/rangka/:id/versions` | List the version history |
| `GET` | `/api/rangka/:id/versions/:version` | Read one version |
| `POST` | `/api/rangka/:id/versions/:version/restore` | Restore a version as a new version |
| `DELETE` | `/api/rangka/:id/versions/:version` | Delete one older version (browser session only) |
| `DELETE` | `/api/rangka/:id/versions` | Clear older versions in batches (browser session only) |

## Folders and search

| Method | Path | Does |
| --- | --- | --- |
| `GET` | `/api/folders` | List folders |
| `POST` | `/api/folders` | Create a folder |
| `PUT` | `/api/folders/:id` | Rename or move a folder |
| `DELETE` | `/api/folders/:id` | Delete an empty folder |
| `GET` | `/api/search` | Search rangka and folders, optionally within a folder subtree |
| `GET` | `/api/overview` | Counts, visibility, storage total, and recent rangka |

## Sharing

| Method | Path | Does |
| --- | --- | --- |
| `GET` | `/api/share/:slug` | Deliver a public or unlisted rangka |
| `GET` | `/api/share/:slug/*` | Deliver a shared bundle's assets |

## Tokens and grants

| Method | Path | Does |
| --- | --- | --- |
| `GET` | `/api/tokens` | List API tokens |
| `POST` | `/api/tokens` | Create an API token |
| `DELETE` | `/api/tokens/:id` | Revoke an API token |
| `GET` | `/api/oauth/clients` | List approved OAuth grants (browser session only) |
| `DELETE` | `/api/oauth/clients/:id` | Disconnect a grant (browser session only) |

## Health

`GET /api/health` returns the server's status. It does not check the database
or file storage.
