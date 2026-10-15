import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const sign = (payload) => createHmac('sha256', process.env.MAGIC_LINK_SECRET).update(payload).digest('base64url');
const safeEqual = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Basic throttle: 3 links per email per hour, 20 per IP per hour.
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((ts) => now - ts < windowMs);
  hits.set(key, arr);
  if (arr.length >= max) return true;
  arr.push(now);
  return false;
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  const email = String(request.body?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return response.status(400).json({ error: 'Please enter a valid email address.' });
  }
  const ip = (request.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(`email:${email}`, 3, 3600000) || limited(`ip:${ip}`, 20, 3600000)) {
    return response.status(429).json({ error: 'Too many login attempts. Please try again later.' });
  }
  if (!process.env.MAGIC_LINK_SECRET) return response.status(500).json({ error: 'Login links are not configured.' });
  if (!process.env.BREVO_API_KEY) {
    return response.status(503).json({ error: 'Login emails are not configured yet. Please contact support.' });
  }

  try {
    // Only paying customers get a link: look the email up in Stripe.
    const cRes = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`, {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
    });
    const customers = await cRes.json();
    if (cRes.ok && customers.data?.length) {
      const expiry = Date.now() + 15 * 60 * 1000;
      const payload = `${b64url(email)}.${expiry}`;
      const token = `${payload}.${sign(payload)}`;
      const link = `https://unirab.vercel.app/api/verify-magic-link?token=${encodeURIComponent(token)}`;
      const senderEmail = process.env.BREVO_SENDER_EMAIL || 'support@unirab.com';
      const senderName = process.env.BREVO_SENDER_NAME || 'Unirab';
      const mail = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email }],
          subject: 'Your UNIRAB login link',
          htmlContent: `<div style="font-family:Inter,Arial,sans-serif;max-width:460px;margin:0 auto;padding:32px 8px;color:#102a2a">
<h2 style="margin:0 0 12px;font-size:22px">Log in to UNIRAB</h2>
<p style="margin:0 0 24px;color:#465956;font-size:15px;line-height:1.5">Click the button below to open your customer portal and manage your subscription. The link works once and expires in 15 minutes.</p>
<a href="${link}" style="display:inline-block;background:#073c38;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:8px;font-size:15px">Open my portal</a>
<p style="margin:24px 0 0;color:#8b9795;font-size:12px">Didn't request this? You can ignore this email.</p>
</div>`
        })
      });
      if (!mail.ok) {
        console.error('Brevo send failed', mail.status, await mail.text().catch(() => ''));
        return response.status(502).json({ error: 'Could not send the login email. Please try again.' });
      }
    } else if (!cRes.ok) {
      console.error('Stripe customer lookup failed', customers.error?.type || cRes.status);
      return response.status(502).json({ error: 'Could not send the login email. Please try again.' });
    }
    // Generic answer either way: never reveal whether an account exists.
    response.setHeader('Cache-Control', 'no-store');
    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error('send-magic-link failed', error instanceof Error ? error.message : 'unknown');
    return response.status(502).json({ error: 'Could not send the login email. Please try again.' });
  }
}
