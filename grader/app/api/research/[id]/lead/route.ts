export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { sendReportEmail } from '@/lib/email'
import { scoreGrade } from '@/lib/scoring'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { first_name, last_name, email, phone, role, challenge } = body

  if (!email) {
    return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 })
  }

  // Verify job exists
  const { data: job } = await getSupabaseAdmin()
    .from('research_jobs')
    .select('id, business_name, score_overall')
    .eq('id', id)
    .single()

  if (!job) {
    return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 })
  }

  // Save lead — check for duplicate first (works with or without migration 005 constraint)
  const { data: existing } = await getSupabaseAdmin()
    .from('leads')
    .select('id')
    .eq('job_id', id)
    .eq('email', email)
    .maybeSingle()

  if (!existing) {
    const { error: leadErr } = await getSupabaseAdmin().from('leads').insert({
      job_id: id,
      first_name: first_name ?? '',
      last_name: last_name ?? '',
      email,
      phone: phone ?? null,
      role: role ?? null,
    })

    if (leadErr) {
      // If migration 005 is applied, dupes hit the unique constraint — not an error
      if (leadErr.code === '23505') {
        console.warn(`[lead] duplicate submission for ${id}/${email}, skipping`)
      } else {
        console.error(`[lead] db error for ${id}:`, leadErr)
        return NextResponse.json({ success: false, error: 'Failed to save lead' }, { status: 500 })
      }
    }
  }

  // Notify the UNIRAB team (Telegram) and sync the lead to the Brevo
  // "visibility-leads" list (best effort, never blocking the response).
  try {
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          text: [
            '<b>🔍 New AI Visibility lead</b>',
            '━━━━━━━━━━━━━━━━━━━━',
            `🏢 <b>Business:</b> ${job.business_name || '-'}`,
            `👤 <b>Name:</b> ${[first_name, last_name].filter(Boolean).join(' ') || '-'}`,
            `✉️ <b>Email:</b> ${email}`,
            `📞 <b>Phone:</b> ${phone || '-'}`,
            `⭐ <b>Score:</b> ${job.score_overall ?? '-'}/100`
          ].join('\n')
        })
      }).catch(() => null)
    }
    if (process.env.BREVO_API_KEY) {
      await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          email,
          attributes: { FIRSTNAME: first_name || job.business_name || '', BUSINESS: job.business_name || '', SOURCE: 'visibility-grader' },
          listIds: [8],
          updateEnabled: true
        })
      }).catch(() => null)
    }
  } catch (err) {
    console.error('[lead] notify failed:', err)
  }

  // Send report email (non-blocking)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${req.headers.get('host')}`
  const reportUrl = `${baseUrl}/research/${id}`
  const { label: scoreLabel } = scoreGrade(job.score_overall ?? 0)

  sendReportEmail({
    to: email,
    firstName: first_name ?? 'there',
    businessName: job.business_name,
    reportUrl,
    overallScore: job.score_overall ?? 0,
    scoreLabel,
  }).catch((err) => console.error(`[lead] email failed for ${id}:`, err))

  // Fire GHL webhook (non-blocking)
  if (process.env.GHL_WEBHOOK_URL) {
    fetch(process.env.GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name, last_name, email, phone, role, challenge,
        business_name: job.business_name,
        score: job.score_overall,
        report_url: reportUrl,
      }),
    }).catch((err) => console.error(`[lead] GHL webhook failed for ${id}:`, err))
  }

  return NextResponse.json({ success: true })
}
