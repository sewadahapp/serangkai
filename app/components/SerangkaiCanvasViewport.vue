<template>
  <div ref="shell" :class="size ? ['canvas-shell', { 'canvas-shell-fill': fill }] : 'canvas-pass-through'">
    <div v-if="size" ref="controls" class="canvas-controls" role="group" aria-label="Canvas controls" @click="focusAfterPointerClick">
      <SButton
        :variant="handActive ? 'soft' : 'ghost'"
        :color="handActive ? 'primary' : 'neutral'"
        size="sm"
        icon="lucide:hand"
        aria-label="Pan"
        aria-keyshortcuts="H"
        title="Pan (H) or hold Space and drag"
        :aria-pressed="panMode"
        @click="panMode = !panMode"
      />
      <span class="canvas-controls-divider" aria-hidden="true" />
      <SButton variant="ghost" color="neutral" size="sm" icon="lucide:minus" aria-label="Zoom out" :disabled="camera.scale <= minimumScale" @click="zoomBy(1 / zoomStep)" />
      <SDropdown :items="zoomMenu" :positioning="{ side: 'top', align: 'center', sideOffset: 10, collisionPadding: 12 }">
        <SButton
          class="canvas-zoom-label"
          variant="ghost"
          color="neutral"
          size="sm"
          trailing-icon="lucide:chevron-down"
          :ui="{ trailingIcon: 'size-3 text-[var(--selaras-resolved-text-muted)]' }"
          :aria-label="`Zoom options, current zoom ${zoomLabel}`"
        >{{ zoomLabel }}</SButton>
      </SDropdown>
      <SButton variant="ghost" color="neutral" size="sm" icon="lucide:plus" aria-label="Zoom in" :disabled="camera.scale >= maximumScale" @click="zoomBy(zoomStep)" />
      <span class="canvas-controls-divider" aria-hidden="true" />
      <SButton variant="ghost" color="neutral" size="sm" icon="lucide:scan" aria-label="Fit canvas" aria-keyshortcuts="Shift+1" title="Fit canvas (Shift + 1)" @click="fit">Fit</SButton>
    </div>

    <div
      ref="viewport"
      :class="size ? ['canvas-viewport serangkai-canvas-pattern', { 'canvas-dragging': dragging, 'canvas-hand': handActive }] : 'canvas-pass-through'"
      :role="size ? 'region' : undefined"
      :aria-label="size ? 'Rangka canvas' : undefined"
      :tabindex="size ? 0 : undefined"
      @wheel="onWheel"
      @pointerdown.self="startDrag"
      @pointermove="moveDrag"
      @pointerup="stopDrag"
      @pointercancel="stopDrag"
      @lostpointercapture="stopDrag"
      @touchstart="onTouch"
      @touchmove="onTouch"
      @touchend="onTouch"
      @touchcancel="onTouch"
      @gesturestart="onGestureStart"
      @gesturechange="onGestureChange"
      @gestureend="endGesture"
    >
      <div :class="size ? 'canvas-board' : 'canvas-pass-through'" :style="boardStyle">
        <slot />
      </div>
      <div v-if="size && handActive" class="canvas-pan-surface" aria-hidden="true" @pointerdown="startDrag" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { CANVAS_KEYS, CANVAS_MODIFIED_KEYS, type CanvasSize } from '#shared/rangka-canvas'

const props = defineProps<{ size: CanvasSize | null; fill?: boolean }>()

const zoomStep = 1.25
const maximumScale = 4
const shell = ref<HTMLElement>()
const controls = ref<HTMLElement>()
const viewport = ref<HTMLElement>()
const view = shallowRef({ width: 0, height: 0, fitHeight: 0 })
const camera = shallowRef({ x: 0, y: 0, scale: 1 })
const fitted = ref(true)
const panMode = ref(false)
const spaceHeld = ref(false)
const frameSpaceHeld = ref(false)
const handActive = computed(() => panMode.value || spaceHeld.value || frameSpaceHeld.value)
const dragging = ref(false)
let drag: { pointer: number; x: number; y: number } | null = null
let frameHovered = false
let pinch: { x: number; y: number; camera: typeof camera.value } | null = null
let touchStart: { x: number; y: number; distance: number } | null = null
let multiTouch = false

