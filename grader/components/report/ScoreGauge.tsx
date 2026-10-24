import React from 'react'
import { scoreGrade } from '@/lib/scoring'
import { stripEmDashes } from '@/lib/text'

interface Props {
  score: number
  scoreLabel: string
  chatgptScore: number
  geminiScore: number
  businessName: string
  primaryService: string
  city: string
  state: string
  description: string | null
  descriptionCategory: string | null
}

/* ── Ring math: dasharray = full circumference, dashoffset = unfilled remainder.
   The ring-sweep keyframe animates dashoffset from --ring-circ (empty) to the
   inline value (final fill) — pure CSS, renders correctly even before JS loads. ── */
function ringStyle(circumference: number, score: number, delayMs: number): React.CSSProperties {
  return {
    strokeDasharray: circumference,
    strokeDashoffset: circumference * (1 - score / 100),
    ['--ring-circ' as string]: circumference,
    animation: `ring-sweep 1.4s cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms both`,
  }
}

/* ── Platform meter: horizontal gauge, scoreboard style ── */
function PlatformMeter({ label, score, weight, delay }: { label: string; score: number; weight: string; delay: number }) {
  const { color } = scoreGrade(score)
  return (
    <div style={{ animation: `fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms both` }}>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-white font-bold text-[13px]">{label}</span>
        <span className="text-white font-black text-xl tabular-nums leading-none">
          {score}
          <span className="text-white/40 text-[11px] font-semibold"> /100</span>
        </span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(2, score)}%`,
            background: color,
            animation: `bar-grow 900ms cubic-bezier(0.22, 1, 0.36, 1) ${delay + 200}ms both`,
          }}
        />
      </div>
      <p className="text-white/40 text-[10px] mt-1.5">{weight} of overall score</p>
    </div>
  )
}

/* ── Highlight helpers ── */
function findTermIdx(text: string, term: string): number {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const needsBoundary = term.length <= 4 && !/[\s,]/.test(term)
  const re = needsBoundary
    ? new RegExp(`\\b${escaped}\\b`, 'i')
    : new RegExp(escaped.replace(/\s+/g, '\\s+'), 'i')
  const m = text.match(re)
  return m?.index ?? -1
}

function highlightTerms(text: string, terms: string[]) {
  const parts: React.ReactNode[] = []
  let remaining = text
  const validTerms = terms.filter(Boolean)

  while (remaining.length > 0) {
    let bestIdx = -1
    let bestTerm = ''
    for (const term of validTerms) {
      const idx = findTermIdx(remaining, term)
      if (idx === -1) continue
      if (bestIdx === -1 || idx < bestIdx || (idx === bestIdx && term.length > bestTerm.length)) {
        bestIdx = idx; bestTerm = term
      }
    }
    if (bestIdx === -1) { parts.push(remaining); break }
    if (bestIdx > 0) parts.push(remaining.slice(0, bestIdx))
    parts.push(
      <strong key={parts.length} className="text-white font-black">
        {remaining.slice(bestIdx, bestIdx + bestTerm.length)}
      </strong>
    )
    remaining = remaining.slice(bestIdx + bestTerm.length)
  }
  return parts
}

// Fallback when the scan-time description failed to generate. States only what
// the score itself supports. No invented frequencies, ratios, or timelines.
function staticDescription(score: number, city: string, state: string): string {
  const cat = 'contracting business'
  if (score <= 20) return `AI doesn't know your ${cat} exists in ${city}, ${state}. When homeowners ask ChatGPT or Gemini for a contractor, your competitors get named. You don't.`
  if (score <= 40) return `Your ${cat} barely shows up in AI searches for ${city}, ${state}. Most queries send homeowners to competitors, and those are jobs you never got the chance to quote.`
  if (score <= 60) return `Your ${cat} has inconsistent AI visibility in ${city}, ${state}. Some searches surface you, most don't. Homeowners who should find you aren't finding you.`
  if (score <= 75) return `Your ${cat} is getting recommended in ${city}, ${state}, but the market isn't locked down. A competitor with a stronger AI presence can take your position.`
  if (score <= 90) return `AI is actively sending homeowners to your ${cat} in ${city}, ${state}. You're in the conversation before most of your competitors get a mention.`
  return `Your ${cat} owns the AI conversation in ${city}, ${state}. ChatGPT and Gemini both recommend you consistently across the searches that matter.`
}

