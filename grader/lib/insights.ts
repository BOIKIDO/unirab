import { queryDeepSeekJSON } from './deepseek'

export interface InsightsInput {
  businessName: string
  city: string
  state: string
  primaryService: string
  scoreOverall: number
  scoreChatgpt: number
  scoreGemini: number
  chatgptMentions: number
  geminiMentions: number
  totalQueriesPerPlatform: number
  keywords: string[]
  topCompetitors: Array<{ name: string; count: number }>
}

export interface InsightsOutput {
  summary: string
  insights: string[]
  recommendations: Array<{ icon: string; text: string }>
}

// Mention targets quoted in recommendations must be achievable within the scan:
// never more than the number of queries actually run per platform.
function cappedTarget(current: number, maxQueries: number): number {
  if (maxQueries <= 0) return current
  return Math.min(maxQueries, Math.max(current * 2, Math.ceil(maxQueries * 0.6)))
}

export async function generateInsights(input: InsightsInput): Promise<InsightsOutput> {
  const competitorTable = input.topCompetitors
    .slice(0, 5)
    .map((c, i) => `  ${i + 1}. ${c.name} — ${c.count} mentions`)
    .join('\n') || '  (no competitors detected)'

  const prompt = `You are an AI search visibility analyst writing a report for a local home-services contractor. The report is a lead-generation asset for an agency that sells AI-visibility services. Your job is to diagnose the wound, quantify the gap, point at the lever — and NEVER hand the prospect the playbook.

DATA:
- Business: ${input.businessName}
- Location: ${input.city}, ${input.state}
- Primary service: ${input.primaryService || 'general contractor'}
- Overall AI visibility score: ${input.scoreOverall}/100
- ChatGPT score: ${input.scoreChatgpt}/100 — ${input.chatgptMentions} mentions out of ${input.totalQueriesPerPlatform} queries
- Gemini score: ${input.scoreGemini}/100 — ${input.geminiMentions} mentions out of ${input.totalQueriesPerPlatform} queries
- Keywords queried: ${input.keywords.join(', ')}
- Top competitors by mention count:
${competitorTable}

RULES:
1. Write a 1-2 sentence "summary" that names the business, cites the actual score, and compares it to the #1 competitor by name and mention count.

2. Write exactly 3 "insights". Each MUST:
   - Cite at least one specific number from the data
   - Where relevant, name a specific competitor from the list
   - Frame the data as a loss or gap, not a neutral observation
   - Be 1-2 sentences, no fluff

3. Write exactly 3 "recommendations". This is the most important section. Follow these rules exactly:
   - TARGETS MUST BE SPECIFIC AND ACHIEVABLE. Use real numbers from the data and a numeric goal (e.g. "raise ChatGPT mentions from ${input.chatgptMentions} to at least ${cappedTarget(input.chatgptMentions, input.totalQueriesPerPlatform)} of the ${input.totalQueriesPerPlatform} queries"). A mention target may NEVER exceed ${input.totalQueriesPerPlatform} — that is the total number of queries run per platform.
   - MECHANISMS MUST BE VAGUE. Do NOT name specific tactics, channels, or counts. Forbidden words: reviews, photos, landing pages, GBP, Google Business Profile, Houzz, Yelp, schema, NAP, citations, blog posts, comparison pages, content pieces, posts, articles.
   - Use generic agency language for the mechanism: "authority signals", "structured content footprint", "platform-specific positioning", "citation surface area", "ranking inputs the AI models weight most", "the channels AI parses to build local recommendations".
   - Include a loss/urgency clause in at least one recommendation (e.g. "every month without action widens the gap with ${input.topCompetitors[0]?.name ?? 'the leader'}").
   - DO NOT suggest social media, influencer marketing, paid ads, or "brand awareness" — those do not move AI rankings.
   - Each rec is 1-2 sentences. No em dashes. No emojis. No markdown.

4. The goal is to create curiosity, not capability. A homeowner-services owner reading these recs should think "I know WHAT to fix but not HOW — I need to talk to someone." Never explain HOW.

5. Each recommendation gets an icon "01", "02", "03".

6. USE ONLY NUMBERS PRESENT IN THE DATA ABOVE. Never invent statistics, percentages, search volumes, revenue figures, timeframes, or counts that are not in the DATA section. Every number you write must be traceable to the data or computed directly from it.

7. NEVER use em dashes or en dashes anywhere in the output: not in the summary, not in insights, not in recommendations. Use commas, colons, or periods instead.

EXAMPLES OF GOOD vs BAD recommendation copy:
BAD:  "Drive 30 Google reviews that mention Hoboken and Kitchen Remodeling."   <- gives the playbook
GOOD: "Triple your ChatGPT mention count by building the authority signals that local AI models weight most for contractors in ${input.city}."  <- specific target, vague mechanism

BAD:  "Build 5 city-specific landing pages."   <- gives the playbook
GOOD: "Close the ${input.topCompetitors[0]?.count ?? 5}-mention gap with ${input.topCompetitors[0]?.name ?? 'the market leader'} by expanding the structured content footprint AI parses when answering homeowner queries."  <- specific gap, vague mechanism

Return strict JSON ONLY in this exact shape:
{
  "summary": "string",
  "insights": ["string", "string", "string"],
  "recommendations": [
    {"icon": "01", "text": "string"},
    {"icon": "02", "text": "string"},
    {"icon": "03", "text": "string"}
  ]
}`

  try {
    const parsed = JSON.parse(await queryDeepSeekJSON(prompt))
    if (
      typeof parsed.summary === 'string' &&
      Array.isArray(parsed.insights) &&
      Array.isArray(parsed.recommendations) &&
      parsed.recommendations.every((r: { icon?: unknown; text?: unknown }) => typeof r.text === 'string')
    ) {
      return {
        summary: parsed.summary,
        insights: parsed.insights.slice(0, 3),
        recommendations: parsed.recommendations.slice(0, 3).map((r: { icon?: string; text: string }, i: number) => ({
          icon: r.icon || String(i + 1).padStart(2, '0'),
          text: r.text,
        })),
      }
    }
    throw new Error('invalid AI response shape')
  } catch (err) {
    console.error('[generateInsights] fell back to static copy:', err)
    return staticFallback(input)
  }
}

