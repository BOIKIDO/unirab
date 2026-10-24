import Fuse from 'fuse.js'
import { queryDeepSeekJSON } from './deepseek'

export interface MentionResult {
  mentioned: boolean
  mentionCount: number
  isFirstMention: boolean
}

// Single GPT pass per response that returns BOTH mention info AND extracted competitor
// names. Replaces the old combined-and-truncated competitor extraction so we don't lose
// 90% of the response data to truncation.
export interface RankedCompetitor {
  name: string
  rank: number      // position in AI response (1 = first mentioned)
  above: boolean    // true = appeared before client (beating client)
}

export interface ResponseAnalysis {
  mention: MentionResult
  competitors: RankedCompetitor[]
}

export async function analyzeResponse(
  responseText: string,
  businessName: string
): Promise<ResponseAnalysis> {
  if (!responseText || !businessName) {
    return { mention: { mentioned: false, mentionCount: 0, isFirstMention: false }, competitors: [] }
  }

  const prompt = `You analyze an AI search response. Extract every local business mentioned IN ORDER of appearance, then check if the target business is in that list.

Target business: "${businessName}"

Response text:
"""
${responseText.slice(0, 7000)}
"""

Rules:
- List businesses in the ORDER they appear in the response (rank 1 = first mentioned).
- For the target check: accept suffix swaps (Contractor/Contracting/Construction/Builders/Renovations/Remodeling/Co/LLC/Inc), word reorderings, abbreviations, possessives, ampersand vs "and". Accept partial brand if the distinctive part clearly matches.
- Do NOT include the target in the competitors array — only OTHER businesses.
- Do NOT include national chains, generic categories, or marketplaces (Yelp, Houzz, Angi, HomeAdvisor, Thumbtack, Google).
- Do NOT include cities, states, or neighborhoods.
- Use the most complete, clean form of each name (preserve capitalization, drop trailing punctuation).
- target_rank: the rank position of the target in the full list (0 if not found).

Respond with strict JSON only:
{
  "target_rank": integer,
  "competitors": [
    {"name": "Business Name", "rank": integer}
  ]
}`

  try {
    const parsed = JSON.parse(await queryDeepSeekJSON(prompt))

    const targetRank: number = Math.max(0, Number(parsed.target_rank) || 0)
    const mentioned = targetRank > 0

    const competitors: RankedCompetitor[] = Array.isArray(parsed.competitors)
      ? parsed.competitors
          .filter((c: unknown): c is { name: string; rank: number } =>
            typeof (c as { name?: unknown }).name === 'string' && (c as { name: string }).name.trim().length > 0
          )
          .map((c: { name: string; rank: number }) => ({
            name: c.name.trim(),
            rank: Number(c.rank) || 0,
            // above = appeared before the client. If client not mentioned, we can't
            // claim this competitor outranked them — they just showed up in a response
            // the client was absent from.
            above: mentioned && c.rank < targetRank,
          }))
      : []

    return {
      mention: {
        mentioned,
        mentionCount: mentioned ? 1 : 0,
        isFirstMention: targetRank === 1,
      },
      competitors,
    }
  } catch (err) {
    console.error('[analyzeResponse] fell back to heuristic:', err)
    const mention = detectMention(responseText, businessName)
    const compNames = extractCompetitorNames(responseText, businessName)
    const competitors: RankedCompetitor[] = compNames.map((name, i) => ({
      name,
      rank: i + 1,
      above: true, // when we can't determine position, assume they beat the target
    }))
    return { mention, competitors }
  }
}

