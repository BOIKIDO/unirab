import { getSupabaseAdmin } from '@/lib/supabase'
import { queryGeminiWithSearch } from '@/lib/gemini'
import { queryOpenAISearch } from '@/lib/openai'
import { queryDeepSeek } from '@/lib/deepseek'
import { analyzeResponse, aggregateCompetitors, normalizeCompetitorName } from '@/lib/parser'
import { calculateScores, PlatformResult } from '@/lib/scoring'
import { generateInsights } from '@/lib/insights'
import { verifyJobCompetitors } from '@/lib/verifier'

const PLATFORMS = ['chatgpt', 'gemini'] as const
type Platform = typeof PLATFORMS[number]

function buildPrompt(keyword: string, location: string): string {
  return `best ${keyword} in ${location}`
}

const KNOWN_CATEGORIES = [
  'general contracting business', 'general contracting company',
  'contracting business', 'contracting company',
  'roofing business', 'roofing company',
  'plumbing business', 'plumbing company',
  'electrical business', 'electrical company',
  'painting business', 'painting company',
  'landscaping business', 'landscaping company',
  'HVAC business', 'HVAC company',
  'remodeling business', 'remodeling company',
  'renovation business', 'renovation company',
  'home services business', 'home improvement business',
]

function getTier(score: number) {
  if (score <= 20) return 'Dead in the Water'
  if (score <= 40) return 'Bleeding Out'
  if (score <= 60) return 'Treading Water'
  if (score <= 75) return 'In the Game'
  if (score <= 90) return 'Market Contender'
  return 'Category King'
}

async function generateDescription(
  businessName: string, primaryService: string, keywords: string[],
  city: string, state: string, score: number
): Promise<{ text: string; category: string | null }> {
  const tier = getTier(score)
  try {
    const prompt = `You write a 2-3 sentence AI visibility score description for a local contractor's report.

Business: "${businessName}"
Services offered: ${keywords.length ? keywords.join(', ') : primaryService}
Location: ${city}, ${state}
Score: ${score}/100
Tier: ${tier}

Tier tone guide:
- Dead in the Water (0-20): Blunt, urgent. AI has no idea they exist. Competitors take every job.
- Bleeding Out (21-40): They show up barely. Losing jobs they never got to quote.
- Treading Water (41-60): Inconsistent presence. Half the homeowners who should find them, don't.
- In the Game (61-75): Getting recommended but market not locked down. Competitor can steal position in 90 days.
- Market Contender (76-90): AI sends homeowners their way. Focus on protecting and expanding.
- Category King (91-100): They own the market. First mention before any competitor. Expand now.

Output plain text with exactly two highlight tags:
1. Wrap "${city}, ${state}" in <hl>...</hl>
2. Wrap the business category phrase (e.g. "contracting business", "roofing company") in <cat>...</cat>. Use exactly ONE <cat> tag. Pick a category that covers the breadth of services — never a single keyword.
2-3 sentences max. Punchy. No fluff. Speak directly to the owner. Never use em dashes or en dashes anywhere; use commas or periods instead. Output ONLY the tagged text.`

    const raw = await queryDeepSeek(prompt)
    const catMatch = raw.match(/<cat>([^<]+)<\/cat>/i)
    const fromTag = catMatch ? catMatch[1].trim() : null
    const text = raw.replace(/<\/?cat>/gi, '').replace(/<\/?hl>/gi, '').replace(/\*\*/g, '').replace(/\*/g, '').trim()
    const fromText = KNOWN_CATEGORIES.find((c) => text.toLowerCase().includes(c)) ?? null
    return { text, category: fromTag ?? fromText }
  } catch (err) {
    console.error('[worker] description generation failed:', err)
    // Fallback copy states only what the score itself supports — no invented
    // frequencies, ratios, or timelines. This text is stored and shown as data.
    const cat = 'contracting business'
    const fallbacks: Record<string, string> = {
      '0-20': `AI doesn't know your ${cat} exists in ${city}, ${state}. When homeowners ask ChatGPT or Gemini for a contractor, your competitors get named. You don't.`,
      '21-40': `Your ${cat} barely shows up in AI searches for ${city}, ${state}. Most queries send homeowners to competitors, and those are jobs you never got the chance to quote.`,
      '41-60': `Your ${cat} has inconsistent AI visibility in ${city}, ${state}. Some searches surface you, most don't. Homeowners who should find you aren't finding you.`,
      '61-75': `Your ${cat} is getting recommended in ${city}, ${state}, but the market isn't locked down. A competitor with a stronger AI presence can take your position.`,
      '76-90': `AI is actively sending homeowners to your ${cat} in ${city}, ${state}. You're in the conversation before most of your competitors get a mention.`,
      '91-100': `Your ${cat} owns the AI conversation in ${city}, ${state}. ChatGPT and Gemini both recommend you consistently. Now expand it to every city you want to dominate.`,
    }
    const bucket = score <= 20 ? '0-20' : score <= 40 ? '21-40' : score <= 60 ? '41-60' : score <= 75 ? '61-75' : score <= 90 ? '76-90' : '91-100'
    return { text: fallbacks[bucket], category: cat }
  }
}

