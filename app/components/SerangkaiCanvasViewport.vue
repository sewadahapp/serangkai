<template>
  <div :class="size ? 'canvas-shell' : 'canvas-pass-through'">
    <div v-if="size" class="canvas-controls" role="group" aria-label="Canvas controls">
      <SButton variant="ghost" color="neutral" size="sm" icon="lucide:minus" aria-label="Zoom out" :disabled="camera.scale <= minimumScale" @click="zoomBy(1 / zoomStep)" />
      <SButton variant="ghost" color="neutral" size="sm" :aria-label="`Actual size, current zoom ${zoomLabel}`" title="Show at 100%" @click="zoomTo(1)">{{ zoomLabel }}</SButton>
      <SButton variant="ghost" color="neutral" size="sm" icon="lucide:plus" aria-label="Zoom in" :disabled="camera.scale >= maximumScale" @click="zoomBy(zoomStep)" />
      <SButton variant="ghost" color="neutral" size="sm" aria-label="Fit canvas" @click="fit">Fit</SButton>
      <SButton :variant="panMode ? 'soft' : 'ghost'" color="neutral" size="sm" icon="lucide:hand" :aria-pressed="panMode" @click="panMode = !panMode">Pan</SButton>
    </div>

    <div
      ref="viewport"
      :class="size ? ['canvas-viewport serangkai-canvas-pattern', { 'canvas-dragging': dragging }] : 'canvas-pass-through'"
      :role="size ? 'region' : undefined"
      :aria-label="size ? 'Rangka canvas' : undefined"
      :tabindex="size ? 0 : undefined"
      @keydown.self="onKeydown"
      @wheel="onWheel"
      @pointerdown.self="startDrag"
      @pointermove="moveDrag"
      @pointerup="stopDrag"
      @pointercancel="stopDrag"
      @lostpointercapture="stopDrag"
    >
      <div :class="size ? 'canvas-board' : 'canvas-pass-through'" :style="boardStyle">
        <slot />
      </div>
      <div v-if="size && panMode" class="canvas-pan-surface" aria-hidden="true" @pointerdown="startDrag" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CanvasSize } from '#shared/rangka-canvas'

const props = defineProps<{ size: CanvasSize | null }>()

const zoomStep = 1.25
const maximumScale = 4
const viewport = ref<HTMLElement>()
const view = shallowRef({ width: 0, height: 0 })
const camera = shallowRef({ x: 0, y: 0, scale: 1 })
const fitted = ref(true)
const panMode = ref(false)
const dragging = ref(false)
let drag: { pointer: number; x: number; y: number } | null = null

const fitScale = computed(() => {
  if (!props.size) return 1
  const width = Math.max(1, view.value.width - 32)
  const height = Math.max(1, view.value.height - 32)
  return Math.min(1, width / props.size.width, height / props.size.height)
})
const minimumScale = computed(() => Math.min(0.25, fitScale.value))
const zoomLabel = computed(() => `${Math.max(1, Math.round(camera.value.scale * 100))}%`)
const boardStyle = computed(() => {
  if (!props.size) return undefined
  const { x, y, scale } = camera.value
  return {
    width: `${props.size.width}px`,
    height: `${props.size.height}px`,
    transform: `translate(${x}px, ${y}px) scale(${scale})`,
  }
})

function clampOffset(offset: number, extent: number, boardExtent: number) {
  const visible = Math.min(40, extent / 2, boardExtent)
  return Math.max(visible - boardExtent, Math.min(extent - visible, offset))
}

function positionCamera(x: number, y: number, scale: number) {
  if (!props.size) return
  camera.value = {
    x: clampOffset(x, view.value.width, props.size.width * scale),
    y: clampOffset(y, view.value.height, props.size.height * scale),
    scale,
  }
}

function fit() {
  if (!props.size) return
  fitted.value = true
  const scale = fitScale.value
  positionCamera((view.value.width - props.size.width * scale) / 2, (view.value.height - props.size.height * scale) / 2, scale)
}

