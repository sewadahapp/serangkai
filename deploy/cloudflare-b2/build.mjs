#!/usr/bin/env node
/**
 * Builds the Serangkai Cloudflare Worker into ./.output.
 *
 * The Deploy to Cloudflare button treats this directory as a standalone
 * repository root, so the application source is fetched at build time instead
 * of duplicated here. Set SERANGKAI_REF to pin a branch, tag, or commit.
 * SERANGKAI_LOCAL_SOURCE builds a local checkout instead — for developing this
 * template or deploying your own fork.
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const REPO = process.env.SERANGKAI_REPO || 'sewadahapp/serangkai'
const REF = process.env.SERANGKAI_REF || 'master'
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
    console.log(`> fetching ${url}`)
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
  console.log(`Built ./.output from ${sourceDir}`)
} finally {
  if (tempDir) rmSync(tempDir, { recursive: true, force: true })
}