async function generateInsightsForJob(
  jobId: string, businessName: string, primaryService: string,
  keywords: string[], city: string, state: string, scores: { overall: number; chatgpt: number; gemini: number }
) {
  const db = getSupabaseAdmin()
  const { data: queryResults } = await db.from('query_results').select('platform, mentioned').eq('job_id', jobId)
  const { data: competitors } = await db.from('competitors').select('competitor_name, mention_count').eq('job_id', jobId).order('mention_count', { ascending: false }).limit(5)

  const all = queryResults ?? []
  const chatgptMentions = all.filter((r: { platform: string; mentioned: boolean }) => r.platform === 'chatgpt' && r.mentioned).length
  const geminiMentions = all.filter((r: { platform: string; mentioned: boolean }) => r.platform === 'gemini' && r.mentioned).length

  return generateInsights({
    businessName,
    city, state,
    primaryService,
    scoreOverall: scores.overall,
    scoreChatgpt: scores.chatgpt,
    scoreGemini: scores.gemini,
    chatgptMentions, geminiMentions,
    totalQueriesPerPlatform: keywords.length * 2 + 2, // +2 for name queries
    keywords,
    topCompetitors: (competitors ?? []).map((c: { competitor_name: string; mention_count: number }) => ({
      name: c.competitor_name,
      count: c.mention_count,
    })),
  })
}

async function runPlatformQuery(platform: Platform, prompt: string): Promise<string> {
  const result = await Promise.race([
    (async () => {
      switch (platform) {
        case 'chatgpt':
          return queryOpenAISearch(prompt)
        case 'gemini':
          return queryGeminiWithSearch(prompt)
      }
    })(),
    new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('Query timeout')), 18000)
    ),
  ])
  return result
}

// Run items in batches to avoid API rate limiting
async function batchMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  batchSize: number
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.allSettled(batch.map(fn))
    for (const r of batchResults) {
      if (r.status === 'fulfilled') results.push(r.value)
      // rejected items are silently skipped — handled by caller
    }
  }
  return results
}

export async function runResearch(jobId: string): Promise<void> {
  try {
    await runResearchInner(jobId)
  } catch (err) {
    console.error(`[worker] FATAL for ${jobId}:`, err)
    await getSupabaseAdmin()
      .from('research_jobs')
      .update({ status: 'failed' })
      .eq('id', jobId)
  }
}

const STUCK_THRESHOLD_MS = 10 * 60 * 1000 // 10 min — if running longer, treat as stuck

