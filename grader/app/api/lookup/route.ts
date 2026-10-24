export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { searchPlaces } from '@/lib/places'
import { rateLimit } from '@/lib/ratelimit'

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const { allowed } = await rateLimit(`lookup:${ip}`, 30, 60)
  if (!allowed) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 })
  }

  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (!q || q.trim().length < 2) {
    return NextResponse.json({ success: true, data: [] })
  }

  try {
    const predictions = await searchPlaces(q.trim())
    return NextResponse.json({ success: true, data: predictions })
  } catch (err) {
    console.error('[lookup] error:', err)
    return NextResponse.json({ success: false, error: 'Search failed' }, { status: 500 })
  }
}