const fitScale = computed(() => {
  if (!props.size) return 1
  const width = Math.max(1, view.value.width - 32)
  const height = Math.max(1, view.value.fitHeight - 32)
  return Math.min(1, width / props.size.width, height / props.size.height)
})
const minimumScale = computed(() => Math.min(0.25, fitScale.value))
const zoomLabel = computed(() => `${Math.max(1, Math.round(camera.value.scale * 100))}%`)
const zoomMenu = [
  [{ label: 'Fit canvas', icon: 'lucide:scan', shortcut: 'Shift+1', onSelect: fit }],
  [25, 50, 100, 200, 400].map(percent => ({
    label: percent === 100 ? '100% (actual size)' : `${percent}%`,
    onSelect: () => zoomTo(percent / 100),
  })),
]
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
  positionCamera((view.value.width - props.size.width * scale) / 2, (view.value.fitHeight - props.size.height * scale) / 2, scale)
}

function zoomTo(value: number, x = view.value.width / 2, y = view.value.fitHeight / 2, from = { x, y, camera: camera.value }) {
  const previous = from.camera
  const scale = Math.max(minimumScale.value, Math.min(maximumScale, value))
  const ratio = scale / previous.scale
  fitted.value = false
  positionCamera(x - (from.x - previous.x) * ratio, y - (from.y - previous.y) * ratio, scale)
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
  // The dock floats over the viewport. Fit leaves the whole board above it.
  const fitHeight = controls.value?.offsetTop ?? height
  if (width === previous.width && height === previous.height && fitHeight === previous.fitHeight && !fitted.value) return
  if (width !== previous.width || height !== previous.height) pinch = null
  view.value = { width, height, fitHeight }
  if (fitted.value) fit()
  else panBy((width - previous.width) / 2, (fitHeight - previous.fitHeight) / 2)
}

