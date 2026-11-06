# Serangkai MCP connection (local dogfooding)

This lets this repo's own agent talk to its own MCP server at
`http://localhost:6969/api/mcp`.

The token is **not** committed. `opencode.json` runs a small bridge script that
reads it from a gitignored file.

## One-time setup

1. Start the dev server on the pinned port:

   ```bash
   npm run dev        # → http://127.0.0.1:6969
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

`scripts/serangkai-mcp.sh` loads `.env.serangkai-mcp` and runs `mcp-remote` as a
stdio→HTTP bridge, so the bearer header is never written into a tracked file.

## Notes

- Requires `npm run dev` to be running; the MCP server lives in the app.
- Only dependency is `npx mcp-remote` on first run (cached afterwards).
- Rotate the token in `/settings` and update `.env.serangkai-mcp` if it leaks.
- `scripts/serangkai-mcp.sh` is committed; `.env.serangkai-mcp` is not.
