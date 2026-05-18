// ─────────────────────────────────────────────────────────────────────
// Ingredient → benefit lookup. Used as a fallback when Gemini's section
// bullets don't already contain a clean "ingredient: benefit" pair, and
// as a deterministic-mapping reference so renders stay consistent across
// regenerations of the same product.
//
// Keys are lowercased and partially matched (substring match against the
// ingredient name). Values are SHORT (≤ ~24 chars) — they get rendered
// as tight 2-line callouts; long copy breaks the layout.
// ─────────────────────────────────────────────────────────────────────

const RAW_MAP: Record<string, string> = {
  // Wellness / superfoods
  'blueberry':     'Antioxidant Rich',
  'blueberries':   'Antioxidant Rich',
  'acai':          'Antioxidant Boost',
  'goji':          'Eye Health Support',
  'pomegranate':   'Cell Protection',

  // Vitamin C
  'lemon':         'Vitamin C Support',
  'orange':        'Vitamin C Boost',
  'kiwi':          'Vitamin C',
  'amla':          'Natural Vitamin C',
  'rosehip':       'Vitamin C + Collagen',

  // Greens
  'kale':          'Iron & Calcium',
  'spinach':       'Iron Rich',
  'chlorella':     'Detox Support',
  'spirulina':     'Plant Protein',
  'wheatgrass':    'Energizing Greens',
  'matcha':        'Calm Focus Energy',
  'moringa':       'Daily Multivitamin',
  'greens':        'Essential Vitamins',
  'super greens':  'Essential Vitamins',

  // Adaptogens / mushrooms
  'lion':          'Adaptogenic Focus',
  "lion's mane":   'Adaptogenic Focus',
  'lions mane':    'Adaptogenic Focus',
  'reishi':        'Stress Resilience',
  'cordyceps':     'Energy Endurance',
  'chaga':         'Immune Support',
  'ashwagandha':   'Stress Balance',
  'rhodiola':      'Mental Stamina',
  'ginseng':       'Natural Energy',

  // Digestion
  'ginger':        'Digestive Comfort',
  'turmeric':      'Anti-Inflammatory',
  'fennel':        'Bloating Relief',
  'peppermint':    'Soothes Digestion',
  'thyme':         'Digestive Support',
  'probiotic':     'Gut Microbiome',
  'lactobacillus': 'Gut Microbiome',
  'prebiotic':     'Feeds Good Bacteria',
  'fiber':         'Daily Fiber',
  'psyllium':      'Gentle Fiber',

  // Skin / hair
  'collagen':      'Skin Elasticity',
  'biotin':        'Hair & Nail Health',
  'hyaluronic':    'Skin Hydration',
  'niacinamide':   'Even Skin Tone',
  'vitamin e':     'Skin Renewal',
  'argan':         'Skin Nourishment',
  'jojoba':        'Skin Moisture',
  'retinol':       'Skin Renewal',

  // Healthy fats / energy
  'omega':         'Brain & Heart',
  'omega-3':       'Brain & Heart',
  'fish oil':      'Brain & Heart',
  'mct':           'Clean Energy',
  'coconut':       'Healthy Fats',
  'avocado':       'Healthy Fats',
  'flaxseed':      'Plant Omega-3',
  'chia':          'Fiber & Omega',

  // Stress / sleep
  'magnesium':     'Calm & Sleep',
  'melatonin':     'Restful Sleep',
  'l-theanine':    'Calm Alertness',
  'gaba':          'Relaxation Support',
  'chamomile':     'Calm & Sleep',
  'lavender':      'Calm Aroma',

  // Protein
  'whey':          'Lean Muscle',
  'pea protein':   'Plant Protein',
  'soy protein':   'Plant Protein',
  'protein':       'Daily Protein',

  // Daily essentials
  'vitamin d':     'Bone & Mood',
  'vitamin b12':   'Energy Metabolism',
  'iron':          'Energy & Focus',
  'zinc':          'Immune Defense',
  'calcium':       'Bone Strength',
  'multivitamin':  'Daily Essentials',
}

/** Look up the benefit phrase for a given ingredient. Returns null if no
 *  match is found — caller can fall back to the bullet's own copy. */
export function lookupBenefit(ingredient: string): string | null {
  const k = ingredient.toLowerCase().trim()
  if (!k) return null
  // Exact match
  if (RAW_MAP[k]) return RAW_MAP[k]
  // Longest substring match (eg "Organic Wild Blueberries" → "blueberries")
  let best: string | null = null
  let bestLen = 0
  for (const key of Object.keys(RAW_MAP)) {
    if (k.includes(key) && key.length > bestLen) {
      best = RAW_MAP[key]
      bestLen = key.length
    }
  }
  return best
}

/** Parse a single bullet like "Blueberries — Antioxidant Rich" or
 *  "Lemon: Vitamin C Support" into an IngredientItem. Returns null if
 *  the bullet doesn't look ingredient-shaped. */
export function parseIngredientBullet(
  bullet: string,
): { name: string; benefit: string } | null {
  if (!bullet) return null
  const trimmed = bullet.replace(/^[•\-*]\s*/, '').trim()

  // Try common separators in priority order
  const separators = [' — ', ' – ', ': ', ' - ', ' = ', ' → ', ' giúp ']
  for (const sep of separators) {
    const idx = trimmed.indexOf(sep)
    if (idx > 0 && idx < 40) {
      const name = trimmed.slice(0, idx).trim()
      const benefit = trimmed.slice(idx + sep.length).trim()
      if (name && benefit) return { name, benefit: benefit.slice(0, 30) }
    }
  }

  // Fallback: try first word as ingredient name, lookup map for benefit
  const firstWords = trimmed.split(/\s+/).slice(0, 3).join(' ')
  const benefit = lookupBenefit(firstWords) ?? lookupBenefit(trimmed)
  if (benefit) return { name: firstWords, benefit }
  return null
}
