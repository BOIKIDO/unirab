'use client'

import { useEffect, useState } from 'react'
import { MagnifyingGlass, Lightning, ChartBar, ClipboardText, CaretRight } from '@phosphor-icons/react'

const STEPS = [
  {
    number: '01',
    title: 'Enter your business',
    body: 'Type your business name. We find it via Google Places and pull your location, category, and services automatically.',
    icon: <MagnifyingGlass weight="bold" className="w-5 h-5" />,
  },
  {
    number: '02',
    title: 'We run 60+ AI queries',
    body: 'We send batches of local-intent homeowner queries to ChatGPT and Gemini, city-level and state-level.',
    icon: <Lightning weight="bold" className="w-5 h-5" />,
  },
  {
    number: '03',
    title: 'See your visibility score',
    body: 'Get a 0 to 100 score per platform, plus who is beating you, which keywords they win, and how often you appear.',
    icon: <ChartBar weight="bold" className="w-5 h-5" />,
  },
  {
    number: '04',
    title: 'Get an action plan',
    body: 'Your report includes specific steps to improve your score, based on exactly where AI models are ignoring you.',
    icon: <ClipboardText weight="bold" className="w-5 h-5" />,
  },
]

export default function HowItWorks() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % STEPS.length)
    }, 2200)
    return () => clearInterval(id)
  }, [paused])

  return (
    <section className="bg-[#f4f4f0] py-24 px-6 md:px-12 lg:px-20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[#F5C518] text-xs font-normal tracking-[0.24em] uppercase mb-4">How It Works</p>
          <h2 className="font-black text-4xl md:text-5xl text-[#111827] tracking-[-0.02em] leading-tight">
            From business name<br />to full report in 90 seconds.
          </h2>
        </div>

        <div
          className="relative grid md:grid-cols-2 lg:grid-cols-4 gap-5"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {STEPS.map((step, i) => {
            const emphasis = i === activeIndex
            return (
              <div
                key={step.number}
                onMouseEnter={() => setActiveIndex(i)}
                className={`relative rounded-2xl p-6 transition-all duration-500 cursor-pointer ${
                  emphasis
                    ? 'bg-[#111827] text-white shadow-[var(--shadow-elevated)] -translate-y-1'
                    : 'bg-[#fafaf8] border border-black/[0.06] shadow-[var(--shadow-rest)] hover:border-black/[0.12] hover:shadow-[var(--shadow-elevated)]'
                }`}
              >
                <div className="flex items-start justify-between mb-5">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-500 ${
                      emphasis ? 'bg-[#F5C518] text-black' : 'bg-black/[0.04] text-[#111827]'
                    }`}
                  >
                    {step.icon}
                  </div>
                  <span
                    className={`text-[11px] font-bold tracking-[0.18em] transition-colors duration-500 ${
                      emphasis ? 'text-[#F5C518]' : 'text-black/[0.25]'
                    }`}
                  >
                    {step.number}
                  </span>
                </div>
                <h3
                  className={`font-bold text-lg mb-2 tracking-tight transition-colors duration-500 ${
                    emphasis ? 'text-white' : 'text-[#111827]'
                  }`}
                >
                  {step.title}
                </h3>
                <p
                  className={`text-sm leading-relaxed transition-colors duration-500 ${
                    emphasis ? 'text-white/70' : 'text-[#6B7280]'
                  }`}
                >
                  {step.body}
                </p>
                {/* Directional arrow between cards on desktop, except last */}
                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="hidden lg:flex absolute top-1/2 -right-3.5 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white border border-black/[0.06] shadow-[var(--shadow-rest)] items-center justify-center text-black/30"
                  >
                    <CaretRight weight="bold" className="w-3 h-3" />
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
