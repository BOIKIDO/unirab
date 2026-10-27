const CATEGORY_KEYWORDS: Record<string, string[]> = {
  roofing: [
    'asphalt shingle roof replacement', 'metal roof installation', 'roof leak repair',
    'flat roof replacement', 'tile roof restoration', 'roof storm damage repair',
    'gutter installation and replacement', 'skylight installation', 'roof ventilation installation',
    'commercial roof coating and sealing',
  ],
  hvac: [
    'air conditioning installation', 'furnace repair and replacement', 'heat pump installation',
    'ductless mini split installation', 'central AC repair', 'HVAC duct cleaning',
    'thermostat upgrade', 'commercial HVAC maintenance', 'indoor air quality testing',
    'emergency AC repair',
  ],
  plumbing: [
    'water heater installation and repair', 'tankless water heater upgrade', 'drain cleaning and unclogging',
    'sewer line repair and replacement', 'pipe leak detection and repair', 'toilet installation and repair',
    'garbage disposal replacement', 'sump pump installation', 'water filtration system install',
    'emergency plumbing repair',
  ],
  electrical: [
    'electrical panel upgrade', 'home rewiring', 'EV charger installation',
    'generator installation and repair', 'lighting fixture installation', 'ceiling fan installation',
    'outdoor electrical wiring', 'circuit breaker repair', 'whole home surge protection',
    'underground electrical service',
  ],
  painting: [
    'interior house painting', 'exterior house painting', 'cabinet painting and refinishing',
    'deck and fence staining', 'drywall repair and painting', 'wallpaper removal and painting',
    'commercial building painting', 'epoxy garage floor coating', 'popcorn ceiling removal',
    'pressure washing and exterior painting',
  ],
  remodeling: [
    'kitchen remodeling', 'bathroom renovation', 'basement finishing',
    'room addition and home expansion', 'custom home building', 'flooring installation',
    'deck and patio construction', 'window replacement and installation', 'door installation',
    'attic conversion',
  ],
  landscaping: [
    'lawn care and maintenance', 'landscape design and installation', 'tree removal and trimming',
    'irrigation system installation', 'sod installation', 'retaining wall construction',
    'outdoor lighting installation', 'mulching and garden bed maintenance', 'hardscape patio installation',
    'drainage solutions for yard',
  ],
  general_contractor: [
    'home renovation and remodeling', 'kitchen and bathroom upgrades', 'custom home building',
    'room addition and expansion', 'deck and porch construction', 'flooring and tile installation',
    'drywall installation and repair', 'window and door replacement', 'exterior siding installation',
    'foundation repair and waterproofing',
  ],
}

// Google Places types → keyword category map
const PLACES_TYPE_MAP: Record<string, string> = {
  roofing_contractor: 'roofing',
  plumber: 'plumbing',
  electrician: 'electrical',
  painter: 'painting',
  general_contractor: 'general_contractor',
  home_goods_store: 'general_contractor',
  moving_company: 'general_contractor',
  // HVAC not always a Places type — catch by name matching
}

// Business-name synonyms → keyword category. Used when Places types and
// website extraction are unavailable or fail.
const NAME_SYNONYMS: Array<[RegExp, string]> = [
  [/electric/i, 'electrical'],
  [/plumb/i, 'plumbing'],
  [/roof/i, 'roofing'],
  [/hvac|heating|air condition|cooling/i, 'hvac'],
  [/paint/i, 'painting'],
  [/landscap|lawn|garden/i, 'landscaping'],
  [/remodel|renovat|contract|construct|build/i, 'general_contractor'],
]

export function getKeywordsForTypes(types: string[], businessName: string): string[] {
  for (const t of types) {
    const category = PLACES_TYPE_MAP[t]
    if (category && CATEGORY_KEYWORDS[category]) return CATEGORY_KEYWORDS[category]
  }

  // Fallback: name-based heuristic
  const name = businessName.toLowerCase()
  for (const [pattern, category] of NAME_SYNONYMS) {
    if (pattern.test(name) && CATEGORY_KEYWORDS[category]) return CATEGORY_KEYWORDS[category]
  }
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (name.includes(category.replace('_', ' ')) || name.includes(category.split('_')[0])) {
      return keywords
    }
  }

  return CATEGORY_KEYWORDS.general_contractor
}

export function getPrimaryService(types: string[], businessName: string): string {
  const keywords = getKeywordsForTypes(types, businessName)
  return keywords[0] ?? 'home services'
}
