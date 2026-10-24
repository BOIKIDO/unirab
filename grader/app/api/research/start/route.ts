export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { purgeExpiredResearchJobs } from '@/lib/cleanup'
import { Client } from '@upstash/qstash'
// TODO: RE-ENABLE BEFORE DEPLOYING TO VERCEL
// import { rateLimit } from '@/lib/ratelimit'
import { runResearch } from '@/workers/research'

function getQstash() { return new Client({ token: process.env.QSTASH_TOKEN! }) }

function isLocalDev() {
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  return url.includes('localhost') || url.includes('127.0.0.1') || url === ''
}

// Fire-and-forget: purge expired jobs (3h unconverted / 30d converted) on every
// new research start. Only purge path in local dev, where Vercel Cron never runs.
function cleanupExpiredJobs() {
  purgeExpiredResearchJobs()
    .then(({ error }) => {
      if (error) console.error('[cleanup] expired jobs purge error:', error)
    })
    .catch((err) => console.error('[cleanup] purge crashed:', err))
}

export async function POST(req: NextRequest) {
  cleanupExpiredJobs()

  // --- RATE LIMIT TEMPORARILY DISABLED FOR TESTING ---
  // TODO: RE-ENABLE BEFORE DEPLOYING TO VERCEL
  // const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  // const { allowed } = await rateLimit(`research:${ip}`, 1, 600)
  // if (!allowed) return NextResponse.json({ success: false, error: 'You can run one report every 10 minutes. Please wait.' }, { status: 429 })
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown' // keep ip var for potential logging

  const body = await req.json()
  const { business_name, website_url, primary_service, location_city, location_state, keywords } = body

  if (!business_name || !location_city || !location_state) {
    return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
  }

  // Validate inputs
  if (typeof business_name !== 'string' || business_name.length > 200) {
    return NextResponse.json({ success: false, error: 'Invalid business name' }, { status: 400 })
  }
  if (typeof location_city !== 'string' || location_city.length > 100) {
    return NextResponse.json({ success: false, error: 'Invalid city' }, { status: 400 })
  }
  if (typeof location_state !== 'string' || location_state.length > 10) {
    return NextResponse.json({ success: false, error: 'Invalid state' }, { status: 400 })
  }
  if (!Array.isArray(keywords) || keywords.length > 10) {
    return NextResponse.json({ success: false, error: 'Maximum 10 keywords allowed' }, { status: 400 })
  }

  try {
    const { data: job, error } = await getSupabaseAdmin()
      .from('research_jobs')
      .insert({
        business_name,
        website_url: website_url ?? null,
        primary_service: primary_service ?? null,
        location_city,
        location_state,
        keywords: keywords ?? [],
        status: 'pending',
      })
      .select('id')
      .single()

    if (error || !job) {
      console.error('[research/start] db error:', error)
      return NextResponse.json({ success: false, error: 'Failed to create job' }, { status: 500 })
    }

    if (isLocalDev()) {
      // Local dev: run worker directly (QStash can't reach localhost)
      runResearch(job.id).catch((err) =>
        console.error(`[research/start] worker error for ${job.id}:`, err)
      )
    } else {
      const workerUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/worker/research`
      await getQstash().publishJSON({
        url: workerUrl,
        body: { jobId: job.id },
        retries: 2,
      })
    }

    return NextResponse.json({ success: true, data: { jobId: job.id } })
  } catch (err) {
    console.error('[research/start] error:', err)
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}
