// Subscriber-only resource: serves the GEO cheat sheet to clients holding a
// valid portal token AND a live subscription (active, trialing or past_due —
// past_due keeps access during the payment-retry grace window; a subscription
// canceling at period end stays "active" until the paid period runs out).
import { readPortalToken } from './verify-magic-link.js';
import CHEAT_SHEET_HTML from '../lib/cheat-sheet.js';

const ACTIVE_STATES = new Set(['active', 'trialing', 'past_due']);

const denialPage = (heading, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${heading} | UNIRAB</title><style>
body{margin:0;font:15px/1.6 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f3f8f6;color:#102a2a;display:grid;place-items:center;min-height:100vh;padding:24px;box-sizing:border-box}
.card{max-width:460px;background:#fff;border:1px solid #dfe8e4;border-radius:14px;padding:32px 34px;box-shadow:0 12px 34px rgba(7,60,56,.07);text-align:center}
h1{font-size:21px;margin:0 0 10px}p{color:#637170;margin:0 0 22px}
a.btn{display:inline-block;background:#073c38;color:#fff;text-decoration:none;font-weight:800;font-size:13.5px;padding:12px 22px;border-radius:8px}
</style></head><body><div class="card"><h1>${heading}</h1><p>${body}</p><a class="btn" href="/portal">Back to my portal</a></div></body></html>`;

async function getLiveSubscription(email) {
  const cRes = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`, {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
  });
  const customers = await cRes.json();
  const customer = cRes.ok ? customers.data?.[0] || null : null;
  if (!customer) return null;
  const sRes = await fetch(`https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(customer.id)}&limit=5`, {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
  });
  const subs = await sRes.json();
  return sRes.ok ? (subs.data || []).find((s) => ACTIVE_STATES.has(s.status)) || null : null;
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Robots-Tag', 'noindex');

  const auth = readPortalToken(String(request.query?.t || ''));
  if (!auth) {
    return response.status(403)
      .send(denialPage('Session expired', 'Your session has expired or the link is invalid. Please log in again from your customer portal.'));
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return response.status(500).send(denialPage('Not available', 'This resource is not configured right now. Please try again later.'));
  }

  let subscription = null;
  try {
    subscription = await getLiveSubscription(auth.e);
  } catch (error) {
    console.error('cheat-sheet lookup failed', error instanceof Error ? error.message : 'unknown');
  }
  if (!subscription) {
    return response.status(403)
      .send(denialPage('Subscribers only', 'The AI Visibility Cheat Sheet is exclusive to clients with an active subscription.'));
  }

  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  return response.status(200).send(CHEAT_SHEET_HTML);
}