export default function ScoreGauge({ score, scoreLabel, chatgptScore, geminiScore, businessName, city, state, description, descriptionCategory }: Props) {
  const { color } = scoreGrade(score)

  const SIZE = 168
  const sw = 12
  const r = SIZE / 2 - sw / 2 - 4
  const c = 2 * Math.PI * r
  const cx = SIZE / 2

  return (
    <div className="fade-up bg-[#111827] border border-white/[0.08] border-t-4 border-t-[#F5C518] shadow-[var(--shadow-elevated)] rounded-2xl overflow-hidden">
      {/* Document header band */}
      <div className="px-6 md:px-8 py-5 border-b border-white/[0.08] flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            <p className="text-white/60 text-[10px] font-bold tracking-[0.16em] uppercase">AI Visibility Report</p>
          </div>
          <h1 className="text-white font-black text-xl sm:text-2xl tracking-[-0.015em]">{businessName}</h1>
          <p className="text-white/50 text-[13px] mt-0.5">{city}, {state}</p>
        </div>
        <div className="hidden sm:block text-right shrink-0">
          <p className="text-white/40 text-[10px] font-bold tracking-[0.16em] uppercase mb-1">Benchmark</p>
          <p className="text-white/70 text-[13px] font-semibold">ChatGPT + Gemini</p>
        </div>
      </div>

      {/* Body: gauge | verdict | platform meters */}
      <div className="p-6 md:p-8 flex flex-col items-center gap-7 text-center lg:grid lg:grid-cols-[auto_1fr_280px] lg:items-center lg:gap-10 lg:text-left">
        {/* Gauge — solid, no glow */}
        <div className="shrink-0">
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={sw} />
            <circle
              cx={cx} cy={cx} r={r}
              fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cx})`}
              style={ringStyle(c, score, 200)}
            />
            <text x={cx} y={cx - 6} textAnchor="middle" fill="white" fontSize="46" fontWeight="900"
              style={{ animation: 'fade-in 0.4s ease-out 0.4s both' }}>
              {score}
            </text>
            <text x={cx} y={cx + 18} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="11" fontWeight="600"
              style={{ animation: 'fade-in 0.4s ease-out 0.6s both' }}>
              out of 100
            </text>
          </svg>
        </div>

        {/* Verdict */}
        <div className="min-w-0 max-w-xl lg:max-w-none">
          <h2 className="text-white font-black text-xl sm:text-2xl leading-[1.15] tracking-[-0.015em] mb-3">
            Your AI visibility is{' '}
            <span style={{ color }}>{scoreLabel}</span>
          </h2>
          <div className="text-white/70 text-[13px] sm:text-sm leading-relaxed">
            {(() => {
              const text = stripEmDashes(description || staticDescription(score, city, state))
              const cat = descriptionCategory ?? null
              const boldTerms = [`${city}, ${state}`, city, state, cat ?? ''].filter(Boolean)
              return highlightTerms(text, boldTerms)
            })()}
          </div>
        </div>

        {/* Platform meter rail */}
        <div className="w-full text-left border-t border-white/[0.08] pt-6 lg:border-t-0 lg:pt-0 lg:border-l lg:border-white/[0.08] lg:pl-10 flex flex-col gap-5">
          <p className="text-white/50 text-[10px] font-bold tracking-[0.16em] uppercase">Platform Breakdown</p>
          <PlatformMeter label="ChatGPT" score={chatgptScore} weight="60%" delay={600} />
          <PlatformMeter label="Gemini" score={geminiScore} weight="40%" delay={750} />
        </div>
      </div>
    </div>
  )
}
