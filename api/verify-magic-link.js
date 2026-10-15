import { createHmac, timingSafeEqual } from 'node:crypto';

const b64url = (s) => Buffer.from(s).toString('base64url');
const sign = (payload) => createHmac('sha256', process.env.MAGIC_LINK_SECRET).update(payload).digest('base64url');
const safeEqual = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const fail = (response, message) => response.redirect(302, `/login?error=${encodeURIComponent(message)}`);

export function makePortalToken(email, minutes = 60) {
  const payload = b64url(JSON.stringify({ e: email.toLowerCase(), x: Date.now() + minutes * 60000, a: 'portal' }));
  return `${payload}.${sign(payload)}`;
}

export function readPortalToken(token) {
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

export default async function handler(request, response) {
  if (request.method !== 'GET') return fail(response, 'This link has been used incorrectly.');

  const token = String(request.query?.token || '');
  const parts = token.split('.');
  if (parts.length !== 3) return fail(response, 'This login link is invalid.');

  const [emailPart, expiryPart, signature] = parts;
  if (!process.env.MAGIC_LINK_SECRET || !safeEqual(signature, sign(`${emailPart}.${expiryPart}`))) {
    return fail(response, 'This login link is invalid.');
  }
  if (Number(expiryPart) < Date.now()) return fail(response, 'This login link has expired. Please request a new one.');

  const email = Buffer.from(emailPart, 'base64url').toString('utf8').toLowerCase();
  try {
    const cRes = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`, {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
    });
    const customers = await cRes.json();
    const customer = cRes.ok ? customers.data?.[0] : null;
    if (!customer) return fail(response, 'No UNIRAB account was found for this email address.');

    return response.redirect(302, `/portal?t=${encodeURIComponent(makePortalToken(email))}`);
  } catch (error) {
    console.error('verify-magic-link failed', error instanceof Error ? error.message : 'unknown');
    return fail(response, 'Could not open the portal. Please try again.');
  }
}
