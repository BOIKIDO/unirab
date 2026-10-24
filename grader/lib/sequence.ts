import { getSupabaseAdmin } from './supabase'

function parseSender(value: string) {
  const m = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/)
  if (m) return { name: m[1] || 'Unirab', email: m[2] }
  return { name: 'Unirab', email: value }
}

async function sendBrevoEmail(opts: { to: string; subject: string; html: string }) {
  const key = process.env.BREVO_API_KEY
  if (!key) {
    console.warn('[sequence] BREVO_API_KEY not configured — skipping email')
    return false
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
    console.error('[sequence] Brevo send failed', res ? res.status : 'network')
    return false
  }
  return true
}

function getFrom() { return process.env.BREVO_SENDER_EMAIL ? `Unirab <${process.env.BREVO_SENDER_EMAIL}>` : 'Unirab <support@unirab.com>' }

const DAY_DELAYS = [0, 24, 48, 72, 96] // hours after enrollment

export async function enrollLeadInSequence(jobId: string, email: string, firstName: string) {
  const db = getSupabaseAdmin()

  // Get job data for the email
  const { data: job } = await db
    .from('research_jobs')
    .select('business_name, location_city, location_state, score_overall')
    .eq('id', jobId)
    .single()

  if (!job) return false

  // Try to mark lead as enrolled (columns may not exist if migration not applied)
  const { error } = await db
    .from('leads')
    .update({ sequence_enrolled: true, sequence_stage: 1, sequence_enrolled_at: new Date().toISOString() })
    .eq('job_id', jobId)
    .eq('email', email)

  if (error) {
    // Columns likely don't exist — still send the email, just skip DB tracking
    console.warn('[sequence] DB update failed (migration 007 may not be applied):', error.message)
  }

  // Send Day 1 immediately — non-blocking, don't fail enrollment if email fails
  sendSequenceEmail(email, firstName, job.business_name, job.score_overall ?? 0, job.location_city, job.location_state, 1)
    .catch(err => console.error('[sequence] day 1 email failed:', err.message))
  return true
}

export async function sendSequenceEmail(
  to: string,
  firstName: string,
  businessName: string,
  score: number,
  city: string,
  state: string,
  day: number
) {
  const content = SEQUENCE_EMAILS[day]
  if (!content) return

  await sendBrevoEmail({
    to,
    subject: content.subject(businessName, score, city),
    html: content.html(firstName, businessName, score, city, state, ''),
  })
}

/**
 * Called by cron to advance leads to their next sequence stage.
 * Each lead gets one email per cron tick until they reach stage 5 (complete).
 */
export async function processSequenceQueue() {
  const db = getSupabaseAdmin()
  const now = new Date()

  // Find leads enrolled in sequence who are due for their next email
  for (let stage = 1; stage <= 4; stage++) {
    const hoursNeeded = DAY_DELAYS[stage] // hours after enrollment for this stage
    const dueBefore = new Date(now.getTime() - hoursNeeded * 60 * 60 * 1000).toISOString()

    const { data: leads, error } = await db
      .from('leads')
      .select('id, job_id, email, first_name, sequence_stage')
      .eq('sequence_stage', stage)
      .eq('sequence_enrolled', true)
      .lt('sequence_enrolled_at', dueBefore)

    if (error || !leads?.length) continue

    for (const lead of leads) {
      // Get job data for the email
      const { data: job } = await db
        .from('research_jobs')
        .select('business_name, location_city, location_state, score_overall')
        .eq('id', lead.job_id)
        .single()

      if (!job) continue

      const nextStage = stage + 1
      await sendSequenceEmail(
        lead.email,
        lead.first_name || 'there',
        job.business_name,
        job.score_overall ?? 0,
        job.location_city,
        job.location_state,
        nextStage
      )

      // Advance the lead to the next stage
      await db
        .from('leads')
        .update({ sequence_stage: nextStage })
        .eq('id', lead.id)

      console.log(`[sequence] sent day ${nextStage} to ${lead.email} for job ${lead.job_id}`)
    }
  }
}

