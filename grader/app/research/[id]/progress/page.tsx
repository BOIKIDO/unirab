'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import ProgressTracker from '@/components/progress/ProgressTracker'
import LeadForm from '@/components/progress/LeadForm'

const TIPS = [
  {
    text: 'ChatGPT and Gemini now influence more homeowner hiring decisions per day than Yelp and Houzz combined.',
    image: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&h=500&fit=crop&auto=format',
    credit: 'AI-powered search',
  },
  {
    text: 'When a homeowner asks AI for the best contractor near them, the first business named gets the call most of the time.',
    image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=500&fit=crop&auto=format',
    credit: 'First-mover advantage',
  },
  {
    text: 'Every AI mention compounds: ChatGPT and Gemini train on overlapping public data, so a win on one lifts the other.',
    image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=500&fit=crop&auto=format',
    credit: 'Compounding visibility',
  },
  {
    text: 'Businesses cited in AI answers get 3 to 4 times more organic clicks than those that only rank on traditional Google results.',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=500&fit=crop&auto=format',
    credit: '3–4x click advantage',
  },
  {
    text: 'AI search does not show ten blue links. It picks one or two businesses. If you are not one of them, you are invisible.',
    image: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&h=500&fit=crop&auto=format',
    credit: 'Winner-takes-most',
  },
]

function DidYouKnow() {
  const [i, setI] = useState(0)
  const [visible, setVisible] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setI((n) => (n + 1) % TIPS.length)
        setVisible(true)
      }, 350)
    }, 6000)
    return () => clearInterval(timerRef.current)
  }, [])

  const tip = TIPS[i]

  return (
    <div className="bg-white border border-black/5 rounded-xl md:rounded-2xl overflow-hidden relative shadow-[0_1px_3px_rgba(0,0,0,0.04)] group md:h-full md:flex md:flex-col">
      {/* Photo section — crossfades with quote */}
      <div className="relative w-full aspect-[2/1] md:aspect-[16/9] bg-gray-100 overflow-hidden">
        {/* Current image */}
        <img
          src={tip.image}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: visible ? 1 : 0,
            transition: 'opacity 500ms cubic-bezier(0.23, 1, 0.32, 1)',
          }}
          loading="lazy"
        />
        {/* Dark gradient overlay for text readability if needed */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />

        {/* Credit badge */}
        <div
          className="absolute bottom-1.5 left-2 md:bottom-3 md:left-4 bg-white/90 backdrop-blur-sm text-[#111827] text-[8px] md:text-[10px] font-semibold px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-full"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(4px)',
            transition: 'opacity 400ms cubic-bezier(0.23, 1, 0.32, 1), transform 400ms cubic-bezier(0.23, 1, 0.32, 1)',
          }}
        >
          {tip.credit}
        </div>
      </div>

      {/* Quote section */}
      <div className="px-3 py-2 md:px-6 md:py-5 md:flex-1 md:flex md:flex-col md:justify-center">
        <div className="flex items-center justify-between mb-2 md:mb-4">
          <span className="text-[#111827] text-[9px] md:text-[11px] font-semibold tracking-[0.1em] md:tracking-[0.14em] uppercase opacity-40">
            Insight {i + 1} of {TIPS.length}
          </span>
          <div className="flex gap-1 md:gap-1.5">
            {TIPS.map((_, idx) => (
              <span
                key={idx}
                className="block rounded-full transition-all duration-500 ease-out"
                style={{
                  width: idx === i ? 10 : 3,
                  height: 3,
                  backgroundColor: idx === i ? '#111827' : '#E5E7EB',
                }}
              />
            ))}
          </div>
        </div>
        <p
          className="text-[#374151] text-[12px] md:text-[16px] leading-snug tracking-[0.01em] font-medium"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 400ms cubic-bezier(0.23, 1, 0.32, 1), transform 400ms cubic-bezier(0.23, 1, 0.32, 1)',
          }}
        >
          {tip.text}
        </p>
      </div>
    </div>
  )
}

export default function ProgressPage() {
  const router = useRouter()
  const params = useParams()
  const jobId = params.id as string

  const [jobComplete, setJobComplete] = useState(false)
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  const handleJobComplete = useCallback(() => {
    setJobComplete(true)
    if (formSubmitted && userEmail) router.push(`/research/${jobId}?email=${encodeURIComponent(userEmail)}`)
  }, [formSubmitted, jobId, router, userEmail])

  const handleFormSubmitted = useCallback((email: string) => {
    setFormSubmitted(true)
    setUserEmail(email)
    if (jobComplete) router.push(`/research/${jobId}?email=${encodeURIComponent(email)}`)
  }, [jobComplete, jobId, router])

  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-black/[0.06]">
        <div className="flex items-baseline gap-2.5">
          <img src="/faaxa-logo.svg" alt="Faaxa" className="w-32 h-auto" />
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 md:px-12 py-16">
        <div className="text-center mb-12">
          <p className="text-[#111827] text-[10px] font-semibold tracking-[0.16em] uppercase mb-4 opacity-40">Scanning now</p>
          <h1 className="text-[#111827] font-black text-3xl md:text-4xl tracking-tight mb-3">
            Scanning AI platforms for your business&hellip;
          </h1>
          <p className="text-[#6B7280] text-[15px]">
            {formSubmitted && !jobComplete
              ? 'Almost done — your report will be ready in a few seconds.'
              : 'Fill in your details below while we run the scan.'}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Lead form — second on mobile, left column on desktop */}
          <div className="order-2 md:order-1">
            <LeadForm jobId={jobId} onSubmitted={handleFormSubmitted} jobComplete={jobComplete} />
          </div>

          {/* Right column — first on mobile, right column on desktop. Stretches to match form height */}
          <div className="order-1 md:order-2 flex flex-col gap-4 md:h-full">
            {/* Scan progress */}
            <div className="bg-white border border-black/[0.08] rounded-2xl p-5 md:p-6 flex flex-col flex-1 shadow-[var(--shadow-rest)]">
              <h2 className="text-[#111827] font-bold text-sm mb-4">Scan progress</h2>
              <ProgressTracker jobId={jobId} onComplete={handleJobComplete} />

              {jobComplete && !formSubmitted && (
                <div className="mt-6 bg-[#F5C518]/8 border border-[#F5C518]/20 rounded-xl p-4">
                  <p className="text-[#111827] font-semibold text-[13px]">
                    Report ready &mdash; fill in your details to view it.
                  </p>
                </div>
              )}
            </div>

            {/* Did you know */}
            <div className="flex-1">
              <DidYouKnow />
            </div>
          </div>
        </div>

        {/* Platform logos */}
        <div className="mt-16 text-center">
          <p className="text-[#111827] text-[10px] font-semibold tracking-[0.16em] uppercase mb-4 opacity-30">Scanning across</p>
          <div className="flex items-center justify-center gap-8">
            {['ChatGPT', 'Gemini'].map((p) => (
              <span key={p} className="text-[#6B7280] font-semibold text-sm opacity-60">{p}</span>
            ))}
          </div>
        </div>
      </div>

    </main>
  )
}
