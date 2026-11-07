<template>
  <article class="selaras-prose max-w-none">
    <MDCRenderer :body="body" :components="components" :tag="false" />
  </article>
</template>

<script setup lang="ts">
import MarkdownPre from './MarkdownPre.vue'
import MarkdownMermaid from './MarkdownMermaid.vue'
import MarkdownChart from './MarkdownChart.vue'

/**
 * Component-driven Markdown renderer.
 *
 * The server sends a sanitized MDC body. `MDCRenderer` turns it into Vue
 * nodes, so Mermaid and charts are ordinary components and no `v-html` or
 * manual `createApp().mount()` pass is needed.
 */
defineProps<{ body: Record<string, unknown> }>()

const components = {
  pre: MarkdownPre,
  'serangkai-mermaid': MarkdownMermaid,
  'serangkai-chart': MarkdownChart,
  's-alert': 'SAlert',
  's-badge': 'SBadge',
  's-callout': 'SCallout',
  's-card': 'SCard',
  's-card-group': 'SCardGroup',
  's-icon': 'SIcon',
}
</script>
