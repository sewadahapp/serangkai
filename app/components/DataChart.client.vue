<script setup lang="ts">
import { defineChart } from '@tanstack/charts'
import { Chart } from '@tanstack/charts/vue'

const props = defineProps<{ definition: Record<string, unknown>; label?: string }>()
const definition = computed(() => defineChart(props.definition as any))
</script>

<template>
  <Chart :definition="definition" :aria-label="label || 'Data chart'" />
</template>
