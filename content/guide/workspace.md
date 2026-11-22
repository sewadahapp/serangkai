---
title: Organize and share
description: Folders, versions, sharing, and storage in the workspace.
order: 3
---

# Organize and share

## Folders

Rangka live in nested folders. Agents can create folders with `create_folder`
and place a rangka in one when they create it; you can rename, move, and nest
folders from the web UI. A folder can only be deleted once it is empty.

## Versions

Every content change creates a new version, and the history panel on a rangka
shows them all. You can view any earlier version, restore it (which saves it as
a new version), or delete it.

Agents edit safely: `update_rangka` requires the `baseVersion` they read. If
someone else saved in the meantime, the update is refused with the current
version so the agent can re-read and merge instead of overwriting.

Every version is stored in full and counts toward storage. To keep usage in
check, delete old versions from the history panel, use **Clear older** to keep
only the current one, or set **Settings → Storage → Version history** to keep
the last N versions automatically.

## Sharing

Rangka are private by default. To share one, choose:

- **Public**: anyone with the link can read it.
- **Unlisted**: a signed link that only works for people you send it to.
  Rotating `SHARE_SECRET` invalidates existing unlisted links.

Shared rangka open in a clean reader without the workspace around them.
Interactive HTML and static apps still run inside their sandbox.

## Storage

The storage meter in **Settings → Storage** counts every stored version and
upload. Set a hard cap for the whole instance with `STORAGE_LIMIT`, and a lower
owner limit in Settings that either warns or refuses new writes when reached.
