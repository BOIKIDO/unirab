'use client'

import { useState } from 'react'

function maskEmail(email: string): string {
  const [name, domain] = email.split('@')
  if (!domain) return email
  const masked = name.length <= 2 ? name[0] + '***' : name[0] + '***' + name[name.length - 1]
  return `${masked}@${domain}`
}

interface Props {
  jobId: string
  email: string
  businessName: string
  alreadyEnrolled: boolean
}

export default function SequenceCta({ jobId, email, businessName, alreadyEnrolled }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>(alreadyEnrolled ? 'done' : 'idle')

  async function handleEnroll() {
    setState('loading')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || '/grader'}/api/research/${jobId}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      setState(data.success ? 'done' : 'error')
    } catch { setState('error') }
  }

  if (state === 'done') {
    return (
      <div className="bg-[#FFFBEB] border-2 border-[#ff735d]/40 rounded-2xl p-6 md:p-8 text-center shadow-[var(--shadow-rest)]">
        <p className="text-green-600 text-[13px] font-semibold">
          {alreadyEnrolled
            ? `You're enrolled in the 5-Day Fix Plan. Check ${maskEmail(email)} for your next email.`
            : 'Day 1 of your 5-Day Fix Plan is in your inbox.'}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-[#FFFBEB] border-2 border-[#ff735d]/40 rounded-2xl p-6 md:p-8 text-center shadow-[var(--shadow-rest)]">
      <h3 className="font-black text-[22px] text-[#102a2a] mb-2">
        Your 5-Day AI Visibility Fix Plan
      </h3>
      <p className="text-[15px] text-[#5d6d6a] mb-5">
        One actionable tactic per day. Written for {businessName}.
      </p>
      <button
        onClick={handleEnroll}
        disabled={state === 'loading'}
        className="bg-[#ff735d] text-black font-bold px-6 py-3 rounded-xl hover:bg-yellow-400 hover:scale-[1.02] active:scale-[0.97] transition-all duration-200 shadow-[var(--shadow-glow)] inline-flex items-center gap-2"
      >
        {state === 'loading' ? 'Sending…' : 'Start the Free Course'}
        <span className="bg-[#102a2a] text-[#ff735d] text-[10px] font-bold px-2 py-0.5 rounded-full">5 days</span>
      </button>
      <p className="text-[#5d6d6a] text-[11px] mt-3">Day 1 goes to {maskEmail(email)} the moment you enroll.</p>
      {state === 'error' && <p className="text-red-500 text-xs mt-2">Something went wrong. Try again.</p>}
    </div>
  )
}
