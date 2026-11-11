import { artifacts } from '../../db/schema'
import { getRequestDatabase } from '../../db/adapter'
import { artifactShareUrl } from '../../utils/share'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const db = await getRequestDatabase(event)
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  
  const userArtifacts = await db.select().from(artifacts).where(eq(artifacts.userId, user.id))
  // The workspace list shows a preview action for shared artifacts. Build the
  // same reader URL the dedicated share endpoint returns, once per artifact,
  // instead of making the browser ask for every row.
  return {
    artifacts: userArtifacts.map(artifact => ({
      ...artifact,
      shareUrl: artifactShareUrl(event, artifact),
    })),
  }
})
