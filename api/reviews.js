import { reviewSig, listPublished, moderatePending, savePending } from '../lib/reviews-store.js';
import { checkMailbox } from '../lib/mail-watch.js';

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Lightweight anti-spam: per-instance memory is imperfect across lambdas,
// but it stops naive hammering.
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((ts) => now - ts < windowMs);
  hits.set(key, arr);
  if (arr.length >= max) { hits.set(key, arr); return true; }
  arr.push(now);
  hits.set(key, arr);
  return false;
}

const page = (title, msg, color) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Inter,Arial,sans-serif;background:#f3f8f6;display:grid;place-items:center;min-height:100vh;margin:0}div{background:#fff;border:1px solid #dfe8e4;border-radius:14px;padding:40px 48px;text-align:center;box-shadow:0 12px 34px rgba(7,60,56,.07)}h1{font-size:22px;margin:0 0 10px;color:${color}}p{color:#465956;margin:0;font-size:14px}</style></head><body><div><h1>${title}</h1><p>${msg}</p></div></body></html>`;

export default async function handler(request, response) {
  const url = new URL(request.url, 'https://x');

  // ---- POST: submit a review (queued for moderation + Telegram alert) ----
  if (request.method === 'POST') {
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
      return response.status(200).json({ ok: false, configured: false });
    }
    const ip = (request.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    if (limited(`ip:${ip}`, 10, 3600000)) return response.status(429).json({ error: 'Too many reviews. Try again later.' });

    const rating = Number(request.body?.rating);
    const body = String(request.body?.reviewBody || '').trim().slice(0, 2000);
    const name = (String(request.body?.reviewerName || '').trim().slice(0, 80)) || 'Anonymous';
    const anon = Boolean(request.body?.anonymous);
    const email = String(request.body?.reviewerEmail || '').trim().slice(0, 120);
    const plan = String(request.body?.plan || 'homepage').slice(0, 40);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return response.status(400).json({ error: 'Rating required.' });
    if (body.length < 3) return response.status(400).json({ error: 'Review required.' });
    if (limited(`body:${body.toLowerCase()}`, 2, 86400000)) return response.status(429).json({ error: 'Duplicate review.' });

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const review = { id, rating, body: body.slice(0, 400), name: anon ? 'Anonymous' : name, plan, ts: Date.now() };

    let queued = true;
    try { queued = await savePending(review); } catch { queued = false; }

    const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
    const origin = 'https://www.unirab.com';
    const pubLink = `${origin}/api/reviews?action=moderate&id=${id}&mod_action=publish&sig=${reviewSig(id, 'publish')}`;
    const rejLink = `${origin}/api/reviews?action=moderate&id=${id}&mod_action=reject&sig=${reviewSig(id, 'reject')}`;
    const text = [
      `<b>📝 New review - ${stars} (${rating}/5)</b>`,
      '━━━━━━━━━━━━━━━━━━━━',
      `📍 <b>Plan:</b> ${esc(plan)}`,
      `👤 <b>By:</b> ${esc(anon ? 'Anonymous' : name)}${!anon && email ? ` (${esc(email)})` : ''}`,
      '',
      esc(body),
      '',
      `Queued: <b>${queued ? 'yes' : 'no'}</b>`,
      `🆔 Reply <code>/approve ${id}</code> (or <code>approve ${id}</code>) to publish - <code>/reject ${id}</code> to discard`,
      `✅ <a href="${pubLink}">Publish to site</a>  |  ❌ <a href="${rejLink}">Reject</a>`
    ].join('\n');

    const tg = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true })
    }).catch(() => null);
    if (!tg?.ok) {
      console.error('Review telegram failed', tg ? tg.status : 'network');
      return response.status(502).json({ error: 'Could not submit the review.' });
    }
    response.setHeader('Cache-Control', 'no-store');
    return response.status(200).json({ ok: true, queued });
  }

  // ---- GET ?action=moderate : publish/reject via signed link, HTML result ----
  if (url.searchParams.get('action') === 'moderate') {
    const id = url.searchParams.get('id');
    const action = url.searchParams.get('mod_action');
    const sig = url.searchParams.get('sig');
    if (!id || !action || !sig) return response.status(400).send('Missing parameters.');
    if (!['publish', 'reject'].includes(action)) return response.status(400).send('Unknown action.');
    if (reviewSig(String(id), String(action)) !== String(sig)) return response.status(403).send('Invalid or expired signature.');
    if (!process.env.STRIPE_SECRET_KEY) return response.status(500).send('Not configured.');

    const result = await moderatePending(String(id), String(action));
    response.setHeader('Content-Type', 'text/html');
    if (!result.ok) {
      if (result.reason === 'missing') return response.status(404).send(page('Not found', 'This review is no longer pending (it may have been handled already).', '#8f5148'));
      return response.status(502).send(page('Error', 'Could not save. Please try again.', '#b3352a'));
    }
    if (action === 'publish') {
      console.log('review published', id);
      return response.status(200).send(page('Review published', 'It is now live on the UNIRAB homepage.', '#0d6a4b'));
    }
    return response.status(200).send(page('Review rejected', 'It will not appear on the site.', '#8f5148'));
  }

  // ---- GET: public list of published reviews ----
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  try {
    await checkMailbox().catch(() => null);
    const reviews = await listPublished();
    response.setHeader('Cache-Control', 'no-store');
    return response.status(200).json({
      reviews: reviews.map(({ id, rating, body, name, plan, ts }) => ({ id, rating, body, name, plan, ts }))
    });
  } catch (error) {
    console.error('reviews failed', error instanceof Error ? error.message : 'unknown');
    return response.status(200).json({ reviews: [] });
  }
}
