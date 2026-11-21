import { formatByteSize } from '#shared/byte-size'
import type { StorageStatus } from '~/composables/useStorageStatus'

export interface StorageMeter {
  /** 0-100 for the bar, or null when there is nothing to measure against. */
  percent: number | null
  color: 'neutral' | 'warning' | 'danger'
  /** e.g. "2.3 MB of 10 GB" */
  summary: string
  /** e.g. "77% left", "Over limit", "958 GB free" */
  remaining: string
  /** One sentence for tooltips and screen readers. */
  description: string
}

/** Amber from 80%, red from 95% (and when over the limit). */
const colorFor = (percent: number): StorageMeter['color'] => percent >= 95 ? 'danger' : percent >= 80 ? 'warning' : 'neutral'

/**
 * What the storage meter shows:
 * - with a limit: usage against it;
 * - without one but on local/Docker disk: usage against what rangka could
 *   still take (used + free on the disk);
 * - otherwise: just the amount used, no bar.
 */
export function storageMeter(status: StorageStatus): StorageMeter {
  const used = formatByteSize(status.usedBytes)
  if (status.limitBytes) {
    const percent = Math.min(100, (status.usedBytes / status.limitBytes) * 100)
    const over = status.usedBytes > status.limitBytes
    const left = Math.max(0, Math.floor(100 - percent))
    const limit = formatByteSize(status.limitBytes)
    return {
      percent,
      color: over ? 'danger' : colorFor(percent),
      summary: `${used} of ${limit}`,
      remaining: over ? 'Over limit' : `${left}% left`,
      description: over ? `Storage: ${used} of ${limit}, over the limit` : `Storage: ${used} of ${limit}, ${left}% left`,
    }
  }
  if (status.disk) {
    const capacity = status.usedBytes + status.disk.freeBytes
    const percent = capacity > 0 ? Math.min(100, (status.usedBytes / capacity) * 100) : 0
    const free = formatByteSize(status.disk.freeBytes)
    return {
      percent,
      color: colorFor(percent),
      summary: `${used} used`,
      remaining: `${free} free`,
      description: `Storage: ${used} used, ${free} free on disk`,
    }
  }
  return { percent: null, color: 'neutral', summary: `${used} used`, remaining: 'No limit', description: `Storage: ${used} used, no limit set` }
}
