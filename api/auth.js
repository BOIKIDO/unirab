// Authentication: Google OAuth + email/password login and registration.
// Accounts are Stripe customers (the site's only datastore): password hashes
// live in customer metadata as scrypt(salt+hash), and a successful login
// mints the same portal token the magic-link flow uses, so the profile
// widget session works unchanged.
// Env: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET enable the Google button.
import { createHmac, createPublicKey, createVerify, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { makePortalToken } from './verify-magic-link.js';

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const sign = (payload) => createHmac('sha256', process.env.MAGIC_LINK_SECRET).update(payload).digest('base64url');
const safeEqual = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------- rate limiting (per serverless instance, same pattern as portal) ----------
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((ts) => now - ts < windowMs);
  hits.set(key, arr);
  if (arr.length >= max) return true;
  arr.push(now);
  return false;
}

// ---------- passwords ----------
export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32);
  return `s1$${salt.toString('hex')}$${hash.toString('hex')}`;
}
function verifyPassword(password, stored) {
  try {
    const [tag, saltHex, hashHex] = String(stored || '').split('$');
    if (tag !== 's1' || !saltHex || !hashHex) return false;
    const expect = Buffer.from(hashHex, 'hex');
    const got = scryptSync(password, Buffer.from(saltHex, 'hex'), expect.length);
    return timingSafeEqual(expect, got);
  } catch { return false; }
}

// ---------- signed tokens ----------
function makeToken(data, minutes) {
  const payload = b64url(JSON.stringify({ ...data, x: Date.now() + minutes * 60000 }));
  return `${payload}.${sign(payload)}`;
}
function readToken(token, action) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) return null;
  if (!process.env.MAGIC_LINK_SECRET || !safeEqual(signature, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.a !== action || Number(data.x) < Date.now()) return null;
    return data;
  } catch { return null; }
}

// ---------- Stripe helpers ----------
async function findCustomer(email) {
  const res = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`, {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
  });
  const body = await res.json();
  return res.ok ? body.data?.[0] || null : null;
}
async function createCustomer(email, name) {
  const params = new URLSearchParams({ email, name: name || email.split('@')[0], 'metadata[unirab_lead]': 'account' });
  const res = await fetch('https://api.stripe.com/v1/customers', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });
  const body = await res.json();
  if (!res.ok) throw new Error('stripe create failed');
  return body;
}
async function setMetadata(customerId, entries) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(entries)) params.append(`metadata[${k}]`, v);
  await fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(customerId)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  }).catch(() => null);
}

// ---------- Google OAuth ----------
let jwksCache = { keys: null, at: 0 };
async function verifyGoogleIdToken(idToken, clientId) {
  const [headB64, payloadB64, sigB64] = String(idToken || '').split('.');
  if (!headB64 || !payloadB64 || !sigB64) return null;
  const header = JSON.parse(Buffer.from(headB64, 'base64url').toString('utf8'));
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') return null;
  if (payload.aud !== clientId || Number(payload.exp) * 1000 < Date.now()) return null;

  if (!jwksCache.keys || Date.now() - jwksCache.at > 3600000) {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/certs').catch(() => null);
    if (!res?.ok) return null;
    jwksCache = { keys: (await res.json()).keys, at: Date.now() };
  }
  const jwk = (jwksCache.keys || []).find((k) => k.kid === header.kid && k.alg === header.alg);
  if (!jwk) return null;
  const verified = createVerify('RSA-SHA256')
    .update(`${headB64}.${payloadB64}`)
    .verify(createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(sigB64, 'base64url'));
  if (!verified || payload.email_verified !== true) return null;
  return { email: String(payload.email || '').toLowerCase(), name: payload.name || '' };
}

const googleRedirectUri = (request) =>
  `https://${String(request.headers.host || 'www.unirab.com').replace(/[^a-z0-9.-]/gi, '')}/api/auth?action=google-callback`;

async function sendConfirmationEmail(email, link) {
  if (!process.env.BREVO_API_KEY) return false;
  const mail = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: process.env.BREVO_SENDER_NAME || 'Unirab', email: process.env.BREVO_SENDER_EMAIL || 'support@unirab.com' },
      to: [{ email }],
      subject: 'Confirm your UNIRAB account',
      htmlContent: `<div style="font-family:Inter,Arial,sans-serif;max-width:460px;margin:0 auto;padding:32px 8px;color:#102a2a">
<h2 style="margin:0 0 12px;font-size:22px">Confirm your account</h2>
<p style="margin:0 0 24px;color:#465956;font-size:15px;line-height:1.5">Welcome! Click the button below to activate your password for the UNIRAB client portal. The link works once and expires in 30 minutes.</p>
<a href="${esc(link)}" style="display:inline-block;background:#073c38;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:8px;font-size:15px">Activate my account</a>
<p style="margin:24px 0 0;color:#8b9795;font-size:12px">Didn't request this? You can ignore this email.</p>
</div>`
    })
  }).catch(() => null);
  return !!mail?.ok;
}

