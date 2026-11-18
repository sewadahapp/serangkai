<template>
  <article class="max-w-none">
    <ComarkMarkdownDocument
      :value="body"
      :components="components"
      class="selaras-prose"
    />
  </article>
</template>

<script setup lang="ts">
import { MarkdownDocument as ComarkMarkdownDocument } from '@comark/vue'
import { rangkaComponents } from '#shared/rangka-components'
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
 * the browser for rangka rendering.
 *
 * `selaras-prose` belongs on Comark's root wrapper because that wrapper holds
 * the rendered block elements. Selaras spaces blocks with a direct-child
 * selector, so putting the class on the outer <article> leaves Markdown blocks
 * with heading margins but no sibling rhythm.
 */
defineProps<{ body: Record<string, any> }>()

const components: Record<string, any> = {
  pre: MarkdownPre,
  'serangkai-mermaid': MarkdownMermaid,
  'serangkai-chart': MarkdownChart,
  's-table': SerangkaiTable,
}

for (const entry of rangkaComponents) {
  const component = selarasComponents[entry.component]
  if (component) components[entry.tag] = component
}

// Serialized JSON needs a small bridge for Selaras' children-as-columns table API.
components['s-table'] = SerangkaiTable
</script>
