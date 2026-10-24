'use client'

import { useState } from 'react'

const FAQS = [
  {
    q: 'How does this work exactly?',
    a: 'We use your business name and location to generate dozens of homeowner-style search queries, then send them to ChatGPT and Gemini. We detect whether your business appears in the responses, count mentions, and score your overall AI visibility.',
  },
  {
    q: 'Is this actually free?',
    a: 'Yes. Your first full report is completely free. No credit card, no trial period, no hidden fees. We offer paid monthly monitoring for businesses that want to track their score over time.',
  },
  {
    q: 'How long does it take?',
    a: 'Most reports are ready in 60–90 seconds. We run your queries in the background the moment you click "Run My Free Report." By the time you fill in your contact details, it is usually done.',
  },
  {
    q: 'What if my business is not in the results?',
    a: 'That is the point. Most local contractors are invisible to AI search right now. Your report shows exactly which competitors are being recommended instead of you, and what you can do to change that.',
  },
  {
    q: 'What do I do after I get my score?',
    a: 'Your report includes a tailored action plan. If you want help implementing it, you can book a free 20-minute strategy call with our team. We work exclusively with contractors and home service businesses.',
  },
]

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section className="bg-[#f3f8f6] py-16 md:py-20 px-6 md:px-12 lg:px-20">
      <div className="max-w-4xl mx-auto">
        <div className="mb-10">
          <p className="text-[#8a6a00] text-xs font-bold tracking-[0.2em] uppercase mb-3">FAQ</p>
          <h2 className="font-black text-3xl md:text-4xl text-[#102a2a] tracking-tight">Common questions.</h2>
        </div>

        <div className="bg-white rounded-2xl border border-black/[0.08] divide-y divide-black/[0.06] overflow-hidden shadow-[var(--shadow-rest)]">
          {FAQS.map((faq, i) => {
            const isOpen = open === i
            return (
              <div key={i}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="w-full text-left px-5 md:px-6 py-4 md:py-5 flex items-center justify-between gap-4 hover:bg-gray-50/60 focus:outline-none focus:bg-gray-50 transition-colors"
                >
                  <span className="font-bold text-[#102a2a] text-[15px] md:text-base">{faq.q}</span>
                  <span
                    className={`shrink-0 text-[#8a9694] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </button>
                {isOpen && (
                  <div className="px-5 md:px-6 pb-5 pt-0 -mt-1">
                    <p className="text-[#5d6d6a] text-sm md:text-base leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
