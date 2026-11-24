---
title: MCP
description: The MCP endpoint, tools, resources, and prompts.
order: 1
---

# MCP

Serangkai serves MCP over Streamable HTTP at `/api/mcp`. See
[Connect an agent](/guide/connect-an-agent) for authentication.

## Tools

| Tool | Scope | Does |
| --- | --- | --- |
| `get_rangka_capabilities` | `read` | Describes supported types, components, and limits |
| `set_connection_name` | `read` | Names this connection in Settings, unless the owner already named it |
| `list_folders` | `read` | Lists folders |
| `search` | `read` | Searches rangka and folders, optionally within a folder subtree |
| `list_rangka` | `read` | Lists rangka |
| `get_rangka` | `read` | Reads a rangka's content and current version |
| `create_folder` | `write` | Creates a folder, optionally nested |
| `create_rangka` | `write` | Creates a rangka, optionally inside a folder |
| `update_rangka` | `write` | Changes content, visibility, or folder |

Text types are `markdown`, `html`, `javascript`, `json`, and `image` (SVG
markup). Bundles and PDFs go through the REST upload.

### Safe updates

`update_rangka` requires `baseVersion`, the version the agent read with
`get_rangka`, whenever content changes. If the rangka changed since then, the
update is refused with the current version so the agent can re-read and merge.
Metadata-only updates don't need it, and unchanged content creates no new
version.

### Structured output

Every tool declares an `outputSchema` and returns `structuredContent`, with the
same JSON repeated as text for older clients. List results are objects, such as
`{ folders }` and `{ rangka }`. Typed output lets clients that turn MCP tools
into a code API call Serangkai from generated code. Serangkai itself never runs
agent-written code on the server.

## Resources

| URI | Contents |
| --- | --- |
| `serangkai://capabilities` | The same data as `get_rangka_capabilities` |
| `serangkai://guides/markdown` | Markdown, components, Mermaid, charts, and limits |
| `serangkai://guides/html` | Self-styled HTML, the document theme, markers, and sandbox rules |
| `serangkai://components/selaras` | Supported component tags, props, slots, and examples |
| `serangkai://tokens/selaras` | Theme-aware CSS custom properties for HTML rangka |
| `serangkai://templates/*` | Starting points: `report`, `technicalDoc`, `dashboard`, `diagram`, `interactiveApp` |

## Prompts

`create_report`, `create_dashboard`, `create_html_document`, and
`create_custom_dashboard` give an agent starting instructions for common work.
