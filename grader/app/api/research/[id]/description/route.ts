export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { queryDeepSeek } from '@/lib/deepseek'

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { data: job } = await getSupabaseAdmin()
    .from('research_jobs')
    .select('business_name, primary_service, keywords, location_city, location_state, score_overall')
    .eq('id', id)
    .single()

  if (!job) return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })
  if (job.score_overall == null) return NextResponse.json({ success: false, error: 'Report not ready' }, { status: 202 })

  const score = job.score_overall
  const tier = getTier(score)
  const keywords = (job.keywords ?? []) as string[]
  const city = job.location_city
  const state = job.location_state

  try {
    const prompt = `You write a 2-3 sentence AI visibility score description for a local contractor's report.

Business: "${job.business_name}"
Services offered: ${keywords.length ? keywords.join(', ') : (job.primary_service ?? 'home services')}
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

OUTPUT FORMAT (CRITICAL):
Your response is plain text EXCEPT for two required highlight tags:
1. Wrap "${city}, ${state}" in <hl>...</hl>
2. Wrap the business CATEGORY phrase (e.g. "contracting business", "roofing company", "home services business", "remodeling company") in <cat>...</cat>. Use exactly ONE <cat> tag. Pick a category phrase that covers the BREADTH of services listed — never a single keyword like "kitchen remodeling".

Other rules:
- 2-3 sentences max. Punchy. No fluff.
- Speak directly to the owner ("you", "your").
- Match the tier tone exactly.
- No other markdown, asterisks, emojis, or formatting.
- Output ONLY the sentences with the two tag types, nothing else.`

    const raw = await queryDeepSeek(prompt)
    const catMatch = raw.match(/<cat>([^<]+)<\/cat>/i)
    const fromTag = catMatch ? catMatch[1].trim() : null
    const text = raw.replace(/<\/?cat>/gi, '').replace(/<\/?hl>/gi, '').replace(/\*\*/g, '').replace(/\*/g, '').trim()

    const fromText = KNOWN_CATEGORIES.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(text)) ?? null

    return NextResponse.json({
      success: true,
      data: { text, category: fromTag ?? fromText },
    })
  } catch {
    // Static fallback — fast, always works
    const category = 'contracting business'
    let text = ''
    if (score <= 20) text = `AI has no idea your ${category} exists in ${city}, ${state}. Every homeowner searching for a local contractor right now is being sent directly to your competitors — and that's happening hundreds of times a month without you knowing.`
    else if (score <= 40) text = `Your ${category} is barely showing up in ${city}, ${state}. AI recommends you once and your competitors seven times. You're losing jobs you never even got a chance to quote — every single day.`
    else if (score <= 60) text = `Your ${category} has some AI visibility in ${city}, ${state} — but inconsistent means unreliable. Half the homeowners who should find you, don't. You're not losing because you're bad. You're losing because you're invisible when it counts.`
    else if (score <= 75) text = `Your ${category} is getting recommended in ${city}, ${state} — but you haven't locked down your market yet. One competitor with a better AI presence can take your position in 90 days.`
    else if (score <= 90) text = `AI is actively sending homeowners to your ${category} in ${city}, ${state}. You're in the conversation before your competitors even get a mention. Your focus now is to protect this position and expand into neighboring cities.`
    else text = `Your ${category} owns the market in ${city}, ${state}. ChatGPT and Gemini both send homeowners to you first — before a competitor gets a single word in. Now expand it to every city you want to dominate.`
    return NextResponse.json({ success: true, data: { text, category } })
  }
}
