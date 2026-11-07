<template>
  <SProsePre
    :code="code"
    :language="language"
    :filename="filename"
  >
    <span class="serangkai-shiki"><slot /></span>
  </SProsePre>
</template>

<script setup lang="ts">
/**
 * Renders an MDC `pre` node with Selaras' code chrome.
 *
 * The MDC parser provides the raw `code` (for the copy button) and the
 * highlighted child spans (from the server-side Shiki pass).
 */
defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{
  code?: string
  language?: string
  filename?: string
}>(), {
  code: '',
  language: '',
  filename: undefined,
})
</script>
