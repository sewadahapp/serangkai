import { Database } from 'bun:sqlite'

// Credential-free Hrana v2 HTTP fixture. SQL and rollback run in real SQLite;
// the production @libsql/client/web handles serialization and result mapping.
// Only one-shot execute/batch streams are supported, as used by this adapter.
export function startLibsqlMock({ token = 'test-turso-token' } = {}) {
  const sqlite = new Database(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  let requests = 0
  let failures = 0
  const errorResult = error => ({ message: error.message, code: error.code || 'SQLITE_ERROR' })
  const decode = value => value.type === 'null' ? null
    : value.type === 'integer' ? Number(value.value)
    : value.type === 'blob' ? Buffer.from(value.base64, 'base64') : value.value
  const encode = value => value == null ? { type: 'null' }
    : typeof value === 'number' ? Number.isInteger(value)
      ? { type: 'integer', value: String(value) } : { type: 'float', value }
    : value instanceof Uint8Array ? { type: 'blob', base64: Buffer.from(value).toString('base64') }
    : { type: 'text', value: String(value) }

  function execute(stmt, stored) {
    const sql = stmt.sql ?? stored.get(stmt.sql_id)
    const query = sqlite.prepare(sql)
    const rows = query.values(...(stmt.args || []).map(decode)) || []
    return {
      cols: query.columnNames.map(name => ({ name })),
      rows: stmt.want_rows ? rows.map(row => row.map(encode)) : [],
      affected_row_count: /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql)
        ? sqlite.query('SELECT changes() AS n').get().n : 0,
      last_insert_rowid: String(sqlite.query('SELECT last_insert_rowid() AS id').get().id),
    }
  }

  function batch(batch, stored) {
    const step_results = [], step_errors = []
    function matches(condition) {
      if (!condition) return true
      switch (condition.type) {
        case 'ok': return step_results[condition.step] != null
        case 'error': return step_errors[condition.step] != null
        case 'not': return !matches(condition.cond)
        case 'and': return condition.conds.every(matches)
        case 'or': return condition.conds.some(matches)
        default: throw new Error(`Unsupported batch condition: ${condition.type}`)
      }
    }
    for (const step of batch.steps) {
      let result = null, error = null
      if (matches(step.condition)) {
        try { result = execute(step.stmt, stored) }
        catch (caught) { error = errorResult(caught) }
      }
      step_results.push(result)
      step_errors.push(error)
    }
    return { step_results, step_errors }
  }

  const server = Bun.serve({
    hostname: '127.0.0.1', port: 0,
    async fetch(request) {
      if (request.headers.get('authorization') !== `Bearer ${token}`) return new Response('Unauthorized', { status: 401 })
      if (new URL(request.url).pathname !== '/v2/pipeline') return new Response('Not found', { status: 404 })
      requests++
      if (failures > 0) { failures--; return new Response('Temporary failure', { status: 503 }) }
      const body = await request.json()
      const stored = new Map()
      const results = body.requests.map(item => {
        try {
          let response = { type: item.type }
          switch (item.type) {
            case 'execute': response.result = execute(item.stmt, stored); break
            case 'batch': response.result = batch(item.batch, stored); break
            case 'store_sql': stored.set(item.sql_id, item.sql); break
            case 'close_sql': stored.delete(item.sql_id); break
            case 'close': break
            default: throw new Error(`Unsupported stream request: ${item.type}`)
          }
          return { type: 'ok', response }
        } catch (error) { return { type: 'error', error: errorResult(error) } }
      })
      return Response.json({ baton: null, base_url: null, results })
    },
  })
  return {
    sqlite,
    url: server.url.origin,
    token,
    get requests() { return requests },
    failNext(count = 1) { failures = count },
    async close() { await server.stop(true); sqlite.close() },
  }
}
