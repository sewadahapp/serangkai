import { eq } from 'drizzle-orm'
import { oauthClients } from '../../db/schema'
import { getRequestDatabase } from '../../db/adapter'
import {
  approveDeviceAuthorization,
  denyDeviceAuthorization,
  findDeviceByUserCode,
  formatUserCode,
  normalizeUserCode,
  parseScopes,
} from '../../utils/oauth'

/**
 * Device activation page (RFC 8628 §3.3).
 *
 * The owner opens this on whichever machine has a browser and types the code
 * the client printed. It mirrors the consent screen's guarantees: it needs the
 * owner's session, shows which client is asking and what it wants, and only
 * the permissions left checked are granted.
 */

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const PAGE_STYLE = `
  :root{color-scheme:light dark}
  body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:2rem;
    font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    background:light-dark(#f8fafc,#090a0d);color:light-dark(#0f172a,#e2e8f0)}
  main{width:100%;max-width:34rem;border:1px solid light-dark(#e2e8f0,#28303d);
    border-radius:.75rem;padding:2rem;background:light-dark(#fff,#14171f)}
  .eyebrow{margin:0 0 .4rem;font-size:.75rem;font-weight:600;letter-spacing:.08em;
    text-transform:uppercase;color:light-dark(#64748b,#9aa4b8)}
  h1{margin:0 0 .5rem;font-size:1.5rem;line-height:1.2;letter-spacing:-.01em}
  p{margin:0 0 1rem;color:light-dark(#475569,#9aa4b8)}
  .client{display:flex;align-items:center;gap:.75rem;margin:1.25rem 0;
    padding:.75rem;border-radius:.5rem;border:1px solid light-dark(#e2e8f0,#28303d)}
  .mark{display:grid;place-items:center;width:2.25rem;height:2.25rem;flex:none;
    border-radius:.5rem;background:#2563eb;color:#fff;font-weight:700}
  .client small{display:block;color:light-dark(#64748b,#9aa4b8);font-size:.8rem}
  ul{list-style:none;margin:0 0 1.25rem;padding:0;display:grid;gap:.5rem}
  label{display:flex;gap:.65rem;align-items:flex-start;padding:.75rem;
    border:1px solid light-dark(#e2e8f0,#28303d);border-radius:.5rem;cursor:pointer}
  input[type=checkbox]{margin-top:.25rem}
  label small{display:block;color:light-dark(#64748b,#9aa4b8);font-size:.85rem}
  .actions{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:1.5rem}
  button{font:inherit;font-weight:600;border-radius:.5rem;padding:.6rem 1rem;
    border:1px solid transparent;cursor:pointer}
  .approve{background:#2563eb;color:#fff}
  .deny{background:transparent;color:inherit;border-color:light-dark(#cbd5e1,#3a4453)}
  input[type=text]{font:inherit;font-family:ui-monospace,monospace;font-size:1.15rem;letter-spacing:.15em;
    width:100%;padding:.7rem .85rem;border-radius:.5rem;text-transform:uppercase;
    border:1px solid light-dark(#cbd5e1,#3a4453);background:transparent;color:inherit}
  .note{margin-top:1.25rem;font-size:.85rem;color:light-dark(#64748b,#9aa4b8)}
  code{font-family:ui-monospace,monospace;font-size:.8em}
`

