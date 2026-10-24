const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY!

export interface PlacePrediction {
  place_id: string
  description: string
  structured_formatting: {
    main_text: string
    secondary_text: string
  }
}

export interface PlaceDetails {
  name: string
  formatted_address: string
  website?: string
  formatted_phone_number?: string
  rating?: number
  user_ratings_total?: number
  types: string[]
  address_components: Array<{
    long_name: string
    short_name: string
    types: string[]
  }>
  editorial_summary?: { overview: string }
  reviews?: Array<{ text: string; rating?: number }>
}

export async function searchPlaces(query: string): Promise<PlacePrediction[]> {
  const params = new URLSearchParams({
    input: query,
    types: 'establishment',
    key: API_KEY,
  })
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`
    )
    if (!res.ok) {
      console.error('[places] autocomplete HTTP error:', res.status, res.statusText)
      return []
    }
    const data = await res.json()
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('[places] autocomplete API error:', data.status, data.error_message ?? '')
    }
    return data.predictions ?? []
  } catch (err) {
    console.error('[places] autocomplete fetch error:', err)
    return []
  }
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'name,formatted_address,website,formatted_phone_number,rating,user_ratings_total,types,address_components,editorial_summary,reviews',
    key: API_KEY,
  })
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params}`
    )
    if (!res.ok) {
      console.error('[places] details HTTP error:', res.status, res.statusText)
      return null
    }
    const data = await res.json()
    if (data.status !== 'OK') {
      console.error('[places] details API error:', data.status, data.error_message ?? '')
      return null
    }
    return data.result ?? null
  } catch (err) {
    console.error('[places] details fetch error:', err)
    return null
  }
}

export function extractCityState(details: PlaceDetails): { city: string; state: string } {
  let city = ''
  let state = ''

  const cityFallback = ['locality', 'postal_town', 'sublocality_level_1', 'sublocality', 'administrative_area_level_2', 'administrative_area_level_3']
  const stateFallback = ['administrative_area_level_1']

  for (const comp of details.address_components) {
    if (!city && comp.types.some((t) => cityFallback.includes(t))) city = comp.long_name
    if (!state && comp.types.some((t) => stateFallback.includes(t))) state = comp.short_name
  }

  // If state is too long (likely a country name from fallback), use long_name
  if (state && state.length > 3) {
    for (const comp of details.address_components) {
      if (comp.types.includes('administrative_area_level_1')) {
        state = comp.short_name
        break
      }
    }
  }

  return { city, state }
}
