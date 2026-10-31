// Bridge between the UNIRAB lead-magnet page and the AI Visibility Grader.
// Resolves the business via Places (through the grader) or reads its website
// directly (for businesses that are not listed), starts a real scan, and
// returns the grader progress URL. Falls back to manual lead capture when the
// grader backend is unavailable.
// Starting a scan requires a client account (portal session token).
import { readPortalToken } from './verify-magic-link.js';

export const config = { maxDuration: 60 };

const DEFAULT_GRADER = 'https://unirab-grader-eta.vercel.app/grader';

function graderBase() {
  return String(process.env.GRADER_URL || DEFAULT_GRADER).replace(/\/$/, '');
}

function clean(value, max) {
  return String(value || '').trim().slice(0, max);
}

function normalizeWebsite(raw) {
  const value = clean(raw, 500);
  if (!value) return '';
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') return '';
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|fc00:|fd00:|fe80:)/.test(host)) return '';
    return url.toString();
  } catch {
    return '';
  }
}

// Fall back to a plain email lead when the live scan cannot start.
function fallback(response, reason) {
  response.setHeader('Cache-Control', 'no-store');
  return response.status(200).json({ ok: false, fallback: true, reason });
}

async function startScan(base, card, typedBusiness) {
  const startBody = {
    business_name: card.name || typedBusiness,
    website_url: card.website || null,
    primary_service: card.primary_service || null,
    location_city: clean(card.city, 100),
    location_state: clean(card.state, 10),
    keywords: Array.isArray(card.keywords) ? card.keywords.slice(0, 10) : []
  };
  if (!startBody.location_city || !startBody.location_state) return { reason: 'location-required' };
  if (!startBody.keywords.length) return { reason: 'no-services' };

  const sRes = await fetch(`${base}/api/research/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(startBody),
    signal: AbortSignal.timeout(15000)
  });
  const start = await sRes.json().catch(() => ({}));
  const jobId = start?.data?.jobId;
  if (!sRes.ok || !jobId) return { reason: 'scan-unavailable' };
  return { startBody, jobId };
}

export default async function handler(request, response) {
  // GET ?q= : autocomplete proxy for the lead-magnet search bar.
  if (request.method === 'GET') {
    const q = String(request.query?.q || '').trim();
    if (q.length < 2) return response.status(200).json({ success: true, data: [] });
    const base = graderBase();
    try {
      const res = await fetch(`${base}/api/lookup?q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(8000) });
      const body = await res.json().catch(() => ({ success: true, data: [] }));
      response.setHeader('Cache-Control', 'no-store');
      return response.status(200).json(body);
    } catch (error) {
      console.error('visibility-start autocomplete failed:', error instanceof Error ? error.message : 'unknown');
      return response.status(200).json({ success: true, data: [] });
    }
  }
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  // Account required: the scan start must carry a valid portal session,
  // either in the unirab_session cookie or as an explicit t parameter.
  const sessionToken = String(request.query?.t || request.body?.t || '') ||
    String(request.headers.cookie || '').split('; ').find((c) => c.startsWith('unirab_session='))?.slice('unirab_session='.length) || '';
  if (!readPortalToken(sessionToken)) {
    response.setHeader('Cache-Control', 'no-store');
    return response.status(401).json({ error: 'Please log in to run the free AI check.', needsAuth: true });
  }

  const business = clean(request.body?.business, 160);
  if (!business) return response.status(400).json({ error: 'Please enter your business name.' });

  const base = graderBase();
  if (!base) return fallback(response, 'grader-offline');

  const website = normalizeWebsite(request.body?.website);
  const city = clean(request.body?.city, 100);
  const state = clean(request.body?.state, 10);

  try {
    let card;

    if (website) {
      // Website path: read the site and derive the services customers ask AI for.
      const params = new URLSearchParams({ website });
      if (business) params.set('name', business);
      if (city) params.set('city', city);
      if (state) params.set('state', state);
      const dRes = await fetch(`${base}/api/lookup/details?${params.toString()}`, {
        signal: AbortSignal.timeout(45000)
      });
      if (!dRes.ok) return fallback(response, 'website-unavailable');
      const d = await dRes.json().catch(() => ({}));
      card = d?.data;
      if (!card) return fallback(response, 'website-unavailable');
    } else {
      // Places path: autocomplete -> first match -> details.
      const qRes = await fetch(`${base}/api/lookup?q=${encodeURIComponent(business)}`, { signal: AbortSignal.timeout(10000) });
      if (!qRes.ok) throw new Error('lookup failed');
      const q = await qRes.json();
      const placeId = q?.data?.[0]?.place_id;
      if (!placeId) return fallback(response, 'not-found');

      const dRes = await fetch(`${base}/api/lookup/details?place_id=${encodeURIComponent(placeId)}`, { signal: AbortSignal.timeout(30000) });
      if (!dRes.ok) throw new Error('details failed');
      const d = await dRes.json();
      card = d?.data;
      if (!card) return fallback(response, 'details-missing');
    }

    const started = await startScan(base, card, business);
    if (!started.jobId) return fallback(response, started.reason || 'scan-unavailable');

    response.setHeader('Cache-Control', 'no-store');
    return response.status(200).json({
      ok: true,
      redirect: `${base}/research/${started.jobId}/progress`,
      business: started.startBody.business_name,
      city: started.startBody.location_city,
      state: started.startBody.location_state
    });
  } catch (error) {
    console.error('visibility-start failed:', error instanceof Error ? error.message : 'unknown');
    return fallback(response, 'scan-unavailable');
  }
}