function page(title: string, body: string) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>${escapeHtml(title)} · Serangkai</title>
<style>${PAGE_STYLE}</style></head>
<body><main>${body}</main></body></html>`
}

function renderCodeForm(prefill: string, error?: string) {
  return page('Connect a device', `
    <p class="eyebrow">Device sign-in</p>
    <h1>Enter the code shown in your terminal</h1>
    <p>The client printed a short code such as <code>WDJB-MJHT</code>. Enter it here to finish connecting.</p>
    ${error ? `<p style="color:light-dark(#b91c1c,#fca5a5)"><strong>${escapeHtml(error)}</strong></p>` : ''}
    <form method="post" action="/oauth/device">
      <input type="text" name="user_code" value="${escapeHtml(prefill)}" placeholder="XXXX-XXXX"
        aria-label="Device code" autocomplete="off" autocapitalize="characters" spellcheck="false" required>
      <div class="actions">
        <button class="approve" type="submit" name="decision" value="continue">Continue</button>
      </div>
    </form>
    <p class="note">Only enter codes for clients you started yourself.</p>
  `)
}

function renderConsent(clientName: string, userCode: string, scopes: string[], error?: string) {
  const rows = scopes.map(scope => `
    <li>
      <label>
        <input type="checkbox" name="scopes" value="${escapeHtml(scope)}" checked>
        <span>
          <strong>${scope === 'read' ? 'Read your workspace' : 'Write to your workspace'}</strong>
          <small>${scope === 'read'
            ? 'See artifacts, folders, versions, and the overview.'
            : 'Create, edit, move, and version artifacts, and change sharing.'}</small>
        </span>
      </label>
    </li>`).join('')

  return page(`Authorize ${clientName}`, `
    <p class="eyebrow">Device sign-in request</p>
    <h1>Allow ${escapeHtml(clientName)} to access your workspace?</h1>
    <p>Code <code>${escapeHtml(formatUserCode(userCode))}</code> from a client that could not open a browser itself.</p>
    ${error ? `<p style="color:light-dark(#b91c1c,#fca5a5)"><strong>${escapeHtml(error)}</strong></p>` : ''}
    <div class="client">
      <span class="mark">${escapeHtml(clientName.slice(0, 1).toUpperCase())}</span>
      <span><strong>${escapeHtml(clientName)}</strong><small>Approved from this device</small></span>
    </div>
    <form method="post" action="/oauth/device">
      <input type="hidden" name="user_code" value="${escapeHtml(userCode)}">
      <ul>${rows}</ul>
      <div class="actions">
        <button class="approve" type="submit" name="decision" value="approve">Allow access</button>
        <button class="deny" type="submit" name="decision" value="deny">Deny</button>
      </div>
    </form>
    <p class="note">Serangkai never shares your password. You can disconnect this client from Settings at any time.</p>
  `)
}

function renderDone(kind: 'approved' | 'denied') {
  const approved = kind === 'approved'
  return page(approved ? 'Device connected' : 'Request denied', `
    <p class="eyebrow">Device sign-in</p>
    <h1>${approved ? 'Device connected' : 'Request denied'}</h1>
    <p>${approved
      ? 'You can close this window and return to your terminal. The client will finish signing in on its own.'
      : 'Nothing was granted. You can close this window.'}</p>
  `)
}

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
  setHeader(event, 'Referrer-Policy', 'no-referrer')

  const method = getMethod(event)
  const query = getQuery(event)
  const body = method === 'POST' ? await readBody<Record<string, any>>(event).catch(() => ({})) : {}
  const rawCode = String(body?.user_code ?? query.user_code ?? '')
  const userCode = normalizeUserCode(rawCode)

  if (!userCode) return renderCodeForm('')

  // A signed-out owner cannot approve. Send them to login and come back here.
  if (!event.context.user) {
    const url = getRequestURL(event)
    return sendRedirect(event, `/auth/login?redirect=${encodeURIComponent(`${url.pathname}${url.search}`)}`, 302)
  }

  const db = await getRequestDatabase(event)
  const device = await findDeviceByUserCode(db, userCode)
  if (!device) {
    return renderCodeForm(formatUserCode(userCode), 'That code was not found. Check the terminal and try again.')
  }
  if (device.expiresAt.getTime() < Date.now()) {
    return renderCodeForm(formatUserCode(userCode), 'That code has expired. Start the connection again from the client.')
  }
  if (device.consumedAt || device.approvedAt || device.deniedAt) {
    return renderDone(device.deniedAt ? 'denied' : 'approved')
  }
  if (method === 'GET' && body?.decision === undefined && query.decision === undefined && query.user_code) {
    // Fall through to the consent view: a valid, pending code was supplied.
  }

  const client = await db.select().from(oauthClients).where(eq(oauthClients.id, device.clientId)).get()
  const clientName = client?.clientName || 'This client'

  if (method === 'POST') {
    const decision = String(body?.decision || '')
    if (decision === 'deny') {
      await denyDeviceAuthorization(db, device.id)
      return renderDone('denied')
    }
    if (decision === 'approve') {
      // Only what the owner left checked, intersected with what was requested.
      const chosen = parseScopes(body?.scopes).filter(scope => (device.scopes as string[]).includes(scope))
      if (!chosen.length) {
        return renderConsent(clientName, userCode, device.scopes as string[], 'Select at least one permission to continue.')
      }
      const approved = await approveDeviceAuthorization(db, device.id, event.context.user.id, chosen)
      if (!approved.ok) {
        return renderDone(approved.error === 'expired' ? 'denied' : 'approved')
      }
      return renderDone('approved')
    }
    return renderCodeForm(formatUserCode(userCode), 'The request was not understood.')
  }

  return renderConsent(clientName, userCode, device.scopes as string[])
})
