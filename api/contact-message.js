const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((ts) => now - ts < windowMs);
  hits.set(key, arr);
  if (arr.length >= max) return true;
  arr.push(now);
  return false;
}

// Brevo contact sync for email sequences (formerly api/brevo-contact.js —
// merged to stay under the Hobby plan's 12-function limit).
//   list=abandoned : form-filler who hasn't paid yet (drop-off recovery sequence)
//   list=active    : paying subscriber (engagement sequence)
// Custom attributes (BUSINESS/PLAN/SOURCE) are sent best-effort - they persist
// once the attributes exist in the Brevo dashboard; FIRSTNAME always persists.
const LISTS = { abandoned: 4, active: 5 };

async function syncContact(request, response) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return response.status(503).json({ error: 'Not configured.' });

  const email = String(request.body?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response.status(400).json({ error: 'Invalid email.' });
  const list = LISTS[request.body?.list] ? request.body.list : 'abandoned';
  const name = String(request.body?.name || '').trim().slice(0, 80);
  const business = String(request.body?.business || '').trim().slice(0, 120);
  const plan = String(request.body?.plan || '').trim().slice(0, 40);

  const attributes = { FIRSTNAME: name || business || email.split('@')[0] };
  if (business) attributes.BUSINESS = business;
  if (plan) attributes.PLAN = plan;
  if (request.body?.source) attributes.SOURCE = String(request.body.source).slice(0, 40);

  const listId = LISTS[list];
  const otherList = Object.values(LISTS).find((id) => id !== listId);
  const body = { email, attributes, listIds: [listId], updateEnabled: true };
  if (list === 'active' && otherList) body.unlinkListIds = [otherList];

  const res = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body)
  }).catch(() => null);

  if (!res) return response.status(502).json({ error: 'Could not sync contact.' });
  const result = await res.json().catch(() => ({}));
  if (!res.ok && result.code !== 'duplicate_parameter') {
    console.error('Brevo contact sync failed', res.status, JSON.stringify(result).slice(0, 200));
    return response.status(502).json({ error: 'Could not sync contact.' });
  }
  response.setHeader('Cache-Control', 'no-store');
  return response.status(200).json({ ok: true, list });
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  if (request.body?.list) return syncContact(request, response);
  if (!process.env.BREVO_API_KEY) return response.status(503).json({ error: 'Contact form is not configured yet.' });
  const ip = (request.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(`ip:${ip}`, 5, 3600000)) return response.status(429).json({ error: 'Too many messages. Please try again later.' });

  const name = String(request.body?.name || '').trim().slice(0, 80);
  const email = String(request.body?.email || '').trim().slice(0, 120);
  const phone = String(request.body?.phone || '').trim().slice(0, 40);
  const comment = String(request.body?.comment || '').trim().slice(0, 3000);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response.status(400).json({ error: 'Please enter a valid email address.' });
  if (!comment) return response.status(400).json({ error: 'Please write a message.' });
  if (limited(`body:${comment.toLowerCase()}`, 2, 86400000)) return response.status(429).json({ error: 'Duplicate message.' });

  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'support@unirab.com';
  const mail = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'UNIRAB Contact Form', email: senderEmail },
      to: [{ email: 'support@unirab.com' }],
      replyTo: { email, name: name || undefined },
      subject: request.body?.source === 'reseller' ? `Reseller application - ${name || email}` : `Website contact - ${name || email}`,
      htmlContent: `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#102a2a">
<h2 style="margin:0 0 16px;font-size:18px">New contact message</h2>
<table style="border-collapse:collapse;font-size:14px">
<tr><td style="padding:4px 14px 4px 0;color:#7b8986">Name</td><td>${esc(name) || '-'}</td></tr>
<tr><td style="padding:4px 14px 4px 0;color:#7b8986">Email</td><td>${esc(email)}</td></tr>
<tr><td style="padding:4px 14px 4px 0;color:#7b8986">Phone</td><td>${esc(phone) || '-'}</td></tr>
<tr><td style="padding:4px 14px 4px 0;color:#7b8986;vertical-align:top">Message</td><td>${esc(comment).replace(/\n/g, '<br>')}</td></tr>
</table></div>`
    })
  }).catch(() => null);
  if (!mail?.ok) {
    console.error('Contact email failed', mail ? mail.status : 'network', await mail?.text().catch(() => ''));
    return response.status(502).json({ error: 'Could not send your message. Please email support@unirab.com directly.' });
  }
  response.setHeader('Cache-Control', 'no-store');
  return response.status(200).json({ ok: true });
}
