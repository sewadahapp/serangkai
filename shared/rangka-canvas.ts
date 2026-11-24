export const MIN_CANVAS_DIMENSION = 240
export const MAX_CANVAS_DIMENSION = 4096
export const CANVAS_DIMENSIONS = /^([0-9]{3,4})x([0-9]{3,4})$/

export function parseCanvasSize(value: unknown) {
  if (typeof value !== 'string' || value.length > 9) return null
  const match = CANVAS_DIMENSIONS.exec(value)
  if (!match) return null

  const width = Number(match[1])
  const height = Number(match[2])
  if (width < MIN_CANVAS_DIMENSION || width > MAX_CANVAS_DIMENSION
    || height < MIN_CANVAS_DIMENSION || height > MAX_CANVAS_DIMENSION) return null

  return { width, height }
}

export type CanvasSize = NonNullable<ReturnType<typeof parseCanvasSize>>

export const CANVAS_KEYS = {
  '+': 'zoom-in',
  '=': 'zoom-in',
  '-': 'zoom-out',
  '0': 'fit',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  h: 'hand',
  Escape: 'escape',
} as const

export const CANVAS_MODIFIED_KEYS = {
  '+': 'zoom-in',
  '=': 'zoom-in',
  '-': 'zoom-out',
  '0': 'fit',
} as const