async function runResearchInner(jobId: string): Promise<void> {
  console.error(`[worker] starting job ${jobId}`)

  const { data: job, error: jobErr } = await getSupabaseAdmin()
    .from('research_jobs')
    .select('*')
    .eq('id', jobId)
    .single()

  if (jobErr || !job) {
    console.error(`[worker] job not found: ${jobId}`, jobErr)
    return
  }

  // Idempotency guard — if already complete, don't re-run
  if (job.status === 'complete') {
    console.error(`[worker] job ${jobId} already complete — skipping`)
    return
  }

  // If already running, check if stuck. Recent running = duplicate trigger, skip.
  if (job.status === 'running') {
    const runningMs = Date.now() - new Date(job.created_at).getTime()
    if (runningMs < STUCK_THRESHOLD_MS) {
      console.error(`[worker] job ${jobId} already running (${Math.round(runningMs / 1000)}s) — skipping`)
      return
    }
    console.error(`[worker] job ${jobId} stuck in running for ${Math.round(runningMs / 1000)}s — restarting`)
  }

  await getSupabaseAdmin()
    .from('research_jobs')
    .update({ status: 'running' })
    .eq('id', jobId)

  const keywords: string[] = job.keywords ?? []
  const cityLocation = `${job.location_city}, ${job.location_state}`
  const stateLocation = job.location_state

  const perResponseCompetitors: import('@/lib/parser').RankedCompetitor[][] = []
  const platformResults: Record<Platform, PlatformResult> = {
    chatgpt: { mentioned: false, mentionCount: 0, isFirstMention: false },
    gemini: { mentioned: false, mentionCount: 0, isFirstMention: false },
  }

  // Build queries for both platforms
  const platformQueries: Record<Platform, Array<{ keyword: string; locationType: string; location: string; prompt: string }>> = {
    chatgpt: [],
    gemini: [],
  }
  for (const keyword of keywords) {
    for (const platform of PLATFORMS) {
      platformQueries[platform].push({ keyword, locationType: 'city', location: cityLocation, prompt: buildPrompt(keyword, cityLocation) })
      platformQueries[platform].push({ keyword, locationType: 'state', location: stateLocation, prompt: buildPrompt(keyword, stateLocation) })
    }
  }
  // Add direct business name searches
  for (const platform of PLATFORMS) {
    platformQueries[platform].push({ keyword: 'business_name', locationType: 'city', location: cityLocation, prompt: job.business_name })
    platformQueries[platform].push({ keyword: 'business_name', locationType: 'state', location: stateLocation, prompt: `${job.business_name} ${stateLocation}` })
  }

  // Run both platforms in parallel, batched 5 at a time per platform to avoid rate limits
  const platformPromises = PLATFORMS.map(async (platform) => {
    const queries = platformQueries[platform]
    const results = await batchMap(queries, async (q) => {
      try {
        const responseText = await runPlatformQuery(platform, q.prompt)
        const analysis = await analyzeResponse(responseText, job.business_name)
        return { platform, ...q, responseText, analysis }
      } catch (err) {
        console.error(`[worker] ${platform}/${q.locationType}/${q.keyword} failed:`, err)
        return {
          platform, ...q,
          responseText: '',
          analysis: { mention: { mentioned: false, mentionCount: 0, isFirstMention: false }, competitors: [] },
        }
      }
    }, 5)
    return { platform, results }
  })

  const settled = await Promise.allSettled(platformPromises)

  for (const platformResult of settled) {
    if (platformResult.status === 'rejected') continue
    const { platform, results } = platformResult.value

    for (const result of results) {
      const { keyword, locationType, prompt, responseText, analysis } = result
      const { mention, competitors } = analysis

      console.error(`[worker] ${platform}/${locationType}/${keyword} — mentioned: ${mention.mentioned} (count ${mention.mentionCount}), competitors: ${competitors.length}`)

      if (mention.mentioned) {
        platformResults[platform].mentioned = true
        platformResults[platform].mentionCount += mention.mentionCount
        if (mention.isFirstMention) platformResults[platform].isFirstMention = true
      }

      perResponseCompetitors.push(competitors)

      const { error: qrErr } = await getSupabaseAdmin().from('query_results').insert({
        job_id: jobId,
        platform,
        keyword,
        location_type: locationType,
        query_text: prompt,
        response_text: responseText,
        mentioned: mention.mentioned,
        mention_count: mention.mentionCount,
      })
      if (qrErr) console.error(`[worker] query_results insert failed:`, qrErr)
    }
  }

  const scores = calculateScores({
    chatgpt: platformResults.chatgpt,
    gemini: platformResults.gemini,
    totalKeywords: keywords.length,
  })

  const top10 = aggregateCompetitors(perResponseCompetitors).slice(0, 10)
  console.error(`[worker] aggregated ${top10.length} competitors from ${perResponseCompetitors.length} responses (total raw: ${perResponseCompetitors.reduce((n, arr) => n + arr.length, 0)})`)

  if (top10.length > 0) {
    const { error: compErr } = await getSupabaseAdmin().from('competitors').insert(
      top10.map((comp) => ({
        job_id: jobId,
        competitor_name: comp.name,
        mention_count: comp.count,
        above_count: comp.aboveCount,
        below_count: comp.belowCount,
      }))
    )
    if (compErr) console.error(`[worker] competitors insert failed:`, compErr)
  }

  // Pre-render AI content — 15s hard deadline, never block job completion
  const preRenderResult = await Promise.race([
    Promise.allSettled([
      generateDescription(job.business_name, job.primary_service ?? '', keywords, job.location_city, job.location_state, scores.overall),
      generateInsightsForJob(jobId, job.business_name, job.primary_service ?? '', keywords, job.location_city, job.location_state, scores),
    ]),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 20000)),
  ])

  const descResult = preRenderResult?.[0] ?? { status: 'rejected' as const, reason: 'timeout' }
  const insightsResult = preRenderResult?.[1] ?? { status: 'rejected' as const, reason: 'timeout' }

  const descriptionText = descResult.status === 'fulfilled' ? descResult.value.text : null
  const descriptionCategory = descResult.status === 'fulfilled' ? descResult.value.category : null
  const insightsData = insightsResult.status === 'fulfilled' ? insightsResult.value : null

  // Update base fields first (always works)
  const baseUpdate: Record<string, unknown> = {
    status: 'complete',
    score_overall: scores.overall,
    score_chatgpt: scores.chatgpt,
    score_gemini: scores.gemini,
  }
  // Pre-rendered content — only include if generated, columns may not exist yet
  if (descriptionText) baseUpdate.description_text = descriptionText
  if (descriptionCategory) baseUpdate.description_category = descriptionCategory
  if (insightsData) {
    baseUpdate.insights_summary = insightsData.summary
    baseUpdate.insights_data = insightsData
  }

  const { error: updErr } = await getSupabaseAdmin()
    .from('research_jobs')
    .update(baseUpdate)
    .eq('id', jobId)
  if (updErr) console.error(`[worker] final job update failed:`, updErr.message)

  console.error(`[worker] job ${jobId} complete — score ${scores.overall}`)

  // Fire-and-forget: verify competitors against Google Places
  // (doesn't block the report — report loads while this runs in background)
  verifyJobCompetitors(jobId, job.location_city, job.location_state).catch((err) =>
    console.error(`[verifier] background verification failed for ${jobId}:`, err)
  )
}

