export interface StorageStatus {
  usedBytes: number
  limitBytes: number | null
  ownerLimitBytes: number | null
  operatorLimitBytes: number | null
  mode: 'warn' | 'reject'
  keepVersions: number | null
  disk: { totalBytes: number; freeBytes: number } | null
  measuring: boolean
}

/**
 * Storage usage shared by the sidebar meter and Settings. One request feeds
 * both; call `refresh()` after anything that adds or removes rangka.
 */
export function useStorageStatus() {
  const status = useState<StorageStatus | null>('serangkai-storage', () => null)
  const refresh = async () => {
    try {
      status.value = (await $fetch<{ storage: StorageStatus }>('/api/storage')).storage
    } catch {
      // The meter is informational; a failed refresh keeps the last value.
    }
  }
  return { status, refresh }
}
