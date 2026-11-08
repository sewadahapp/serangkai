<template>
  <SProsePre
    :code="code"
    :language="language"
    :filename="filename"
    icon="lucide:file-code"
  >
    <span class="serangkai-shiki"><slot /></span>
  </SProsePre>
</template>

<script setup lang="ts">
import { textContent } from 'comark/utils'

/**
 * Renders a Comark `pre` node with Selaras' code chrome.
 *
 * Comark's Shiki plugin replaces the code body with highlighted nodes, so the
 * copy source is reconstructed from the original node rather than a `code`
 * prop.
 */
defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  __node?: any
  language?: string
  filename?: string
}>(), {
  __node: undefined,
  language: '',
  filename: undefined,
})

const code = computed(() => props.__node ? textContent(props.__node).replace(/\n$/, '') : '')
</script>
