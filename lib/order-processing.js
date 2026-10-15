const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const PLAN_NAMES = {
  'price_1UPKoR0ArfCxocSQueNG7KkD': 'Basic - ChatGPT',
  'price_1UPKoS0ArfCxocSQt6SAifbq': 'Basic - Multi-platform',
  'price_1UPKoT0ArfCxocSQHHZ6XrSd': 'Growth Plan',
  'price_1UPKoU0ArfCxocSQgLlYKLkU': 'Business Plan',
  'price_1UPQei0ArfCxocSQRa198deY': 'Basic - ChatGPT (Yearly)',
  'price_1UPQej0ArfCxocSQb076lcgB': 'Basic - Multi-platform (Yearly)',
  'price_1UPQek0ArfCxocSQvqhpxmZ7': 'Growth Plan (Yearly)',
  'price_1UPQem0ArfCxocSQMG1V09eJ': 'Business Plan (Yearly)'
};
const FORM_FIELDS = {
  business_name: 'Business', website: 'Website', services: 'Services', country: 'Country',
  address: 'Address', phone: 'Phone', service_area: 'Service area', email: 'Email'
};

// Idempotent post-payment processing: persists intake metadata onto the customer
// and alerts Telegram. Safe to call from both the webhook and the thank-you page.
export async function processPaidSession(session) {
  if (!session || session.payment_status !== 'paid') return { ok: false, reason: 'unpaid' };
  if (session.metadata?.unirab_order_sent === '1') return { ok: true, deduped: true };
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { ok: false, reason: 'not-configured' };

  const meta = session.metadata || {};
  const line = session.line_items?.data?.[0] || {};
  const planName = PLAN_NAMES[line.price?.id] || line.description || 'UNIRAB subscription';
  const recurring = line.price?.recurring?.interval === 'year' ? ' / year' : ' / month';
  const amount = ((session.amount_total ?? 0) / 100).toLocaleString('en-US', {
    style: 'currency', currency: (session.currency || 'usd').toUpperCase()
  });
  const when = new Date((session.created ?? Date.now() / 1000) * 1000).toLocaleString('en-US', {
    timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
  }) + ' UTC';
  const cd = session.customer_details || {};
  const formRows = Object.entries(FORM_FIELDS)
    .map(([metaKey, label]) => [label, meta[metaKey]])
    .filter(([, v]) => v && String(v).trim());

  // 1. Persist business info onto the customer (portal reads it from there).
  if (session.customer) {
    const cParams = new URLSearchParams();
    for (const [metaKey, label] of Object.entries(FORM_FIELDS)) {
      if (metaKey === 'email') continue;
      if (meta[metaKey]) cParams.append(`metadata[unirab_${metaKey}]`, meta[metaKey]);
    }
    if ([...cParams.keys()].length) {
      await fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(session.customer)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: cParams
      }).catch(() => null);
    }
  }

  // 1b. Move the customer to the active-subscribers sequence in Brevo.
  if (process.env.BREVO_API_KEY && cd.email) {
    fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        email: cd.email,
        attributes: { FIRSTNAME: (cd.name || cd.email.split('@')[0]).split(' ')[0], PLAN: planName },
        listIds: [5],
        unlinkListIds: [4],
        updateEnabled: true
      })
    }).catch(() => null);
  }

  // 1c. Meta Conversions API - server-side Purchase (dedupes with the browser
  // pixel via event_id = checkout session id).
  if (process.env.META_CAPI_TOKEN && cd.email) {
    const event = {
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: session.id,
      action_source: 'website',
      user_data: { em: [createHash('sha256').update(String(cd.email).trim().toLowerCase()).digest('hex')] },
      custom_data: {
        currency: (session.currency || 'usd').toUpperCase(),
        value: (session.amount_total ?? 0) / 100,
        content_name: planName,
        content_type: 'product'
      }
    };
    const capi = await fetch(`https://graph.facebook.com/v21.0/${process.env.META_PIXEL_ID || '1055402677480814'}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [event], access_token: process.env.META_CAPI_TOKEN })
    }).catch(() => null);
    if (!capi) console.error('CAPI failed: network');
    else if (!capi.ok) console.error('CAPI rejected', capi.status, await capi.text().catch(() => ''));
  }

  // 2. Telegram alert.
  let telegramOk = false;
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    const lines = [
      `<b>🟢 New UNIRAB order - ${esc(amount)}${recurring}</b>`,
      '━━━━━━━━━━━━━━━━━━━━',
      `📦 <b>Plan:</b> ${esc(planName)}`,
      `💵 <b>Amount:</b> ${esc(amount)}${recurring}`,
      `📅 <b>Date:</b> ${esc(when)}`,
      '',
      '👤 <b>Customer</b> (from payment)',
      ...[cd.name && `• Name: ${esc(cd.name)}`, cd.email && `• Email: ${esc(cd.email)}`, cd.phone && `• Phone: ${esc(cd.phone)}`].filter(Boolean)
    ];
    if (formRows.length) lines.push('', '📋 <b>Intake form</b>', ...formRows.map(([k, v]) => `• ${k}: ${esc(v)}`));
    lines.push('━━━━━━━━━━━━━━━━━━━━', `🧾 <code>${esc(session.id)}</code>`);
    const tg = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: lines.join('\n'), parse_mode: 'HTML' })
    }).catch(() => null);
    telegramOk = !!tg?.ok;
    if (tg && !tg.ok) console.error('Telegram send failed', tg.status, await tg.text().catch(() => ''));
  }

  // 3. Mark the session processed so retries never double-alert.
  await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session.id)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ 'metadata[unirab_order_sent]': '1' })
  }).catch(() => null);

  const summary = { plan: planName, amount: `${amount}${recurring}` };
  return { ok: telegramOk || !process.env.TELEGRAM_BOT_TOKEN, summary };
}import { createHash } from 'node:crypto';

