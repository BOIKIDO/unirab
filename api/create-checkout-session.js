const PLANS = Object.freeze({
  basic20: { monthly: 'price_1UPKoR0ArfCxocSQueNG7KkD', yearly: 'price_1UPQei0ArfCxocSQRa198deY' },
  basic40: { monthly: 'price_1UPKoS0ArfCxocSQt6SAifbq', yearly: 'price_1UPQej0ArfCxocSQb076lcgB' },
  growth100: { monthly: 'price_1UPKoT0ArfCxocSQHHZ6XrSd', yearly: 'price_1UPQek0ArfCxocSQvqhpxmZ7' },
  business250: { monthly: 'price_1UPKoU0ArfCxocSQgLlYKLkU', yearly: 'price_1UPQem0ArfCxocSQMG1V09eJ' }
});

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  const price = PLANS[request.body?.plan];
  if (!price) return response.status(400).json({ error: 'Choose a valid UNIRAB plan.' });
  const billing = request.body?.billing === 'year' ? 'yearly' : 'monthly';
  const priceId = price[billing];
  if (!process.env.STRIPE_SECRET_KEY) return response.status(500).json({ error: 'Checkout is not configured.' });


  // Keep the customer on the domain they started on (sessionStorage is per-origin).
  const host = String(request.headers.host || 'unirab.vercel.app').replace(/[^a-z0-9.-]/gi, '');
  const origin = `https://${host}`;

  // Carry the intake form on the session so webhooks and the thank-you page
  // can read it without depending on the customer's browser.
  const metaParams = new URLSearchParams();
  const form = request.body?.form;
  if (form && typeof form === 'object') {
    const fields = {
      businessName: 'business_name', website: 'website', primaryServices: 'services',
      country: 'country', address: 'address', phone: 'phone', serviceArea: 'service_area', email: 'email'
    };
    for (const [key, metaKey] of Object.entries(fields)) {
      const value = String(form[key] ?? '').trim().slice(0, 480);
      if (value) metaParams.append(`metadata[${metaKey}]`, value);
    }
  }
  const params = new URLSearchParams({
    ui_mode: 'embedded',
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    return_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    billing_address_collection: 'auto',
    allow_promotion_codes: 'true'
  });
  try {
    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: metaParams.size ? params.toString() + '&' + metaParams.toString() : params
    });
    const session = await stripeResponse.json();
    if (!stripeResponse.ok || !session.client_secret) {
      console.error('Stripe session error', session.error?.type || stripeResponse.status);
      return response.status(502).json({ error: 'Secure checkout is temporarily unavailable. Please try again.' });
    }
    response.setHeader('Cache-Control', 'no-store');
    return response.status(200).json({ clientSecret: session.client_secret });
  } catch (error) {
    console.error('Stripe request failed', error instanceof Error ? error.message : 'unknown');
    return response.status(502).json({ error: 'Secure checkout is temporarily unavailable. Please try again.' });
  }
}
