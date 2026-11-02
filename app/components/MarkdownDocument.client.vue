<template>
  <article ref="root" class="prose max-w-none" v-html="html" />
</template>

<script setup lang="ts">
import { createApp, h } from 'vue'
import MermaidDiagram from './MermaidDiagram.client.vue'
import DataChart from './DataChart.client.vue'

const props = defineProps<{ html: string }>()
const root = ref<HTMLElement>()
const html = computed(() => props.html)

onMounted(() => {
  if (!root.value) return
  root.value.querySelectorAll<HTMLElement>('[data-mermaid]').forEach(node => {
    const source = node.dataset.mermaid || ''
    createApp({ render: () => h(MermaidDiagram, { source, label: 'Mermaid diagram' }) }).mount(node)
  })
  root.value.querySelectorAll<HTMLElement>('[data-chart]').forEach(node => {
    try {
      const definition = JSON.parse(node.dataset.chart || '{}')
      createApp({ render: () => h(DataChart, { definition, label: 'Data chart' }) }).mount(node)
    } catch {
      // Keep the server-rendered fallback visible.
    }
  })
})
</script>
