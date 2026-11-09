# Serangkai MCP connection (local dogfooding)

Two ways to connect this repo's own agent to its own MCP server at
`http://localhost:6969/api/mcp`:

- **OAuth (recommended):** no token file, no pasted secret. `mcp-remote`
  discovers the authorization server and opens a browser for approval. On a
  headless machine, use the device-code variant instead.
- **Bearer token:** a scoped API token in a gitignored file. Useful for
  headless shells and CI, where a browser is not available.

## Connecting over SSH (device code)

The browser flow needs a loopback callback, which an SSH session or container
cannot receive. Use the device grant instead: the client prints a short code and
a URL, and you approve it from whichever machine has a browser.

```bash
SERANGKAI_MCP_AUTH=oauth-device bash scripts/serangkai-mcp.sh
```

The client prints something like:

```
To authorize this client, visit:
  http://localhost:6969/oauth/device?user_code=NVWT-RVWF

Waiting for approval...
```

Open that URL anywhere, sign in, and approve. The terminal finishes on its own —
no port forwarding and no callback reachability needed. The grant then appears
under Settings → Connected agents like any other connection.

## OAuth setup

`opencode.json` already points at the bridge script. With OAuth, the bridge
needs no token:

```bash
SERANGKAI_MCP_AUTH=oauth bash scripts/serangkai-mcp.sh
```

On first run `mcp-remote` prints an authorization URL (and opens a browser).
Approve the client at `/oauth/authorize`; the grant then appears under
Settings → Connected agents, where it can be disconnected.

Credentials are cached under `MCP_REMOTE_CONFIG_DIR` (defaults to the user's
config directory), so later runs reuse the refresh token. Requires HTTPS in a
deployed environment; `localhost` is exempt.

## Bearer token setup

1. Start the dev server on the pinned port:

   ```bash
   bun run dev        # → http://127.0.0.1:6969
   ```

2. Create a token in the app at `/settings` (scopes: `read`, `write`).

3. Store it locally:

   ```bash
   printf 'SERANGKAI_MCP_TOKEN=%s\n' '<token>' > .env.serangkai-mcp
   chmod 600 .env.serangkai-mcp
   ```

4. Restart the MCP client so it re-reads `opencode.json`.

## How it is wired

```json
{
  "mcp": {
    "serangkai": {
      "type": "local",
      "command": ["bash", "scripts/serangkai-mcp.sh"],
      "enabled": true
    }
  }
}
```

`scripts/serangkai-mcp.sh` runs `mcp-remote` as a stdio→HTTP bridge, so the
bearer header is never written into a tracked file. In OAuth mode it passes no
header at all.

## Notes

- Requires `bun run dev` to be running; the MCP server lives in the app.
- Only dependency is `bunx mcp-remote` on first run (cached afterwards).
- Rotate the token in `/settings` and update `.env.serangkai-mcp` if it leaks.
- `scripts/serangkai-mcp.sh` is committed; `.env.serangkai-mcp` is not.
- Dogfooded against the built server with `mcp-remote` 0.16.5: discovery,
  registration, PKCE, consent, and a tool call all completed, over both the
  browser flow and `--device-code`.
