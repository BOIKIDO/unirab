import { createHmac, timingSafeEqual } from 'node:crypto';
import { processPaidSession } from '../lib/order-processing.js';
import { checkMailbox } from '../lib/mail-watch.js';

export const config = { api: { bodyParser: false } };

function verifyStripeSignature(rawBody, header, secret) {
  if (!header) return false;
  const parts = Object.fromEntries(String(header).split(',').map((kv) => kv.split('=')));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return response.status(500).json({ error: 'Webhook not configured.' });

  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString('utf8');

  if (!verifyStripeSignature(rawBody, request.headers['stripe-signature'], secret)) {
    return response.status(400).json({ error: 'Invalid signature.' });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return response.status(400).json({ error: 'Invalid payload.' });
  }

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data?.object;
    if (session?.object === 'checkout.session') {
      const result = await processPaidSession({ ...session, line_items: session.line_items });
      console.log('webhook processed', session.id, JSON.stringify(result));
    }
  }
  await checkMailbox().catch(() => null);
  return response.status(200).json({ received: true });
}
