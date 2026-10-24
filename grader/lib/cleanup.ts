import { getSupabaseAdmin } from './supabase'

// Two-tier retention for research_jobs (CASCADE → query_results, competitors, leads):
//
//  - Unconverted jobs (no lead row) are anonymous/abandoned scans — purged after 3h.
//  - Converted jobs (lead attached) must outlive the 5-day email sequence:
//    lib/sequence.ts re-reads the lead AND job rows through Day 5 (+96h), and the
//    report links in every sequence email point at /research/[id]. 30 days keeps
//    those links alive for the full nurture plus follow-up calls.
export const UNCONVERTED_RETENTION_MS = 3 * 60 * 60 * 1000
export const CONVERTED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

// PostgREST filters travel in the request URL, so .in() id lists must stay small.
const DELETE_CHUNK_SIZE = 100

export interface PurgeResult {
  deletedUnconverted: number
  deletedConverted: number
  error: string | null
}

export async function purgeExpiredResearchJobs(): Promise<PurgeResult> {
  const db = getSupabaseAdmin()
  const now = Date.now()
  const result: PurgeResult = { deletedUnconverted: 0, deletedConverted: 0, error: null }

  // 1. Anything past full retention goes, converted or not.
  const { error: agedErr, count: agedCount } = await db
    .from('research_jobs')
    .delete({ count: 'exact' })
    .lt('created_at', new Date(now - CONVERTED_RETENTION_MS).toISOString())

  if (agedErr) {
    result.error = `30d delete: ${agedErr.message}`
    return result
  }
  result.deletedConverted = agedCount ?? 0

  // 2. Unconverted jobs past 3h. PostgREST can't express NOT IN (subquery), so
  //    fetch candidates with their leads embedded and delete the lead-less ones.
  const { data: expired, error: expiredErr } = await db
    .from('research_jobs')
    .select('id, leads(id)')
    .lt('created_at', new Date(now - UNCONVERTED_RETENTION_MS).toISOString())
    .limit(1000) // overflow is caught by the next cron tick / scan start

  if (expiredErr) {
    result.error = `expired select: ${expiredErr.message}`
    return result
  }

  const orphanIds = (expired ?? [])
    .filter((job) => !job.leads?.length)
    .map((job) => job.id as string)

  for (let i = 0; i < orphanIds.length; i += DELETE_CHUNK_SIZE) {
    const chunk = orphanIds.slice(i, i + DELETE_CHUNK_SIZE)
    const { error: deleteErr, count } = await db
      .from('research_jobs')
      .delete({ count: 'exact' })
      .in('id', chunk)

    if (deleteErr) {
      result.error = `unconverted delete: ${deleteErr.message}`
      return result
    }
    result.deletedUnconverted += count ?? 0
  }

  return result
}
