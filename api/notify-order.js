import { processPaidSession } from '../lib/order-processing.js';

const FORM_TO_META = {
  businessName: 'business_name', website: 'website', primaryServices: 'services',
  country: 'country', address: 'address', phone: 'phone', serviceArea: 'service_area', email: 'email'
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  const { sessionId, form } = request.body || {};
  if (!sessionId || !/^cs_live_[A-Za-z0-9]+$/.test(sessionId)) {
    return response.status(400).json({ error: 'Missing or unsupported session id.' });
  }
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return response.status(500).json({ error: 'Not configured.' });
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    return response.status(200).json({ ok: false, configured: false });
  }

  try {
    const sRes = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=line_items`,
      { headers: { Authorization: `Bearer ${secretKey}` } }
    );
    const session = await sRes.json();
    if (!sRes.ok) {
      console.error('Stripe session load failed', session.error?.type || sRes.status);
      return response.status(502).json({ error: 'Could not load the payment session.' });
    }
    // Fallback: sessions created before form metadata existed carry the form in the browser.
    if (form && typeof form === 'object') {
      session.metadata = { ...(session.metadata || {}) };
      for (const [key, metaKey] of Object.entries(FORM_TO_META)) {
        const value = String(form[key] ?? '').trim().slice(0, 480);
        if (value && !session.metadata[metaKey]) session.metadata[metaKey] = value;
      }
    }
    const result = await processPaidSession(session);
    if (!result.ok && result.reason === 'unpaid') {
      return response.status(200).json({ ok: false, reason: 'unpaid' });
    }
    const numericValue = (session.amount_total ?? 0) / 100;
    response.setHeader('Cache-Control', 'no-store');
    return response.status(200).json({
      ok: result.ok,
      ...result.summary,
      value: numericValue,
      currency: (session.currency || 'usd').toUpperCase(),
      transactionId: session.id
    });
  } catch (error) {
    console.error('notify-order failed', error instanceof Error ? error.message : 'unknown');
    return response.status(502).json({ error: 'Notification failed.' });
  }
}
