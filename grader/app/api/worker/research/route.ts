export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { Receiver, Client } from '@upstash/qstash'
import { runResearchStep } from '@/workers/research'

function appBase() {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '')
  if (!raw) return ''
  return raw.endsWith('/grader') ? raw : `${raw}/grader`
}

function getQstash() {
  return new Client({
    token: process.env.QSTASH_TOKEN!,
    baseUrl: process.env.QSTASH_URL,
  })
}

function getReceiver() {
  return new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
  })
}

async function enqueueNextStep(jobId: string) {
  const base = appBase()
  if (!base) throw new Error('NEXT_PUBLIC_SITE_URL is not set')
  await getQstash().publishJSON({
    url: `${base}/api/worker/research`,
    body: { jobId },
    retries: 2,
    timeout: '55s',
  })
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get('upstash-signature') ?? ''
  const body = await req.text()

  try {
    // URL is intentionally omitted: Next strips basePath from req.url, which
    // would not match the signed destination URL.
    await getReceiver().verify({ signature, body })
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let jobId = ''
  try {
    jobId = JSON.parse(body).jobId ?? ''
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 })
  }

  // One bounded phase per invocation (Vercel Hobby: 60s max). The function
  // stays alive for the whole phase, then queues the next phase via QStash.
  const result = await runResearchStep(jobId)

  if (!result.complete) {
    if (result.progressed === 0) {
      return NextResponse.json({ error: 'Step made no progress' }, { status: 500 })
    }
    await enqueueNextStep(jobId)
  }

  return NextResponse.json({ success: true, ...result })
}
