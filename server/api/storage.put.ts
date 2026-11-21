import { z } from 'zod'
import { getRequestDatabase } from '../db/adapter'
import { requireSessionUser } from '../utils/require-auth'
import { getServerConfig } from '../utils/config'
import { getStorageSettings, getStorageStatus, saveStorageSettings } from '../utils/storage-quota'
import { formatByteSize } from '../../shared/byte-size'

const schema = z.object({
  limitBytes: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
  mode: z.enum(['warn', 'reject']),
  // Optional so older clients that only send the limit keep the current value.
  keepVersions: z.number().int().min(1).max(1000).nullable().optional(),
})

/**
 * Owner storage settings. Browser session only: an agent token, even a full
 * one, must not be able to raise the limit it is held to. The operator cap is
 * enforced here as well as on every write, so a crafted request cannot store
 * a limit above it.
 */
export default defineEventHandler(async (event) => {
  const user = requireSessionUser(event)
  const input = schema.safeParse(await readBody(event))
  if (!input.success) throw createError({ statusCode: 400, message: 'Send limitBytes (a positive number of bytes, or null), mode (warn or reject), and optionally keepVersions (1 to 1000, or null to keep all).' })

  const cap = getServerConfig().storageLimitBytes
  if (cap !== null && input.data.limitBytes !== null && input.data.limitBytes > cap) {
    throw createError({ statusCode: 400, message: `The limit cannot be higher than this server's ${formatByteSize(cap)} cap.` })
  }

  const db = await getRequestDatabase(event)
  const keepVersions = input.data.keepVersions === undefined
    ? (await getStorageSettings(db, user.id)).keepVersions
    : input.data.keepVersions
  await saveStorageSettings(db, user.id, { ownerLimitBytes: input.data.limitBytes, mode: input.data.mode, keepVersions })
  return { storage: await getStorageStatus(db, user.id) }
})