function staticFallback(input: InsightsInput): InsightsOutput {
  const top = input.topCompetitors[0]
  const topPhrase = top ? `${top.name} leads with ${top.count} AI mentions` : 'competitors are capturing the mentions you miss'
  const cgTarget = cappedTarget(input.chatgptMentions, input.totalQueriesPerPlatform)
  const gmTarget = cappedTarget(input.geminiMentions, input.totalQueriesPerPlatform)

  return {
    summary: `${input.businessName} scores ${input.scoreOverall} out of 100 across ChatGPT and Gemini for ${input.city}, ${input.state}. ${topPhrase}, defining the gap to close.`,
    insights: [
      top
        ? `${input.businessName} captured ${input.chatgptMentions + input.geminiMentions} total AI mentions while ${top.name} captured ${top.count}, a gap that translates directly into homeowner inquiries flowing to competitors.`
        : `${input.businessName} appeared in only ${input.chatgptMentions + input.geminiMentions} of ${input.totalQueriesPerPlatform * 2} AI queries, leaving the majority of homeowner searches unanswered by your brand.`,
      `ChatGPT scored ${input.scoreChatgpt}/100 and Gemini scored ${input.scoreGemini}/100; the lower-scoring platform represents the fastest path to a measurable lift.`,
      `AI visibility compounds: the businesses AI already cites keep getting cited, and every month at ${input.scoreOverall}/100 is another month ${top?.name ?? 'the market leader'} cements its position.`,
    ],
    recommendations: [
      { icon: '01', text: `Raise ChatGPT mentions from ${input.chatgptMentions} to at least ${cgTarget} of the ${input.totalQueriesPerPlatform} queries this scan runs, by building the authority signals AI models weight most heavily when answering homeowner queries in ${input.city}.` },
      { icon: '02', text: `Close the gap to ${top?.name ?? 'the market leader'} by expanding the structured content footprint that AI parses to surface local contractors. Every month without action widens it.` },
      { icon: '03', text: `Lift Gemini visibility from ${input.geminiMentions} mentions to at least ${gmTarget} of ${input.totalQueriesPerPlatform} queries through platform-specific positioning across the channels AI parses.` },
    ],
  }
}
