'use client'

import { Robot, Hourglass, CurrencyDollar, UsersThree } from '@phosphor-icons/react'

const CARDS = [
  {
    icon: <Robot weight="bold" className="w-5 h-5" />,
    title: 'AI is replacing Google search',
    body: 'Millions of homeowners now ask ChatGPT and Gemini for contractor recommendations instead of Googling. That number doubles every year.',
  },
  {
    icon: <Hourglass weight="bold" className="w-5 h-5" />,
    title: 'Early movers get locked in',
    body: 'AI models are forming opinions about which businesses are credible right now. The contractors who establish visibility today will own this channel for years.',
  },
  {
    icon: <CurrencyDollar weight="bold" className="w-5 h-5" />,
    title: 'Your score affects revenue',
    body: 'Being mentioned in AI results for high-intent queries like "best roofer in Austin" directly translates to inbound calls. Each mention is a lead opportunity you are either capturing or missing.',
  },
  {
    icon: <UsersThree weight="bold" className="w-5 h-5" />,
    title: 'Competitors may already be there',
    body: 'Your report shows exactly which businesses AI recommends instead of you. Knowing your competition is the first step to outranking them.',
  },
]

export default function WhyItMatters() {
  return (
    <section className="bg-[var(--surface-warm)] py-24 px-6 md:px-12 lg:px-20">
      <div className="max-w-6xl mx-auto">
        <div className="mb-16">
          <p className="text-[#8a6a00] text-xs font-normal tracking-[0.24em] uppercase mb-4">Why It Matters</p>
          <h2 className="font-black text-4xl md:text-5xl text-[#102a2a] tracking-[-0.02em] leading-tight max-w-2xl">
            Every month you wait,<br />a competitor locks in<br /><span className="text-[#ff735d]">your next 50 leads.</span>
          </h2>
          <p className="text-[#5d6d6a] text-lg mt-4 max-w-xl leading-relaxed">
            The contractors who show up in AI answers today will own their market for years. Here&apos;s why it matters right now.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CARDS.map((card) => (
            <div key={card.title} className="bg-[#f3f8f6] rounded-2xl p-6 border border-black/[0.06] shadow-[var(--shadow-rest)]">
              <div className="w-10 h-10 rounded-lg bg-black/[0.04] flex items-center justify-center text-[#102a2a] mb-5">
                {card.icon}
              </div>
              <h3 className="font-bold text-lg text-[#102a2a] mb-2 tracking-tight">{card.title}</h3>
              <p className="text-[#5d6d6a] text-sm leading-relaxed">{card.body}</p>
            </div>
          ))}

          {/* Comparison widget */}
          <div className="bg-[#102a2a] rounded-2xl p-6 md:p-7 md:col-span-2 lg:col-span-2 text-white">
            {/* Header */}
            <div className="flex items-baseline justify-between mb-5">
              <div>
                <p className="text-[#ff735d] text-[11px] font-semibold tracking-[0.16em] uppercase mb-1">How you compare</p>
                <p className="text-white/25 text-[11px] leading-relaxed">
                  ChatGPT results for &ldquo;best roofer near Austin TX&rdquo;
                </p>
              </div>
              <span className="text-white/20 text-[10px] tracking-wider">sample data</span>
            </div>

            {/* Rankings */}
            <div className="flex flex-col">
              {[
                { name: 'Ironwood Builders Inc', score: 82, you: false },
                { name: 'Apex Roofing & Restoration', score: 67, you: false },
                { name: 'McAllister HVAC & Plumbing', score: 54, you: false },
                { name: 'Summit Excavation & Grading', score: 41, you: false },
                { name: 'Your Business', score: 23, you: true },
              ].sort((a, b) => b.score - a.score).map((item, i, arr) => {
                const isLast = i === arr.length - 1
                const isGap = item.you // this row is the "your business" gap
                return (
                <div key={item.name}>
                  {/* Visual gap before "Your Business" */}
                  {isGap && (
                    <div className="flex items-center gap-3 py-2">
                      <div className="flex-1 h-px bg-white/[0.06] ml-[30px]" />
                      <span className="text-white/15 text-[9px] font-semibold tracking-widest uppercase shrink-0">and then</span>
                      <div className="flex-1 h-px bg-white/[0.06] mr-7" />
                    </div>
                  )}

                  <div
                    className={`group flex items-center gap-3 px-3 py-[9px] -mx-3 rounded-lg transition-colors duration-200 ${
                      item.you
                        ? 'bg-[#ff735d]/[0.06] border border-[#ff735d]/15'
                        : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    {/* Rank */}
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border ${
                      item.you
                        ? 'bg-[#ff735d] border-[#ff735d] text-black'
                        : i === 0
                          ? 'border-[#ff735d]/40 text-[#ff735d] bg-[#ff735d]/10'
                          : i === 1
                            ? 'border-white/25 text-white/45 bg-white/5'
                            : 'border-white/12 text-white/30 bg-transparent'
                    }`}>
                      {i + 1}
                    </span>

                    {/* Name */}
                    <div className="min-w-0 shrink-0" style={{ width: 'clamp(90px, 30%, 160px)' }}>
                      <span className={`text-[12px] font-semibold truncate block ${
                        item.you ? 'text-[#ff735d]' : 'text-white/65'
                      }`}>
                        {item.name}
                      </span>
                      {item.you && (
                        <span className="text-[#ff735d]/40 text-[9px] font-medium">this is you →</span>
                      )}
                    </div>

                    {/* Bar track */}
                    <div className="flex-1 h-[5px] rounded-full bg-white/[0.06] overflow-hidden relative">
                      {/* Subtle grid lines inside bar track */}
                      <div className="absolute inset-0 flex gap-[14%] pointer-events-none">
                        {[...Array(6)].map((_, gi) => (
                          <div key={gi} className="w-px h-full bg-white/[0.04]" />
                        ))}
                      </div>
                      <div
                        className="h-full rounded-full relative"
                        style={{
                          width: `${item.score}%`,
                          background: item.you
                            ? 'linear-gradient(90deg, #EF4444 0%, #f87171 100%)'
                            : i === 0
                              ? 'linear-gradient(90deg, #ff735d 0%, #e5b800 100%)'
                              : i === 1
                                ? 'linear-gradient(90deg, #d9991c 0%, #c48818 100%)'
                                : 'linear-gradient(90deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.10) 100%)',
                          animation: `bar-grow 700ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 70}ms both`,
                        }}
                      />
                    </div>

                    {/* Score */}
                    <span className={`text-[13px] font-bold w-7 text-right tabular-nums shrink-0 ${
                      item.you ? 'text-red-400' : i === 0 ? 'text-[#ff735d]' : 'text-white/35'
                    }`}>
                      {item.score}
                    </span>
                  </div>
                </div>
              )})}
            </div>

            {/* Footer */}
            <p className="mt-5 text-white/20 text-[11px] leading-relaxed">
              Your business ranks <span className="text-white/45 font-semibold">5th of 5</span> in this sample.
              Run a free scan to see your real position against actual local competitors.
            </p>
          </div>

        </div>
      </div>
    </section>
  )
}
