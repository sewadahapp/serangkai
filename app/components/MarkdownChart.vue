<template>
  <div class="serangkai-chart">
    <ClientOnly>
      <DataChart v-if="definition" :definition="definition" label="Data chart" />
      <template #fallback>
        <pre class="serangkai-chart-fallback"><code>{{ pretty }}</code></pre>
      </template>
    </ClientOnly>
    <pre v-if="!definition" class="serangkai-chart-error"><code>{{ source }}</code></pre>
  </div>
</template>

<script setup lang="ts">
/**
 * Renders an MDC chart node. The server has already validated that the JSON is
 * an object; parsing again here keeps the component independent of the parser.
 */
defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  definition?: string
}>(), {
  definition: '',
})

const parsed = computed(() => {
  try {
    const value = JSON.parse(props.definition)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch {
    return null
  }
})

const definition = computed(() => parsed.value as Record<string, unknown> | null)
const pretty = computed(() => definition.value ? JSON.stringify(definition.value, null, 2) : props.definition)
const source = computed(() => props.definition)
</script>
