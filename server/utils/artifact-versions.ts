import { and, eq } from 'drizzle-orm'
import { artifactVersions } from '../db/schema'
import { isVersionConflict } from '../db/migrations'
import { writeArtifact } from './artifact-storage'

export interface AppendVersionInput {
  artifactId: string
  version: number
  contentPath: string
  metadata: Record<string, any>
  content: Buffer | Uint8Array | string
}

/**
 * Append one version, claiming its number before touching storage.
 *
 * `UNIQUE(artifact_id, version)` decides the winner when two writers race on
 * the same base version. Inserting the row first means the loser fails before
 * it writes `versions/N`, so it can never overwrite the winner's bytes.
 * Returns false when another writer already holds that number.
 */
export async function appendVersion(db: any, input: AppendVersionInput): Promise<boolean> {
  const id = crypto.randomUUID()
  try {
    await db.insert(artifactVersions).values({
      id,
      artifactId: input.artifactId,
      version: input.version,
      contentPath: input.contentPath,
      metadata: input.metadata,
      createdAt: new Date(),
    })
  } catch (error) {
    if (isVersionConflict(error)) return false
    throw error
  }

  try {
    await writeArtifact(input.contentPath, input.content)
  } catch (error) {
    // Release the number so history never points at bytes that were not stored.
    await db.delete(artifactVersions)
      .where(and(eq(artifactVersions.id, id), eq(artifactVersions.artifactId, input.artifactId)))
      .catch(() => {})
    throw error
  }
  return true
}
