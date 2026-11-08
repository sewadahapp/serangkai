import { sql } from 'drizzle-orm'

/**
 * Global uniqueness for public share identifiers.
 *
 * Artifacts are resolved by slug alone (`/api/share/:slug`), but the original
 * schema only enforced `UNIQUE(user_id, slug)`. Two users could therefore own
 * the same slug, and the share route would resolve whichever row the database
 * happened to return first: one user's link could open another user's artifact
 * (or a private 403) instead of their own.
 *
 * This migration makes the invariant global. Existing duplicates are
 * disambiguated deterministically: the oldest artifact keeps its slug (so the
 * longest-lived share URL keeps working), and later ones get a short suffix.
 */
export async function ensureGlobalSlugUniqueness(db: any) {
  const existingIndex = await db.all<{ name: string }>(sql`
    SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'artifacts_slug_unique'
  `)
  if (existingIndex.length) return

  const duplicates = await db.all<{ slug: string }>(sql`
    SELECT slug FROM artifacts GROUP BY slug HAVING COUNT(*) > 1
  `)

  for (const row of duplicates) {
    const slug = row?.slug
    if (!slug) continue
    const owners = await db.all<{ id: string; userId: string }>(sql`
      SELECT id, user_id AS userId FROM artifacts
      WHERE slug = ${slug}
      ORDER BY created_at ASC, id ASC
    `)
    for (const artifact of owners.slice(1)) {
      const base = `${slug}-${String(artifact.id).slice(0, 6)}`
      let candidate = base
      let attempt = 0
      // The suffix is derived from the id, so a collision is unlikely but the
      // loop keeps the invariant absolute rather than probabilistic.
      while (true) {
        const taken = await db.all<{ id: string }>(sql`
          SELECT id FROM artifacts WHERE slug = ${candidate} LIMIT 1
        `)
        if (!taken.length) break
        candidate = `${base}-${++attempt}`
      }
      await db.run(sql`UPDATE artifacts SET slug = ${candidate} WHERE id = ${artifact.id}`)
      console.warn(`[serangkai] Reassigned duplicate artifact slug "${slug}" -> "${candidate}" (artifact ${artifact.id}).`)
    }
  }

  // A partial index would let duplicates slip back in; this is the durable
  // guarantee that two artifacts can never share a public identifier.
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS artifacts_slug_unique ON artifacts (slug)`)
}

/** True when a unique-constraint error came from the slug index. */
export function isSlugConflict(error: any) {
  const message = String(error?.message || error || '')
  return /unique constraint failed.*artifacts\.slug/i.test(message)
    || /UNIQUE constraint failed: artifacts\.slug/i.test(message)
    || /artifacts_slug_unique/i.test(message)
}
