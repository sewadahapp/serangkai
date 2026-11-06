/**
 * Copy-to-clipboard for Markdown code blocks.
 *
 * Shiki emits plain markup, and Markdown output is sanitized, so the copy button
 * cannot carry a Vue listener. This delegates clicks from the container instead,
 * which also covers blocks added after hydration.
 */
export default defineNuxtPlugin(() => {
  if (import.meta.server) return

  document.addEventListener('click', async (event) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const button = target.closest<HTMLButtonElement>('[data-serangkai-copy]')
    if (!button) return

    const block = button.closest('.serangkai-code')
    const code = block?.querySelector('pre code')?.textContent
    if (!code) return

    event.preventDefault()
    try {
      await navigator.clipboard.writeText(code)
      button.textContent = 'Copied'
      button.setAttribute('data-copied', '')
      setTimeout(() => {
        button.textContent = 'Copy'
        button.removeAttribute('data-copied')
      }, 1500)
    } catch {
      button.textContent = 'Copy failed'
      setTimeout(() => { button.textContent = 'Copy' }, 1500)
    }
  })
})
