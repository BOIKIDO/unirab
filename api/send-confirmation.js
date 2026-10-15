import { confirmationEmailHtml } from '../lib/email-template.js';
import { checkMailbox } from '../lib/mail-watch.js';
// Custom order confirmation - sent ~120s after payment (triggered by the
// thank-you page). Stripe's own receipts are disabled; this is the receipt.
// GET (Vercel cron, daily): fallback sweep that catches any paid session whose
// confirmation was never sent (e.g. customer closed the tab before the timer).

export default async function handler(request, response) {
  // ---- GET (cron): sweep for missed confirmations - only sessions older
  // than 25h, so it can never overlap with the 120s primary path. ----
  if (request.method === 'GET') {
    const isCron = request.headers['x-vercel-cron'] === '1';
    const url = new URL(request.url, 'https://x');
    const manual = url.searchParams.get('simkey') === process.env.MAGIC_LINK_SECRET;
    if (!isCron && !manual) return response.status(403).json({ error: 'Forbidden.' });
    if (!process.env.STRIPE_SECRET_KEY || !process.env.BREVO_API_KEY) return response.status(503).json({ error: 'Not configured.' });

    await checkMailbox({ force: true }).catch(() => null);
    const cutoff = Math.floor(Date.now() / 1000) - 25 * 3600;   // older than 25h
    const since = Math.floor(Date.now() / 1000) - 7 * 86400;    // last 7 days only
    const sRes = await fetch(`https://api.stripe.com/v1/checkout/sessions?created[gte]=${since}&created[lt]=${cutoff}&limit=100`, {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
    });
    const list = await sRes.json();
    if (!sRes.ok) return response.status(502).json({ error: 'Stripe list failed.' });

    let sent = 0;
    const recipients = [];
    for (const session of list.data || []) {
      if (session.payment_status !== 'paid') continue;
      if (session.metadata?.unirab_confirmation_sent === '1') continue;
      const email = session.customer_details?.email;
      if (!email) continue;

      const line = session.line_items?.data?.[0] || {};
      const amount = ((session.amount_total ?? 0) / 100).toLocaleString('en-US', { style: 'currency', currency: (session.currency || 'usd').toUpperCase() });
      const html = confirmationEmailHtml({
        first: (session.customer_details?.name || email.split('@')[0]).split(' ')[0],
        plan: line.description || 'UNIRAB subscription',
        amount,
        period: line.price?.recurring?.interval === 'year' ? 'year' : 'month',
        sessionId: session.id
      });
      const mail = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: { name: process.env.BREVO_SENDER_NAME || 'Unirab', email: process.env.BREVO_SENDER_EMAIL || 'support@unirab.com' },
          to: [{ email }],
          subject: `Order confirmed - ${line.description || 'UNIRAB subscription'}`,
          htmlContent: html
        })
      }).catch(() => null);
      if (mail?.ok) {
        sent++;
        recipients.push(email);
        await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session.id)}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ 'metadata[unirab_confirmation_sent]': '1' })
        }).catch(() => null);
      }
    }
    return response.status(200).json({ swept: true, sent, recipients });
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  const sessionId = String(request.body?.sessionId || '');
  if (!/^cs_live_[A-Za-z0-9]+$/.test(sessionId)) return response.status(400).json({ error: 'Invalid session.' });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return response.status(500).json({ error: 'Not configured.' });
  if (!process.env.BREVO_API_KEY) return response.status(503).json({ error: 'Email is not configured.' });

  try {
    const sRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=line_items`, {
      headers: { Authorization: `Bearer ${key}` }
    });
    const session = await sRes.json();
    if (!sRes.ok) return response.status(404).json({ error: 'Session not found.' });
    if (session.payment_status !== 'paid') return response.status(200).json({ ok: false, reason: 'unpaid' });
    if (session.metadata?.unirab_confirmation_sent === '1') return response.status(200).json({ ok: true, deduped: true });

    const customerEmail = session.customer_details?.email;
    if (!customerEmail) return response.status(200).json({ ok: false, reason: 'no-email' });

    const firstName = (session.customer_details?.name || customerEmail.split('@')[0]).split(' ')[0];
    const line = session.line_items?.data?.[0] || {};
    const planName = line.description || 'UNIRAB subscription';
    const amount = ((session.amount_total ?? 0) / 100).toLocaleString('en-US', {
      style: 'currency', currency: (session.currency || 'usd').toUpperCase()
    });
    const isYearly = line.price?.recurring?.interval === 'year';
    const period = isYearly ? 'year' : 'month';

    // ================== EDIT YOUR EMAIL TEMPLATE HERE (now in api/_email-template.js) ==================
    const html = confirmationEmailHtml({
      first: firstName,
      plan: planName,
      amount,
      period,
      sessionId: session.id
    });


    const mail = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: process.env.BREVO_SENDER_NAME || 'Unirab', email: process.env.BREVO_SENDER_EMAIL || 'support@unirab.com' },
        to: [{ email: customerEmail, name: session.customer_details?.name || undefined }],
        subject: `Order confirmed - ${planName}`,
        htmlContent: html
      })
    });
    if (!mail.ok) {
      console.error('Confirmation email failed', mail.status, await mail.text().catch(() => ''));
      return response.status(502).json({ error: 'Could not send the confirmation.' });
    }
    // Mark sent so retries/refreshes never double-email.
    await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session.id)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ 'metadata[unirab_confirmation_sent]': '1' })
    }).catch(() => null);
    response.setHeader('Cache-Control', 'no-store');
    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error('send-confirmation failed', error instanceof Error ? error.stack : 'unknown');
    return response.status(502).json({ error: 'Could not send the confirmation.' });
  }
}

function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
