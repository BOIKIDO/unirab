import { moderatePending } from './_reviews-store.js';

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function reply(chatId, text) {
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
  }).catch(() => null);
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  // Telegram sends our secret back on every webhook call.
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected || request.headers['x-telegram-bot-api-secret-token'] !== expected) {
    return response.status(401).json({ error: 'Unauthorized' });
  }

  const message = request.body?.message;
  const chatId = message?.chat?.id;
  const text = String(message?.text || '').trim();
  // Only commands from the owner group are honored; everything else is ignored.
  if (!chatId || String(chatId) !== String(process.env.TELEGRAM_CHAT_ID) || !text) {
    return response.status(200).json({ ok: true });
  }

  // Accept both "approve <id>" and "/approve <id>" (Telegram privacy mode
  // only delivers slash-commands to bots in groups by default).
  const match = text.match(/^\/?(?:approve|publish|ok|yes)\s+([a-z0-9]+)\s*$/i)
    || text.match(/^\/?(?:reject|deny|no)\s+([a-z0-9]+)\s*$/i);
  if (!match) {
    if (/^\/?(approve|reject|publish|deny|pending)/i.test(text)) {
      await reply(chatId, 'Usage: <code>/approve &lt;review id&gt;</code> or <code>/reject &lt;review id&gt;</code>. The review id is shown at the bottom of every review alert.');
    }
    return response.status(200).json({ ok: true });
  }

  const action = /^\/?(?:approve|publish|ok|yes)/i.test(match[0]) ? 'publish' : 'reject';
  const id = match[1].toLowerCase();
  const result = await moderatePending(id, action);

  if (!result.ok) {
    await reply(chatId, `⚠️ Could not find a pending review with id <code>${esc(id)}</code>. It may have been handled already.`);
    return response.status(200).json({ ok: true });
  }
  if (action === 'publish') {
    const r = result.review;
    await reply(chatId, `✅ Review <b>${esc(r.name)}</b> (${'★'.repeat(r.rating)}) is now <b>live on the site</b>.`);
  } else {
    await reply(chatId, `🗑️ Review <b>${esc(id)}</b> rejected. It will not appear on the site.`);
  }
  return response.status(200).json({ ok: true });
}
