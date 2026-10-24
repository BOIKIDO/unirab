// Usage:
//   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/test-visibility.ts "Business Name"
//   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/test-visibility.ts "Acme Roofing"
//
// The script auto-detects location + keywords from Google Places (same as the real app).
// For manual override, pass extra args:
//   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/test-visibility.ts "Business" "City" "ST" "category"

import { queryGemini } from '../lib/gemini'
import { analyzeResponse, aggregateCompetitors, RankedCompetitor } from '../lib/parser'
import { calculateScores, PlatformResult, scoreGrade } from '../lib/scoring'
import { getOpenAI } from '../lib/openai'
import { getKeywordsForTypes } from '../lib/keywords'
import { searchPlaces, getPlaceDetails, extractCityState } from '../lib/places'

// ── Step 1: Resolve business info ─────────────────────
async function resolveBusiness(name: string, manualCity?: string, manualState?: string, manualCat?: string) {
  // Manual override path
  if (manualCity && manualState) {
    const category = manualCat || 'general_contractor'
    let keywords = getKeywordsForTypes([category], name)
    if (keywords.length < 10) {
      const extras = [
        'kitchen remodel', 'bathroom remodel', 'basement finishing',
        'room addition', 'home renovation contractor', 'house painter',
        'interior painting', 'deck builder', 'flooring contractor', 'landscaping company',
      ]
      for (const ek of extras) {
        if (keywords.length >= 10) break
        if (!keywords.includes(ek)) keywords.push(ek)
      }
    }
    return { name, city: manualCity, state: manualState, keywords: keywords.slice(0, 10), primaryService: keywords[0] }
  }

  // Auto-detect via Google Places (matches real app flow)
  console.log(`Looking up "${name}" via Google Places...`)
  const predictions = await searchPlaces(name)
  if (!predictions.length) {
    console.log('No Google Places results found. Falling back to defaults.')
    return resolveBusiness(name, 'Hoboken', 'NJ', 'general_contractor')
  }

  const place = predictions[0]
  console.log(`  → ${place.description} (${place.place_id})`)

  const details = await getPlaceDetails(place.place_id)
  if (!details) {
    console.log('Could not fetch place details. Falling back to defaults.')
    return resolveBusiness(name, 'Hoboken', 'NJ', 'general_contractor')
  }

  const { city, state } = extractCityState(details)

  // Extract keywords via GPT (same as /api/lookup/details)
  let keywords: string[]
  let primaryService: string

  try {
    const openai = getOpenAI()
    const res = await openai.responses.create({
      model: 'gpt-5.4-nano',
      input: `You are analyzing a local contractor or home service business.

Business name: "${details.name}"
Google description: ${details.editorial_summary?.overview ?? 'N/A'}
Google types: ${details.types.join(', ')}

Return JSON with:
- "keywords": array of exactly 10 specific service keywords (short phrases, 2-5 words, as specific as possible to THIS business)
- "primary_service": the single most important service (2-4 words)

Respond with JSON only.`,
    })
    const data = JSON.parse(res.output_text)
    keywords = Array.isArray(data.keywords) && data.keywords.length > 0
      ? data.keywords.slice(0, 10)
      : getKeywordsForTypes(details.types, details.name).slice(0, 10)
    primaryService = data.primary_service ?? keywords[0]
  } catch {
    keywords = getKeywordsForTypes(details.types, details.name)
    primaryService = keywords[0]
  }

  console.log(`  → ${details.formatted_address}`)
  console.log(`  → ${city}, ${state} | ${primaryService} | ${keywords.length} keywords`)
  return { name: details.name, city, state, keywords: keywords.slice(0, 10), primaryService }
}

// ── Helpers ─────────────────────────────────────────────
function buildPrompt(kw: string, loc: string) {
  return `Who are the best ${kw} companies in ${loc}? Give me specific local business names, not national chains. List 3-5 real companies.`
}

