/**
 * Competitor Verification Agent
 *
 * Purpose: prevent AI hallucinations from polluting the competitor list.
 * For each competitor name extracted from AI responses, we query Google Places
 * to confirm it is a real, operating business in the right city/state.
 *
 * A competitor is VERIFIED if Places returns a result whose name fuzzy-matches
 * the extracted name (Levenshtein-ratio > 0.55 after normalization).
 *
 * A competitor is UNVERIFIED (likely hallucinated) if no Places result matches.
 */

import { getSupabaseAdmin } from './supabase'

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY!

interface PlaceCandidate {
  place_id: string
  name: string
  formatted_address: string
}

// Common trade words that inflate similarity between unrelated businesses.
// Excluding these forces the match to be driven by brand-distinctive tokens.
const TRADE_WORDS = new Set([
  'plumbing', 'plumber', 'roofing', 'roofer', 'hvac', 'heating', 'cooling', 'air',
  'electrical', 'electrician', 'electric', 'painting', 'painter', 'remodeling',
  'remodeler', 'renovation', 'renovations', 'landscaping', 'landscape', 'landscaper',
  'contracting', 'contractor', 'contractors', 'construction', 'builder', 'builders',
  'home', 'improvement', 'services', 'service', 'repair', 'installation', 'install',
  'maintenance', 'general', 'pro', 'solutions', 'group', 'company', 'co', 'llc',
  'inc', 'ltd', 'limited', 'exterior', 'interior', 'residential', 'commercial',
])

// Normalize for comparison: lowercase, strip punctuation/suffixes, collapse whitespace
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|ltd|limited|services|contractors?|group|company)\b\.?/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Token similarity excluding trade words — "ABC Plumbing" ≠ "XYZ Plumbing".
// Now driven by brand-distinctive tokens only.
function tokenSimilarity(a: string, b: string): number {
  const ta = new Set(norm(a).split(' ').filter(Boolean).filter(t => !TRADE_WORDS.has(t)))
  const tb = new Set(norm(b).split(' ').filter(Boolean).filter(t => !TRADE_WORDS.has(t)))
  if (ta.size === 0 || tb.size === 0) return 0
  const shared = [...ta].filter(t => tb.has(t)).length
  return shared / Math.max(ta.size, tb.size)
}

async function searchPlacesText(query: string): Promise<PlaceCandidate[]> {
  try {
    const params = new URLSearchParams({
      query,
      type: 'establishment',
      key: API_KEY,
    })
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.results ?? []).slice(0, 3).map((r: { place_id: string; name: string; formatted_address: string }) => ({
      place_id: r.place_id,
      name: r.name,
      formatted_address: r.formatted_address,
    }))
  } catch {
    return []
  }
}

export interface VerificationResult {
  competitorId: string
  competitorName: string
  verified: boolean
  placeId: string | null
  matchedName: string | null
  similarity: number
}

const VERIFY_THRESHOLD = 0.6 // raised — trade words excluded, so stricter matching needed

export async function verifyCompetitor(
  competitorId: string,
  competitorName: string,
  city: string,
  state: string
): Promise<VerificationResult> {
  const query = `${competitorName} ${city}, ${state}`
  const candidates = await searchPlacesText(query)

  let best: PlaceCandidate | null = null
  let bestScore = 0

  for (const candidate of candidates) {
    // Must be in the right state (address contains state abbreviation or full name)
    const addrLower = candidate.formatted_address.toLowerCase()
    if (!addrLower.includes(state.toLowerCase())) continue

    const score = tokenSimilarity(competitorName, candidate.name)
    if (score > bestScore) {
      bestScore = score
      best = candidate
    }
  }

  const verified = bestScore >= VERIFY_THRESHOLD

  return {
    competitorId,
    competitorName,
    verified,
    placeId: verified && best ? best.place_id : null,
    matchedName: verified && best ? best.name : null,
    similarity: bestScore,
  }
}

/**
 * Run verification for all competitors of a job.
 * Called fire-and-forget from the research worker after scoring completes.
 * Updates each competitor row with verified status.
 */
export async function verifyJobCompetitors(
  jobId: string,
  city: string,
  state: string
): Promise<void> {
  const db = getSupabaseAdmin()

  const { data: competitors, error } = await db
    .from('competitors')
    .select('id, competitor_name')
    .eq('job_id', jobId)
    .is('verified', null) // only unverified ones

  if (error || !competitors?.length) {
    if (error) console.error('[verifier] fetch competitors error:', error)
    return
  }

  console.error(`[verifier] verifying ${competitors.length} competitors for job ${jobId}`)

  // Verify in parallel with concurrency limit of 3 (Places API rate limits)
  const CONCURRENCY = 3
  for (let i = 0; i < competitors.length; i += CONCURRENCY) {
    const batch = competitors.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map((c) => verifyCompetitor(c.id, c.competitor_name, city, state))
    )

    for (const result of results) {
      if (result.status === 'rejected') continue
      const { competitorId, verified, placeId } = result.value

      await db
        .from('competitors')
        .update({
          verified,
          verified_place_id: placeId ?? null,
          verified_at: new Date().toISOString(),
        })
        .eq('id', competitorId)
    }

    // Small delay between batches to avoid rate limits
    if (i + CONCURRENCY < competitors.length) {
      await new Promise(r => setTimeout(r, 300))
    }
  }

  const verifiedCount = competitors.length // recount via return values would be better
  console.error(`[verifier] verification complete for job ${jobId}`)
}
