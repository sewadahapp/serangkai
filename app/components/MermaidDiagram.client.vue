<template>
  <div ref="root" class="min-h-24 overflow-auto rounded-lg border bg-muted/20 p-4" role="img" :aria-label="label" />
</template>

<script setup lang="ts">
import mermaid from 'mermaid'

const props = defineProps<{ source: string; label?: string }>()
const root = ref<HTMLElement>()

onMounted(async () => {
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' })
  if (!root.value) return
  try {
    const id = `diagram-${Math.random().toString(36).slice(2)}`
    const result = await mermaid.render(id, props.source)
    root.value.innerHTML = result.svg
  } catch {
    root.value.textContent = 'Unable to render diagram.'
  }
})
</script>
