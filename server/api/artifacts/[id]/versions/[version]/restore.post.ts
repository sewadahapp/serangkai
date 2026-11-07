import { nanoid } from 'nanoid'
import { artifactVersions, artifacts } from '../../../../../db/schema'
import { getRequestDatabase } from '../../../../../db/adapter'
import { requireScope } from '../../../../../utils/require-auth'
import { and, eq, max } from 'drizzle-orm'
import { readArtifactBytes, writeArtifact } from '../../../../../utils/artifact-storage'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = requireScope(event, 'write')
  const id = getRouterParam(event, 'id')
  const versionNumber = Number(getRouterParam(event, 'version'))
  if (!id || !Number.isInteger(versionNumber) || versionNumber < 1) {
    throw createError({ statusCode: 400, message: 'Artifact id and a positive version number are required' })
  }

  const artifact = await db.select().from(artifacts)
    .where(and(eq(artifacts.id, id), eq(artifacts.userId, user.id))).get()
  if (!artifact) throw createError({ statusCode: 404, message: 'Artifact not found' })

  const source = await db.select().from(artifactVersions)
    .where(and(eq(artifactVersions.artifactId, artifact.id), eq(artifactVersions.version, versionNumber))).get()
  if (!source) throw createError({ statusCode: 404, message: 'Version not found' })

  // Restoring never rewrites history: the old content becomes a brand-new
  // version so the artifact timeline stays append-only.
  const latest = await db.select({ value: max(artifactVersions.version) })
    .from(artifactVersions).where(eq(artifactVersions.artifactId, artifact.id)).get()
  const version = Number(latest?.value || 0) + 1
  const contentPath = `${user.id}/${artifact.id}/versions/${version}`
  const content = await readArtifactBytes(source.contentPath)
  await writeArtifact(contentPath, content)

  const now = new Date()
  await db.insert(artifactVersions).values({
    id: nanoid(), artifactId: artifact.id, version, contentPath,
    metadata: source.metadata || {}, createdAt: now,
  })
  await db.update(artifacts).set({ contentPath, updatedAt: now })
    .where(and(eq(artifacts.id, artifact.id), eq(artifacts.userId, user.id)))

  return { version, restoredFrom: source.version, artifact: { ...artifact, contentPath, updatedAt: now } }
})
