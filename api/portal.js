import { createHmac, timingSafeEqual } from 'node:crypto';
import { checkMailbox } from '../lib/mail-watch.js';
import { makePortalToken } from './verify-magic-link.js';

const sign = (payload) => createHmac('sha256', process.env.MAGIC_LINK_SECRET).update(payload).digest('base64url');
const safeEqual = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
function readPortalToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!process.env.MAGIC_LINK_SECRET || !safeEqual(signature, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.a !== 'portal' || typeof data.e !== 'string' || Number(data.x) < Date.now()) return null;
    return data;
  } catch { return null; }
}
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const PRICES = {
  basic20: 'price_1UPKoR0ArfCxocSQueNG7KkD',
  basic40: 'price_1UPKoS0ArfCxocSQt6SAifbq',
  growth100: 'price_1UPKoT0ArfCxocSQHHZ6XrSd',
  business250: 'price_1UPKoU0ArfCxocSQgLlYKLkU'
};
const YEARLY_PRICES = {
  'price_1UPQei0ArfCxocSQRa198deY': { key: 'basic20', name: 'Basic - ChatGPT (Yearly)', price: 168 },
  'price_1UPQej0ArfCxocSQb076lcgB': { key: 'basic40', name: 'Basic - Multi-platform (Yearly)', price: 336 },
  'price_1UPQek0ArfCxocSQvqhpxmZ7': { key: 'growth100', name: 'Growth Plan (Yearly)', price: 840 },
  'price_1UPQem0ArfCxocSQMG1V09eJ': { key: 'business250', name: 'Business Plan (Yearly)', price: 2100 }
};
const PLANS = Object.fromEntries(Object.entries(PRICES).map(([key, id]) => [id, { key, name: { basic20: 'Basic - ChatGPT', basic40: 'Basic - Multi-platform', growth100: 'Growth Plan', business250: 'Business Plan' }[key], price: { basic20: 20, basic40: 40, growth100: 100, business250: 250 }[key], interval: 'month' }])
  .concat(Object.entries(YEARLY_PRICES).map(([id, p]) => [id, { ...p, interval: 'year' }])));
const PLANS_BY_KEY = Object.fromEntries(Object.values(PLANS).map((p) => [p.key, p]));
const UPGRADE_ORDER = ['basic20', 'basic40', 'growth100', 'business250'];
const PLAN_NAMES = Object.fromEntries(Object.entries(PRICES).map(([key, id]) => [id, PLANS[id].name]));

