export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { enrollLeadInSequence } from '@/lib/sequence'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { email } = body

  if (!email) {
    return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 })
  }

  // Verify the lead exists for this job
  const { data: lead } = await getSupabaseAdmin()
    .from('leads')
    .select('id, first_name, email')
    .eq('job_id', id)
    .eq('email', email)
    .maybeSingle()

  if (!lead) {
    return NextResponse.json({ success: false, error: 'Lead not found. Submit your email first.' }, { status: 404 })
  }

  // Check if already enrolled (column may not exist if migration not applied)
  const { data: existing } = await getSupabaseAdmin()
    .from('leads')
    .select('id')
    .eq('job_id', id)
    .eq('email', email)
    .eq('sequence_enrolled', true)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ success: true, data: { already_enrolled: true } })
  }

  const enrolled = await enrollLeadInSequence(id, email, lead.first_name || 'there')

  if (!enrolled) {
    return NextResponse.json({ success: false, error: 'Failed to enroll' }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: { enrolled: true } })
}
