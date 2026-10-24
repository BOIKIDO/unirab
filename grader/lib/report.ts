import { getSupabaseAdmin } from './supabase'

export interface ReportData {
  job: {
    id: string
    business_name: string
    website_url: string | null
    primary_service: string | null
    location_city: string
    location_state: string
    keywords: string[]
    score_overall: number
    score_chatgpt: number
    score_gemini: number
    description_text: string | null
    description_category: string | null
    insights_summary: string | null
    insights_data: Record<string, unknown> | null
    created_at: string
  }
  competitors: Array<{
    id: string
    competitor_name: string
    mention_count: number
    above_count: number
    below_count: number
    verified?: boolean | null
    verified_place_id?: string | null
  }>
  queryResults: Array<{
    platform: string
    location_type: string
    keyword: string | null
    query_text: string | null
    mentioned: boolean
    mention_count: number
    response_text: string | null
  }>
  // Most recent lead captured for this job — drives the in-report sequence offer
  // without leaking the email through the URL.
  lead: { email: string; sequence_enrolled: boolean } | null
}

export async function fetchReportData(id: string): Promise<
  | { success: true; data: ReportData }
  | { success: false; error: string; data?: { status: string } }
> {
  const db = getSupabaseAdmin()

  const { data: job } = await db.from('research_jobs').select('*').eq('id', id).single()

  if (!job) return { success: false, error: 'Report not found' }
  if (job.status !== 'complete') return { success: false, error: 'Report not ready', data: { status: job.status } }

  const [{ data: competitors, error: compErr }, { data: queryResults, error: qrErr }, { data: lead }] = await Promise.all([
    db.from('competitors')
      .select('id, competitor_name, mention_count, above_count, below_count')
      .eq('job_id', id)
      .order('mention_count', { ascending: false })
      .limit(10),
    db.from('query_results')
      .select('platform, location_type, keyword, query_text, mentioned, mention_count, response_text')
      .eq('job_id', id),
    db.from('leads')
      .select('email, sequence_enrolled')
      .eq('job_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (compErr) console.error('[report] competitors query error:', compErr.message)
  if (qrErr) console.error('[report] query_results error:', qrErr.message)
  console.error(`[report] job ${id}: ${(competitors ?? []).length} competitors, ${(queryResults ?? []).length} query results`)

  return {
    success: true,
    data: {
      job: {
        id: job.id,
        business_name: job.business_name,
        website_url: job.website_url,
        primary_service: job.primary_service,
        location_city: job.location_city,
        location_state: job.location_state,
        keywords: job.keywords ?? [],
        score_overall: job.score_overall ?? 0,
        score_chatgpt: job.score_chatgpt ?? 0,
        score_gemini: job.score_gemini ?? 0,
        description_text: job.description_text ?? null,
        description_category: job.description_category ?? null,
        insights_summary: job.insights_summary ?? null,
        insights_data: job.insights_data ?? null,
        created_at: job.created_at,
      },
      competitors: (competitors ?? []) as ReportData['competitors'],
      queryResults: (queryResults ?? []) as ReportData['queryResults'],
      lead: lead
        ? { email: lead.email as string, sequence_enrolled: !!lead.sequence_enrolled }
        : null,
    },
  }
}
