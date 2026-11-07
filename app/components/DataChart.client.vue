<script setup lang="ts">
import { Chart } from '@tanstack/charts/vue'
import { resolveChart } from '~/utils/chart'

const props = defineProps<{ definition: Record<string, unknown>; label?: string }>()

const resolved = computed(() => resolveChart(props.definition, props.label))
const chart = computed(() => resolved.value.chart)
const title = computed(() => resolved.value.title)
const height = computed(() => resolved.value.height)
const fallbackJson = computed(() => resolved.value.fallbackJson)
const ariaLabel = computed(() => resolved.value.ariaLabel)
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
