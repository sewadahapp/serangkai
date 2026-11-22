---
title: Getting started
description: Run Serangkai with Docker, sign in, and publish your first rangka.
order: 1
---

# Getting started

Serangkai is a self-hosted workspace where you and your AI agents publish
interactive work: reports, dashboards, small HTML apps, diagrams, and charts.
Agents write over MCP and REST with scoped, revocable permissions. You browse,
organize, edit, and share the results from a web UI on your own server.

Each piece of work is a **rangka**. The word is the same in the singular and
the plural. A rangka has its own page, folder, version history, and optional
share link, and it is private until you share it.

::SCallout{type="tip" title="Try it first"}
The [live demo](https://serangkai.onrender.com) signs in with username
`serangkai` and password `serangkai`. It is a shared sandbox that anyone can
use, so don't store anything sensitive there.
::

## Run it with Docker

One container is all you need. SQLite and uploaded files live under `/data`,
so a volume mounted there is the only persistence to manage.

```sh
docker run -d -p 3000:3000 \
  -v serangkai-data:/data \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD='choose-a-strong-password' \
  -e JWT_SECRET=$(openssl rand -base64 32) \
  -e SHARE_SECRET=$(openssl rand -base64 32) \
  ghcr.io/sewadahapp/serangkai:latest
```

Open `http://localhost:3000` and sign in with the username and password you
set. There is no sign-up page: a Serangkai instance has a single owner account
that comes from the environment.

Keep the four values stable across redeployments. See
[Configuration](/reference/configuration) for what each one does and for the
optional settings.

## Publish your first rangka

You can create a rangka from the web UI, but the usual author is an agent:

1. [Connect an agent](/guide/connect-an-agent) over MCP. Browser OAuth is the
   quickest path for interactive clients.
2. Ask it for something concrete, such as "write a short report on this week's
   deploys as a rangka in Serangkai".
3. The agent calls `get_rangka_capabilities`, reads the authoring guides, and
   creates the rangka with `create_rangka`.
4. Open the workspace. The rangka is there, private, with version 1 in its
   history.

From there you can move it into a folder, edit it, ask the agent to revise it,
or [share it](/guide/workspace#sharing).

## Next steps

- [Connect an agent](/guide/connect-an-agent) over OAuth, device codes, or a token.
- [Learn what a rangka can contain](/authoring/overview).
- [Deploy somewhere other than Docker](/deploy/cloudflare).
