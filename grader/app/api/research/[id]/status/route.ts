export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { data, error } = await getSupabaseAdmin()
    .from('research_jobs')
    .select('id, status, score_overall, created_at')
    .eq('id', id)
    .single()

  if (error || !data) {
    return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })
  }

  // Estimate progress based on elapsed time (cosmetic — real status drives redirect)
  const elapsed = Date.now() - new Date(data.created_at).getTime()
  const estimatedMs = 75_000 // 75s average
  const progress = data.status === 'complete'
    ? 100
    : data.status === 'failed'
    ? 0
    : Math.min(95, Math.round((elapsed / estimatedMs) * 100))

  return NextResponse.json({
    success: true,
    data: { status: data.status, progress },
  })
}
