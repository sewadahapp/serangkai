/** Fence languages Shiki may still load lazily beyond the pre-registered set. */
const ALIASES: Record<string, string> = {
  sh: 'bash', shell: 'bash', console: 'bash', zsh: 'bash',
  yml: 'yaml', py: 'python', rs: 'rust', md: 'markdown',
  text: '', plaintext: '', txt: '',
}

export function normalizeLanguage(lang = '') {
  const raw = lang.trim().toLowerCase().split(/\s+/)[0] || ''
  if (raw in ALIASES) return ALIASES[raw]
  return raw
}
