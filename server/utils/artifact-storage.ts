import { useStorage } from 'nitropack/runtime'

/**
 * The single artifact storage surface.
 *
 * Keys are the existing `userId/artifactId/...` paths, so moving from the old
 * local adapter to Nitro storage does not migrate or rename any user data.
 */
export function artifactStorage() {
  return useStorage('artifacts')
}

export async function readArtifactBytes(key: string): Promise<Buffer> {
  const value = await artifactStorage().getItemRaw(key)
  if (value === null || value === undefined) {
    throw createError({ statusCode: 404, message: 'File not found' })
  }
  return Buffer.from(value as any)
}

export async function readArtifactText(key: string): Promise<string> {
  return (await readArtifactBytes(key)).toString('utf8')
}

export async function writeArtifact(key: string, data: Buffer | Uint8Array | string) {
  await artifactStorage().setItemRaw(key, data)
}

export async function removeArtifact(key: string) {
  await artifactStorage().removeItem(key)
}

export async function artifactExists(key: string) {
  return artifactStorage().hasItem(key)
}
