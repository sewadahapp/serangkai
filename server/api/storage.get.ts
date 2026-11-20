import { getRequestDatabase } from '../db/adapter'
import { requireScope } from '../utils/require-auth'
import { getStorageStatus } from '../utils/storage-quota'

/** Storage usage, the limits that apply, and the owner's warn/reject mode. */
export default defineEventHandler(async (event) => {
  const user = requireScope(event, 'read')
  const db = await getRequestDatabase(event)
  return { storage: await getStorageStatus(db, user.id) }
})
