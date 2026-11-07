import mermaid from 'mermaid'

/**
 * Trusted Mermaid runtime for sandboxed HTML artifacts.
 *
 * Injected only when the artifact contains a `.mermaid` element or a
 * `data-serangkai-mermaid` marker. Mermaid source is declarative: it never
 * evaluates artifact-authored JavaScript, and the strict security level keeps
 * HTML labels sanitized. The original source is kept so theme changes can
 * re-render the diagram.
 */

interface RuntimeApi {
  renderMermaid?: () => void
}

const sources = new WeakMap<Element, string>()
let renderToken = 0

function isDark() {
  const declared = document.documentElement.dataset.serangkaiMode
  if (declared === 'dark' || declared === 'light') return declared === 'dark'

  const scheme = (getComputedStyle(document.documentElement).colorScheme || '').toLowerCase()
  const hasLight = scheme.includes('light')
  const hasDark = scheme.includes('dark')
  if (hasDark !== hasLight) return hasDark

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function markers() {
  // `.serangkai-mermaid` keeps rendered data-attribute markers discoverable
  // after the attribute is removed, so a color-mode switch re-renders them too.
  return [...document.querySelectorAll<HTMLElement>('.mermaid, .serangkai-mermaid, [data-serangkai-mermaid]')]
}

async function renderMermaid() {
  const token = ++renderToken
  const list = markers()
  if (!list.length) return

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
    theme: isDark() ? 'dark' : 'neutral',
  })

  for (const [index, marker] of list.entries()) {
    if (!sources.has(marker)) {
      sources.set(marker, marker.dataset.serangkaiMermaid || marker.textContent || '')
    }
    const source = sources.get(marker) || ''
    if (!source.trim()) continue

    const id = `serangkai-mermaid-${token}-${index}`
    try {
      const result = await mermaid.render(id, source)
      if (token !== renderToken) return
      marker.innerHTML = result.svg
      marker.classList.add('serangkai-mermaid')
      marker.removeAttribute('data-serangkai-mermaid')
    } catch {
      if (token !== renderToken) return
      document.getElementById(id)?.remove()
      marker.textContent = 'Unable to render diagram.'
      marker.classList.add('serangkai-runtime-error')
    }
  }
}

function ready() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderMermaid, { once: true })
  } else {
    renderMermaid()
  }
}

// The parent app posts the live workspace mode into the frame; re-render so
// Mermaid receives a matching theme instead of a mismatched light/dark SVG.
window.addEventListener('serangkai:colormode', renderMermaid)

const api = ((window as any).SerangkaiArtifacts ||= {}) as RuntimeApi
api.renderMermaid = renderMermaid

ready()