// ── Email Content ──────────────────────────────────────────────

const SEQUENCE_EMAILS: Record<number, {
  subject: (business: string, score: number, city: string) => string
  html: (firstName: string, business: string, score: number, city: string, state: string, reportUrl: string) => string
}> = {
  1: {
    subject: (b, s) => `Your ${b} Fix Plan starts now — Day 1 of 5`,
    html: (fn, b, s, c, st) => `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <p style="color: #6B7280; font-size: 14px; margin-bottom: 16px;">${fn},</p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 16px;">
          Welcome to your <strong>5-Day AI Visibility Fix Plan</strong> for <strong>${b}</strong>.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 16px;">
          Your score was <strong>${s}/100</strong>. Here's what that actually means: when a homeowner in ${c}, ${st} asks ChatGPT or Gemini "who's the best contractor near me," your name comes up roughly ${s}% of the time. The other ${100 - s}% of the time, a competitor gets the call.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 16px;">
          Over the next 5 days, I'll show you exactly what's causing this — and the specific framework we use to fix it. No fluff. No theory. Just the mechanics of how AI decides who to recommend.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 24px;">
          <strong>Here's the plan:</strong><br/>
          Day 1 (today): What your score costs you<br/>
          Day 2: The 3 signals AI actually reads<br/>
          Day 3: Competitor teardown — why they win<br/>
          Day 4: The 90-day fix framework<br/>
          Day 5: Your personalized roadmap + next step
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 16px;">
          Tomorrow I'll break down the three specific signals that make AI recommend one contractor over another. Most contractors have never heard of them. The ones who fix them own their market.
        </p>
        <p style="color: #9CA3AF; font-size: 13px;">Talk tomorrow,<br/>Faaxa</p>
      </div>
    `,
  },

  2: {
    subject: (b, s) => `What ${s}/100 actually costs ${b}`,
    html: (fn, b, s, c, st) => `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <p style="color: #6B7280; font-size: 14px; margin-bottom: 16px;">${fn},</p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 16px;">
          A ${s}/100 score means roughly <strong>${100 - s}% of AI searches for a contractor in ${c}</strong> return someone else's name.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 16px;">
          Here's the math: ChatGPT and Gemini handle millions of local searches per day. Even a conservative estimate — say 50 homeowner searches per month in ${c} for your specific trade — means ${Math.round(50 * (100 - s) / 100)} of those searches handed your competitor the job. Without you ever knowing the homeowner was looking.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 16px;">
          You don't lose jobs you quote. You lose jobs you never even heard about. That's the silent cost of AI invisibility — and it compounds monthly.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 24px;">
          The good news: this is mechanical. It's not luck. It's not "going viral." It's specific signals AI models look for. Tomorrow I'll show you exactly what those signals are and why most contractors don't have them.
        </p>
        <p style="color: #9CA3AF; font-size: 13px;">Day 3 tomorrow,<br/>Faaxa</p>
      </div>
    `,
  },

  3: {
    subject: () => 'The 3 signals AI uses to pick a contractor',
    html: (fn, b, s, c, st) => `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <p style="color: #6B7280; font-size: 14px; margin-bottom: 16px;">${fn},</p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 16px;">
          AI models don't "browse the web" like a human. They pull business data from specific structured sources, then cross-reference that with what they've been trained on. When a homeowner asks "best contractor in ${c}," the AI checks three things:
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 8px;">
          <strong>1. Citation Surface Area</strong> — How many trusted sources reference your business with consistent information. This is the #1 ranking factor. If your business isn't structured correctly across the sources AI reads, you literally don't exist to the model.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 8px;">
          <strong>2. Contextual Relevance</strong> — AI doesn't just check if you're a contractor. It checks if you're specifically relevant to the QUERY. "Best roofer in ${c}" and "roof repair ${c}" are different searches with different ranking signals. Most contractors are optimized for neither.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 16px;">
          <strong>3. Engagement Velocity</strong> — How often your business gets interacted with across platforms. Reviews, clicks, mentions, citations — the AI tracks the momentum. Businesses with growing engagement get ranked higher. Businesses with stagnant or declining signals get deprioritized.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 24px;">
          Tomorrow I'll show you a real competitor teardown — exactly why the #1 contractor in your market beats you on these three signals, and the specific gap you need to close.
        </p>
        <p style="color: #9CA3AF; font-size: 13px;">Day 4 coming,<br/>Faaxa</p>
      </div>
    `,
  },

  4: {
    subject: (b) => `Why your competitors show up in AI — and ${b} doesn't`,
    html: (fn, b, s, c, st) => `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <p style="color: #6B7280; font-size: 14px; margin-bottom: 16px;">${fn},</p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 16px;">
          When we ran your scan, we queried ChatGPT and Gemini across multiple keywords and locations. Your competitors showed up ${s === 0 ? 'every time' : 'significantly more often than you'}. Here's why:
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 16px;">
          The contractors AI recommends first all share three things: they have broad citation coverage across the data sources AI reads, they appear consistently across city AND state-level queries, and their business information is structured in a way AI models can parse confidently.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 16px;">
          The gap isn't about who does better work. It's about who AI can SEE. Your competitors didn't earn their AI rankings — they happened to have the right signals in the right places. Probably by accident. But now they're compounding: the more AI cites them, the more it cites them.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 24px;">
          The fix is systematic, not random. Tomorrow, on the final day, I'll lay out the exact 90-day roadmap we use to take a contractor from invisible to #1 — and what the first move looks like for ${b} specifically.
        </p>
        <p style="color: #9CA3AF; font-size: 13px;">Final day tomorrow,<br/>Faaxa</p>
      </div>
    `,
  },

  5: {
    subject: (b) => `Your ${b} 90-day roadmap`,
    html: (fn, b, s, c, st) => `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <p style="color: #6B7280; font-size: 14px; margin-bottom: 16px;">${fn},</p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 16px;">
          Here's the 90-day framework we use to take a contractor from invisible to #1 in AI search:
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 8px;">
          <strong>Month 1: Build the foundation.</strong> Fix your citation surface area across every data source AI reads. Structure your business information so AI models parse it with zero ambiguity. This alone can move a score from 0 to 30-40.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 8px;">
          <strong>Month 2: Expand your footprint.</strong> Layer in contextual relevance across the specific keywords and locations that matter to your business. This is where you start appearing in AI results — not just existing in the background.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 16px;">
          <strong>Month 3: Compound the advantage.</strong> Once AI starts citing you, the momentum builds itself. AI models reward businesses that get cited more. This is where you go from "sometimes mentioned" to "always first." Scores of 70+ are achievable in 90 days.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.7; margin-bottom: 16px;">
          We've done this for over 200 contractors. ${b} in ${c} is no different — the mechanics are the same. The only question is whether you act before your competitors widen the gap.
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${process.env.NEXT_PUBLIC_CALENDLY_URL}" style="display: inline-block; background: #F5C518; color: #000; font-weight: 700; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-size: 15px;">
            Book Your Free Strategy Call →
          </a>
          <p style="color: #9CA3AF; font-size: 12px; margin-top: 8px;">20 minutes. We look at your report, map your first 3 moves. No pitch.</p>
        </div>
        <p style="color: #9CA3AF; font-size: 13px; margin-top: 32px;">
          Thanks for reading all 5 days, ${fn}. Whether you book a call or not, you now know more about AI visibility than 99% of contractors in ${c}.
        </p>
        <p style="color: #9CA3AF; font-size: 13px;">Talk soon,<br/>Faaxa</p>
      </div>
    `,
  },
}
