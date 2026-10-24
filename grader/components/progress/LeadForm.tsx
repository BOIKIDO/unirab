'use client'

import { useState } from 'react'

interface Props {
  jobId: string
  onSubmitted: (email: string) => void
  jobComplete: boolean
}

type FieldError = { field: 'email' | 'general'; message: string }

export default function LeadForm({ jobId, onSubmitted, jobComplete }: Props) {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    role: '',
    challenge: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<FieldError | null>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    if (error?.field === 'email' && k === 'email') setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email) {
      setError({ field: 'email', message: 'Email is required so we can deliver your report.' })
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || '/grader'}/api/research/${jobId}/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.success) {
        setSubmitted(true)
        onSubmitted(form.email)
      } else {
        setError({ field: 'general', message: data.error ?? 'We could not save your details. Please try again.' })
        setSubmitting(false)
      }
    } catch {
      setError({ field: 'general', message: 'Network error. Check your connection and try again.' })
      setSubmitting(false)
    }
  }

  const labelClass = 'block text-[#344745] text-[12px] font-semibold tracking-[0.02em] mb-1.5'
  const inputClass = 'w-full bg-[#FAFAF8] border border-black/[0.12] rounded-lg px-4 py-3 md:py-3.5 text-[#102a2a] placeholder-[#8a9694] text-[15px] focus:outline-none focus:border-[#102a2a] transition-[border-color] duration-200'
  const inputErrorClass = 'border-red-400 focus:border-red-500'
  const optionalInputClass = 'w-full bg-gray-50/50 border border-black/[0.08] border-l-[3px] border-l-black/[0.08] rounded-lg px-4 py-3 md:py-3.5 text-[#102a2a] placeholder-[#8a9694] text-[15px] focus:outline-none focus:border-[#102a2a] transition-[border-color] duration-200'

  if (submitted) {
    return (
      <div className="bg-white border border-black/[0.08] shadow-[var(--shadow-elevated)] rounded-2xl p-4 md:p-8 flex flex-col">
        <h3 className="text-[#102a2a] font-black text-[22px] tracking-[-0.015em] mb-1.5 md:mb-2">You&apos;re locked in.</h3>
        <p className="text-[#5d6d6a] text-xs md:text-sm leading-relaxed mb-4 md:mb-8">
          The moment our scan finishes you&apos;ll be taken straight to your report. We&apos;ll also drop a copy in your inbox so you can come back to it any time.
        </p>

        <div className="flex flex-col items-center text-center my-1 md:my-2">
          <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mb-3 md:mb-5">
            <svg className="w-6 h-6 md:w-8 md:h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-[#102a2a] font-bold text-sm md:text-base mb-0.5 md:mb-1">Details received</p>
          <p className="text-[#5d6d6a] text-xs md:text-sm">
            {jobComplete
              ? 'Opening your report now…'
              : 'We\'ll email your report the moment the scan completes.'}
          </p>
        </div>

        <div className="mt-4 md:mt-8 bg-gray-50 border border-black/[0.06] rounded-xl px-4 py-3 md:px-6 md:py-4 flex items-center justify-center gap-2 md:gap-3" role="status" aria-live="polite">
          <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-black/[0.12] border-t-[#ff735d] rounded-full animate-spin" aria-hidden="true" />
          <span className="text-[#344745] font-bold text-sm md:text-base">
            {jobComplete ? 'Loading your report…' : 'Scanning AI platforms. Hold tight…'}
          </span>
        </div>

        <p className="text-[#8a9694] text-[10px] md:text-xs text-center mt-3 md:mt-5 flex items-center justify-center gap-1 md:gap-1.5">
          <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Your details are encrypted and only used to deliver this report.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-black/[0.08] shadow-[var(--shadow-elevated)] rounded-2xl p-6 md:p-8">
      <h3 className="text-[#102a2a] font-black text-[22px] tracking-[-0.015em] mb-0.5 md:mb-1">Where should we send your report?</h3>
      <p className="text-[#5d6d6a] text-xs md:text-sm mb-4 md:mb-6 flex items-start gap-1.5 md:gap-2">
        {jobComplete && (
          <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
        <span>
          {jobComplete
            ? 'Your report is ready. Fill in your details to view it.'
            : 'We\'ll email you the full report and notify you the moment it\'s done.'}
        </span>
      </p>

      <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-2 md:gap-3">
          <div>
            <label htmlFor="lead-first-name" className={labelClass}>First name</label>
            <input
              id="lead-first-name"
              type="text"
              autoComplete="given-name"
              placeholder="Jane"
              value={form.first_name}
              onChange={set('first_name')}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="lead-last-name" className={labelClass}>Last name</label>
            <input
              id="lead-last-name"
              type="text"
              autoComplete="family-name"
              placeholder="Doe"
              value={form.last_name}
              onChange={set('last_name')}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="lead-email" className={labelClass}>
            Email <span className="text-red-500" aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </label>
          <input
            id="lead-email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@yourcompany.com"
            value={form.email}
            onChange={set('email')}
            aria-invalid={error?.field === 'email'}
            aria-describedby={error?.field === 'email' ? 'lead-email-error' : undefined}
            className={`${inputClass} ${error?.field === 'email' ? inputErrorClass : ''}`}
          />
          {error?.field === 'email' && (
            <p id="lead-email-error" role="alert" className="mt-1.5 text-red-600 text-xs flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="lead-phone" className={labelClass}>Phone <span className="text-[#8a9694] italic font-normal">(optional)</span></label>
          <input
            id="lead-phone"
            type="tel"
            autoComplete="tel"
            placeholder="(555) 123-4567"
            value={form.phone}
            onChange={set('phone')}
            className={optionalInputClass}
          />
        </div>

        <div>
          <label htmlFor="lead-role" className={labelClass}>Your role <span className="text-[#8a9694] italic font-normal">(optional)</span></label>
          <select
            id="lead-role"
            value={form.role}
            onChange={set('role')}
            className={`${optionalInputClass} cursor-pointer`}
          >
            <option value="">Select one…</option>
            <option value="Owner">Owner</option>
            <option value="Manager">Manager</option>
            <option value="Marketing">Marketing</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div>
          <label htmlFor="lead-challenge" className={labelClass}>Biggest challenge <span className="text-[#8a9694] italic font-normal">(optional)</span></label>
          <select
            id="lead-challenge"
            value={form.challenge}
            onChange={set('challenge')}
            className={`${optionalInputClass} cursor-pointer`}
          >
            <option value="">Select one…</option>
            <option value="Not getting enough leads">Not getting enough leads</option>
            <option value="Leads go to competitors">Leads go to competitors</option>
            <option value="Don't know where I stand">Don&apos;t know where I rank</option>
            <option value="Want to grow faster">Want to grow faster</option>
            <option value="Losing revenue to unknowns">Losing revenue to unknowns</option>
          </select>
        </div>

        {error?.field === 'general' && (
          <p role="alert" className="text-red-600 text-sm flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error.message}
          </p>
        )}

        <p className="text-[#5d6d6a] text-[11px] text-center mb-3 flex items-center justify-center gap-1.5">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          No spam. We&apos;ll email your report once. That&apos;s it.
        </p>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#ff735d] text-[#1d2423] font-bold px-6 py-3.5 md:py-4 rounded-xl hover:bg-[#ff846f] hover:scale-[1.02] active:scale-[0.96] focus:outline-none text-[15px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[var(--shadow-glow)] transition-all duration-200"
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              <span>Sending…</span>
            </>
          ) : (
            <span>Get My Report Now</span>
          )}
        </button>
      </form>
    </div>
  )
}
