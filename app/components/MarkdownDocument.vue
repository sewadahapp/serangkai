<template>
  <article class="selaras-prose max-w-none">
    <ComarkMarkdownDocument :value="body" :components="components" />
  </article>
</template>

<script setup lang="ts">
import { MarkdownDocument as ComarkMarkdownDocument } from '@comark/vue'
import { artifactComponents } from '#shared/artifact-components'
import { selarasComponents } from '~/utils/selaras-components'
import MarkdownPre from './MarkdownPre.vue'
import MarkdownMermaid from './MarkdownMermaid.vue'
import MarkdownChart from './MarkdownChart.vue'
import SerangkaiTable from './SerangkaiTable.vue'

/**
 * Renders a sanitized Comark document with Selaras components.
 *
 * The server parses and sanitizes the document; this component only maps the
 * trusted tag vocabulary to Vue components. No parser or plugin code ships to
 * the browser for artifact rendering.
 */
defineProps<{ body: Record<string, any> }>()

const components: Record<string, any> = {
  pre: MarkdownPre,
  'serangkai-mermaid': MarkdownMermaid,
  'serangkai-chart': MarkdownChart,
  's-table': SerangkaiTable,
}

for (const entry of artifactComponents) {
  const component = selarasComponents[entry.component]
  if (component) components[entry.tag] = component
}

// Serialized JSON needs a small bridge for Selaras' children-as-columns table API.
components['s-table'] = SerangkaiTable
</script>
