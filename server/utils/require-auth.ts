export function requireUser(event: any) {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  return user
}

export function requireScope(event: any, scope: string) {
  const user = requireUser(event)
  const token = event.context.apiToken
  if (token && !token.scopes.includes(scope) && !token.scopes.includes('full')) {
    throw createError({ statusCode: 403, message: `API token requires ${scope} scope` })
  }
  return user
}
