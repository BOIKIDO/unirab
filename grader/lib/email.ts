// Email is sent through Brevo (UNIRAB's verified transactional sender).
function parseSender(value: string) {
  const m = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/)
  if (m) return { name: m[1] || 'Unirab', email: m[2] }
  return { name: 'Unirab', email: value }
}

async function sendEmail(opts: { to: string; subject: string; html: string }) {
  const key = process.env.BREVO_API_KEY
  if (!key) {
    console.warn('[email] BREVO_API_KEY not configured — skipping email')
    return
  }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': key, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: parseSender(getFrom()),
      to: [{ email: opts.to }],
      subject: opts.subject,
      htmlContent: opts.html
    })
  }).catch(() => null)
  if (!res || !res.ok) {
    console.error('[email] Brevo send failed', res ? res.status : 'network', res ? await res.text().catch(() => '') : '')
  }
}

function getFrom() { return process.env.BREVO_SENDER_EMAIL ? `Unirab <${process.env.BREVO_SENDER_EMAIL}>` : 'Unirab <support@unirab.com>' }

function scoreUrgency(score: number): string {
  if (score <= 20) return 'You never even get a chance to quote.'
  if (score <= 40) return 'Your competitors get named 3x more than you.'
  if (score <= 60) return 'Half the homeowners who should find you, don\'t.'
  if (score <= 75) return 'One competitor push and they take your spot.'
  if (score <= 90) return 'You\'re ahead. Now make it permanent.'
  return 'You own the market. Expand before someone catches up.'
}