export default async function handler(request, response) {
  const url = new URL(request.url, 'https://x');
  const action = request.query?.action || url.searchParams.get('action') || '';
  response.setHeader('Cache-Control', 'no-store');
  const ip = (request.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';

  try {
    // ----- GET ?action=status : which sign-in options are configured -----
    if (action === 'status') {
      return response.status(200).json({ google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) });
    }

    // ----- GET ?action=google : start OAuth -----
    if (action === 'google') {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return response.redirect(302, `/login?error=${encodeURIComponent('Google sign-in is not configured yet.')}`);
      }
      const state = makeToken({ a: 'oauth', r: randomBytes(12).toString('hex') }, 10);
      const authorize = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authorize.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
      authorize.searchParams.set('redirect_uri', googleRedirectUri(request));
      authorize.searchParams.set('response_type', 'code');
      authorize.searchParams.set('scope', 'openid email profile');
      authorize.searchParams.set('state', state);
      response.setHeader('Set-Cookie', `unirab_oauth=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`);
      return response.redirect(302, authorize.toString());
    }

    // ----- GET ?action=google-callback : finish OAuth -----
    if (action === 'google-callback') {
      response.setHeader('Set-Cookie', 'unirab_oauth=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/');
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return response.redirect(302, `/login?error=${encodeURIComponent('Google sign-in is not configured yet.')}`);
      }
      const cookie = String(request.headers.cookie || '').split('; ').find((c) => c.startsWith('unirab_oauth='))?.slice('unirab_oauth='.length) || '';
      const state = url.searchParams.get('state') || request.query?.state || '';
      const code = url.searchParams.get('code') || request.query?.code || '';
      if (!code || !readToken(state, 'oauth') || !cookie || !safeEqual(cookie, state)) {
        return response.redirect(302, `/login?error=${encodeURIComponent('The Google sign-in attempt could not be verified. Please try again.')}`);
      }
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: googleRedirectUri(request),
          grant_type: 'authorization_code'
        })
      });
      const tokens = await tokenRes.json();
      const profile = tokenRes.ok ? await verifyGoogleIdToken(tokens.id_token, process.env.GOOGLE_CLIENT_ID) : null;
      if (!profile) {
        return response.redirect(302, `/login?error=${encodeURIComponent('Google could not verify your account. Please try again.')}`);
      }
      let customer = await findCustomer(profile.email);
      if (!customer) customer = await createCustomer(profile.email, profile.name);
      await setMetadata(customer.id, { unirab_google: '1', ...(profile.name ? { unirab_name: profile.name } : {}) });
      return response.redirect(302, `/portal?t=${encodeURIComponent(makePortalToken(profile.email, 60 * 24 * 30))}`);
    }

    // ----- POST ?action=login : email + password -----
    if (action === 'login') {
      if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
      const email = String(request.body?.email || '').trim().toLowerCase();
      const password = String(request.body?.password || '');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
        return response.status(400).json({ error: 'Enter your email and password.' });
      }
      if (limited(`login-ip:${ip}`, 12, 900000) || limited(`login:${email}`, 8, 900000)) {
        return response.status(429).json({ error: 'Too many attempts. Please try again in a few minutes.' });
      }
      if (!process.env.STRIPE_SECRET_KEY) return response.status(500).json({ error: 'Not configured.' });
      const customer = await findCustomer(email);
      if (!customer || !verifyPassword(password, customer.metadata?.unirab_pw)) {
        return response.status(401).json({ error: 'Invalid email or password. If you never set a password, create one below.' });
      }
      return response.status(200).json({ ok: true, redirect: `/portal?t=${encodeURIComponent(makePortalToken(email, 60 * 24 * 30))}` });
    }

    // ----- POST ?action=register : email + password, confirmed by email link -----
    if (action === 'register') {
      if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
      const email = String(request.body?.email || '').trim().toLowerCase();
      const password = String(request.body?.password || '');
      const name = String(request.body?.name || '').trim().slice(0, 80);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response.status(400).json({ error: 'Please enter a valid email address.' });
      if (password.length < 8 || password.length > 100) return response.status(400).json({ error: 'Password must be at least 8 characters.' });
      if (limited(`reg-ip:${ip}`, 8, 3600000) || limited(`reg:${email}`, 3, 3600000)) {
        return response.status(429).json({ error: 'Too many attempts. Please try again later.' });
      }
      if (!process.env.BREVO_API_KEY) return response.status(503).json({ error: 'Registration is not configured yet. Please use a login link.' });

      const existing = process.env.STRIPE_SECRET_KEY ? await findCustomer(email) : null;
      if (existing?.metadata?.unirab_pw) {
        return response.status(409).json({ error: 'An account with this email already exists. Log in instead.' });
      }
      // The link carries the (already-hashed) password; it only becomes active
      // once the email owner clicks it within 30 minutes.
      const token = makeToken({ a: 'pwset', e: email, n: name || undefined, h: hashPassword(password) }, 30);
      const link = `${googleRedirectUri(request).replace(/\/api\/auth\?action=google-callback$/, '')}/api/auth?action=verify&token=${encodeURIComponent(token)}`;
      const sent = await sendConfirmationEmail(email, link);
      if (!sent) return response.status(502).json({ error: 'Could not send the confirmation email. Please try again.' });
      return response.status(200).json({ ok: true, message: 'Check your inbox - we sent you a link to activate your account. It expires in 30 minutes.' });
    }

    // ----- GET ?action=verify : activate password (or create lead account) -----
    if (action === 'verify') {
      const data = readToken(url.searchParams.get('token') || request.query?.token || '', 'pwset');
      if (!data) return response.redirect(302, `/login?error=${encodeURIComponent('This activation link is invalid or has expired. Please register again.')}`);
      if (!process.env.STRIPE_SECRET_KEY) return response.redirect(302, `/login?error=${encodeURIComponent('Not configured.')}`);
      let customer = await findCustomer(data.e);
      if (!customer) customer = await createCustomer(data.e, data.n);
      await setMetadata(customer.id, { unirab_pw: data.h, unirab_pw_set: new Date().toISOString() });
      return response.redirect(302, `/portal?t=${encodeURIComponent(makePortalToken(data.e, 60 * 24 * 30))}`);
    }

    return response.status(400).json({ error: 'Unknown action.' });
  } catch (error) {
    console.error('auth failed', action, error instanceof Error ? error.message : 'unknown');
    return response.status(502).json({ error: 'Something went wrong. Please try again.' });
  }
}
