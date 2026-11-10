import { createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import githubLight from '@shikijs/themes/github-light'
import githubDark from '@shikijs/themes/github-dark'
import bash from '@shikijs/langs/bash'
import css from '@shikijs/langs/css'
import dockerfile from '@shikijs/langs/dockerfile'
import go from '@shikijs/langs/go'
import html from '@shikijs/langs/html'
import http from '@shikijs/langs/http'
import javascript from '@shikijs/langs/javascript'
import json from '@shikijs/langs/json'
import jsonc from '@shikijs/langs/jsonc'
import markdown from '@shikijs/langs/markdown'
import python from '@shikijs/langs/python'
import rust from '@shikijs/langs/rust'
import sql from '@shikijs/langs/sql'
import typescript from '@shikijs/langs/typescript'
import vue from '@shikijs/langs/vue'
import yaml from '@shikijs/langs/yaml'

/**
 * One Shiki setup for the whole server.
 *
 * The JavaScript regex engine is deliberate: the default Oniguruma engine
 * loads a WASM binary that does not initialize on Cloudflare Workers, so
 * highlighted blocks silently fell back to plain text there. Both the Markdown
 * pipeline (Comark) and the `/api/highlight` endpoint use this module so they
 * cannot drift apart again.
 */
export const SHIKI_THEMES = { light: githubLight, dark: githubDark }

export const SHIKI_LANGUAGES = [
  bash, css, dockerfile, go, html, http, javascript, json, jsonc, markdown,
  python, rust, sql, typescript, vue, yaml,
]

let highlighterPromise: Promise<HighlighterCore> | null = null

export function getHighlighterCore() {
  highlighterPromise ||= createHighlighterCore({
    themes: [githubLight, githubDark],
    langs: SHIKI_LANGUAGES,
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  })
  return highlighterPromise
}