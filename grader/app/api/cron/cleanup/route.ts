export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { purgeExpiredResearchJobs } from '@/lib/cleanup'

// Called by Vercel Cron every 30 min (vercel.json) and optionally manually.
// Retention policy lives in lib/cleanup.ts (shared with /api/research/start):
// 3h for unconverted jobs, 30 days for jobs with a lead attached.

const STUCK_RUNNING_MS = 10 * 60 * 1000 // 10 min — jobs stuck in running longer get marked failed

export async function GET(req: NextRequest) {
  // Verify cron secret in production
  if (process.env.NODE_ENV === 'production') {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const db = getSupabaseAdmin()

  // 1. Mark stuck running jobs as failed (fire-and-forget worker got frozen)
  const stuckBefore = new Date(Date.now() - STUCK_RUNNING_MS).toISOString()
  const { error: stuckErr, count: stuckCount } = await db
    .from('research_jobs')
    .update({ status: 'failed' }, { count: 'exact' })
    .eq('status', 'running')
    .lt('created_at', stuckBefore)

  if (stuckErr) {
    console.error('[cron/cleanup] stuck job update error:', stuckErr)
  } else if (stuckCount) {
    console.log(`[cron/cleanup] marked ${stuckCount} stuck running jobs as failed`)
  }

  // 2. Two-tier retention purge (CASCADE removes query_results, competitors, leads)
  const { deletedUnconverted, deletedConverted, error } = await purgeExpiredResearchJobs()

  if (error) {
    console.error('[cron/cleanup] purge error:', error)
    return NextResponse.json({ success: false, error }, { status: 500 })
  }

  console.log(
    `[cron/cleanup] deleted ${deletedUnconverted} unconverted (3h) + ${deletedConverted} aged (30d) jobs`
  )
  return NextResponse.json({
    success: true,
    deletedUnconverted,
    deletedConverted,
    stuckFixed: stuckCount,
  })
}
