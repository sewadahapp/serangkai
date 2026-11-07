<template>
  <iframe
    ref="frame"
    :src="src"
    :title="title"
    sandbox="allow-scripts"
    referrerpolicy="no-referrer"
    :class="flush
      ? 'block w-full border-0 bg-white dark:bg-[#111]'
      : 'w-full rounded-md border border-[var(--selaras-resolved-border-default)] bg-white dark:bg-[#111]'"
    :style="{ height }"
    @load="sync"
  />
</template>

<script setup lang="ts">
/**
 * HTML artifact preview.
 *
 * The iframe is sandboxed (no same-origin access), so the workspace theme
 * cannot be inherited -- `color-scheme` is not reset across the frame boundary,
 * but nothing propagates automatically either. This posts the live mode into
 * the frame on every change, and the delivery route injects a listener for it.
 */
const props = withDefaults(defineProps<{
  src: string
  title: string
  height?: string
  /**
   * Fill the parent edge to edge instead of sitting in a bordered card. Used by
   * the share reader, where the document is the page rather than a preview.
   */
  flush?: boolean
}>(), { height: '70vh', flush: false })

const colorMode = useColorMode()
const frame = ref<HTMLIFrameElement>()

// Resolve "system" to the concrete mode the artifact should render in.
const resolvedMode = computed(() => colorMode.value === 'dark' ? 'dark' : 'light')

function sync() {
  // targetOrigin '*' is safe here: the frame is sandboxed and opaque-origin,
  // so it cannot be addressed any other way. The payload is a mode string.
  frame.value?.contentWindow?.postMessage({ type: 'serangkai:color-mode', mode: resolvedMode.value }, '*')
}

watch(resolvedMode, sync)

onMounted(() => {
  if (colorMode.unknown) {
    colorMode.value = colorMode.preference === 'system' ? 'system' : colorMode.preference
  }
})
</script>
