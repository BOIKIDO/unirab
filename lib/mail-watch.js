// Mailbox watchdog: polls support@unirab.com over IMAP, keyword-matches new
// emails (cancel / refund / complaint / angry / ... broad match) and alerts
// Telegram. Checkpoint (last seen UID) lives in the support customer's Stripe
// metadata, and a throttle keeps polls at most one per few minutes.
import { ImapFlow } from 'imapflow';

const KEYWORDS = [
  'cancel', 'cancellation', 'refund', 'money back', 'complain', 'complaint',
  'angry', 'furious', 'unhappy', 'disappointed', 'terrible', 'awful', 'worst',
  'scam', 'fraud', 'dispute', 'chargeback', 'charge back', 'attorney', 'lawyer',
  'legal action', 'sue ', 'sued', 'unacceptable', 'not working', 'broken',
  'stop charging', 'ban', 'useless', 'garbage', 'horrible'
];

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function getSupportCustomer() {
  const res = await fetch('https://api.stripe.com/v1/customers?email=support%40unirab.com&limit=1', {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
  });
  const body = await res.json();
  return res.ok ? body.data?.[0] || null : null;
}

async function telegram(text) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return;
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true })
  }).catch(() => null);
}

export async function checkMailbox({ force = false } = {}) {
  if (!process.env.MAILBOX_PASSWORD) return { skipped: 'no-credentials' };
  if (!process.env.STRIPE_SECRET_KEY) return { skipped: 'not-configured' };

  const customer = await getSupportCustomer();
  if (!customer) return { skipped: 'no-customer' };
  const meta = customer.metadata || {};

  // Throttle: at most one poll every 3 minutes unless forced (cron).
  const last = Number(meta.unirab_mail_last_poll || 0);
  if (!force && Date.now() - last < 3 * 60 * 1000) return { skipped: 'throttled' };

  let maxUid = Number(meta.unirab_mail_last_uid || 0);
  const alerts = [];
  let error = null;

  const client = new ImapFlow({
    host: process.env.MAILBOX_IMAP_HOST || 'imap.hostinger.com',
    port: 993,
    secure: true,
    auth: { user: process.env.MAILBOX_USER || 'support@unirab.com', pass: process.env.MAILBOX_PASSWORD },
    logger: false
  });

  try {
    await client.connect();
      const mailbox = await client.mailboxOpen('INBOX');
      // On first run, adopt the current max UID without alerting on old mail.
      if (!maxUid) {
        let highest = 0;
        for await (const msg of client.fetch({ all: true }, { uid: true })) highest = Math.max(highest, msg.uid);
        maxUid = highest;
      } else {
        for await (const msg of client.fetch({ uid: `${maxUid + 1}:*` }, { envelope: true, uid: true, bodyStructure: false, source: false })) {
          if (msg.uid <= maxUid) continue;
          maxUid = Math.max(maxUid, msg.uid);
          const senderName = msg.envelope?.from?.[0]?.name || '';
          const senderEmail = msg.envelope?.from?.[0]?.address || 'unknown';
          const from = senderName ? `${senderName} <${senderEmail}>` : senderEmail;
          const subject = msg.envelope?.subject || '(no subject)';
          // Broad match on subject + sender
          const haystack = `${subject} ${from}`.toLowerCase();
          const matched = KEYWORDS.filter((k) => haystack.includes(k));
          const entry = { uid: msg.uid, from, subject, matched, date: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : null };
          alerts.push(entry);
          if (matched.length) {
            await telegram([
              `<b>🚨 Support email needs attention</b>`,
              '━━━━━━━━━━━━━━━━━━━━',
              `📧 <b>From:</b> ${esc(senderName || senderEmail)}`,
              `✉️ <b>Sender email:</b> ${esc(senderEmail)}`,
              `<b>Subject:</b> ${esc(subject)}`,
              `🔎 <b>Matched:</b> ${esc(matched.join(', '))}`,
              `📅 <b>Received:</b> ${entry.date ? entry.date.slice(0, 16).replace('T', ' ') : 'just now'} UTC`
            ].join('\n'));
          }
        }
      }
    await client.logout();
  } catch (err) {
    error = err instanceof Error ? err.message : 'imap failed';
    try { client.close(); } catch {}
  }

  // Persist checkpoint + poll time.
  const params = new URLSearchParams({
    'metadata[unirab_mail_last_poll]': String(Date.now())
  });
  if (maxUid) params.append('metadata[unirab_mail_last_uid]', String(maxUid));
  await fetch(`https://api.stripe.com/v1/customers/${encodeURIComponent(customer.id)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  }).catch(() => null);

  return { ok: !error, error, newEmails: alerts.length, alerts };
}