function zoomTo(value: number, x = view.value.width / 2, y = view.value.height / 2) {
  const previous = camera.value
  const scale = Math.max(minimumScale.value, Math.min(maximumScale, value))
  const ratio = scale / previous.scale
  fitted.value = false
  positionCamera(x - (x - previous.x) * ratio, y - (y - previous.y) * ratio, scale)
}

function zoomBy(factor: number) {
  zoomTo(camera.value.scale * factor)
}

function panBy(x: number, y: number) {
  fitted.value = false
  positionCamera(camera.value.x + x, camera.value.y + y, camera.value.scale)
}

function measureViewport() {
  if (!props.size || !viewport.value) return
  const previous = view.value
  const { clientWidth: width, clientHeight: height } = viewport.value
  view.value = { width, height }
  if (fitted.value) fit()
  else panBy((width - previous.width) / 2, (height - previous.height) / 2)
}

function startDrag(event: PointerEvent) {
  if (!props.size || drag || event.button !== 0 || !viewport.value) return
  event.preventDefault()
  viewport.value.focus({ preventScroll: true })
  viewport.value.setPointerCapture(event.pointerId)
  drag = { pointer: event.pointerId, x: event.clientX, y: event.clientY }
  dragging.value = true
}

function moveDrag(event: PointerEvent) {
  if (drag?.pointer !== event.pointerId) return
  panBy(event.clientX - drag.x, event.clientY - drag.y)
  drag.x = event.clientX
  drag.y = event.clientY
}

function stopDrag(event: PointerEvent) {
  if (drag?.pointer !== event.pointerId) return
  drag = null
  dragging.value = false
}

function onWheel(event: WheelEvent) {
  if (!panMode.value || !viewport.value || !(event.ctrlKey || event.metaKey) || !event.deltaY) return
  event.preventDefault()
  const bounds = viewport.value.getBoundingClientRect()
  const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? bounds.height : 1)
  zoomTo(camera.value.scale * Math.exp(-pixels / 350), event.clientX - bounds.left, event.clientY - bounds.top)
}

function onKeydown(event: KeyboardEvent) {
  if (!props.size || event.ctrlKey || event.metaKey || event.altKey) return
  switch (event.key) {
    case '+':
    case '=': zoomBy(zoomStep); break
    case '-': zoomBy(1 / zoomStep); break
    case '0': fit(); break
    case 'ArrowLeft': panBy(40, 0); break
    case 'ArrowRight': panBy(-40, 0); break
    case 'ArrowUp': panBy(0, 40); break
    case 'ArrowDown': panBy(0, -40); break
    case 'Escape': panMode.value = false; break
    default: return
  }
  event.preventDefault()
}

watch(() => props.size, () => {
  panMode.value = false
  fitted.value = true
  measureViewport()
}, { flush: 'post' })

let observer: ResizeObserver | undefined
onMounted(() => {
  if (!viewport.value) return
  measureViewport()
  observer = new ResizeObserver(measureViewport)
  observer.observe(viewport.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<style scoped>
.canvas-pass-through { display: contents; }
.canvas-shell { min-width: 0; overflow: hidden; border: 1px solid var(--selaras-resolved-border-default); border-radius: var(--selaras-resolved-radius-md); }
.canvas-controls { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .25rem; padding: .375rem .5rem; border-bottom: 1px solid var(--selaras-resolved-border-default); background: var(--selaras-resolved-surface-default); font-variant-numeric: tabular-nums; }
.canvas-viewport { position: relative; height: max(17rem, 65dvh); overflow: clip; background-color: var(--selaras-resolved-surface-canvas); }
.canvas-viewport:focus-visible { outline: 2px solid var(--selaras-resolved-color-primary-border); outline-offset: -2px; }
.canvas-board { position: absolute; inset: 0 auto auto 0; overflow: clip; transform-origin: top left; box-shadow: 0 0 0 1px var(--selaras-resolved-border-default); }
.canvas-pan-surface { position: absolute; inset: 0; cursor: grab; touch-action: none; }
.canvas-dragging, .canvas-dragging .canvas-pan-surface { cursor: grabbing; }
@media (pointer: coarse) {
  .canvas-controls :deep(button) { min-width: 2.75rem; min-height: 2.75rem; }
}
</style>
