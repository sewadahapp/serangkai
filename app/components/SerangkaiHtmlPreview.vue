<template>
  <SerangkaiCanvasViewport ref="canvasViewport" :size="canvasSize" :fill="fillCanvas" :loading="loading" :delayed="delayed" @retry="startPreview">
    <iframe
      v-if="mounted"
      :key="previewAttempt"
      ref="frame"
      v-bind="$attrs"
      :src="src"
      :title="title"
      sandbox="allow-scripts"
      allow="fullscreen"
      referrerpolicy="no-referrer"
      class="block w-full border-0 bg-white dark:bg-[#111]"
      :style="canvasSize ? { height: '100%', minHeight: '0' } : { height: resolvedHeight }"
      @load="sync"
    />
  </SerangkaiCanvasViewport>
</template>

<script setup lang="ts">
import { parseCanvasSize } from '#shared/rangka-canvas'
import { answerRangkaDataRequest, isRangkaDataRequest, type RangkaDataBridgeOptions } from '~/utils/rangka-data-bridge'
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
  /**
   * Answers the rangka's `serangkai.data` requests against this data API (see
   * app/utils/rangka-data-bridge.ts). Without it the frame gets no data access.
   */
  data?: RangkaDataBridgeOptions
}>(), { height: '70vh', autoHeight: false })

// Keep this in sync with MAX_PREVIEW_HEIGHT in the server bridge.
const MAX_HEIGHT = 50_000
const PREVIEW_RETRY_DELAY = 8000
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
const delayed = ref(false)
const previewAttempt = ref(0)
const reportedHeight = ref<number | null>(null)
const canvasSize = shallowRef<ReturnType<typeof parseCanvasSize>>(null)
let readyTimeout: ReturnType<typeof setTimeout> | undefined

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

function startPreview() {
  clearTimeout(readyTimeout)
  loading.value = true
  delayed.value = false
  reportedHeight.value = null
  canvasSize.value = null
  previewAttempt.value++
  // A failed request may never send a layout message. Keep the iframe hidden
  // and offer a retry while still accepting a late reply from this attempt.
  readyTimeout = setTimeout(() => {
    delayed.value = true
  }, PREVIEW_RETRY_DELAY)
}

function finishLoading() {
  clearTimeout(readyTimeout)
  if (!loading.value) return
  const attempt = previewAttempt.value
  // Let the canvas render its controls and measure Fit before revealing either.
  void nextTick(() => {
    if (previewAttempt.value === attempt) {
      loading.value = false
      delayed.value = false
    }
  })
}

function onMessage(event: MessageEvent) {
  // A sandboxed frame has an opaque origin, so `event.origin` is "null".
  // Match the sender window, then validate its dimensions or input.
  const sender = frame.value
  if (!sender || event.source !== sender.contentWindow) return
  if (isRangkaDataRequest(event.data)) {
    const target = sender.contentWindow
    if (target && props.data) void answerRangkaDataRequest(target, event.data, props.data)
    return
  }
  const data = event.data as { type?: unknown; height?: unknown; size?: unknown; kind?: unknown; gesture?: unknown } | null
  if (data?.type === 'serangkai:canvas-size') {
    const size = parseCanvasSize(data.size)
    if (!size) return
    if (canvasSize.value?.width !== size.width || canvasSize.value?.height !== size.height) {
      canvasSize.value = size
      loading.value = true
      reportedHeight.value = null
    }
    finishLoading()
    return
  }
  if (data?.type === 'serangkai:preview-ready') {
    if (canvasSize.value) {
      canvasSize.value = null
      sync()
    }
    finishLoading()
    return
  }
  if (canvasSize.value && data?.type === 'serangkai:canvas-input') {
    canvasViewport.value?.onFrameInput(sender, data.kind, data.gesture)
    return
  }
  if (!props.autoHeight || canvasSize.value || data?.type !== 'serangkai:height') return
  if (typeof data.height !== 'number') return
  const height = Math.round(data.height)
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

watch(() => props.src, startPreview)
watch(resolvedMode, sync)

onMounted(() => {
  window.addEventListener('message', onMessage)
  if (colorMode.unknown) {
    colorMode.value = colorMode.preference === 'system' ? 'system' : colorMode.preference
  }
  // Start the iframe after the listener is ready, including for cached previews.
  startPreview()
  mounted.value = true
})

onBeforeUnmount(() => {
  clearTimeout(readyTimeout)
  window.removeEventListener('message', onMessage)
})
</script>
