import { getRequestDatabase } from '../../db/adapter'
import {
  anyRedirectMatches,
  createAuthorizationCode,
  findClient,
  isAcceptableRedirectUri,
  normalizeScopes,
  parseScopes,
  OAUTH_SCOPES,
} from '../../utils/oauth'

/**
 * OAuth 2.1 authorization endpoint.
 *
 * Two request shapes share this route:
 *  - `GET` renders the consent page (owner signs in first if needed, then
 *    approves or denies).
 *  - `POST` is the approval decision and issues the redirect.
 *
 * All validation happens before anything is rendered or redirected: an unknown
 * client or an unregistered redirect URI is answered with a plain 400 instead
 * of a redirect, because redirecting to an unvalidated URI is the attack this
 * endpoint must not enable.
 */

interface AuthorizeInput {
  clientId: string
  redirectUri: string
  responseType: string
  codeChallenge: string
  codeChallengeMethod: string
  scope: string
  state: string
  resource: string
}

function readAuthorizeInput(source: Record<string, any>): AuthorizeInput {
  const value = (key: string) => {
    const raw = source?.[key]
    return typeof raw === 'string' ? raw : Array.isArray(raw) ? String(raw[0] ?? '') : ''
  }
  return {
    clientId: value('client_id'),
    redirectUri: value('redirect_uri'),
    responseType: value('response_type'),
    codeChallenge: value('code_challenge'),
    codeChallengeMethod: value('code_challenge_method'),
    scope: value('scope'),
    state: value('state'),
    resource: value('resource'),
  }
}

/** Append query parameters to a redirect URI without losing existing ones. */
function appendQuery(uri: string, params: Record<string, string>): string {
  const url = new URL(uri)
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value)
  }
  return url.href
}

