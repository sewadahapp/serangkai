import { createApp, h } from 'vue'
import { Chart } from '@tanstack/charts/vue'
import { resolveChart } from '../app/utils/chart'

/**
 * Trusted chart runtime for sandboxed HTML artifacts.
 *
 * The artifact iframe has no network access and cannot load npm packages. This
 * small same-origin bundle is injected only when the artifact carries a
 * `data-serangkai-chart` marker, so the author gets TanStack Charts without
 * turning on remote scripts. The definition stays JSON: no artifact JavaScript
 * is evaluated.
 */

interface RuntimeApi {
  renderCharts?: () => void
}

const mounted = new WeakSet<Element>()

function definitionFor(marker: HTMLElement): Record<string, unknown> | null {
  const attribute = marker.dataset.serangkaiChart || ''
  const raw = attribute.trim()
    ? attribute
    : marker.tagName === 'SCRIPT'
      ? marker.textContent || ''
      : ''

  if (!raw.trim()) return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

function errorBlock(message: string, detail?: string) {
  const pre = document.createElement('pre')
  pre.className = 'serangkai-runtime-error'
  pre.textContent = detail ? `${message}\n\n${detail}` : message
  return pre
}

function figureFor(marker: HTMLElement) {
  if (marker.tagName !== 'SCRIPT') {
    marker.replaceChildren()
    marker.classList.add('serangkai-chart-figure')
    return marker
  }

  const figure = document.createElement('figure')
  figure.className = 'serangkai-chart-figure'
  marker.after(figure)
  return figure
}

function renderChart(marker: HTMLElement) {
  if (mounted.has(marker)) return
  mounted.add(marker)

  const definition = definitionFor(marker)
  if (!definition) {
    const figure = figureFor(marker)
    figure.append(errorBlock('This chart is not valid JSON.'))
    return
  }

  const resolved = resolveChart(definition, 'Data chart')
  const figure = figureFor(marker)

  if (resolved.title) {
    const caption = document.createElement('figcaption')
    caption.textContent = resolved.title
    figure.append(caption)
  }

  if (!resolved.chart) {
    figure.append(errorBlock('This chart has no plottable data.', resolved.fallbackJson))
    return
  }

  const host = document.createElement('div')
  figure.append(host)
  createApp({
    render: () => h(Chart, {
      definition: resolved.chart,
      ariaLabel: resolved.ariaLabel,
      height: resolved.height,
    }),
  }).mount(host)
}

function renderCharts() {
  document.querySelectorAll<HTMLElement>('[data-serangkai-chart]').forEach(renderChart)
}

function ready() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderCharts, { once: true })
  } else {
    renderCharts()
  }
}

const api = ((window as any).SerangkaiArtifacts ||= {}) as RuntimeApi
api.renderCharts = renderCharts

ready()
