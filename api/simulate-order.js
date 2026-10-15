// Payment simulation for production testing - runs the full paid-order pipeline
// (Stripe customer + trial subscription, Telegram alert, business metadata,
// Brevo active-subscriber move, confirmation email) WITHOUT a real charge.
// Protected by simkey === MAGIC_LINK_SECRET. Delete this file when done testing.
import { confirmationEmailHtml } from '../lib/email-template.js';
import { processPaidSession } from '../lib/order-processing.js';

const PRICES = {
  basic20: { id: 'price_1UPKoR0ArfCxocSQueNG7KkD', name: 'Basic - ChatGPT', amount: 2000 },
  basic40: { id: 'price_1UPKoS0ArfCxocSQt6SAifbq', name: 'Basic - Multi-platform', amount: 4000 },
  growth100: { id: 'price_1UPKoT0ArfCxocSQHHZ6XrSd', name: 'Growth Plan', amount: 10000 },
  business250: { id: 'price_1UPKoU0ArfCxocSQgLlYKLkU', name: 'Business Plan', amount: 25000 }
};

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.MAGIC_LINK_SECRET || request.body?.simkey !== process.env.MAGIC_LINK_SECRET) {
    return response.status(403).json({ error: 'Forbidden.' });
  }
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return response.status(500).json({ error: 'Not configured.' });

  const email = String(request.body?.email || '').trim().toLowerCase();
  const plan = PRICES[request.body?.plan || 'basic40'];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response.status(400).json({ error: 'Invalid email.' });
  if (!plan) return response.status(400).json({ error: 'Invalid plan.' });
  const name = String(request.body?.name || '').trim().slice(0, 80) || 'Test Buyer';

  const form = request.body?.form && typeof request.body.form === 'object' ? request.body.form : {};

  try {
    // 1. Reuse or create the Stripe customer (as a real payment would).
    const cRes = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`, {
      headers: { Authorization: `Bearer ${key}` }
    });
    const found = await cRes.json();
    let customer = cRes.ok ? found.data?.[0] : null;
    if (!customer) {
      const params = new URLSearchParams({ email, name, 'metadata[unirab_plan]': request.body?.plan || 'basic40' });
      for (const [k, v] of Object.entries(form)) {
        const value = String(v ?? '').trim().slice(0, 480);
        if (value) params.append(`metadata[unirab_${k}]`, value);
      }
      const created = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      });
      customer = await created.json();
      if (!created.ok) return response.status(502).json({ error: 'Stripe customer creation failed.', detail: customer.error?.message });
    } else {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(form)) {
        const value = String(v ?? '').trim().slice(0, 480);
        if (value) params.append(`metadata[unirab_${k}]`, value);
      }
      if ([...params.keys()].length) {
        await fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(customer.id)}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params
        }).catch(() => null);
      }
    }

    // 2. Attach a trial subscription on the chosen plan (mirrors a paid order;
    //    the trial means NO money moves and nothing renews without a card).
    const sub = await fetch('https://api.stripe.com/v1/subscriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        customer: customer.id,
        'items[0][price]': plan.id,
        trial_end: String(Math.floor(Date.now() / 1000) + 30 * 86400)
      })
    }).then((r) => r.json()).catch(() => null);

    // 3. Run the exact production post-payment pipeline (Telegram, customer
    //    metadata, Brevo move to active-subscribers).
    const syntheticSession = {
      id: 'cs_live_SIM' + Math.random().toString(36).slice(2, 12).toUpperCase(),
      object: 'checkout.session',
      payment_status: 'paid',
      created: Math.floor(Date.now() / 1000),
      amount_total: plan.amount,
      currency: 'usd',
      customer: customer.id,
      customer_details: { email, name },
      line_items: { data: [{ description: plan.name, price: { id: plan.id, recurring: { interval: 'month' } } }] },
      metadata: {}
    };
    for (const [k, v] of Object.entries(form)) {
      const value = String(v ?? '').trim().slice(0, 480);
      if (value) syntheticSession.metadata[k] = value;
    }
    const pipeline = await processPaidSession(syntheticSession);

    // 4. Confirmation email (immediately in simulation; the real flow waits 120s).
    let emailSent = false;
    if (process.env.BREVO_API_KEY && customerEmail(customer)) {
      const first = (name || email.split('@')[0]).split(' ')[0];
      const amount = (plan.amount / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
      const mail = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: { name: process.env.BREVO_SENDER_NAME || 'Unirab', email: process.env.BREVO_SENDER_EMAIL || 'support@unirab.com' },
          to: [{ email: customer.email }],
          subject: `Order confirmed - ${plan.name}`,
          htmlContent: confirmationEmailHtml({ first, plan: plan.name, amount, period: 'month', sessionId: syntheticSession.id })
        })
      }).catch(() => null);
      emailSent = !!mail?.ok;
      if (mail && !mail.ok) console.error('Simulation confirmation email failed', mail.status);
    }

    response.setHeader('Cache-Control', 'no-store');
    return response.status(200).json({
      ok: true,
      simulated: true,
      customerId: customer.id,
      subscription: sub && !sub._error ? { id: sub.id, status: sub.status, trialEnd: sub.trial_end } : null,
      telegram: pipeline.ok,
      confirmationEmail: emailSent,
      note: 'Trial subscription - no charge. Delete the customer in Stripe to clean up.'
    });
  } catch (error) {
    console.error('simulate-order failed', error instanceof Error ? error.stack : 'unknown');
    return response.status(502).json({ error: 'Simulation failed.', detail: error instanceof Error ? error.message : '' });
  }
}

function customerEmail(customer) {
  return customer?.email;
}
