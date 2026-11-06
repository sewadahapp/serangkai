<template>
  <article ref="root" class="selaras-prose max-w-none" v-html="html" />
</template>

<script setup lang="ts">
import { createApp, h, nextTick, onBeforeUnmount, onMounted } from 'vue'
import MermaidDiagram from './MermaidDiagram.client.vue'
import DataChart from './DataChart.client.vue'

const props = defineProps<{ html: string }>()
const root = ref<HTMLElement>()
const html = computed(() => props.html)
let observer: MutationObserver | undefined

/**
 * Markers are plain divs inside sanitized Markdown output, so each one gets a
 * real Vue app mounted into it.
 *
 * Mounting is driven by a MutationObserver rather than a single mount hook:
 * the host page can re-render (and re-patch the `v-html` subtree) after this
 * component first appears, which would otherwise wipe a mounted diagram and
 * leave the fallback behind. The `data-mounted` flag keeps it idempotent.
 */
async function mountMarkers() {
  await nextTick()
  if (!root.value) return

  root.value.querySelectorAll<HTMLElement>('[data-mermaid]:not([data-mounted])').forEach((node) => {
    node.dataset.mounted = '1'
    const source = node.dataset.mermaid || ''
    createApp({ render: () => h(MermaidDiagram, { source, label: 'Mermaid diagram' }) }).mount(node)
  })

  root.value.querySelectorAll<HTMLElement>('[data-chart]:not([data-mounted])').forEach((node) => {
    try {
      const definition = JSON.parse(node.dataset.chart || '{}')
      node.dataset.mounted = '1'
      createApp({ render: () => h(DataChart, { definition, label: 'Data chart' }) }).mount(node)
    } catch {
      // Leave the server-rendered source visible.
    }
  })
}

onMounted(() => {
  mountMarkers()
  if (root.value) {
    observer = new MutationObserver(() => { mountMarkers() })
    observer.observe(root.value, { childList: true, subtree: true })
  }
})

onBeforeUnmount(() => observer?.disconnect())
</script>