// ---------------------------------------------------------------------------
// Chunked worker for production (Vercel Hobby caps a function at 60s).
// Each QStash invocation performs one bounded phase:
//   1. search  - run a small batch of AI queries, store raw responses
//   2. analysis - parse a batch of stored responses + queue competitor rows
//   3. finalize - aggregate competitors, score, generate insights, mark complete
// State lives entirely in Supabase, so retries resume instead of starting over.
// ---------------------------------------------------------------------------

export const SEARCH_CHUNK = 12
export const ANALYSIS_CHUNK = 12
const STEP_CONCURRENCY = 6
// mention_count doubles as a "not analyzed yet" marker (-1) and as the
// first-mention flag (+100). Nothing in the report displays this column.
const FIRST_MENTION_MARKER = 100

interface PlannedQuery {
  platform: Platform
  keyword: string
  locationType: 'city' | 'state'
  location: string
  prompt: string
}

function buildQueryPlan(job: {
  business_name: string
  location_city: string
  location_state: string
  keywords?: string[] | null
}): PlannedQuery[] {
  const keywords: string[] = job.keywords ?? []
  const cityLocation = `${job.location_city}, ${job.location_state}`
  const stateLocation = job.location_state
  const plan: PlannedQuery[] = []

  for (const keyword of keywords) {
    for (const platform of PLATFORMS) {
      plan.push({ platform, keyword, locationType: 'city', location: cityLocation, prompt: buildPrompt(keyword, cityLocation) })
      plan.push({ platform, keyword, locationType: 'state', location: stateLocation, prompt: buildPrompt(keyword, stateLocation) })
    }
  }
  for (const platform of PLATFORMS) {
    plan.push({ platform, keyword: 'business_name', locationType: 'city', location: cityLocation, prompt: job.business_name })
    plan.push({ platform, keyword: 'business_name', locationType: 'state', location: stateLocation, prompt: `${job.business_name} ${stateLocation}` })
  }
  return plan
}

function queryKey(q: {
  platform: string
  keyword: string
  location_type?: string
  locationType?: string
}): string {
  return `${q.platform}|${q.keyword}|${q.location_type ?? q.locationType}`
}

async function runConcurrent<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < items.length; i += size) {
    const settled = await Promise.allSettled(items.slice(i, i + size).map(fn))
    for (const s of settled) if (s.status === 'fulfilled') out.push(s.value)
  }
  return out
}