export async function sendReportEmail(params: {
  to: string
  firstName: string
  businessName: string
  reportUrl: string
  overallScore: number
  scoreLabel: string
}) {
  const urgency = scoreUrgency(params.overallScore)

  await sendEmail({
    to: params.to,
    subject: `Your ${params.businessName} AI Visibility Report — Score: ${params.overallScore}/100`,
    html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h1 style="font-size: 22px; font-weight: 800; margin-bottom: 4px; color: #111827;">
          ${params.firstName}, here's your AI Visibility Report
        </h1>
        <p style="color: #6B7280; font-size: 14px; margin-bottom: 28px;">
          We scanned ChatGPT and Gemini for <strong>${params.businessName}</strong>. Here's what we found.
        </p>

        <div style="background: #F9FAFB; border-radius: 12px; padding: 24px; margin: 0 0 24px; text-align: center;">
          <p style="font-size: 13px; color: #6B7280; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600;">Your AI Visibility Score</p>
          <p style="font-size: 52px; font-weight: 900; margin: 0; color: #111827; line-height: 1;">${params.overallScore}</p>
          <p style="font-size: 18px; font-weight: 700; margin: 6px 0 0; color: ${params.scoreLabel === 'Good' ? '#22C55E' : params.scoreLabel === 'Needs Work' ? '#F97316' : '#EF4444'};">
            ${params.scoreLabel}
          </p>
          <p style="font-size: 13px; color: #6B7280; margin: 8px 0 0;">${urgency}</p>
        </div>

        <a href="${params.reportUrl}" style="display: block; text-align: center; background: #F5C518; color: #000; font-weight: 700; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-size: 16px; margin-bottom: 28px;">
          View Your Full Report →
        </a>

        <div style="border-top: 1px solid #E5E7EB; padding-top: 20px; margin-bottom: 24px;">
          <p style="font-size: 13px; color: #374151; font-weight: 700; margin: 0 0 8px;">Next: We'll follow up with a 3-part breakdown</p>
          <p style="font-size: 13px; color: #6B7280; margin: 0 0 4px;">Day 1 — What your score actually means for your revenue this month</p>
          <p style="font-size: 13px; color: #6B7280; margin: 0 0 4px;">Day 2 — A case study of a contractor who went from invisible to #1 in AI search</p>
          <p style="font-size: 13px; color: #6B7280; margin: 0;">Day 3 — The 3 specific things to fix first (and how we do it in 90 days)</p>
        </div>

        <p style="color: #6B7280; font-size: 13px; line-height: 1.6;">
          Want to skip the sequence and talk now? <a href="${process.env.NEXT_PUBLIC_CALENDLY_URL}" style="color: #2563EB; font-weight: 600;">Book a free 20-minute strategy call →</a>
        </p>
      </div>
    `,
  })
}

/**
 * Email sequence templates.
 * Day 1: Immediate — report delivery (sent by sendReportEmail above)
 * Day 2-4: Below templates. Wire these up to your email automation (Resend sequences,
 * Customer.io, ConvertKit, etc.) or trigger via cron + Supabase lead list.
 */

export function emailDay2Data(params: { firstName: string; businessName: string; score: number; reportUrl: string }) {
  return {
    subject: `What a ${params.score}/100 AI score actually costs ${params.businessName}`,
    html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <p style="color: #6B7280; font-size: 14px; margin-bottom: 16px;">${params.firstName},</p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 16px;">
          A ${params.score}/100 AI visibility score isn't just a number. It's a rough estimate of how many homeowner searches <strong>don't</strong> have your name attached.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 16px;">
          Every AI query where you're not mentioned is a potential job that went to a competitor — without you ever knowing the homeowner was looking. That's the silent cost of AI invisibility: you don't lose jobs you quote. You lose jobs you never even heard about.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 24px;">
          The good news: AI visibility is mechanical. It's not luck. It's not "going viral." It's specific signals AI models look for when they answer "who's the best contractor near me." Tomorrow I'll send you a real case study of a contractor who figured this out.
        </p>
        <a href="${params.reportUrl}" style="display: inline-block; background: #F5C518; color: #000; font-weight: 700; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px;">
          Revisit Your Report →
        </a>
      </div>
    `,
  }
}

export function emailDay3Data(params: { firstName: string; reportUrl: string }) {
  return {
    subject: `How a roofing contractor went from 0 AI mentions to #1 in 90 days`,
    html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <p style="color: #6B7280; font-size: 14px; margin-bottom: 16px;">${params.firstName},</p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 16px;">
          When we first scanned Martinez Roofing in Phoenix, their score was 8/100. ChatGPT and Gemini didn't know they existed. Homeowners searching "best roofer in Phoenix AZ" got three other companies — none of them Martinez.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 16px;">
          Three months later: 72/100. ChatGPT names them first for "roof replacement Phoenix." Gemini puts them in the top 3. Their inbound leads from "found you on ChatGPT" went from zero to 12 per week.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 16px;">
          The fix wasn't complicated. It was three specific changes — the same three changes we map out for every business we work with. Tomorrow I'll break down exactly what those changes are and why most contractors never make them.
        </p>
        <a href="${params.reportUrl}" style="display: inline-block; background: #F5C518; color: #000; font-weight: 700; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px;">
          See Your Report Again →
        </a>
      </div>
    `,
  }
}

export function emailDay4Data(params: { firstName: string; businessName: string; score: number; reportUrl: string }) {
  return {
    subject: `The 3 things ${params.businessName} needs to fix (and how we do it)`,
    html: `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <p style="color: #6B7280; font-size: 14px; margin-bottom: 16px;">${params.firstName},</p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 16px;">
          Every business we've moved from invisible to #1 in AI search followed the same pattern. Three things, in order:
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 8px;">
          <strong>1. Fix the signals AI actually reads.</strong> AI models don't "browse the web" like a human. They pull from specific data sources. If your business isn't structured correctly in those sources, you don't exist to AI. Period.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 8px;">
          <strong>2. Expand your surface area.</strong> AI cites businesses that show up across the most relevant contexts. One mention on one platform isn't enough. You need a footprint that makes you the obvious answer.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 24px;">
          <strong>3. Compound the advantage.</strong> AI visibility feeds itself — the more AI cites you, the more it cites you. Once you're in the top 3, staying there is easier than getting there. But you have to get there first.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 16px;">
          We do all three for our clients in 90 days. If you want to see what that looks like for ${params.businessName} specifically, let's talk.
        </p>
        <a href="${process.env.NEXT_PUBLIC_CALENDLY_URL}" style="display: inline-block; background: #F5C518; color: #000; font-weight: 700; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-size: 15px; margin-bottom: 24px;">
          Book a Free 20-Min Strategy Call →
        </a>
        <p style="color: #9CA3AF; font-size: 12px;">
          No pitch. No pressure. A 20-minute call where we look at your report together and map out the first three moves.
        </p>
      </div>
    `,
  }
}
