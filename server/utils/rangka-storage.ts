import { useStorage } from 'nitropack/runtime'

/**
 * The single rangka storage surface.
 *
 * Keys are the existing `userId/rangkaId/...` paths, so moving from the old
 * local adapter to Nitro storage does not migrate or rename any user data.
 */
export function rangkaStorage() {
  return useStorage('rangka')
}

export async function readRangkaBytes(key: string): Promise<Buffer> {
  const value = await rangkaStorage().getItemRaw(key)
  if (value === null || value === undefined) {
    throw createError({ statusCode: 404, message: 'File not found' })
  }
  return Buffer.from(value as any)
}

export async function readRangkaText(key: string): Promise<string> {
  return (await readRangkaBytes(key)).toString('utf8')
}

export async function writeRangka(key: string, data: Buffer | Uint8Array | string) {
  await rangkaStorage().setItemRaw(key, data)
}

export async function removeRangka(key: string) {
  await rangkaStorage().removeItem(key)
}

export async function rangkaExists(key: string) {
  return rangkaStorage().hasItem(key)
}
