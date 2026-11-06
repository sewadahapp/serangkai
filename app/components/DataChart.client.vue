<script setup lang="ts">
import { areaY, barX, barY, defineChart, lineY, type ChartMark } from '@tanstack/charts'
import { Chart } from '@tanstack/charts/vue'
import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scalePoint } from '@tanstack/charts/scales/point'

/**
 * A JSON-safe chart description.
 *
 * Markdown fences cannot carry functions, and evaluating author-supplied
 * JavaScript would break the artifact security model. This small schema maps
 * data rows onto a fixed set of TanStack Charts marks instead.
 */
interface ChartInput {
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

const props = defineProps<{ definition: Record<string, unknown>; label?: string }>()

const input = computed<ChartInput>(() => (props.definition || {}) as ChartInput)
const rows = computed(() => (Array.isArray(input.value.data) ? input.value.data : []))

const type = computed<'bar' | 'line' | 'area'>(() => {
  const value = input.value.type
  return value === 'line' || value === 'area' ? value : 'bar'
})
const horizontal = computed(() => type.value === 'bar' && input.value.horizontal === true)
const title = computed(() => (typeof input.value.title === 'string' ? input.value.title : ''))
const height = computed(() => (
  typeof input.value.height === 'number' && input.value.height > 0 ? input.value.height : 320
))

function firstKey(predicate: (value: unknown) => boolean, fallback: string) {
  const row = rows.value[0]
  if (!row) return fallback
  return Object.keys(row).find(key => predicate(row[key])) || fallback
}

const xKey = computed(() => (
  typeof input.value.x === 'string' && input.value.x
    ? input.value.x
    : firstKey(value => typeof value !== 'number', 'label')
))
const yKey = computed(() => (
  typeof input.value.y === 'string' && input.value.y
    ? input.value.y
    : firstKey(value => typeof value === 'number', 'value')
))

const color = computed(() => (typeof input.value.color === 'string' ? input.value.color : undefined))

const chart = computed(() => {
  const data = rows.value
  if (!data.length) return null
  const x = xKey.value
  const y = yKey.value
  const categories = data.map(row => String(row[x] ?? ''))
  const axis = {
    xLabel: input.value.xLabel || (horizontal.value ? y : x),
    yLabel: input.value.yLabel || (horizontal.value ? x : y),
  }

  try {
    let mark: ChartMark<any, any, any>
    let scales: Record<string, unknown>

    if (horizontal.value) {
      mark = barX(data, { x: y, y: x, inset: 1, ...(color.value ? { fill: color.value } : {}) })
      scales = {
        x: { scale: scaleLinear, nice: true, grid: true, axis: { label: axis.xLabel } },
        y: {
          scale: () => scaleBand<string>().domain(categories).padding(0.18),
          axis: { label: axis.yLabel },
        },
      }
    } else if (type.value === 'bar') {
      mark = barY(data, { x, y, inset: 1, ...(color.value ? { fill: color.value } : {}) })
      scales = {
        x: {
          scale: () => scaleBand<string>().domain(categories).padding(0.18),
          axis: { label: axis.xLabel },
        },
        y: { scale: scaleLinear, nice: true, grid: true, axis: { label: axis.yLabel } },
      }
    } else if (type.value === 'line') {
      mark = lineY(data, { x, y, points: true, ...(color.value ? { stroke: color.value } : {}) })
      scales = {
        x: {
          scale: () => scalePoint<string>().domain(categories).padding(0.3),
          axis: { label: axis.xLabel },
        },
        y: { scale: scaleLinear, nice: true, grid: true, axis: { label: axis.yLabel } },
      }
    } else {
      mark = areaY(data, { x, y, ...(color.value ? { fill: color.value } : {}) })
      scales = {
        x: {
          scale: () => scalePoint<string>().domain(categories).padding(0.3),
          axis: { label: axis.xLabel },
        },
        y: { scale: scaleLinear, nice: true, grid: true, axis: { label: axis.yLabel } },
      }
    }

    return defineChart({ marks: [mark], scales, svgAnimation: true } as any)
  } catch {
    return null
  }
})

const fallbackJson = computed(() => JSON.stringify(props.definition, null, 2))
const ariaLabel = computed(() => title.value || props.label || 'Data chart')
</script>

<template>
  <figure class="my-6 overflow-hidden rounded-lg border border-[var(--selaras-resolved-border-default)] bg-[var(--selaras-resolved-surface-elevated)] p-4">
    <figcaption v-if="title" class="mb-3 text-sm font-semibold">{{ title }}</figcaption>
    <Chart
      v-if="chart"
      :definition="chart"
      :aria-label="ariaLabel"
      :height="height"
    />
    <pre v-else class="overflow-x-auto rounded-md bg-[var(--selaras-resolved-surface-default)] p-3 font-mono text-xs"><code>{{ fallbackJson }}</code></pre>
  </figure>
</template>