// ── Main ────────────────────────────────────────────────
async function main() {
  const businessName = process.argv[2] || 'Hoboken General Contractor'
  const manualCity = process.argv[3]
  const manualState = process.argv[4]
  const manualCat = process.argv[5]

  const biz = await resolveBusiness(businessName, manualCity, manualState, manualCat)

  const cityLocation = `${biz.city}, ${biz.state}`
  const stateLocation = biz.state
  const KEYWORDS = biz.keywords

  console.log('\n══════════════════════════════════════════════════')
  console.log(`  AI VISIBILITY TEST — ${biz.name}`)
  console.log(`  Location: ${cityLocation}`)
  console.log(`  Primary service: ${biz.primaryService}`)
  console.log(`  Keywords: ${KEYWORDS.length} | Locations: city + state | Platforms: ChatGPT + Gemini`)
  console.log(`  Total queries: ${KEYWORDS.length * 4}`)
  console.log(`  ${KEYWORDS.join(', ')}`)
  console.log('══════════════════════════════════════════════════\n')

  const openai = getOpenAI()
  const platforms = ['chatgpt', 'gemini'] as const

  const platformResults: Record<string, PlatformResult> = {
    chatgpt: { mentioned: false, mentionCount: 0, isFirstMention: false },
    gemini: { mentioned: false, mentionCount: 0, isFirstMention: false },
  }
  const perResponseCompetitors: RankedCompetitor[][] = []

  for (const platform of platforms) {
    console.log(`── ${platform.toUpperCase()} ──`)
    let hits = 0
    let total = 0

    for (const kw of KEYWORDS) {
      for (const loc of [cityLocation, stateLocation]) {
        const locType = loc === cityLocation ? 'city' : 'state'
        const prompt = buildPrompt(kw, loc)
        total++

        try {
          let responseText: string
          if (platform === 'chatgpt') {
            const res = await openai.responses.create({ model: 'gpt-5.4-nano', input: prompt })
            responseText = res.output_text
          } else {
            responseText = await queryGemini(prompt)
          }

          const analysis = await analyzeResponse(responseText, biz.name)
          perResponseCompetitors.push(analysis.competitors)

          if (analysis.mention.mentioned) {
            hits++
            platformResults[platform].mentioned = true
            platformResults[platform].mentionCount += analysis.mention.mentionCount
            if (analysis.mention.isFirstMention) platformResults[platform].isFirstMention = true
          }

          const status = analysis.mention.mentioned ? '✓' : '✗'
          const nComps = analysis.competitors.length
          console.log(`  ${status} ${kw.padEnd(32)} ${locType.padEnd(6)} ${nComps} competitor${nComps !== 1 ? 's' : ''}`)

        } catch (err: any) {
          console.log(`  ✗ ${kw.padEnd(32)} ${locType.padEnd(6)} ERROR: ${err.message?.slice(0, 60)}`)
        }
      }
    }

    const pr = platformResults[platform]
    console.log(`  → ${hits}/${total} mentions | mentionCount=${pr.mentionCount} | firstMention=${pr.isFirstMention}\n`)
  }

  // ── Scores ────────────────────────────────────────────
  const scores = calculateScores({
    chatgpt: platformResults.chatgpt,
    gemini: platformResults.gemini,
    totalKeywords: KEYWORDS.length,
  })

  console.log('══════════════════════════════════════════════════')
  console.log('  SCORES (0–100)')
  console.log('══════════════════════════════════════════════════')
  console.log(`  ChatGPT   : ${scores.chatgpt.toString().padStart(3)}  ${scoreGrade(scores.chatgpt).label}`)
  console.log(`  Gemini    : ${scores.gemini.toString().padStart(3)}  ${scoreGrade(scores.gemini).label}`)
  console.log(`  OVERALL   : ${scores.overall.toString().padStart(3)}  ${scoreGrade(scores.overall).label}`)

  // ── Competitors ───────────────────────────────────────
  const top = aggregateCompetitors(perResponseCompetitors).slice(0, 10)
  if (top.length > 0) {
    console.log(`\n  TOP COMPETITORS (by how often they beat ${biz.name})`)
    for (const c of top) {
      console.log(`  ${c.name} — ${c.count}x total (↑${c.aboveCount} ahead ↓${c.belowCount} behind)`)
    }
  }

  console.log('\n══════════════════════════════════════════════════')
}

main().catch((e) => { console.error(e); process.exit(1) })
