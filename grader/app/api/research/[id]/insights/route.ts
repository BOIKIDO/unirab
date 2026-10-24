export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { generateInsights } from '@/lib/insights'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = getSupabaseAdmin()

  const { data: job } = await db
    .from('research_jobs')
    .select('business_name, primary_service, keywords, location_city, location_state, score_overall, score_chatgpt, score_gemini')
    .eq('id', id)
    .single()

  if (!job) return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })
  if (job.score_overall == null) return NextResponse.json({ success: false, error: 'Report not ready' }, { status: 202 })

  const { data: queryResults } = await db
    .from('query_results')
    .select('platform, mentioned')
    .eq('job_id', id)

  const { data: competitors } = await db
    .from('competitors')
    .select('competitor_name, mention_count')
    .eq('job_id', id)
    .order('mention_count', { ascending: false })
    .limit(5)

  const allResults = queryResults ?? []
  const chatgptMentions = allResults.filter((r: { platform: string; mentioned: boolean }) => r.platform === 'chatgpt' && r.mentioned).length
  const geminiMentions = allResults.filter((r: { platform: string; mentioned: boolean }) => r.platform === 'gemini' && r.mentioned).length
  // Matches the worker's actual query plan: 2 locations per keyword + 2 business-name queries
  const totalQueriesPerPlatform = (job.keywords?.length ?? 0) * 2 + 2

  const result = await generateInsights({
    businessName: job.business_name,
    city: job.location_city,
    state: job.location_state,
    primaryService: job.primary_service ?? '',
    scoreOverall: job.score_overall,
    scoreChatgpt: job.score_chatgpt ?? 0,
    scoreGemini: job.score_gemini ?? 0,
    chatgptMentions,
    geminiMentions,
    totalQueriesPerPlatform,
    keywords: (job.keywords ?? []) as string[],
    topCompetitors: (competitors ?? []).map((c: { competitor_name: string; mention_count: number }) => ({
      name: c.competitor_name,
      count: c.mention_count,
    })),
  })

  return NextResponse.json({ success: true, data: result })
}
