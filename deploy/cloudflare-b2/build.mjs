#!/usr/bin/env node
/**
 * Builds the Serangkai Cloudflare Worker into ./.output.
 *
 * The Deploy to Cloudflare button treats this directory as a standalone
 * repository root, so the application source is fetched at build time instead
 * of duplicated here.
 *
 * Reproducibility: the source ref resolves as SERANGKAI_REF env (explicit
 * override) > the committed `serangkai.ref` pin (immutable commit / release
 * tag) > the development branch. The resolved ref is recorded in
 * `.output/serangkai-source.json` so a deployment is auditable. Upgrading is
 * deliberate: edit `serangkai.ref` or set SERANGKAI_REF, then rebuild.
 * SERANGKAI_LOCAL_SOURCE builds a local checkout instead — for developing this
 * template or deploying your own fork.
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveRef } from './ref.mjs'

const templateDir = dirname(fileURLToPath(import.meta.url))
const REPO = process.env.SERANGKAI_REPO || 'sewadahapp/serangkai'
const { ref: REF, source: REF_SOURCE } = resolveRef({ pinFile: join(templateDir, 'serangkai.ref') })
const OUTPUT = resolve('.output')

function run(command, args, cwd) {
  console.log(`> ${command} ${args.join(' ')}`)
  execFileSync(command, args, { cwd, stdio: 'inherit' })
}

let sourceDir = process.env.SERANGKAI_LOCAL_SOURCE ? resolve(process.env.SERANGKAI_LOCAL_SOURCE) : undefined
let tempDir

try {
  if (!sourceDir) {
    tempDir = mkdtempSync(join(tmpdir(), 'serangkai-build-'))
    const archive = join(tempDir, 'source.tar.gz')
    const url = `https://codeload.github.com/${REPO}/tar.gz/${REF}`
    console.log(`> fetching ${url} (ref source: ${REF_SOURCE})`)
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Could not download ${url}: ${response.status}`)
    writeFileSync(archive, Buffer.from(await response.arrayBuffer()))
    run('tar', ['-xzf', archive, '-C', tempDir])
    const extracted = readdirSync(tempDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => join(tempDir, entry.name))
    if (extracted.length !== 1) throw new Error(`Unexpected archive layout in ${url}`)
    sourceDir = extracted[0]
  }

  try {
    run('bun', ['--version'], sourceDir)
  } catch {
    throw new Error('Bun 1.4+ is required to build Serangkai: https://bun.sh')
  }
  run('bun', ['install', '--frozen-lockfile', '--ignore-scripts'], sourceDir)
  run('bun', ['run', 'build:cloudflare'], sourceDir)
  if (!existsSync(join(sourceDir, '.output'))) {
    throw new Error(`The Cloudflare build did not produce .output in ${sourceDir}`)
  }

  rmSync(OUTPUT, { recursive: true, force: true })
  cpSync(join(sourceDir, '.output'), OUTPUT, { recursive: true })
  writeFileSync(join(OUTPUT, 'serangkai-source.json'), `${JSON.stringify({
    repo: REPO,
    ref: REF,
    refSource: REF_SOURCE,
    localSource: Boolean(process.env.SERANGKAI_LOCAL_SOURCE),
    builtAt: new Date().toISOString(),
  }, null, 2)}\n`)
  console.log(`Built ./.output from ${sourceDir} (repo=${REPO} ref=${REF} source=${REF_SOURCE})`)
} finally {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true })
}