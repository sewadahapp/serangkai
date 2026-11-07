<template>
  <div class="serangkai-mermaid">
    <ClientOnly>
      <MermaidDiagram :source="source" label="Mermaid diagram" />
      <template #fallback>
        <pre class="serangkai-mermaid-fallback"><code>{{ source }}</code></pre>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })
defineProps<{ source?: string }>()
</script>