// Normalize a business name for deduplication. Lowercases, strips punctuation,
// drops common corporate suffixes, collapses whitespace.
const SUFFIXES = /\b(llc|inc|corp|corporation|company|co|ltd|limited)\b\.?/g
export function normalizeCompetitorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,'"&]/g, ' ')
    .replace(/\s+and\s+/g, ' ')
    .replace(SUFFIXES, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Aggregate raw competitor name lists from many responses into a deduplicated
// count map. The display name is the longest original form seen (preserves "& Co"
// style variants while merging "J.C." with "JC").
export function aggregateCompetitors(
  perResponseCompetitors: RankedCompetitor[][]
): Array<{ name: string; count: number; aboveCount: number; belowCount: number }> {
  const buckets = new Map<string, { display: string; count: number; aboveCount: number; belowCount: number }>()

  for (const competitors of perResponseCompetitors) {
    const seenThisResponse = new Set<string>()
    for (const comp of competitors) {
      const key = normalizeCompetitorName(comp.name)
      if (!key || key.length < 3) continue
      if (seenThisResponse.has(key)) continue
      seenThisResponse.add(key)

      const existing = buckets.get(key)
      if (!existing) {
        buckets.set(key, {
          display: comp.name.trim(),
          count: 1,
          aboveCount: comp.above ? 1 : 0,
          belowCount: comp.above ? 0 : 1,
        })
      } else {
        existing.count++
        if (comp.above) existing.aboveCount++
        else existing.belowCount++
        if (comp.name.trim().length > existing.display.length) existing.display = comp.name.trim()
      }
    }
  }

  return Array.from(buckets.values())
    .map((b) => ({ name: b.display, count: b.count, aboveCount: b.aboveCount, belowCount: b.belowCount }))
    .sort((a, b) => b.aboveCount - a.aboveCount) // sort by how often they beat the client
}

// Backwards-compatible thin wrapper if any caller still needs just the mention.
export async function detectMentionGPT(
  responseText: string,
  businessName: string
): Promise<MentionResult> {
  if (!responseText || !businessName) {
    return { mentioned: false, mentionCount: 0, isFirstMention: false }
  }

  const prompt = `You check whether a specific local business is mentioned in an AI search response.

Business: "${businessName}"

Response text:
"""
${responseText.slice(0, 6000)}
"""

Rules for what counts as a mention:
- Accept suffix swaps: Contractor / Contracting / Construction / Builders / Renovations / Remodeling / Co / LLC / Inc are interchangeable.
- Accept word reorderings ("X of Y" ↔ "Y X"), abbreviations, possessives, ampersand vs "and".
- Accept partial brand WITHOUT the suffix if the distinctive part is clearly the same business.
- Do NOT count generic category phrases that lack the brand-distinctive words (e.g. "a general contractor in Hoboken" alone is NOT a mention of "Hoboken General Contractor" — there must be the brand-specific combination, not just the category).
- Do NOT count the AI echoing the user's search query in framing sentences ("here are general contractors in Hoboken...").

Respond with strict JSON only:
{
  "mentioned": boolean,
  "exact_phrase": string or null,
  "count": integer (number of distinct mention occurrences),
  "is_first": boolean (true if the mention appears before any other named business in the response)
}`

  try {
    const parsed = JSON.parse(await queryDeepSeekJSON(prompt))
    return {
      mentioned: !!parsed.mentioned,
      mentionCount: Math.max(0, Number(parsed.count) || 0),
      isFirstMention: !!parsed.is_first,
    }
  } catch (err) {
    console.error('[detectMentionGPT] fell back to string match:', err)
    return detectMention(responseText, businessName)
  }
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

export function detectMention(
  responseText: string,
  businessName: string,
  aliases: string[] = []
): MentionResult {
  const normalizedResponse = normalize(responseText)
  const targets = [businessName, ...aliases].map(normalize)

  let mentionCount = 0

  // Exact matches
  for (const target of targets) {
    const matches = normalizedResponse.split(target).length - 1
    if (matches > 0) mentionCount += matches
  }

  // Fuzzy fallback if no exact match
  if (mentionCount === 0) {
    const sentences = responseText.split(/[.\n]/).filter(Boolean)
    const fuse = new Fuse(sentences, { threshold: 0.3, includeScore: true })
    for (const target of targets) {
      const results = fuse.search(target)
      if (results.length > 0 && (results[0].score ?? 1) < 0.3) {
        mentionCount += 1
      }
    }
  }

  // Heuristic cannot reliably determine position — fallback always false
  return { mentioned: mentionCount > 0, mentionCount, isFirstMention: false }
}

// Extract competitor business names from AI response using simple heuristics
// Full extraction uses GPT in the worker — this is a lightweight pre-pass
export function extractCompetitorNames(responseText: string, targetName: string): string[] {
  const normalizedTarget = normalize(targetName)
  const lines = responseText.split(/[\n.]/g).filter(Boolean)
  const candidates: string[] = []

  // Lines that look like "1. Company Name" or "- Company Name" or "**Company Name**"
  const listPattern = /^[\s*\-\d.]+([A-Z][A-Za-z\s&']+(?:LLC|Inc|Co|Corp|Services|Contractors?|Group|Roofing|Plumbing|HVAC|Electric)?)/
  for (const line of lines) {
    const match = line.match(listPattern)
    if (match) {
      const name = match[1].trim()
      if (normalize(name) !== normalizedTarget && name.length > 3 && name.length < 60) {
        candidates.push(name)
      }
    }
  }

  return [...new Set(candidates)].slice(0, 20)
}
