export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { fetchReportData } from '@/lib/report'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const result = await fetchReportData(id)

  if (!result.success) {
    const status = result.error === 'Report not found' ? 404
      : result.data?.status === 'pending' || result.data?.status === 'running' ? 202
      : 500
    return NextResponse.json(
      { success: false, error: result.error, data: result.data?.status ? { status: result.data.status } : undefined },
      { status }
    )
  }

  return NextResponse.json({ success: true, data: result.data })
}