function startDrag(event: PointerEvent) {
  if (!props.size || drag || multiTouch || event.button !== 0 || !viewport.value) return
  event.preventDefault()
  // Keep focus in the frame when Space was pressed there, so it sees keyup.
  if (!frameSpaceHeld.value) viewport.value.focus({ preventScroll: true })
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

function releaseDrag() {
  const previous = drag
  drag = null
  dragging.value = false
  if (previous && viewport.value?.hasPointerCapture(previous.pointer)) viewport.value.releasePointerCapture(previous.pointer)
}

function stopDrag(event: PointerEvent) {
  if (drag?.pointer === event.pointerId) releaseDrag()
}

function wheel(dx: number, dy: number, mode: number, zoom: boolean, x: number, y: number) {
  const pixels = mode === 1 ? 16 : mode === 2 ? view.value.height : 1
  if (zoom) zoomTo(camera.value.scale * Math.exp(-dy * pixels / 350), x, y)
  else panBy(-dx * pixels, -dy * pixels)
}

function onWheel(event: WheelEvent) {
  if (!props.size || !viewport.value || !event.cancelable || event.defaultPrevented) return
  const mode = event.deltaMode
  const zoom = event.ctrlKey || event.metaKey
  const horizontal = !zoom && event.shiftKey && !event.deltaX
  const dx = horizontal ? event.deltaY : event.deltaX
  const dy = horizontal ? 0 : event.deltaY
  if (zoom ? !dy : (!dx && !dy)) return
  event.preventDefault()
  const bounds = viewport.value.getBoundingClientRect()
  wheel(dx, dy, mode, zoom, event.clientX - bounds.left, event.clientY - bounds.top)
}

function keyCommand(command: unknown, fast: boolean) {
  const step = fast ? 160 : 40
  switch (command) {
    case 'zoom-in': zoomBy(zoomStep); break
    case 'zoom-out': zoomBy(1 / zoomStep); break
    case 'fit': fit(); break
    case 'left': panBy(step, 0); break
    case 'right': panBy(-step, 0); break
    case 'up': panBy(0, step); break
    case 'down': panBy(0, -step); break
    case 'hand': panMode.value = !panMode.value; break
    case 'escape':
      if (!handActive.value && !drag) return false
      panMode.value = false
      resetInput()
      break
    default: return false
  }
  return true
}

function focusAfterPointerClick(event: MouseEvent) {
  const button = event.target instanceof Element ? event.target.closest('button') : null
  if (event.detail > 0 && button && !button.hasAttribute('aria-haspopup')) {
    viewport.value?.focus({ preventScroll: true })
  }
}

function onKeydown(event: KeyboardEvent) {
  if (!props.size || event.defaultPrevented || event.isComposing || event.altKey || !viewport.value) return
  const inCanvas = event.target === viewport.value
    || (event.target === document.body && (frameHovered || viewport.value.matches(':hover')))
  const leavingHandTool = event.key === 'Escape' && event.target instanceof Node && shell.value?.contains(event.target)
  if (!inCanvas && !leavingHandTool) return
  const modified = event.ctrlKey || event.metaKey
  if (event.code === 'Space' && !modified && !event.shiftKey) {
    spaceHeld.value = true
    event.preventDefault()
    return
  }
  const map: Partial<Record<string, string>> = modified ? CANVAS_MODIFIED_KEYS : CANVAS_KEYS
  const key = event.shiftKey && event.code === 'Digit1' && !modified ? '0' : event.key
  if (!Object.hasOwn(map, key)) return
  const command = map[key]
  if (command === 'hand' && event.repeat) return
  if (keyCommand(command, event.shiftKey)) event.preventDefault()
}

function onKeyup(event: KeyboardEvent) {
  if (event.code !== 'Space' || (!spaceHeld.value && !frameSpaceHeld.value)) return
  spaceHeld.value = false
  frameSpaceHeld.value = false
  if (!panMode.value) releaseDrag()
}

function startPinch(x: number, y: number) {
  releaseDrag()
  pinch = { x, y, camera: camera.value }
}

function movePinch(dx: number, dy: number, factor: number) {
  if (pinch && Number.isFinite(factor)) zoomTo(pinch.camera.scale * factor, pinch.x + dx, pinch.y + dy, pinch)
}

function onTouch(event: TouchEvent) {
  if (!props.size || !viewport.value || (event.touches.length < 2 && !multiTouch)) return
  if (event.cancelable) event.preventDefault()
  multiTouch = event.touches.length > 0
  if (event.touches.length !== 2) {
    touchStart = null
    pinch = null
    return
  }
  const [a, b] = Array.from(event.touches)
  const x = (a.clientX + b.clientX) / 2
  const y = (a.clientY + b.clientY) / 2
  const distance = Math.max(1, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY))
  if (!touchStart) {
    const bounds = viewport.value.getBoundingClientRect()
    startPinch(x - bounds.left, y - bounds.top)
    touchStart = { x, y, distance }
  } else {
    movePinch(x - touchStart.x, y - touchStart.y, distance / touchStart.distance)
  }
}

function onGestureStart(event: Event) {
  if (!props.size || !viewport.value || !event.isTrusted || event.defaultPrevented) return
  event.preventDefault()
  if (multiTouch) return
  const { clientX, clientY } = event as MouseEvent
  const bounds = viewport.value.getBoundingClientRect()
  startPinch(clientX - bounds.left, clientY - bounds.top)
}

function onGestureChange(event: Event) {
  if (!props.size || !event.isTrusted || event.defaultPrevented) return
  event.preventDefault()
  if (!multiTouch) movePinch(0, 0, (event as Event & { scale: number }).scale)
}

function endGesture() {
  if (!multiTouch) pinch = null
}

function resetInput() {
  spaceHeld.value = false
  frameSpaceHeld.value = false
  clearFrameHover()
  releaseDrag()
  pinch = null
  touchStart = null
  multiTouch = false
}

function clearFrameHover() {
  frameHovered = false
}

