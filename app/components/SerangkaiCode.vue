<template>
  <SProsePre
    :code="code"
    :language="language"
    :filename="filename"
    :show-header="showHeader"
  >
    <!-- eslint-disable-next-line vue/no-v-html -- Shiki output is sanitized
         server-side by /api/highlight, which strips everything but
         pre/code/span and their class/style attributes. -->
    <span v-if="html" class="serangkai-shiki" v-html="html" />
    <code v-else>{{ code }}</code>
  </SProsePre>
</template>

<script setup lang="ts">
/**
 * Highlighted code for the app's own snippets (MCP config, curl examples).
 *
 * The Markdown pipeline highlights server-side because sanitized `v-html` cannot
 * carry Vue components. Here we are in a real template, so the actual
 * `SProsePre` component provides the header and copy button, and only the code
 * body comes from the highlight endpoint.
 */
const props = withDefaults(defineProps<{
  code: string
  language?: string
  filename?: string
  showHeader?: boolean
}>(), {
  language: '',
  filename: undefined,
  showHeader: true,
})

const html = ref('')

watch(
  () => [props.code, props.language] as const,
  async ([code, language]) => {
    if (!code) { html.value = ''; return }
    try {
      const res = await $fetch<{ html: string; highlighted: boolean }>('/api/highlight', {
        method: 'POST',
        body: { code, lang: language },
      })
      html.value = res.highlighted ? res.html : ''
    } catch {
      html.value = ''
    }
  },
  { immediate: true },
)
</script>
