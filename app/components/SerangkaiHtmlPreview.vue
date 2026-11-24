<template>
  <SerangkaiCanvasViewport ref="canvasViewport" :size="canvasSize" :fill="fillCanvas" :loading="loading">
    <iframe
      v-if="mounted"
      :key="src"
      ref="frame"
      v-bind="$attrs"
      :src="src"
      :title="title"
      sandbox="allow-scripts"
      referrerpolicy="no-referrer"
      class="block w-full border-0 bg-white dark:bg-[#111]"
      :style="canvasSize ? { height: '100%', minHeight: '0' } : { height: resolvedHeight }"
      @load="onFrameLoad"
    />
  </SerangkaiCanvasViewport>
</template>

<script setup lang="ts">
import { parseCanvasSize } from '#shared/rangka-canvas'
import SerangkaiCanvasViewport from './SerangkaiCanvasViewport.vue'

defineOptions({ inheritAttrs: false })

/**
 * HTML rangka preview.
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
   * Resize the frame to the document height reported by the injected preview
   * bridge, so the page owns the scrollbar instead of the iframe. Used by the
   * rangka detail view and the shared HTML reader. A rangka that manages its
   * own viewport-sized layout opts out with the `serangkai-presentation` meta,
   * which leaves the frame bounded and scrolling internally.
   */
  autoHeight?: boolean
  /** Let an opted-in canvas fill the reader's available height. */
  fillCanvas?: boolean
}>(), { height: '70vh', autoHeight: false })

// Keep this in sync with MAX_PREVIEW_HEIGHT in the server bridge. The detail
// panel keeps its 70vh floor and the share reader fills the row between the
// header and footer, so a failed report degrades to a bounded frame rather
// than a collapsed one.
const MAX_HEIGHT = 50_000
// Leave a little slack below the reported content. A 1px residual overflow is
// enough to make the iframe a scroll target, so on macOS with overlay
// scrollbars the document scrolls first and the page only afterwards. The
// parent's guard ignores corrections that small, so the frame would otherwise
// keep that sliver forever.
const HEIGHT_HEADROOM = 2
const colorMode = useColorMode()
const frame = ref<HTMLIFrameElement>()
const canvasViewport = useTemplateRef<InstanceType<typeof SerangkaiCanvasViewport>>('canvasViewport')
const mounted = ref(false)
const loading = ref(true)
const reportedHeight = ref<number | null>(null)
const canvasSize = shallowRef<ReturnType<typeof parseCanvasSize>>(null)
let readyTimeout: ReturnType<typeof setTimeout> | undefined
let awaitingReady = false

const resolvedHeight = computed(() => {
  if (!props.autoHeight || reportedHeight.value === null) return props.height
  return `${reportedHeight.value + HEIGHT_HEADROOM}px`
})

// Resolve "system" to the concrete mode the rangka should render in.
const resolvedMode = computed(() => colorMode.value === 'dark' ? 'dark' : 'light')

function sync() {
  // targetOrigin '*' is safe here: the frame is sandboxed and opaque-origin,
  // so it cannot be addressed any other way. The payload is a mode string and
  // a height request.
  const contentWindow = frame.value?.contentWindow
  contentWindow?.postMessage({ type: 'serangkai:color-mode', mode: resolvedMode.value }, '*')
  contentWindow?.postMessage({ type: 'serangkai:height-request' }, '*')
}

function onFrameLoad() {
  loading.value = true
  canvasSize.value = null
  reportedHeight.value = null
  // A blocked document or an HTTP error may load without the preview bridge.
  awaitingReady = true
  clearTimeout(readyTimeout)
  readyTimeout = setTimeout(finishLoading, 350)
  sync()
}

function finishLoading() {
  if (!awaitingReady) return
  awaitingReady = false
  clearTimeout(readyTimeout)
  const loadedFrame = frame.value
  // Let the canvas render its controls and measure Fit before revealing either.
  void nextTick(() => {
    if (frame.value === loadedFrame) loading.value = false
  })
}

function onMessage(event: MessageEvent) {
  // A sandboxed frame has an opaque origin, so `event.origin` is "null".
  // Match the sender window, then validate its dimensions or input.
  const sender = frame.value
  if (!sender || event.source !== sender.contentWindow) return
  const data = event.data as { type?: unknown; height?: unknown; size?: unknown; kind?: unknown; gesture?: unknown } | null
  if (data?.type === 'serangkai:canvas-size') {
    canvasSize.value ??= parseCanvasSize(data.size)
    if (canvasSize.value) finishLoading()
    return
  }
  if (data?.type === 'serangkai:preview-ready') {
    finishLoading()
    return
  }
  if (canvasSize.value && data?.type === 'serangkai:canvas-input') {
    canvasViewport.value?.onFrameInput(sender, data.kind, data.gesture)
    return
  }
  if (!props.autoHeight || canvasSize.value || data?.type !== 'serangkai:height') return
  const height = Math.round(Number(data.height))
  if (!Number.isFinite(height) || height <= 0) return
  const next = Math.min(height, MAX_HEIGHT)

  // A document that sizes itself from the viewport (`100vh`, `100dvh`) reports
  // its own frame height. Growing the frame for that would feed back into
  // itself forever, so a report within 2px of the current content height is
  // treated as "the frame is already the right size". Anything else is a real
  // change, in either direction, so collapsing content still shrinks the frame.
  const current = frame.value?.clientHeight ?? 0
  if (current > 0 && Math.abs(next - current) <= 2) return

  if (reportedHeight.value !== null && Math.abs(reportedHeight.value - next) < 2) return
  reportedHeight.value = next
}

watch(() => props.src, () => {
  clearTimeout(readyTimeout)
  awaitingReady = false
  loading.value = true
  reportedHeight.value = null
  canvasSize.value = null
})
watch(resolvedMode, sync)

onMounted(() => {
  window.addEventListener('message', onMessage)
  if (colorMode.unknown) {
    colorMode.value = colorMode.preference === 'system' ? 'system' : colorMode.preference
  }
  // Start the iframe after the listener is ready, including for cached previews.
  mounted.value = true
})

onBeforeUnmount(() => {
  clearTimeout(readyTimeout)
  window.removeEventListener('message', onMessage)
})
</script>
