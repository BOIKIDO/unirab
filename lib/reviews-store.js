// Reviews are stored as chunked metadata keys on the merchant's own Stripe
// customer (support@unirab.com) - no database required.
//   pub_<n>_<chunk>  published reviews (newest first, max 8)
//   pend_<id>_<chunk> pending moderation queue (max 5, oldest evicted)
import { createHmac } from 'node:crypto';

const MAX_PUBLISHED = 8;
const MAX_PENDING = 5;
const CHUNK = 460;

export function reviewSig(id, action) {
  return createHmac('sha256', process.env.MAGIC_LINK_SECRET).update(`${id}.${action}`).digest('base64url').slice(0, 24);
}

function chunkStore(value) {
  const chunks = [];
  for (let i = 0; i < value.length; i += CHUNK) chunks.push(value.slice(i, i + CHUNK));
  return chunks;
}

function writeSets(customerId, metadata, sets) {
  const params = new URLSearchParams();
  // remove every existing key belonging to the sets we manage
  for (const key of Object.keys(metadata)) {
    if (/^(pub|pend)_/.test(key)) params.append(`metadata[${key}]`, '');
  }
  for (const [key, value] of Object.entries(sets)) {
    const chunks = chunkStore(value);
    chunks.forEach((chunk, i) => params.append(`metadata[${key}_${i}]`, chunk));
  }
  return fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(customerId)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });
}

function reassemble(metadata, prefix) {
  const grouped = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!key.startsWith(prefix + '_')) continue;
    const rest = key.slice(prefix.length + 1);
    const dot = rest.lastIndexOf('_');
    if (dot === -1) continue;
    const id = rest.slice(0, dot);
    const idx = Number(rest.slice(dot + 1));
    if (!Number.isInteger(idx)) continue;
    (grouped[id] = grouped[id] || [])[idx] = value;
  }
  const out = [];
  for (const [id, chunks] of Object.entries(grouped)) {
    try {
      const review = JSON.parse(chunks.join(''));
      out.push(review);
    } catch { /* skip corrupt chunk sets */ }
  }
  out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return out;
}

export async function savePending(review) {
  const customer = await getSupportCustomer();
  if (!customer) return false;
  const metadata = customer.metadata || {};
  const pending = reassemble(metadata, 'pend');
  pending.unshift(review);
  while (pending.length > MAX_PENDING) pending.pop();
  const sets = {};
  pending.forEach((r) => { sets[`pend_${r.id}`] = JSON.stringify(r); });
  const res = await writeSets(customer.id, metadata, sets);
  return res.ok;
}

export async function moderatePending(id, action) {
  const customer = await getSupportCustomer();
  if (!customer) return { ok: false };
  const metadata = customer.metadata || {};
  const pending = reassemble(metadata, 'pend');
  const review = pending.find((r) => r.id === id);
  if (!review) return { ok: false, reason: 'missing' };

  let published = reassemble(metadata, 'pub');
  if (action === 'publish') {
    published.unshift(review);
    while (published.length > MAX_PUBLISHED) published.pop();
  }
  const remaining = pending.filter((r) => r.id !== id);
  const sets = {};
  published.forEach((r) => { sets[`pub_${r.id}`] = JSON.stringify(r); });
  remaining.forEach((r) => { sets[`pend_${r.id}`] = JSON.stringify(r); });
  const res = await writeSets(customer.id, metadata, sets);
  return { ok: res.ok, review, published: action === 'publish' ? published : null };
}

export async function listPublished() {
  const customer = await getSupportCustomer();
  if (!customer) return [];
  return reassemble(customer.metadata || {}, 'pub');
}

async function getSupportCustomer() {
  const res = await fetch('https://api.stripe.com/v1/customers?email=support%40unirab.com&limit=1', {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
  });
  const body = await res.json();
  return res.ok ? body.data?.[0] || null : null;
}