export async function runResearchStep(jobId: string): Promise<{ complete: boolean; phase: string; progressed: number }> {
  const db = getSupabaseAdmin()
  const { data: job, error } = await db.from('research_jobs').select('*').eq('id', jobId).single()
  if (error || !job) throw new Error(`job ${jobId} not found`)
  if (job.status === 'complete') return { complete: true, phase: 'complete', progressed: 0 }
  if (job.status === 'pending') {
    await db.from('research_jobs').update({ status: 'running' }).eq('id', jobId)
  }

  const plan = buildQueryPlan(job)
  const { data: existingRows, error: rowsErr } = await db
    .from('query_results')
    .select('platform, keyword, location_type')
    .eq('job_id', jobId)
  if (rowsErr) throw new Error(`query_results read failed: ${rowsErr.message}`)

  const existing = new Set((existingRows ?? []).map(queryKey))
  const missing = plan.filter((q) => !existing.has(queryKey(q)))

  if (missing.length > 0) {
    const chunk = missing.slice(0, SEARCH_CHUNK)
    const results = await runConcurrent(chunk, STEP_CONCURRENCY, async (q) => {
      try {
        const responseText = await runPlatformQuery(q.platform, q.prompt)
        return { q, responseText }
      } catch (err) {
        console.error(`[step] ${q.platform}/${q.locationType}/${q.keyword} failed:`, err)
        return { q, responseText: '' }
      }
    })

    if (results.length > 0) {
      const { error: insErr } = await db.from('query_results').insert(
        results.map(({ q, responseText }) => ({
          job_id: jobId,
          platform: q.platform,
          keyword: q.keyword,
          location_type: q.locationType,
          query_text: q.prompt,
          response_text: responseText,
          mentioned: false,
          mention_count: -1,
        }))
      )
      if (insErr) throw new Error(`query_results insert failed: ${insErr.message}`)
    }
    return { complete: false, phase: 'search', progressed: results.length }
  }

  const { data: unanalyzed, error: anErr } = await db
    .from('query_results')
    .select('id, platform, keyword, location_type, response_text')
    .eq('job_id', jobId)
    .eq('mention_count', -1)
    .limit(ANALYSIS_CHUNK)
  if (anErr) throw new Error(`analysis read failed: ${anErr.message}`)

  if (unanalyzed && unanalyzed.length > 0) {
    const analyzed = await runConcurrent(unanalyzed, STEP_CONCURRENCY, async (row) => {
      const analysis = await analyzeResponse(row.response_text ?? '', job.business_name)
      return { row, analysis }
    })

    let updated = 0
    for (const { row, analysis } of analyzed) {
      const encoded = analysis.mention.mentioned
        ? (analysis.mention.isFirstMention
            ? FIRST_MENTION_MARKER + analysis.mention.mentionCount
            : analysis.mention.mentionCount)
        : 0

      const { error: updErr } = await db
        .from('query_results')
        .update({ mentioned: analysis.mention.mentioned, mention_count: encoded })
        .eq('id', row.id)
      if (updErr) {
        console.error('[step] query_result update failed:', updErr)
        continue
      }
      updated++

      // Store one row per competitor mention. Finalize aggregates these into
      // the top-10 table the report reads.
      const seen = new Set<string>()
      const compRows: Array<Record<string, string | number>> = []
      for (const comp of analysis.competitors) {
        const key = normalizeCompetitorName(comp.name)
        if (!key || key.length < 3 || seen.has(key)) continue
        seen.add(key)
        compRows.push({
          job_id: jobId,
          competitor_name: comp.name.trim(),
          mention_count: 1,
          above_count: comp.above ? 1 : 0,
          below_count: comp.above ? 0 : 1,
        })
      }
      if (compRows.length > 0) {
        const { error: compErr } = await db.from('competitors').insert(compRows)
        if (compErr) console.error('[step] competitor insert failed:', compErr)
      }
    }
    return { complete: false, phase: 'analysis', progressed: updated }
  }

  await finalizeResearch(db, job)
  return { complete: true, phase: 'finalize', progressed: 1 }
}

