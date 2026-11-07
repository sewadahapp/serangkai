import { areaY, barX, barY, defineChart, lineY, type ChartMark } from '@tanstack/charts'
import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scalePoint } from '@tanstack/charts/scales/point'

/**
 * A JSON-safe chart description.
 *
 * Markdown fences and HTML artifacts cannot carry functions, and evaluating
 * author-supplied JavaScript would break the artifact security model. This
 * small schema maps data rows onto a fixed set of TanStack Charts marks instead.
 */
export interface ChartInput {
  type?: 'bar' | 'line' | 'area'
  data?: Array<Record<string, unknown>>
  x?: string
  y?: string
  title?: string
  xLabel?: string
  yLabel?: string
  horizontal?: boolean
  color?: string
  height?: number
}

export interface ResolvedChart {
  /** A TanStack chart definition, or null when the input cannot be charted. */
  chart: any
  title: string
  height: number
  ariaLabel: string
  fallbackJson: string
}

function firstKey(rows: Array<Record<string, unknown>>, predicate: (value: unknown) => boolean, fallback: string) {
  const row = rows[0]
  if (!row) return fallback
  return Object.keys(row).find(key => predicate(row[key])) || fallback
}

/**
 * Resolves the shared chart schema. Kept free of Vue so the Markdown renderer
 * and the sandboxed HTML runtime can use the exact same rules and fallbacks.
 */
export function resolveChart(definition: Record<string, unknown>, label = 'Data chart'): ResolvedChart {
  const input = (definition || {}) as ChartInput
  const rows = Array.isArray(input.data) ? input.data : []
  const type = input.type === 'line' || input.type === 'area' ? input.type : 'bar'
  const horizontal = type === 'bar' && input.horizontal === true
  const title = typeof input.title === 'string' ? input.title : ''
  const height = typeof input.height === 'number' && input.height > 0 ? input.height : 320
  const xKey = typeof input.x === 'string' && input.x
    ? input.x
    : firstKey(rows, value => typeof value !== 'number', 'label')
  const yKey = typeof input.y === 'string' && input.y
    ? input.y
    : firstKey(rows, value => typeof value === 'number', 'value')
  const color = typeof input.color === 'string' ? input.color : undefined
  const fallbackJson = JSON.stringify(definition, null, 2)
  const ariaLabel = title || label

  if (!rows.length) {
    return { chart: null, title, height, ariaLabel, fallbackJson }
  }

  const categories = rows.map(row => String(row[xKey] ?? ''))
  const axis = {
    xLabel: input.xLabel || (horizontal ? yKey : xKey),
    yLabel: input.yLabel || (horizontal ? xKey : yKey),
  }

  try {
    let mark: ChartMark<any, any, any>
    let scales: Record<string, unknown>

    if (horizontal) {
      mark = barX(rows, { x: yKey, y: xKey, inset: 1, ...(color ? { fill: color } : {}) })
      scales = {
        x: { scale: scaleLinear, nice: true, grid: true, axis: { label: axis.xLabel } },
        y: {
          scale: () => scaleBand<string>().domain(categories).padding(0.18),
          axis: { label: axis.yLabel },
        },
      }
    } else if (type === 'bar') {
      mark = barY(rows, { x: xKey, y: yKey, inset: 1, ...(color ? { fill: color } : {}) })
      scales = {
        x: {
          scale: () => scaleBand<string>().domain(categories).padding(0.18),
          axis: { label: axis.xLabel },
        },
        y: { scale: scaleLinear, nice: true, grid: true, axis: { label: axis.yLabel } },
      }
    } else if (type === 'line') {
      mark = lineY(rows, { x: xKey, y: yKey, points: true, ...(color ? { stroke: color } : {}) })
      scales = {
        x: {
          scale: () => scalePoint<string>().domain(categories).padding(0.3),
          axis: { label: axis.xLabel },
        },
        y: { scale: scaleLinear, nice: true, grid: true, axis: { label: axis.yLabel } },
      }
    } else {
      mark = areaY(rows, { x: xKey, y: yKey, ...(color ? { fill: color } : {}) })
      scales = {
        x: {
          scale: () => scalePoint<string>().domain(categories).padding(0.3),
          axis: { label: axis.xLabel },
        },
        y: { scale: scaleLinear, nice: true, grid: true, axis: { label: axis.yLabel } },
      }
    }

    return {
      chart: defineChart({ marks: [mark], scales, svgAnimation: true } as any),
      title,
      height,
      ariaLabel,
      fallbackJson,
    }
  } catch {
    return { chart: null, title, height, ariaLabel, fallbackJson }
  }
}
