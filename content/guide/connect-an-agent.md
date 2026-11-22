---
title: Connect an agent
description: Connect an MCP client with browser OAuth, device authorization, or a scoped API token.
order: 2
---

# Connect an agent

Serangkai is its own OAuth 2.1 authorization server, so MCP clients can connect
in three ways. All of them end at the same Streamable HTTP endpoint:

```text
https://<your-host>/api/mcp
```

## Browser OAuth

Recommended for interactive clients. A client that supports OAuth discovers the
authorization server from the endpoint's `401` response, opens your browser to
a consent screen, and you approve the requested scopes. No secret is pasted
into the client.

Authorization codes use PKCE (S256), and every grant is bound to the MCP
resource. Approved grants are listed in **Settings**, where you can disconnect
any of them.

## Device authorization

For SSH sessions, containers, or CI, where no browser callback is possible. The
client requests a device code and prints a short user code. Open
`https://<your-host>/oauth/device`, sign in, enter the code, and approve. The
client polls until the grant is issued.

## Manual API token

Create a scoped token in **Settings → API tokens** and pass it as a bearer
header. For example, with Claude Code:

```sh
claude mcp add --transport http serangkai http://localhost:3000/api/mcp \
  --header "Authorization: Bearer $SERANGKAI_API_TOKEN" --scope user
```

## Scopes

| Scope | Allows |
| --- | --- |
| `read` | Discovery, listing, searching, and reading rangka and folders |
| `write` | Creating and updating rangka and folders |
| `full` | Everything, including managing other tokens. Only a manually minted token can hold it. |

OAuth grants are capped at `read` and `write`. Tokens are hashed at rest and
revocable at any time, and a read-only token can never mint share links.

::SCallout{type="note" title="Sessions and tokens stay separate"}
A browser session never authorizes MCP, and a request that carries a bearer
token never falls back to a session.
::

## What the agent sees

Once connected, an agent should start with `get_rangka_capabilities` and the
`serangkai://guides/*` resources. They describe every supported format and
component, so the agent does not need access to this site or the repository.
See the [MCP reference](/reference/mcp) for the full tool list.
