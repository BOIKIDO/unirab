export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getPlaceDetails, extractCityState } from '@/lib/places'
import { getKeywordsForTypes, getPrimaryService } from '@/lib/keywords'
import { queryGeminiJSON } from '@/lib/gemini'

function isValidPublicUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return false
    const host = parsed.hostname.toLowerCase()
    // Block private/reserved IPs and localhost
    if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(host)) return false
    if (host.match(/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|fc00:|fd00:|fe80:)/)) return false
    // Block cloud metadata endpoints
    if (host === '169.254.169.254') return false
    return true
  } catch { return false }
}

async function scrapeWebsite(url: string): Promise<string> {
  if (!isValidPublicUrl(url)) return ''

  const urls = [url]
  if (url.startsWith('http://')) urls.push(url.replace('http://', 'https://'))
  else if (url.startsWith('https://')) urls.push(url.replace('https://', 'http://'))

  // Also try common service pages
  const base = url.replace(/\/+$/, '')
  const servicePaths = ['/services', '/about', '/our-work', '/residential', '/commercial']
  for (const path of servicePaths) {
    urls.push(`${base}${path}`)
  }

  for (const u of urls.slice(0, 6)) { // max 6 attempts
    try {
      const res = await fetch(u, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
        signal: AbortSignal.timeout(6000),
        redirect: 'follow',
      })
      if (!res.ok) continue
      const html = await res.text()
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 8000)
      if (text.length > 300) return text
    } catch { /* try next URL */ }
  }

  // Last resort: try Google cached version
  try {
    const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`
    const res = await fetch(cacheUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const html = await res.text()
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 8000)
      if (text.length > 300) return text
    }
  } catch { /* cache miss */ }

  return ''
}

async function extractKeywords(params: {
  businessName: string
  websiteText: string
  googleDescription: string
  googleReviews: string
  googleTypes: string[]
  fallbackKeywords: string[]
}): Promise<{ keywords: string[]; primaryService: string }> {
  const { businessName, websiteText, googleDescription, googleReviews, googleTypes, fallbackKeywords } = params

  try {
    const context = [
      websiteText ? `Website content:\n${websiteText}` : '',
      googleDescription ? `Google Business description: ${googleDescription}` : '',
      googleReviews ? `Customer reviews mentioning services:\n${googleReviews}` : '',
      googleTypes.length ? `Google category tags: ${googleTypes.join(', ')}` : '',
    ].filter(Boolean).join('\n\n')

    const prompt = `You are analyzing a local home service business. Your job: extract the EXACT specific services they sell to homeowners.

RULES — violation means the output is useless:
1. NO generic categories. FORBIDDEN WORDS (never use): "contractor", "company", "service", "general", "construction", "home improvement", "handyman", "repair service", "maintenance service", "installation service". These are NOT services — they are business descriptions.
2. Every keyword must be a specific task a homeowner would type into Google. Format: "[specific action] + [specific thing]". Examples: "roof leak repair", "asphalt shingle replacement", "tankless water heater install", "kitchen cabinet refacing", "hardwood floor refinishing", "French drain installation".
3. Pull from actual data first: website text, reviews, Google description. If someone wrote "we replaced my 30-year-old cedar shake roof", the keyword is "cedar shake roof replacement".
4. If the website/reviews mention specific materials, brands, or techniques — USE THEM. "We specialize in James Hardie siding" → "James Hardie siding installation".
5. Minimum 10 keywords, maximum 12.

Business name: "${businessName}"
Google category tags: ${googleTypes.join(', ')}
${context || 'No website or review data available. Infer specific services from the business name and Google categories. For a roofing company, think: "asphalt shingle roof replacement", "flat roof repair", "metal roof installation", "roof leak detection", "gutter replacement", "skylight installation", "roof ventilation", "storm damage roof repair", "tile roof restoration", "commercial roof coating".'}

Return JSON only:
- "keywords": array of 10-12 ultra-specific services (2-5 word phrases)
- "primary_service": the #1 service this business sells (2-4 words)`

    const raw = await queryGeminiJSON(prompt + '\n\nRespond with JSON only.')
    let data: Record<string, unknown> = {}
    try {
      data = JSON.parse(raw)
    } catch {
      console.error('[lookup/details] Gemini returned non-JSON:', raw.slice(0, 200))
    }
    const keywords = Array.isArray(data.keywords) && data.keywords.length > 0
      ? (data.keywords as string[]).slice(0, 10)
      : fallbackKeywords.slice(0, 10)
    const primaryService = typeof data.primary_service === 'string' ? data.primary_service : keywords[0]
    console.error(`[lookup/details] Gemini keywords: ${keywords.length} (fallback: ${keywords === fallbackKeywords})`)
    return { keywords, primaryService }
  } catch (err) {
    console.error('[lookup/details] Gemini extraction failed:', err)
    return { keywords: fallbackKeywords, primaryService: fallbackKeywords[0] }
  }
}

export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get('place_id') ?? ''
  if (!placeId) {
    return NextResponse.json({ success: false, error: 'place_id required' }, { status: 400 })
  }

  try {
    const details = await getPlaceDetails(placeId)
    if (!details) {
      return NextResponse.json({ success: false, error: 'Place not found' }, { status: 404 })
    }

    const { city, state } = extractCityState(details)
    const fallbackKeywords = getKeywordsForTypes(details.types, details.name)
    const fallbackService = getPrimaryService(details.types, details.name)

    // Scrape website if available (may return empty for JS-rendered sites)
    const websiteText = details.website ? await scrapeWebsite(details.website) : ''

    // Build context from Google data
    const googleDescription = details.editorial_summary?.overview ?? ''

    // Mine reviews for service mentions — extract sentences with action verbs
    const serviceVerbs = /\b(install|replace|repair|fix|build|remodel|renovate|restore|clean|paint|seal|coat|inspect|upgrade|design|construct|pour|frame|wire|plumb|tile|drywall|finish|sand|stain|waterproof|insulate|excavat|grade|pave|demo)\w*\b/i
    const allReviewText = (details.reviews ?? []).map((r) => r.text).join('. ')
    const reviewSentences = allReviewText.split(/[.!?]+/).filter(s => s.trim().length > 10)
    const serviceSentences = reviewSentences.filter(s => serviceVerbs.test(s))
    const googleReviews = (serviceSentences.length >= 2 ? serviceSentences : reviewSentences)
      .join('. ')
      .slice(0, 2000)

    const extracted = await Promise.race([
      extractKeywords({
        businessName: details.name,
        websiteText,
        googleDescription,
        googleReviews,
        googleTypes: details.types,
        fallbackKeywords,
      }),
      new Promise<{ keywords: string[]; primaryService: string }>((resolve) =>
        setTimeout(() => resolve({ keywords: fallbackKeywords, primaryService: fallbackService }), 12000)
      ),
    ])
    const keywords = extracted.keywords
    const primaryService = extracted.primaryService

    return NextResponse.json({
      success: true,
      data: {
        name: details.name,
        address: details.formatted_address,
        website: details.website ?? null,
        phone: details.formatted_phone_number ?? null,
        city,
        state,
        keywords,
        primary_service: primaryService,
        has_website: !!details.website,
        place_id: placeId,
        google_rating: details.rating ?? null,
        google_review_count: details.user_ratings_total ?? null,
      },
    })
  } catch (err) {
    console.error('[lookup/details] error:', err)
    return NextResponse.json({ success: false, error: 'Failed to fetch details' }, { status: 500 })
  }
}