async function getCustomerByEmail(email) {
  const cRes = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`, {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
  });
  const customers = await cRes.json();
  return cRes.ok ? customers.data?.[0] || null : null;
}

async function createPortalSession(customerId) {
  const create = (config) => fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ customer: customerId, ...(config ? { configuration: config } : {}) })
  });
  let res = await create();
  let body = await res.json();
  if (!res.ok && body.error?.code === 'portal_configuration_required') {
    const cfg = await fetch('https://api.stripe.com/v1/billing_portal/configurations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        'features[customer_update][enabled]': 'true',
        'features[customer_update][allowed_updates][0]': 'email',
        'features[invoice_history][enabled]': 'true',
        'features[payment_method_update][enabled]': 'true',
        'features[subscription_cancel][enabled]': 'true',
        'business_profile[headline]': 'Manage your UNIRAB subscription'
      })
    });
    const cfgBody = await cfg.json();
    if (cfg.ok && cfgBody.id) {
      res = await create(cfgBody.id);
      body = await res.json();
    }
  }
  return res.ok ? body : null;
}

export default async function handler(request, response) {
  const url = new URL(request.url, 'https://x');
  const action = request.query?.action || url.searchParams.get('action') || '';
  const token = request.query?.t ?? request.body?.t;
  const auth = readPortalToken(token);
  const loginRedirect = (msg) => response.redirect(302, `/login?error=${encodeURIComponent(msg)}`);
  if (!auth) {
    if (request.method === 'GET' && action === 'billing') return loginRedirect('Your session has expired. Please log in again.');
    return response.status(401).json({ error: 'Your session has expired. Please log in again.' });
  }
  if (!process.env.STRIPE_SECRET_KEY) return response.status(500).json({ error: 'Not configured.' });

  try {
    // ----- GET ?action=session : validate + refresh the session cookie,
    // return light profile data for the site-wide profile widget -----
    if (action === 'session') {
      const customer = await getCustomerByEmail(auth.e);
      if (!customer) return response.status(404).json({ error: 'No UNIRAB account was found for this email address.' });
      const sRes = await fetch(`https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(customer.id)}&limit=5`, {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
      });
      const subs = await sRes.json();
      const hasActiveSubscription = sRes.ok
        ? (subs.data || []).some((s) => ['active', 'trialing', 'past_due'].includes(s.status))
        : false;
      response.setHeader('Cache-Control', 'no-store');
      return response.status(200).json({
        ok: true,
        email: customer.email,
        name: customer.name || null,
        hasActiveSubscription,
        token: makePortalToken(customer.email, 60 * 24 * 30)
      });
    }

    // ----- GET ?action=billing : open the Stripe billing portal -----
    if (action === 'billing') {
      const customer = await getCustomerByEmail(auth.e);
      if (!customer) return loginRedirect('No UNIRAB account was found for this email address.');
      const session = await createPortalSession(customer.id);
      if (!session?.url) return loginRedirect('Could not open billing. Please try again.');
      return response.redirect(302, session.url);
    }

    // ----- GET ?action=data : everything the dashboard needs -----
    if (action === 'data') {
      const customer = await getCustomerByEmail(auth.e);
      if (!customer) return response.status(404).json({ error: 'No UNIRAB account was found for this email address.' });

      const sRes = await fetch(`https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(customer.id)}&limit=5`, {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
      });
      const subs = await sRes.json();
      const live = sRes.ok ? (subs.data || []).filter((s) => s.status !== 'canceled' && s.status !== 'incomplete_expired') : [];
      // After an upgrade checkout the customer may briefly own two subscriptions:
      // retire the older one (immediately if it never charged, else at period end).
      if (live.length > 1) {
        live.sort((a, b) => (b.created || 0) - (a.created || 0));
        for (const old of live.slice(1)) {
          await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(old.id)}`, {
            method: old.status === 'trialing' ? 'DELETE' : 'POST',
            headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: old.status === 'trialing' ? undefined : new URLSearchParams({ cancel_at_period_end: 'true' })
          }).catch(() => null);
        }
      }
      const sub = live[0] || null;
      const items = Array.isArray(sub?.items?.data) ? sub.items.data : [];
      const item = items[0];
      const priceId = typeof item?.price === 'string' ? item.price : item?.price?.id ?? null;
      const plan = priceId ? PLANS[priceId] ?? null : null;
      const periodEnd = item?.current_period_end ?? sub?.current_period_end ?? null;
      const meta = customer.metadata || {};
      const upgrades = plan
        ? UPGRADE_ORDER.filter((key) => PLANS_BY_KEY[key] && PLANS_BY_KEY[key].price > plan.price).map((key) => ({ plan: key, name: PLANS_BY_KEY[key].name, price: PLANS_BY_KEY[key].price }))
        : UPGRADE_ORDER.map((key) => ({ plan: key, name: PLANS_BY_KEY[key].name, price: PLANS_BY_KEY[key].price }));

      await checkMailbox().catch(() => null);
      response.setHeader('Cache-Control', 'no-store');
      return response.status(200).json({
        email: customer.email,
        business: {
          businessName: meta.unirab_business_name || null,
          website: meta.unirab_website || null,
          primaryServices: meta.unirab_services || null,
          country: meta.unirab_country || null,
          address: meta.unirab_address || null,
          phone: meta.unirab_phone || null,
          serviceArea: meta.unirab_service_area || null
        },
        subscription: sub
          ? {
              status: sub.status,
              plan: plan ? plan.name : 'Custom plan',
              price: plan ? plan.price : null,
              interval: plan ? plan.interval : 'month',
              renewalDate: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
              cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
              subId: sub.id,
              itemId: item ? item.id : null,
              priceId
            }
          : null,
        upgrades
      });
    }

    // ----- POST ?action=upgrade-checkout : embedded payment form for a plan switch -----
    if (action === 'upgrade-checkout') {
      if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
      const priceId = PRICES[request.body?.plan];
      if (!priceId) return response.status(400).json({ error: 'Invalid plan.' });
      const customer = await getCustomerByEmail(auth.e);
      if (!customer) return response.status(404).json({ error: 'No UNIRAB account was found for this email address.' });
      const host = String(request.headers.host || 'unirab.vercel.app').replace(/[^a-z0-9.-]/gi, '');
      const params = new URLSearchParams({
        ui_mode: 'embedded',
        mode: 'subscription',
        customer: customer.id,
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        allow_promotion_codes: 'true',
        return_url: `https://${host}/portal?t=${encodeURIComponent(String(token || ''))}`
      });
      // No free trials: upgrades start and charge immediately.
      const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      });
      const session = await stripeResponse.json();
      if (!stripeResponse.ok || !session.client_secret) {
        console.error('Upgrade checkout error', session.error?.type || stripeResponse.status);
        return response.status(502).json({ error: 'Could not start the upgrade. Please try again.' });
      }
      response.setHeader('Cache-Control', 'no-store');
      return response.status(200).json({ clientSecret: session.client_secret });
    }

    // ----- POST ?action=cancel : cancel at period end + notify -----
    if (action === 'cancel') {
      if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
      const subId = String(request.body?.subId || '');
      const reason = String(request.body?.reason || '').slice(0, 900);
      if (!/^sub_[A-Za-z0-9]+$/.test(subId)) return response.status(400).json({ error: 'Invalid request.' });
      const sRes = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subId)}`, {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
      });
      const sub = await sRes.json();
      if (!sRes.ok) return response.status(404).json({ error: 'Subscription not found.' });
      const customer = await getCustomerByEmail(auth.e);
      if (!customer || sub.customer !== customer.id) return response.status(403).json({ error: 'This subscription does not belong to your account.' });
      if (sub.cancel_at_period_end) return response.status(200).json({ ok: true, already: true });

      const cancelRes = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subId)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ cancel_at_period_end: 'true' })
      });
      const updated = await cancelRes.json();
      if (!cancelRes.ok) {
        console.error('Cancel failed', updated.error?.type || cancelRes.status);
        return response.status(502).json({ error: 'The cancellation could not be completed. Please try again.' });
      }

      const item = updated.items?.data?.[0];
      const planName = PLAN_NAMES[item?.price?.id] || 'UNIRAB plan';
      const periodEnd = item?.current_period_end || updated.current_period_end;
      const until = periodEnd ? new Date(periodEnd * 1000).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' }) : 'the period end';

      if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
        const text = [
          '<b>🔴 Cancellation requested</b>',
          '━━━━━━━━━━━━━━━━━━━━',
          `📦 <b>Plan:</b> ${esc(planName)}`,
          `👤 <b>Customer:</b> ${esc(customer.email)}`,
          `📅 <b>Active until:</b> ${esc(until)}`,
          reason ? `💬 <b>Reason:</b> ${esc(reason)}` : '💬 <b>Reason:</b> <i>not given</i>',
          `🧾 <code>${esc(sub.id)}</code>`
        ].join('\n');
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' })
        }).catch(() => null);
      }

      // Email a ticket to support@unirab.com with full customer data.
      if (process.env.BREVO_API_KEY) {
        try {
          const counterCust = customer.email === 'support@unirab.com' ? customer : await getCustomerByEmail('support@unirab.com');
          let ticketNo = 1001;
          if (counterCust) {
            const prev = parseInt(counterCust.metadata?.unirab_cancel_counter || '1000', 10);
            if (Number.isFinite(prev)) ticketNo = prev + 1;
            await fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(counterCust.id)}`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ 'metadata[unirab_cancel_counter]': String(ticketNo) })
            }).catch(() => null);
          }
          const m = customer.metadata || {};
          const rows = [
            ['Ticket number', `#${ticketNo}`],
            ['Customer email', customer.email],
            ['Customer name', customer.name],
            ['Business name', m.unirab_business_name],
            ['Website', m.unirab_website],
            ['Services', m.unirab_services],
            ['Country', m.unirab_country],
            ['Address', m.unirab_address],
            ['Phone', m.unirab_phone],
            ['Service area', m.unirab_service_area],
            ['Plan', planName],
            ['Active until', until],
            ['Cancellation reason', reason || '(not given)'],
            ['Subscription ID', sub.id]
          ].filter(([, v]) => v);
          const table = rows.map(([k, v]) => `<tr><td style="padding:6px 14px 6px 0;color:#7b8986;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;color:#102a2a;font-weight:600">${esc(v)}</td></tr>`).join('');
          await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({
              sender: { name: process.env.BREVO_SENDER_NAME || 'Unirab', email: process.env.BREVO_SENDER_EMAIL || 'support@unirab.com' },
              to: [{ email: 'support@unirab.com' }],
              subject: `CANCEL REQUEST #${ticketNo}`,
              htmlContent: `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px 8px;color:#102a2a"><h2 style="margin:0 0 6px;font-size:20px">Cancellation request</h2><p style="margin:0 0 18px;color:#b3352a;font-weight:700">CANCEL REQUEST #${ticketNo}</p><table style="border-collapse:collapse;font-size:14px">${table}</table><p style="margin:20px 0 0;color:#8b9795;font-size:12px">The subscription was set to cancel at the period end. The customer keeps access until ${esc(until)}.</p></div>`
            })
          }).catch(() => null);
        } catch (mailErr) {
          console.error('Cancel email error', mailErr instanceof Error ? mailErr.message : mailErr);
        }
      }
      response.setHeader('Cache-Control', 'no-store');
      return response.status(200).json({ ok: true });
    }

    // ----- POST ?action=update-business : save intake fields to the customer -----
    if (action === 'update-business') {
      if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
      const business = request.body?.business;
      if (!business || typeof business !== 'object') return response.status(400).json({ error: 'Nothing to update.' });
      const customer = await getCustomerByEmail(auth.e);
      if (!customer) return response.status(404).json({ error: 'No UNIRAB account was found for this email address.' });
      const fields = {
        businessName: 'unirab_business_name', website: 'unirab_website', primaryServices: 'unirab_services',
        country: 'unirab_country', address: 'unirab_address', phone: 'unirab_phone', serviceArea: 'unirab_service_area'
      };
      const params = new URLSearchParams();
      let any = false;
      for (const [key, metaKey] of Object.entries(fields)) {
        const value = String(business[key] ?? '').trim().slice(0, 480);
        if (value) { params.append(`metadata[${metaKey}]`, value); any = true; }
      }
      if (!any) return response.status(400).json({ error: 'Please fill at least one field.' });
      const uRes = await fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(customer.id)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      });
      if (!uRes.ok) {
        console.error('Business update failed', uRes.status);
        return response.status(502).json({ error: 'Could not save your business information. Please try again.' });
      }
      response.setHeader('Cache-Control', 'no-store');
      return response.status(200).json({ ok: true });
    }

    return response.status(400).json({ error: 'Unknown action.' });
  } catch (error) {
    console.error('portal failed', action, error instanceof Error ? error.stack : 'unknown');
    return response.status(502).json({ error: 'Something went wrong. Please try again.' });
  }
}
