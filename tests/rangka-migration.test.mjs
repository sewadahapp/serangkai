import assert from 'node:assert/strict'
import { randomBytes, createHmac } from 'node:crypto'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { Database } from 'bun:sqlite'
import { BOOTSTRAP_SQL } from '../server/db/bootstrap.ts'
import { test } from 'node:test'
import { serverRuntime } from './helpers/server.mjs'
import { adminEnv, login, seedUser } from './helpers/auth.mjs'

test('an existing installation recovers empty bootstrap tables and migrates documents, files, history, and signed links to Rangka', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'serangkai-rangka-upgrade-'))
  const databasePath = join(directory, 'old.db')
  const storagePath = join(directory, 'files')
  const contentPath = 'owner-old/document-old/content'
  const port = 4450 + Math.floor(Math.random() * 100)
  const base = `http://127.0.0.1:${port}`
  const shareSecret = randomBytes(32).toString('hex')
  const key = createHmac('sha256', shareSecret).update('document-old').digest('hex')
  let child
  const stop = async () => { if (child && child.exitCode === null) { const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited } }
  const start = async () => {
    let startupError = ''
    child = spawn(serverRuntime, ['.output/server/index.mjs'], { env: { ...process.env, ...adminEnv(), PORT: String(port), JWT_SECRET: 'stable-upgrade-session-secret-at-least-32-characters', SHARE_SECRET: shareSecret, DATABASE_PATH: databasePath, STORAGE_PATH: storagePath }, stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout.on('data', chunk => { startupError = (startupError + chunk.toString()).slice(-4000) })
    child.stderr.on('data', chunk => { startupError = (startupError + chunk.toString()).slice(-4000) })
    for (let i = 0; i < 120; i++) { if (child.exitCode !== null) break; try { if ((await fetch(`${base}/api/health`)).ok) return } catch {} await new Promise(resolve => setTimeout(resolve, 100)) }
    throw new Error(`Upgrade server did not start (exit ${child.exitCode}, signal ${child.signalCode})\n${startupError}`)
  }
  try {
    const sqlite = new Database(databasePath)
    sqlite.exec(await readFile(new URL('./fixtures/pre-rangka-schema.sql', import.meta.url), 'utf8'))
    sqlite.close()
    await seedUser(databasePath, { id: 'owner-old', username: 'owner' })
    const legacy = new Database(databasePath)
    legacy.exec(`PRAGMA foreign_keys = ON;
      INSERT INTO folders (id,user_id,name,path) VALUES ('folder-old','owner-old','Old folder','/Old folder');
      INSERT INTO artifacts (id,user_id,folder_id,slug,title,type,visibility,content_path) VALUES ('document-old','owner-old','folder-old','existing-signed-link','Old document','markdown','unlisted','owner-old/document-old/content');
      INSERT INTO artifact_versions (id,artifact_id,version,content_path) VALUES ('version-old','document-old',1,'owner-old/document-old/content');`)
    legacy.exec(BOOTSTRAP_SQL)
    legacy.close()
    await mkdir(join(storagePath, 'owner-old', 'document-old'), { recursive: true })
    await writeFile(join(storagePath, contentPath), '# Existing document\n')
    await start()
    const headers = { cookie: (await login(base)).cookie, 'content-type': 'application/json' }
    const list = await (await fetch(`${base}/api/rangka`, { headers })).json()
    assert.equal(list.rangka[0].id, 'document-old')
    assert.equal(list.rangka[0].folderId, 'folder-old')
    const signedLink = `${base}/share/existing-signed-link?k=${key}`
    const shared = await fetch(signedLink)
    assert.equal(shared.status, 200)
    assert.match(await shared.text(), /Existing document/)
    const versions = await (await fetch(`${base}/api/rangka/document-old/versions?page=1`, { headers })).json()
    assert.equal(versions.latestVersion, 1)
    assert.equal(versions.versions[0].id, 'version-old')
    const updated = await fetch(`${base}/api/rangka/document-old`, { method: 'PUT', headers, body: JSON.stringify({ content: '# Updated rangka', baseVersion: 1 }) })
    assert.equal(updated.status, 200)
    const restored = await fetch(`${base}/api/rangka/document-old/versions/1/restore`, { method: 'POST', headers })
    assert.equal((await restored.json()).version, 3)
    assert.equal(await (await fetch(`${base}/api/rangka/document-old/download`, { headers })).text(), '# Existing document\n')
    await stop()
    await start()
    assert.equal((await fetch(signedLink)).status, 200)
    const persisted = new Database(databasePath)
    assert.equal(persisted.prepare('SELECT COUNT(*) n FROM rangka_versions').get().n, 3)
    assert.deepEqual(persisted.prepare('PRAGMA foreign_key_check').all(), [])
    assert.equal(persisted.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name IN ('artifacts','artifact_versions')").get().n, 0)
    persisted.close()
  } finally { await stop(); await rm(directory, { recursive: true, force: true }) }
})
