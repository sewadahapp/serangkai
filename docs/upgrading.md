# Upgrading

Back up the database and files together before any upgrade (see
[Backup and restore](backup-restore.md)). Database migrations run
automatically at startup; the notes below cover the steps that need you.

## From the custom-session build

Upgrading from the earlier custom-session build signs browsers out once (the
cookie format changed) and replaces email login with `ADMIN_USERNAME`. Existing
rangka, folders, versions, and API tokens are preserved. If the database has
more than one user, startup lists the ids; choose one with
`SERANGKAI_MIGRATION_OWNER_USER_ID`.

## To the rangka terminology

Earlier versions called each piece of work an "artifact". Startup automatically
renames the legacy `artifacts` and `artifact_versions` tables to `rangka` and
`rangka_versions`, including `artifact_id` → `rangka_id`. IDs, slugs, version
numbers, stored content paths, and signed share links are preserved. SQLite
startup automatically repairs empty duplicate tables left by a development
reload. If both legacy and new tables contain data, startup stops rather than
choosing one dataset. D1 retains the strict duplicate-table check.

Integrations must update `/api/artifacts` to `/api/rangka`, response fields
`artifact` / `artifacts` to `rangka`, and MCP names to `get_rangka_capabilities`,
`list_rangka`, `get_rangka`, `create_rangka`, and `update_rangka`. Reconnect MCP
clients to refresh tool discovery. Application detail URLs now use
`/rangka/:id`; public `/share/:slug` links stay the same. The legacy opt-in HTML
theme URL redirects to `/rangka-themes/selaras-document.css` for saved HTML
that links it.

Cloudflare deployments now name the R2 binding `RANGKA`. Keep it mapped to the
same existing bucket, or set `R2_BINDING` to the binding name in your existing
deployment. Filesystem paths, S3 configuration, and object keys do not change.
