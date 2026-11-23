<template>
  <SerangkaiCanvasViewport :size="canvasSize">
    <iframe
      ref="frame"
      v-bind="$attrs"
      :src="src"
      :title="title"
      sandbox="allow-scripts"
      referrerpolicy="no-referrer"
      :class="flush || canvasSize
        ? 'block w-full border-0 bg-white dark:bg-[#111]'
        : 'w-full rounded-md border border-[var(--selaras-resolved-border-default)] bg-white dark:bg-[#111]'"
      :style="canvasSize ? { height: '100%', minHeight: '0' } : { height: resolvedHeight }"
      @load="onFrameLoad"
    />
  </SerangkaiCanvasViewport>
</template>

<script setup lang="ts">
import { parseCanvasSize } from '#shared/rangka-canvas'

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
  /**
   * Fill the parent edge to edge instead of sitting in a bordered card. Used by
   * the share reader, where the document is the page rather than a preview.
   */
  flush?: boolean
}>(), { height: '70vh', autoHeight: false, flush: false })

// Keep this in sync with MAX_PREVIEW_HEIGHT in the server bridge. The detail
// panel keeps its 70vh floor and the share reader fills the row between the
// header and footer, so a failed report degrades to a bounded frame rather
// than a collapsed one.
const MAX_HEIGHT = 50_000
// The bordered preview uses 1px on each edge; without this the frame's content
// viewport is 2px shorter than the reported document and always has a tiny
// scrollbar. `box-sizing: border-box` is global.
const VERTICAL_BORDER = 2
// Leave a little slack below the reported content. A 1px residual overflow is
// enough to make the iframe a scroll target, so on macOS with overlay
// scrollbars the document scrolls first and the page only afterwards. The
// parent's guard ignores corrections that small, so the frame would otherwise
// keep that sliver forever. The share reader's flush frame accidentally had the
// same slack because it still added VERTICAL_BORDER; make it explicit for both.
const HEIGHT_HEADROOM = 2
const colorMode = useColorMode()
const frame = ref<HTMLIFrameElement>()
const reportedHeight = ref<number | null>(null)
const canvasSize = shallowRef<ReturnType<typeof parseCanvasSize>>(null)

const resolvedHeight = computed(() => {
  if (!props.autoHeight || reportedHeight.value === null) return props.height
  const chrome = (props.flush ? 0 : VERTICAL_BORDER) + HEIGHT_HEADROOM
  return `${reportedHeight.value + chrome}px`
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
  canvasSize.value = null
  sync()
}

function onMessage(event: MessageEvent) {
  // A sandboxed frame has an opaque origin, so `event.origin` is "null".
  // Match the sender window instead, then validate its size report.
  if (event.source !== frame.value?.contentWindow) return
  const data = event.data as { type?: unknown; height?: unknown; size?: unknown } | null
  if (data?.type === 'serangkai:canvas-size') {
    canvasSize.value ??= parseCanvasSize(data.size)
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
  reportedHeight.value = null
  canvasSize.value = null
})
watch(resolvedMode, sync)

onMounted(() => {
  window.addEventListener('message', onMessage)
  if (colorMode.unknown) {
    colorMode.value = colorMode.preference === 'system' ? 'system' : colorMode.preference
  }
  // A server-rendered frame may finish loading before hydration attaches the
  // listener, so its first height reports are lost. Ask for the current height
  // once the listener is in place.
  sync()
})

onBeforeUnmount(() => window.removeEventListener('message', onMessage))
</script>
