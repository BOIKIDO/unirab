'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MagnifyingGlass, UsersThree, Lightning, SealCheck, ArrowRight, X } from '@phosphor-icons/react'

interface Prediction {
  place_id: string
  description: string
  structured_formatting: { main_text: string; secondary_text: string }
}

interface BusinessCard {
  name: string
  address: string
  city: string
  state: string
  website: string | null
  keywords: string[]
  primary_service: string
  has_website: boolean
  place_id: string
  google_rating: number | null
  google_review_count: number | null
}

export default function Hero() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [selected, setSelected] = useState<BusinessCard | null>(null)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [activeKeywords, setActiveKeywords] = useState<string[]>([])
  const [customKeyword, setCustomKeyword] = useState('')
  const [addingKeyword, setAddingKeyword] = useState(false)
  const [animPlaceholder, setAnimPlaceholder] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const customInputRef = useRef<HTMLInputElement>(null)

  const DEMO_BUSINESSES = [
    "Apex Roofing & Restoration",
    "McAllister HVAC & Plumbing",
    "Ironwood Builders Inc",
    "Crown City Concrete",
    "Summit Excavation & Grading",
    "Blue Ridge Electrical Co",
    "Pioneer Waterproofing LLC",
  ]

  useEffect(() => {
    if (query || selected) { setAnimPlaceholder(''); return }
    let bIdx = 0, cIdx = 0, del = false
    let t: ReturnType<typeof setTimeout>
    const run = () => {
      const name = DEMO_BUSINESSES[bIdx]
      del ? cIdx-- : cIdx++
      setAnimPlaceholder(name.slice(0, cIdx))
      if (!del && cIdx >= name.length) { del = true; t = setTimeout(run, 1500); return }
      if (del && cIdx <= 0) { del = false; bIdx = (bIdx + 1) % DEMO_BUSINESSES.length; t = setTimeout(run, 350); return }
      t = setTimeout(run, del ? 35 : 65)
    }
    t = setTimeout(run, 700)
    return () => { clearTimeout(t); setAnimPlaceholder('') }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selected])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query || query.length < 2 || selected) { setPredictions([]); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || '/grader'}/api/lookup?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        if (data.success) setPredictions(data.data)
      } catch { /* silent */ }
    }, 300)
  }, [query, selected])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setPredictions([])
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (addingKeyword && customInputRef.current) customInputRef.current.focus()
  }, [addingKeyword])

  async function handleSelect(prediction: Prediction) {
    setPredictions([])
    setQuery(prediction.structured_formatting.main_text)
    setLoading(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || '/grader'}/api/lookup/details?place_id=${prediction.place_id}`)
      const data = await res.json()
      if (data.success) {
        setSelected(data.data)
        setActiveKeywords(data.data.keywords ?? [])
      }
    } catch { setError('Could not load business details. Try again.') }
    setLoading(false)
  }

  function clearSelection() {
    setSelected(null)
    setQuery('')
    setActiveKeywords([])
    setError('')
  }

  function toggleKeyword(kw: string) {
    setActiveKeywords(prev =>
      prev.includes(kw) ? prev.filter(k => k !== kw) : [...prev, kw]
    )
  }

  const customKeywords = activeKeywords.filter(k => !selected?.keywords.includes(k))

  function addCustomKeyword() {
    const kw = customKeyword.trim()
    if (kw && !activeKeywords.includes(kw) && customKeywords.length < 3) {
      setActiveKeywords(prev => [...prev, kw])
    }
    setCustomKeyword('')
    setAddingKeyword(false)
  }

  async function handleRun() {
    if (!selected || activeKeywords.length === 0) return
    if (!selected.city || !selected.state) {
      setError('Could not determine business location. Try a more specific search term.')
      return
    }
    setRunning(true)
    setError('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || '/grader'}/api/research/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: selected.name,
          website_url: selected.website,
          primary_service: selected.primary_service,
          location_city: selected.city,
          location_state: selected.state,
          keywords: activeKeywords,
        }),
      })
      const data = await res.json()
      if (data.success) {
        router.push(`/research/${data.data.jobId}/progress`)
      } else {
        setError(data.error ?? 'Something went wrong. Please try again.')
        setRunning(false)
      }
    } catch {
      setError('Network error. Please try again.')
      setRunning(false)
    }
  }

  return (
    <section className="bg-white min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-black/[0.06]">
        <div className="flex items-baseline gap-2.5">
<span className="inline-flex items-baseline" style={{fontStyle:'italic', fontWeight:900, fontSize:26, letterSpacing:'-1.2px', color:'#102a2a'}}>UNI<span style={{color:'#ff735d'}}>RAB</span><span style={{color:'#ff735d', fontSize:'0.72em', verticalAlign:'super'}}>&bull;</span></span>
        </div>
        <a
          href={process.env.NEXT_PUBLIC_CALENDLY_URL ?? '#'}
          className="bg-[#ff735d] text-[#1d2423] font-bold px-5 py-3 rounded-full text-sm hover:bg-[#ff846f] transition-all focus:outline-none focus:ring-2 focus:ring-[#ff735d]/50 focus:ring-offset-2"
        >
          Book a Free Call
        </a>
      </nav>

      {/* Hero content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 md:px-12 lg:px-20 pt-16 md:pt-20 pb-16 max-w-5xl mx-auto w-full">
        {/* Headline */}
        <h1 className="text-[#102a2a] font-black leading-[1.05] tracking-tight mb-6">
          <span className="block text-[1.3rem] md:text-[2.4rem] lg:text-[2.9rem] md:whitespace-nowrap">Homeowners Ask AI</span>
          <span className="block text-[1.3rem] md:text-[2.4rem] lg:text-[2.9rem] text-[#ff735d]">&quot;Who&apos;s The Best Contractor?&quot;</span>
          <span className="block text-[1.3rem] md:text-[2.4rem] lg:text-[2.9rem]">Is Your Name Coming Up?</span>
        </h1>

        <p className="text-[#465956] text-base md:text-lg max-w-lg mx-auto mb-3 leading-relaxed">
          AI now answers more local contractor searches than Google. One name gets the call. Eleven others don&rsquo;t. See where you land, free of charge, in 90 seconds.
        </p>

        <p className="text-[#8a9694] text-xs mb-9">
          Trusted by roofers, HVAC teams, electricians, and plumbers across 1,400+ cities.
        </p>

        {/* Search bar */}
        <div className="w-full max-w-3xl mx-auto text-left">
          <div className="relative" ref={dropdownRef}>
            <div className={`flex items-center bg-white border border-black/[0.12] shadow-[var(--shadow-elevated)] focus-within:border-[#ff735d] focus-within:shadow-[var(--shadow-glow)] transition-all duration-300 ${predictions.length > 0 ? 'rounded-t-xl border-b-0' : 'rounded-xl'}`}>
                {/* Input area */}
                <div className="relative flex-1 min-w-0">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); if (!e.target.value) clearSelection() }}
                    placeholder={animPlaceholder || 'Enter your business name…'}
                    disabled={!!selected}
                    className="w-full bg-transparent px-5 py-4 text-[#102a2a] placeholder-gray-400 text-base focus:outline-none disabled:opacity-80"
                  />
                  {loading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-5 h-5 border-2 border-[#ff735d] border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {selected && (
                    <button
                      onClick={clearSelection}
                      aria-label="Clear selected business"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#102a2a] focus:outline-none focus:ring-2 focus:ring-[#ff735d]/40 rounded p-1 transition-colors"
                    >
                      <X weight="bold" className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>

                {/* Embedded CTA */}
                <button
                  onClick={handleRun}
                  disabled={!selected || running || activeKeywords.length === 0}
                  className="flex items-center gap-2 bg-[#ff735d] text-[#1d2423] font-bold px-5 py-3 rounded-xl mr-1.5 my-1.5 shrink-0 whitespace-nowrap hover:bg-[#ff846f] active:scale-[0.97] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-[var(--shadow-glow)] focus:outline-none focus:ring-2 focus:ring-[#ff735d]/50 focus:ring-offset-2"
                >
                  {running ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span className="hidden sm:inline text-sm">Scanning…</span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-bold">Scan My Business</span>
                      <ArrowRight weight="bold" className="w-4 h-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>

              {/* Dropdown — overlays content below */}
              {predictions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-t-0 border-black/[0.08] rounded-b-xl overflow-hidden z-50 shadow-[var(--shadow-float)]">
                  {predictions.map((p) => (
                    <button
                      key={p.place_id}
                      onClick={() => handleSelect(p)}
                      className="w-full text-left px-5 py-3.5 hover:bg-gray-50 transition-colors border-b border-black/[0.06] last:border-0"
                    >
                      <div className="text-[#102a2a] font-semibold text-sm">{p.structured_formatting.main_text}</div>
                      <div className="text-[#5d6d6a] text-xs mt-0.5">{p.structured_formatting.secondary_text}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

          {!selected && !error && (
            <p className="mt-3 text-[#5d6d6a] text-sm">Search for your business above to get started.</p>
          )}

          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

          {/* Business details + keyword card */}
          {selected && (
            <div className="mt-4 bg-white rounded-2xl p-6 shadow-xl">
              {/* Business info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 mb-5 pb-5 border-b border-black/[0.06]">
                <div>
                  <span className="text-[#5d6d6a] text-sm">Business name: </span>
                  <span className="text-[#102a2a] font-bold text-sm">{selected.name}</span>
                  {!selected.has_website && (
                    <span className="ml-2 text-xs font-semibold bg-orange-100 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full">No Website</span>
                  )}
                </div>
                <div>
                  <span className="text-[#5d6d6a] text-sm">Primary service: </span>
                  <span className="text-[#102a2a] font-bold text-sm capitalize">{selected.primary_service}</span>
                </div>
                {selected.website && (
                  <div>
                    <span className="text-[#5d6d6a] text-sm">Website URL: </span>
                    <a href={`https://${selected.website.replace(/^https?:\/\//, '')}`} target="_blank" rel="noopener noreferrer" className="text-[#073c38] font-medium text-sm underline truncate block">
                      {selected.website.replace(/^https?:\/\//, '').split('/')[0].split('?')[0]}
                    </a>
                  </div>
                )}
                <div>
                  <span className="text-[#5d6d6a] text-sm">Research location: </span>
                  <span className="text-[#102a2a] font-bold text-sm">{selected.city}, {selected.state}</span>
                </div>
              </div>

              {/* Keywords */}
              <div>
                <p className="text-[#5d6d6a] text-sm mb-3">
                  <span className="font-semibold text-[#102a2a]">Keywords to Analyze:</span> We&apos;ll run AI queries for these primary keywords.
                </p>
                <div className="flex flex-wrap gap-2">
                  {[...new Set([...selected.keywords, ...activeKeywords.filter(k => !selected.keywords.includes(k))])].map((kw) => {
                    const active = activeKeywords.includes(kw)
                    return (
                      <button
                        key={kw}
                        onClick={() => toggleKeyword(kw)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-semibold transition-all ${
                          active
                            ? 'bg-white border-black/[0.12] text-[#102a2a]'
                            : 'bg-gray-100 border-black/[0.08] text-gray-400 line-through'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${active ? 'bg-[#102a2a] border-[#102a2a]' : 'border-black/[0.12] bg-white'}`}>
                          {active && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </span>
                        <span className="capitalize">{kw}</span>
                      </button>
                    )
                  })}

                  {/* Add keyword */}
                  {addingKeyword ? (
                    <form
                      onSubmit={(e) => { e.preventDefault(); addCustomKeyword() }}
                      className="flex items-center gap-1"
                    >
                      <input
                        ref={customInputRef}
                        type="text"
                        value={customKeyword}
                        onChange={(e) => setCustomKeyword(e.target.value)}
                        onBlur={addCustomKeyword}
                        aria-label="Add a custom keyword"
                        placeholder="e.g. deck building"
                        className="border border-[#073c38] rounded-full px-4 py-2 text-sm text-[#102a2a] focus:outline-none focus:ring-2 focus:ring-[#073c38]/40 w-40"
                      />
                    </form>
                  ) : customKeywords.length < 3 ? (
                    <button
                      onClick={() => setAddingKeyword(true)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-dashed border-[#073c38] text-[#073c38] text-sm font-semibold hover:bg-blue-50 transition-all"
                    >
                      + Add a keyword
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {!selected && <p className="text-[#8a9694] text-xs mt-3 text-center">Free report. No credit card. Results in under 2 minutes.</p>}
        </div>
      </div>

      {/* Stats bar */}
      <div className="bg-[#102a2a] text-white grid grid-cols-2 md:grid-cols-4">
        {[
          {
            stat: '1,400+',
            unit: 'cities',
            label: 'Contractors from Miami to Anchorage have run their free AI visibility scan',
            icon: <MagnifyingGlass weight="bold" className="w-4 h-4" />,
          },
          {
            stat: 'Top 10',
            unit: 'rivals mapped',
            label: 'We name every competitor AI recommends instead of you, by name, no guesswork',
            icon: <UsersThree weight="bold" className="w-4 h-4" />,
          },
          {
            stat: '< 2 min',
            unit: 'to full report',
            label: 'Your score, competitor breakdown, and fix plan, faster than your next estimate',
            icon: <Lightning weight="bold" className="w-4 h-4" />,
          },
          {
            stat: '100%',
            unit: 'free',
            label: 'No credit card. No sales pitch. Just your report, delivered.',
            icon: <SealCheck weight="bold" className="w-4 h-4" />,
          },
        ].map((item, i) => (
          <div
            key={i}
            className="px-5 md:px-8 py-6 md:py-7 border-r border-white/[0.08] last:border-r-0 border-b border-white/[0.08] [&:nth-child(n+3)]:border-b-0 md:border-b-0"
          >
            <div className="flex items-center gap-2 text-[#ff735d] mb-3">
              {item.icon}
              <span className="text-[11px] font-bold tracking-[0.18em] uppercase">{item.unit}</span>
            </div>
            <div className="text-white font-black text-2xl md:text-3xl lg:text-4xl leading-none tracking-tight">
              {item.stat}
            </div>
            <div className="text-white/50 text-xs mt-3 leading-relaxed">{item.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
