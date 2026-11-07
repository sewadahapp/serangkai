import { artifactVersions, artifacts } from '../../../../db/schema'
import { getRequestDatabase } from '../../../../db/adapter'
import { requireUser } from '../../../../utils/require-auth'
import { and, eq } from 'drizzle-orm'
import { readArtifactBytes } from '../../../../utils/artifact-storage'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = requireUser(event)
  const id = getRouterParam(event, 'id')
  const versionNumber = Number(getRouterParam(event, 'version'))
  if (!id || !Number.isInteger(versionNumber) || versionNumber < 1) {
    throw createError({ statusCode: 400, message: 'Artifact id and a positive version number are required' })
  }

  const artifact = await db.select().from(artifacts)
    .where(and(eq(artifacts.id, id), eq(artifacts.userId, user.id))).get()
  if (!artifact) throw createError({ statusCode: 404, message: 'Artifact not found' })

  const version = await db.select().from(artifactVersions)
    .where(and(eq(artifactVersions.artifactId, artifact.id), eq(artifactVersions.version, versionNumber))).get()
  if (!version) throw createError({ statusCode: 404, message: 'Version not found' })

  const content = await readArtifactBytes(version.contentPath)
  return {
    version: { id: version.id, version: version.version, createdAt: version.createdAt },
    content: content.toString(),
  }
})
