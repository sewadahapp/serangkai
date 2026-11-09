export function requireUser(event: any) {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  return user
}

/**
 * Browser-session only.
 *
 * The auth middleware sets `apiToken` when a request presents a bearer token.
 * Settings surfaces that manage credentials must never accept one: an agent
 * must not be able to list or revoke other grants, or escape its own scopes by
 * acting as the owner. This is the same rule the MCP endpoint already applies
 * in reverse.
 */
export function requireSessionUser(event: any) {
  if (event.context.apiToken) {
    throw createError({ statusCode: 401, message: 'This endpoint requires a browser session, not an API token.' })
  }
  return requireUser(event)
}

export function requireScope(event: any, scope: string) {
  const user = requireUser(event)
  const token = event.context.apiToken
  if (token && !token.scopes.includes(scope) && !token.scopes.includes('full')) {
    throw createError({ statusCode: 403, message: `API token requires ${scope} scope` })
  }
  return user
}
