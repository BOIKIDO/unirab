export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { Receiver } from '@upstash/qstash'
import { runResearch } from '@/workers/research'

function getReceiver() {
  return new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
  })
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get('upstash-signature') ?? ''
  const body = await req.text()

  try {
    await getReceiver().verify({ signature, body })
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const { jobId } = JSON.parse(body)
  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 })
  }

  // Run in background — respond immediately so QStash doesn't retry
  runResearch(jobId).catch((err) =>
    console.error(`[worker/research] unhandled error for ${jobId}:`, err)
  )

  return NextResponse.json({ success: true })
}
