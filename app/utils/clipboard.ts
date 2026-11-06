/**
 * Copies text to the clipboard.
 *
 * `navigator.clipboard` only exists in secure contexts. Self-hosted instances
 * are often opened over plain HTTP on a LAN host, so fall back to a temporary
 * textarea with `execCommand('copy')` rather than failing silently.
 */
export async function copyText(value: string): Promise<boolean> {
  if (!value) return false

  if (import.meta.client && window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      // Permission denied or unavailable; try the legacy path.
    }
  }

  if (!import.meta.client) return false

  try {
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.top = '0'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(textarea)
    return copied
  } catch {
    return false
  }
}
