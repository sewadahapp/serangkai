import { and, eq } from 'drizzle-orm'
import { rangkaVersions } from '../db/schema'
import { isVersionConflict } from '../db/migrations'
import { writeRangka } from './rangka-storage'

export interface AppendVersionInput {
  rangkaId: string
  version: number
  contentPath: string
  metadata: Record<string, any>
  content: Buffer | Uint8Array | string
}

/**
 * Append one version, claiming its number before touching storage.
 *
 * `UNIQUE(rangka_id, version)` decides the winner when two writers race on
 * the same base version. Inserting the row first means the loser fails before
 * it writes `versions/N`, so it can never overwrite the winner's bytes.
 * Returns false when another writer already holds that number.
 */
export async function appendVersion(db: any, input: AppendVersionInput): Promise<boolean> {
  const id = crypto.randomUUID()
  try {
    await db.insert(rangkaVersions).values({
      id,
      rangkaId: input.rangkaId,
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
    await writeRangka(input.contentPath, input.content)
  } catch (error) {
    // Release the number so history never points at bytes that were not stored.
    await db.delete(rangkaVersions)
      .where(and(eq(rangkaVersions.id, id), eq(rangkaVersions.rangkaId, input.rangkaId)))
      .catch(() => {})
    throw error
  }
  return true
}
