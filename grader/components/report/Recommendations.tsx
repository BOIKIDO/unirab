'use client'

import { useEffect, useState } from 'react'
import { stripEmDashes } from '@/lib/text'

interface InsightsData {
  summary: string
  insights: string[]
  recommendations: Array<{ icon: string; text: string }>
}

interface Props {
  jobId: string
  score: number
  businessName: string
  city: string
  state: string
  topCompetitor?: string
  chatgptMentions: number
  geminiMentions: number
  totalQueries: number
  summary?: string | null
  insights?: string[] | null
  recommendations?: Array<{ icon: string; text: string }> | null
}

// Last-resort fallback when both the pre-rendered insights and the live API are
// unavailable. Every number here is computed from the scan's real results —
// targets never exceed the number of queries the scan actually runs.
function buildStaticInsights(props: Props): InsightsData {
  const { score, businessName, city, state, chatgptMentions, geminiMentions, totalQueries, topCompetitor } = props
  const total = chatgptMentions + geminiMentions
  const missed = Math.max(0, totalQueries - total)
  const perPlatform = Math.max(1, Math.round(totalQueries / 2))
  const cgTarget = Math.min(perPlatform, Math.max(chatgptMentions * 2, Math.ceil(perPlatform * 0.6)))
  const gmTarget = Math.min(perPlatform, Math.max(geminiMentions * 2, Math.ceil(perPlatform * 0.6)))

  const topPhrase = topCompetitor
    ? `${topCompetitor} currently leads the market`
    : 'competitors currently capture the mentions you miss'
  const platformGap = chatgptMentions === geminiMentions
    ? 'ChatGPT and Gemini mention you equally often'
    : chatgptMentions > geminiMentions
      ? 'ChatGPT mentions you more often than Gemini'
      : 'Gemini mentions you more often than ChatGPT'
  const weaker = chatgptMentions <= geminiMentions ? 'ChatGPT' : 'Gemini'

  return {
    summary: `${businessName} scores ${score} out of 100 across ChatGPT and Gemini for ${city}, ${state}. With ${total} mentions across ${totalQueries} AI queries, ${topPhrase}. That is the gap to close.`,
    insights: [
      `${businessName} appeared in ${total} of ${totalQueries} AI queries in this scan. The other ${missed} searches sent homeowners to competitors, jobs you never got the chance to quote.`,
      `${platformGap}; the weaker platform (${weaker}) is the fastest path to a measurable lift in overall visibility.`,
      `AI visibility compounds: the businesses AI already cites keep getting cited. Every month at ${score}/100 makes the current leaders harder to displace.`,
    ],
    recommendations: [
      { icon: '01', text: `Raise ChatGPT mentions from ${chatgptMentions} to at least ${cgTarget} of the ${perPlatform} queries this scan runs, by building the authority signals AI models weight most heavily for ${city} contractors.` },
      { icon: '02', text: topCompetitor
        ? `Close the gap to ${topCompetitor} by expanding the structured content footprint AI parses to surface local contractors. Every month without action widens it.`
        : `Expand the structured content footprint AI parses to surface local contractors. Every month without action widens the gap to the market leaders.` },
      { icon: '03', text: `Lift Gemini mentions from ${geminiMentions} to at least ${gmTarget} of ${perPlatform} queries through platform-specific positioning across the channels AI reads.` },
    ],
  }
}

function InsightsContent({ data }: { data: InsightsData }) {
  return (
    <>
      {/* Market Analysis Summary */}
      <div className="border border-black/[0.08] shadow-[var(--shadow-rest)] rounded-2xl p-4 md:p-7 bg-white">
        <div className="flex items-center gap-2.5 md:gap-3 mb-3 md:mb-4">
          <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-yellow-50 border border-yellow-200 flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#8a6a00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h2 className="font-black text-[#102a2a] text-base md:text-lg">Market Analysis Summary</h2>
        </div>
        <p className="text-[#5d6d6a] leading-relaxed text-[13px] md:text-sm">{stripEmDashes(data.summary)}</p>
      </div>

      {/* Insights + Recommendations */}
      <div className="grid md:grid-cols-2 gap-3 md:gap-6">
        <div className="border border-black/[0.08] shadow-[var(--shadow-rest)] rounded-2xl p-4 md:p-7 bg-white">
          <div className="flex items-center gap-2.5 md:gap-3 mb-4 md:mb-6">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-green-50 border border-green-200 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="font-black text-[#102a2a] text-sm md:text-base">Key Insights</h3>
          </div>
          <div className="space-y-3 md:space-y-5">
            {data.insights.map((insight, i) => (
              <div key={i} className="flex gap-2.5 md:gap-3">
                <div className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-green-50 border border-green-200 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-2 h-2 md:w-2.5 md:h-2.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-[#5d6d6a] text-[13px] md:text-sm leading-relaxed">{stripEmDashes(insight)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-black/[0.08] shadow-[var(--shadow-rest)] rounded-2xl p-4 md:p-7 bg-white">
          <div className="flex items-center gap-2.5 md:gap-3 mb-4 md:mb-6">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="font-black text-[#102a2a] text-sm md:text-base">Recommendations</h3>
          </div>
          <div className="space-y-3 md:space-y-5">
            {data.recommendations.map((rec, i) => (
              <div key={i} className="flex gap-2.5 md:gap-3">
                <span className="text-[#8a6a00] font-black text-[11px] md:text-xs shrink-0 mt-0.5 w-4 md:w-5">{rec.icon}</span>
                <p className="text-[#5d6d6a] text-[13px] md:text-sm leading-relaxed">{stripEmDashes(rec.text)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

export default function Recommendations(props: Props) {
  const { jobId, summary, insights, recommendations: recs } = props
  const preRendered = summary && insights && recs
    ? { summary, insights, recommendations: recs }
    : null

  // Start with static fallback immediately — no skeleton flicker
  const staticData = buildStaticInsights(props)
  const [data, setData] = useState<InsightsData>(preRendered ?? staticData)

  useEffect(() => {
    if (preRendered) return
    let cancelled = false
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || '/grader'}/api/research/${jobId}/insights`)
      .then(r => r.json())
      .then(d => { if (!cancelled && d.success) setData(d.data) })
      .catch(() => { /* keep static fallback */ })
    return () => { cancelled = true }
  }, [jobId, preRendered])

  return (
    <section className="bg-white py-10 md:py-16 px-4 md:px-12 lg:px-20">
      <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
        <InsightsContent data={data} />

        {/* Methodology note — hidden on mobile, visible on desktop */}
        <div className="hidden md:flex border border-black/[0.08] rounded-2xl p-5 gap-4 bg-white shadow-[var(--shadow-rest)]">
          <div className="w-9 h-9 rounded-xl bg-gray-50 border border-black/[0.08] flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-[#5d6d6a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-[#102a2a] text-sm mb-1">A note on AI search variability</h3>
            <p className="text-[#5d6d6a] text-[13px] leading-relaxed">
              AI tools deliver different results to different users based on location, search history, and account context. No single query has a universal answer. This report reflects a standardized benchmark across multiple query types and locations.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
