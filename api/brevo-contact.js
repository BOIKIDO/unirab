// Brevo contact sync for email sequences.
//   list=abandoned : form-filler who hasn't paid yet (drop-off recovery sequence)
//   list=active    : paying subscriber (engagement sequence)
// Custom attributes (BUSINESS/PLAN/SOURCE) are sent best-effort - they persist
// once the attributes exist in the Brevo dashboard; FIRSTNAME always persists.
const LISTS = { abandoned: 4, active: 5 };

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }
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