function errorPage(event: any, status: number, message: string, detail?: string) {
  setResponseStatus(event, status)
  setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
  setHeader(event, 'Cache-Control', 'no-store')
  const escape = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Authorization error · Serangkai</title>
<style>
  :root{color-scheme:light dark}
  body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:2rem;
    font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;
    background:light-dark(#f8fafc,#090a0d);color:light-dark(#0f172a,#e2e8f0)}
  main{max-width:32rem;border:1px solid light-dark(#e2e8f0,#28303d);border-radius:.75rem;padding:2rem;background:light-dark(#fff,#14171f)}
  h1{margin:0 0 .5rem;font-size:1.35rem}
  p{margin:0 0 1rem;color:light-dark(#475569,#9aa4b8)}
  code{font-family:ui-monospace,monospace;font-size:.85em;background:light-dark(#f1f5f9,#1b2029);padding:.15rem .35rem;border-radius:.25rem}
  a{color:light-dark(#2563eb,#5b9bff)}
</style></head>
<body><main>
  <h1>This connection could not be authorized</h1>
  <p>${escape(message)}</p>
  ${detail ? `<p><code>${escape(detail)}</code></p>` : ''}
  <p><a href="/settings">Back to settings</a></p>
</main></body></html>`
}

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store')
  const method = getMethod(event)
  const query = getQuery(event)
  const body = method === 'POST' ? await readBody<Record<string, any>>(event).catch(() => ({})) : {}
  const input = readAuthorizeInput({ ...query, ...(body || {}) })

  if (input.responseType !== 'code') {
    return errorPage(event, 400, 'Only the authorization code flow is supported.', `response_type=${input.responseType || '(missing)'}`)
  }
  if (!input.clientId) {
    return errorPage(event, 400, 'The request is missing a client identifier.')
  }
  if (!input.redirectUri) {
    return errorPage(event, 400, 'The request is missing a redirect URI.')
  }
  if (!isAcceptableRedirectUri(input.redirectUri)) {
    return errorPage(event, 400, 'The redirect URI is not allowed.', input.redirectUri)
  }
  if (!input.codeChallenge) {
    return errorPage(event, 400, 'PKCE is required. The request is missing a code challenge.')
  }
  if (input.codeChallengeMethod && input.codeChallengeMethod !== 'S256') {
    return errorPage(event, 400, 'Only the S256 PKCE method is supported.', input.codeChallengeMethod)
  }

  const db = await getRequestDatabase(event)
  const client = await findClient(db, input.clientId)
  if (!client) {
    return errorPage(event, 400, 'This client is not registered with this Serangkai instance.')
  }
  // Exact redirect match (except loopback ports) before anything else: a
  // registered client must not be able to bounce the code somewhere else.
  if (!anyRedirectMatches(input.redirectUri, client.redirectUris)) {
    return errorPage(event, 400, 'The redirect URI does not match the one registered for this client.', input.redirectUri)
  }

  const requested = normalizeScopes(input.scope)
    .filter(scope => (OAUTH_SCOPES as readonly string[]).includes(scope))

  // A signed-out owner cannot consent. Send them to login and come back to the
  // exact same authorization request.
  const user = event.context.user
  if (!user) {
    const target = absoluteAuthorizeUrl(event)
    return sendRedirect(event, `/auth/login?redirect=${encodeURIComponent(target)}`, 302)
  }

  if (method === 'POST') {
    if (body?.decision === 'deny') {
      return sendRedirect(event, appendQuery(input.redirectUri, {
        error: 'access_denied',
        error_description: 'The owner declined the connection.',
        state: input.state,
      }), 302)
    }
    if (body?.decision !== 'approve') {
      return errorPage(event, 400, 'The authorization decision was not understood.')
    }

    // Persist only what the owner approved, not what the client asked for.
    // A single checked box arrives as a string rather than an array, so the
    // presence of the field decides, never `Array.isArray`. `parseScopes` does
    // not default: unchecking everything must deny, not hand back full access.
    const approved = parseScopes(body?.scopes)
    const scopes = approved.filter(scope => requested.includes(scope))
    if (!scopes.length) {
      return errorPage(event, 400, 'Select at least one permission to continue.')
    }

    const code = await createAuthorizationCode(db, {
      clientId: client.id,
      userId: user.id,
      redirectUri: input.redirectUri,
      scopes,
      codeChallenge: input.codeChallenge,
      codeChallengeMethod: 'S256',
      resource: input.resource || null,
    })

    return sendRedirect(event, appendQuery(input.redirectUri, { code, state: input.state }), 302)
  }

  // Render the consent page. It is a plain server-rendered document: it must
  // work before any client JS loads, and it has to be readable to someone who
  // is deciding whether to trust a client.
  setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
  setHeader(event, 'Referrer-Policy', 'no-referrer')
  return renderConsentPage({
    client,
    input,
    scopes: requested,
    owner: String(user.username || 'owner'),
  })
})

/** The current authorization request, rebuilt for the login round-trip. */
function absoluteAuthorizeUrl(event: any): string {
  const url = getRequestURL(event)
  return `${url.pathname}${url.search}`
}

interface ConsentPageInput {
  client: { clientName: string | null; clientUri: string | null }
  input: AuthorizeInput
  scopes: string[]
  owner: string
}

function renderConsentPage({ client, input, scopes, owner }: ConsentPageInput) {
  const escape = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  const scopeRows = scopes.map(scope => `
      <li>
        <label>
          <input type="checkbox" name="scopes" value="${escape(scope)}" checked>
          <span>
            <strong>${scope === 'read' ? 'Read your workspace' : 'Write to your workspace'}</strong>
            <small>${scope === 'read'
              ? 'See artifacts, folders, versions, and the overview.'
              : 'Create, edit, move, and version artifacts, and change sharing.'}</small>
          </span>
        </label>
      </li>`).join('')

  const hidden = (name: string, value: string) => value
    ? `<input type="hidden" name="${name}" value="${escape(value)}">`
    : ''

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Authorize ${escape(client.clientName || 'a client')} · Serangkai</title>
<style>
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
  .client small{display:block;color:light-dark(#64748b,#9aa4b8);font-size:.8rem;
    word-break:break-all}
  ul{list-style:none;margin:0 0 1.25rem;padding:0;display:grid;gap:.5rem}
  label{display:flex;gap:.65rem;align-items:flex-start;padding:.75rem;
    border:1px solid light-dark(#e2e8f0,#28303d);border-radius:.5rem;cursor:pointer}
  input[type=checkbox]{margin-top:.25rem}
  label span{display:block}
  label small{display:block;color:light-dark(#64748b,#9aa4b8);font-size:.85rem}
  .actions{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:1.5rem}
  button{font:inherit;font-weight:600;border-radius:.5rem;padding:.6rem 1rem;
    border:1px solid transparent;cursor:pointer}
  .approve{background:#2563eb;color:#fff}
  .deny{background:transparent;color:inherit;border-color:light-dark(#cbd5e1,#3a4453)}
  .note{margin-top:1.25rem;font-size:.85rem;color:light-dark(#64748b,#9aa4b8)}
  code{font-family:ui-monospace,monospace;font-size:.8em}
</style></head>
<body>
  <main>
    <p class="eyebrow">Agent connection request</p>
    <h1>Allow ${escape(client.clientName || 'this client')} to access your workspace?</h1>
    <p>You are signed in as <strong>${escape(owner)}</strong>. Only approve clients you started yourself.</p>
    <div class="client">
      <span class="mark">${escape((client.clientName || 'C').slice(0, 1).toUpperCase())}</span>
      <span>
        <strong>${escape(client.clientName || 'Unnamed client')}</strong>
        <small>Redirects to <code>${escape(input.redirectUri)}</code></small>
      </span>
    </div>
    <form method="post" action="/oauth/authorize">
      ${hidden('response_type', 'code')}
      ${hidden('client_id', input.clientId)}
      ${hidden('redirect_uri', input.redirectUri)}
      ${hidden('code_challenge', input.codeChallenge)}
      ${hidden('code_challenge_method', 'S256')}
      ${hidden('state', input.state)}
      ${hidden('resource', input.resource)}
      <ul>${scopeRows}</ul>
      <div class="actions">
        <button class="approve" type="submit" name="decision" value="approve">Allow access</button>
        <button class="deny" type="submit" name="decision" value="deny">Deny</button>
      </div>
    </form>
    <p class="note">Serangkai never shares your password, and you can disconnect this client from Settings at any time.</p>
  </main>
</body></html>`
}
