<template>
  <div ref="root" class="min-h-24 overflow-auto rounded-lg border bg-muted/20 p-4" role="img" :aria-label="label" />
</template>

<script setup lang="ts">
import mermaid from 'mermaid'

const props = defineProps<{ source: string; label?: string }>()
const root = ref<HTMLElement>()
let observer: MutationObserver | undefined
let renderToken = 0

function isDark() {
  return document.documentElement.classList.contains('dark')
}

async function render() {
  if (!root.value) return
  const token = ++renderToken
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: isDark() ? 'dark' : 'neutral',
  })
  try {
    const id = `diagram-${Math.random().toString(36).slice(2)}`
    const result = await mermaid.render(id, props.source)
    // A mode switch can start a second render; only the newest wins.
    if (token === renderToken && root.value) root.value.innerHTML = result.svg
  } catch {
    if (token === renderToken && root.value) root.value.textContent = 'Unable to render diagram.'
  }
}

onMounted(() => {
  render()
  observer = new MutationObserver(render)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

onBeforeUnmount(() => observer?.disconnect())
</script>