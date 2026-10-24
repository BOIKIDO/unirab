'use client'

import { useEffect, useState } from 'react'

const QUERIES = [
  'best roofer in Austin TX',
  'top HVAC contractor near me',
  'who should I hire for plumbing in Denver',
]

const MOCK_RESULTS = [
  ['Apex Roofing & Restoration', 'Summit Pro Contractors', 'Premier Home Services'],
  ['CoolAir HVAC Solutions', 'Climate Masters', 'TempRight Services'],
  ['FlowPro Plumbing', 'Reliable Pipe Works', 'AquaTech Contractors'],
]

export default function ProblemSection() {
  const [queryIndex, setQueryIndex] = useState(0)
  const [displayText, setDisplayText] = useState('')
  const [isTyping, setIsTyping] = useState(true)
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    const target = QUERIES[queryIndex]
    let i = 0
    setDisplayText('')
    setIsTyping(true)
    setShowResults(false)

    const typeInterval = setInterval(() => {
      i++
      setDisplayText(target.slice(0, i))
      if (i >= target.length) {
        clearInterval(typeInterval)
        setIsTyping(false)
        setTimeout(() => setShowResults(true), 400)
        setTimeout(() => {
          setShowResults(false)
          setTimeout(() => setQueryIndex((prev) => (prev + 1) % QUERIES.length), 600)
        }, 3500)
      }
    }, 45)

    return () => clearInterval(typeInterval)
  }, [queryIndex])

  return (
    <section className="bg-white py-24 px-6 md:px-12 lg:px-20">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Left: copy */}
          <div>
            <p className="text-[#ff735d] text-xs font-normal tracking-[0.24em] uppercase mb-4">The AI Reality</p>
            <h2 className="font-black text-3xl sm:text-4xl md:text-5xl text-[#102a2a] leading-[1.1] tracking-[-0.02em] mb-6">
              Your competitors<br />are getting picked.<br />
              <span className="text-[#ff735d]">You&apos;re not.</span>
            </h2>
            <p className="text-[#5d6d6a] text-lg leading-relaxed mb-4">
              Right now, homeowners are asking AI tools "best roofer near me" and getting a list back instantly.
              If your name isn&apos;t on that list, someone else is getting the call.
            </p>
            <p className="text-[#5d6d6a] text-lg leading-relaxed mb-4">
              It is not luck. Your competitors have made themselves visible to AI search engines. They have the citations, the content, and the signals that make AI models mention them first.
            </p>
            <p className="text-[#102a2a] font-bold text-lg">
              Find out where you stand. It takes 90 seconds.
            </p>
          </div>

          {/* Right: animated AI query demo, framed like a real browser window */}
          <div className="rounded-xl border border-black/[0.08] bg-white shadow-[var(--shadow-float)] overflow-hidden">
            {/* Fake browser chrome */}
            <div className="flex items-center gap-2 bg-[#f3f8f6] px-3 py-2.5 border-b border-black/[0.06]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
              <div className="flex-1 mx-2">
                <div className="bg-white border border-black/[0.08] rounded-md text-[11px] text-[#5d6d6a] py-1 px-2.5 text-center font-mono">
                  chat.openai.com
                </div>
              </div>
            </div>
            <div className="p-4 md:p-5 bg-[#fafaf7]">
            {/* Query input */}
            <div className="bg-white rounded-xl border border-black/[0.08] p-4 mb-4">
              <p className="text-[10px] font-bold text-[#5d6d6a] uppercase tracking-widest mb-2">Homeowner types into ChatGPT…</p>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#5d6d6a] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="text-[#102a2a] font-medium text-sm">
                  {displayText}
                  <span className={`cursor-blink ml-0.5 text-[#102a2a] font-bold ${!isTyping ? 'opacity-0' : ''}`}>|</span>
                </span>
              </div>
            </div>

            {/* AI response */}
            <div
              className={`bg-white rounded-xl border border-black/[0.08] p-4 transition-all duration-500 ${showResults ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
              style={{ transitionProperty: 'opacity, transform' }}
            >
              <p className="text-[10px] font-bold text-[#5d6d6a] uppercase tracking-widest mb-3">AI responds with…</p>
              <div className="space-y-2.5">
                {MOCK_RESULTS[queryIndex].map((name, i) => (
                  <div key={name} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#ff735d] text-black text-xs font-black flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-[#102a2a] font-semibold text-sm">{name}</span>
                  </div>
                ))}
                <div className="border-t border-dashed border-black/[0.06] pt-3 mt-3">
                  <div className="flex items-center gap-2 text-red-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="text-xs font-semibold">Your business not mentioned</span>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
