'use client'

import { useEffect, useState, useRef } from 'react'

const STEPS = [
  { label: 'Identifying business', duration: 8 },
  { label: 'Running AI queries', duration: 55 },
  { label: 'Detecting mentions', duration: 20 },
  { label: 'Scoring results', duration: 10 },
]

interface Props {
  jobId: string
  onComplete: () => void
}

export default function ProgressTracker({ jobId, onComplete }: Props) {
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<string>('pending')
  const [elapsed, setElapsed] = useState(0)
  const firedComplete = useRef(false)

  // Tick elapsed time
  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Poll status
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || '/grader'}/api/research/${jobId}/status`)
        const data = await res.json()
        if (data.success) {
          setProgress(data.data.progress)
          setStatus(data.data.status)
          if (data.data.status === 'complete' && !firedComplete.current) {
            firedComplete.current = true
            onComplete()
          }
        }
      } catch { /* keep polling */ }
    }
    poll()
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [jobId, onComplete])

  // Calculate which step is active based on progress
  const activeStep = progress < 15 ? 0 : progress < 80 ? 1 : progress < 95 ? 2 : 3

  return (
    <div className="space-y-3">
      {STEPS.map((step, i) => {
        const done = i < activeStep
        const active = i === activeStep
        return (
          <div key={step.label} className="flex items-center gap-3">
            {/* Status indicator */}
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                done
                  ? 'bg-[#22C55E]'
                  : active
                  ? 'bg-[#ff735d]'
                  : 'bg-gray-100 border border-black/[0.08]'
              }`}
            >
              {done ? (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : active ? (
                <div className="w-2 h-2 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-semibold ${done || active ? 'text-[#102a2a]' : 'text-[#8a9694]'}`}>
                  {step.label}
                </span>
                <span className={`text-[10px] font-bold ml-2 shrink-0 ${
                  done ? 'text-[#22C55E]' : active ? 'text-[#8f5148]' : 'text-transparent'
                }`}>
                  {done ? 'Done' : active ? 'Running…' : '·'}
                </span>
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: done ? '100%' : active ? `${Math.min(100, ((progress - (i === 1 ? 15 : i === 2 ? 80 : i === 3 ? 95 : 0)) / (i === 1 ? 65 : i === 2 ? 15 : i === 3 ? 5 : 15)) * 100)}%` : '0%',
                    background: done ? '#22C55E' : '#ff735d',
                  }}
                />
              </div>
            </div>
          </div>
        )
      })}

      <div className="pt-1 flex items-center justify-between">
        <span className="text-[#8a9694] text-[10px]">{elapsed}s elapsed</span>
        <span className="text-[#5d6d6a] text-[10px]">{progress}% complete</span>
      </div>
    </div>
  )
}
