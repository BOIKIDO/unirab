// Bridge between the UNIRAB lead-magnet page and the AI Visibility Grader.
// Resolves the business via Places (through the grader), starts a real scan,
// and returns the grader progress URL. Falls back to manual lead capture when
// the grader backend is unavailable.
export const config = { maxDuration: 60 };

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  const business = String(request.body?.business || '').trim().slice(0, 160);
  if (!business) return response.status(400).json({ error: 'Please enter your business name.' });

  const base = String(process.env.GRADER_URL || '').replace(/\/$/, '');
  if (!base) return response.status(200).json({ ok: false, fallback: true, reason: 'grader-offline' });

  try {
    // 1. Places autocomplete -> first match
    const qRes = await fetch(`${base}/api/lookup?q=${encodeURIComponent(business)}`, { signal: AbortSignal.timeout(10000) });
    if (!qRes.ok) throw new Error('lookup failed');
    const q = await qRes.json();
    const placeId = q?.data?.[0]?.place_id;
    if (!placeId) return response.status(200).json({ ok: false, fallback: true, reason: 'not-found' });

    // 2. Details + keyword inference
    const dRes = await fetch(`${base}/api/lookup/details?place_id=${encodeURIComponent(placeId)}`, { signal: AbortSignal.timeout(30000) });
    if (!dRes.ok) throw new Error('details failed');
    const d = await dRes.json();
    const card = d?.data;
    if (!card) return response.status(200).json({ ok: false, fallback: true, reason: 'details-missing' });

    // 3. Start the scan
    const startBody = {
      business_name: card.name || business,
      website_url: card.website || null,
      primary_service: card.primary_service || null,
      location_city: card.city || '',
      location_state: card.state || '',
      keywords: Array.isArray(card.keywords) ? card.keywords.slice(0, 10) : []
    };
    if (!startBody.location_city || !startBody.location_state || !startBody.keywords.length) {
      return response.status(200).json({ ok: false, fallback: true, reason: 'incomplete-placement' });
    }
    const sRes = await fetch(`${base}/api/research/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(startBody),
      signal: AbortSignal.timeout(15000)
    });
    const start = await sRes.json().catch(() => ({}));
    const jobId = start?.data?.jobId;
    if (!sRes.ok || !jobId) throw new Error('start failed');

    response.setHeader('Cache-Control', 'no-store');
    return response.status(200).json({
      ok: true,
      redirect: `${base}/research/${jobId}/progress`,
      business: startBody.business_name,
      city: startBody.location_city,
      state: startBody.location_state
    });
  } catch (error) {
    console.error('visibility-start failed:', error instanceof Error ? error.message : 'unknown');
    return response.status(200).json({ ok: false, fallback: true, reason: 'scan-unavailable' });
  }
}
