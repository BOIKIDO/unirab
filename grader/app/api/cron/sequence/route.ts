export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { processSequenceQueue } from '@/lib/sequence'

// Called by Vercel Cron every 30 min — advances leads through the 5-day email sequence
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    await processSequenceQueue()
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[cron/sequence] error:', err)
    return NextResponse.json({ success: false, error: 'Sequence processing failed' }, { status: 500 })
  }
}