async function finalizeResearch(
  db: ReturnType<typeof getSupabaseAdmin>,
  job: {
    id: string
    business_name: string
    primary_service?: string | null
    location_city: string
    location_state: string
    keywords?: string[] | null
  }
): Promise<void> {
  const jobId = job.id
  const keywords: string[] = job.keywords ?? []
  const cityLocation = `${job.location_city}, ${job.location_state}`
  const stateLocation = job.location_state

  const { data: rows } = await db
    .from('query_results')
    .select('platform, keyword, location_type, mentioned, mention_count')
    .eq('job_id', jobId)

  const platformResults: Record<Platform, PlatformResult> = {
    chatgpt: { mentioned: false, mentionCount: 0, isFirstMention: false },
    gemini: { mentioned: false, mentionCount: 0, isFirstMention: false },
  }
  for (const row of rows ?? []) {
    if (!row.mentioned) continue
    const target = platformResults[row.platform as Platform]
    if (!target) continue
    const encoded = Math.max(0, Number(row.mention_count) || 0)
    const isFirst = encoded >= FIRST_MENTION_MARKER
    target.mentioned = true
    target.mentionCount += isFirst ? encoded - FIRST_MENTION_MARKER : encoded
    if (isFirst) target.isFirstMention = true
  }

  const scores = calculateScores({
    chatgpt: platformResults.chatgpt,
    gemini: platformResults.gemini,
    totalKeywords: keywords.length,
  })

  // Aggregate the per-response competitor rows written during analysis.
  const { data: rawComps } = await db
    .from('competitors')
    .select('competitor_name, mention_count, above_count, below_count')
    .eq('job_id', jobId)

  const buckets = new Map<string, { display: string; count: number; aboveCount: number; belowCount: number }>()
  for (const c of rawComps ?? []) {
    const key = normalizeCompetitorName(c.competitor_name)
    if (!key || key.length < 3) continue
    const existing = buckets.get(key)
    if (!existing) {
      buckets.set(key, {
        display: c.competitor_name.trim(),
        count: c.mention_count,
        aboveCount: c.above_count,
        belowCount: c.below_count,
      })
    } else {
      existing.count += c.mention_count
      existing.aboveCount += c.above_count
      existing.belowCount += c.below_count
      if (c.competitor_name.trim().length > existing.display.length) {
        existing.display = c.competitor_name.trim()
      }
    }
  }

  const top10 = Array.from(buckets.values())
    .map((b) => ({ name: b.display, count: b.count, aboveCount: b.aboveCount, belowCount: b.belowCount }))
    .sort((a, b) => b.aboveCount - a.aboveCount)
    .slice(0, 10)

  await db.from('competitors').delete().eq('job_id', jobId)
  if (top10.length > 0) {
    const { error: compErr } = await db.from('competitors').insert(
      top10.map((c) => ({
        job_id: jobId,
        competitor_name: c.name,
        mention_count: c.count,
        above_count: c.aboveCount,
        below_count: c.belowCount,
      }))
    )
    if (compErr) console.error('[step] final competitor insert failed:', compErr)
  }

  const preRenderResult = await Promise.race([
    Promise.allSettled([
      generateDescription(job.business_name, job.primary_service ?? '', keywords, job.location_city, job.location_state, scores.overall),
      generateInsightsForJob(jobId, job.business_name, job.primary_service ?? '', keywords, job.location_city, job.location_state, scores),
    ]),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 20000)),
  ])

  const descResult = preRenderResult?.[0] ?? { status: 'rejected' as const, reason: 'timeout' }
  const insightsResult = preRenderResult?.[1] ?? { status: 'rejected' as const, reason: 'timeout' }
  const descriptionText = descResult.status === 'fulfilled' ? descResult.value.text : null
  const descriptionCategory = descResult.status === 'fulfilled' ? descResult.value.category : null
  const insightsData = insightsResult.status === 'fulfilled' ? insightsResult.value : null

  const baseUpdate: Record<string, unknown> = {
    status: 'complete',
    score_overall: scores.overall,
    score_chatgpt: scores.chatgpt,
    score_gemini: scores.gemini,
  }
  if (descriptionText) baseUpdate.description_text = descriptionText
  if (descriptionCategory) baseUpdate.description_category = descriptionCategory
  if (insightsData) {
    baseUpdate.insights_summary = insightsData.summary
    baseUpdate.insights_data = insightsData
  }

  const { error: updErr } = await db.from('research_jobs').update(baseUpdate).eq('id', jobId)
  if (updErr) console.error('[step] final job update failed:', updErr.message)

  // Verification is quick (10 Places lookups); await it with a cap so the
  // result is saved before this function returns and freezes.
  await Promise.race([
    verifyJobCompetitors(jobId, job.location_city, job.location_state).catch((err) =>
      console.error(`[verifier] verification failed for ${jobId}:`, err)
    ),
    new Promise((resolve) => setTimeout(resolve, 15000)),
  ])
}