function finite(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function onFrameInput(frame: HTMLIFrameElement, kind: unknown, payload: unknown) {
  if (!props.size || !viewport.value || !payload || typeof payload !== 'object') return
  const { x, y, dx, dy, factor, zoom, mode, command, fast, held, inside } = payload as Record<string, unknown>
  if (kind === 'hover') {
    frameHovered = inside === true
    return
  }
  if (kind === 'space') {
    if (held === true && document.activeElement === frame) frameSpaceHeld.value = true
    if (held === false && frameSpaceHeld.value) {
      frameSpaceHeld.value = false
      if (!panMode.value) releaseDrag()
    }
    return
  }
  if (kind === 'key') {
    if (document.activeElement !== frame) return
    keyCommand(command, fast === true)
    if (command === 'hand' && panMode.value) viewport.value.focus({ preventScroll: true })
    return
  }
  if (kind === 'pinch') {
    if (finite(dx, -16384, 16384) && finite(dy, -16384, 16384) && finite(factor, 0, 16384)) movePinch(dx, dy, factor)
    return
  }
  if (kind === 'pinch-end') {
    pinch = null
    return
  }
  if (kind !== 'wheel' && kind !== 'pinch-start') return
  if (!finite(x, 0, props.size.width) || !finite(y, 0, props.size.height)) return
  const bounds = viewport.value.getBoundingClientRect()
  const board = frame.getBoundingClientRect()
  const anchorX = board.left - bounds.left + x * board.width / props.size.width
  const anchorY = board.top - bounds.top + y * board.height / props.size.height
  if (kind === 'pinch-start') {
    startPinch(anchorX, anchorY)
  } else if (finite(dx, -16384, 16384) && finite(dy, -16384, 16384) && (mode === 0 || mode === 1 || mode === 2)) {
    wheel(dx, dy, mode, zoom === true, anchorX, anchorY)
  }
}

defineExpose({ onFrameInput })

watch(() => props.size, () => {
  resetInput()
  panMode.value = false
  fitted.value = true
  measureViewport()
}, { flush: 'post' })

let observer: ResizeObserver | undefined
watch(controls, (next, previous) => {
  if (previous) observer?.unobserve(previous)
  if (next) observer?.observe(next)
})
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('keyup', onKeyup)
  window.addEventListener('blur', resetInput)
  window.addEventListener('pointerover', clearFrameHover, { passive: true })
  if (!viewport.value) return
  measureViewport()
  observer = new ResizeObserver(measureViewport)
  observer.observe(viewport.value)
  if (controls.value) observer.observe(controls.value)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('keyup', onKeyup)
  window.removeEventListener('blur', resetInput)
  window.removeEventListener('pointerover', clearFrameHover)
  observer?.disconnect()
})
</script>

<style scoped>
.canvas-pass-through { display: contents; }
.canvas-shell { position: relative; min-width: 0; overflow: hidden; border: 1px solid var(--selaras-resolved-border-default); border-radius: var(--selaras-resolved-radius-md); }
.canvas-controls {
  --canvas-control-size: 2.25rem;
  position: absolute;
  inset-block-end: max(2.75rem, env(safe-area-inset-bottom));
  inset-inline: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: .125rem;
  width: max-content;
  margin-inline: auto;
  padding: .25rem;
  border: 1px solid var(--selaras-resolved-border-default);
  border-radius: var(--selaras-resolved-radius-lg);
  background: var(--selaras-resolved-surface-elevated);
  box-shadow: var(--selaras-resolved-shadow-md);
  font-variant-numeric: tabular-nums;
}
.canvas-controls :deep(button) { min-width: var(--canvas-control-size); min-height: var(--canvas-control-size); }
.canvas-controls-divider { width: 1px; height: 1.25rem; margin-inline: .125rem; background: var(--selaras-resolved-border-default); }
.canvas-zoom-label { width: 4.375rem; padding-inline: .375rem; }
.canvas-zoom-label[data-state='open'] { background: var(--selaras-resolved-color-neutral-subtle); }
.canvas-viewport { position: relative; height: max(17rem, 65dvh); overflow: clip; background-color: var(--selaras-resolved-surface-canvas); touch-action: none; }
.canvas-viewport:focus-visible { outline: 2px solid var(--selaras-resolved-color-primary-border); outline-offset: -2px; }
.canvas-board { position: absolute; inset: 0 auto auto 0; overflow: clip; transform-origin: top left; box-shadow: 0 0 0 1px var(--selaras-resolved-border-default); }
.canvas-pan-surface { position: absolute; inset: 0; }
.canvas-hand { cursor: grab; }
.canvas-dragging, .canvas-dragging .canvas-pan-surface { cursor: grabbing; }
.canvas-shell-fill { height: var(--rangka-reader-height); min-height: 17rem; border: 0; border-radius: 0; }
.canvas-shell-fill .canvas-viewport { height: 100%; background: none; }
.canvas-shell-fill .canvas-board { box-shadow: none; }
@media (pointer: coarse) {
  .canvas-controls { --canvas-control-size: 2.75rem; }
}
</style>
