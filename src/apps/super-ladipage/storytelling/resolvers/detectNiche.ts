// ─────────────────────────────────────────────────────────────────────
// Storytelling — detectNiche (FIX 2026-05-27, v2)
//
// Auto-detect NicheKey from product info (name + painPoints + benefits).
// Keyword matching across VI + MS + EN.
//
// v2 (2026-05-27): MAJOR keyword expansion after live test bugs:
//   - "Knee Support Booster" was mis-detecting as beauty-confidence
//     because /confidence/ matched "boost confidence to walk" in benefits
//   - Added: knee/gối/ankle/back/spine/elbow/đai/băng/brace/orthopedic to
//     health-functional
//   - Tightened beauty-confidence: removed loose /confidence/, now
//     requires COMPOUND PHRASES (body confidence / vóc dáng tự tin)
//   - Reordered: health-functional checked BEFORE beauty-confidence
//
// LOCKED: pure pattern matching. NO LLM call. Marketer can override
// later via UI selector (TODO P-NICHE-UI).
// ─────────────────────────────────────────────────────────────────────

import type { NicheKey } from '../types'

interface DetectInput {
  productName: string
  painPoints?: string
  benefits?: string
  category?: string
}

interface DetectResult {
  niche: NicheKey
  confidence: 'high' | 'medium' | 'low'
  matchedKeywords: string[]
}

// ─── Keyword maps per niche (VI + MS + EN) ─────────────────────────

const NICHE_KEYWORDS: Array<{ niche: NicheKey; keywords: RegExp[] }> = [
  {
    niche: 'mom-baby',
    keywords: [
      /\bbaby\b/i, /\bbé\b/i, /\bsơ sinh\b/i, /\btrẻ\b/i,
      /\bbayi\b/i, /\banak\b/i, /\bibu\b/i, /\bbunda\b/i, /\bsusu\b/i,
      /\bmama\b/i, /\bmom\b/i, /\bmother\b/i, /\bnewborn\b/i,
      /\bbỉm\b/i, /\bsữa\b/i, /\bbầu\b/i, /\bmang thai\b/i, /\bhamil\b/i, /\bpregnant\b/i,
    ],
  },
  {
    niche: 'haircare',
    keywords: [
      /\bhair\b/i, /\btóc\b/i, /\bhói\b/i, /\brụng tóc\b/i, /\bgội\b/i,
      /\brambut\b/i, /\bgugur\b/i, /\bbotak\b/i, /\bsyampu\b/i,
      /\bshampoo\b/i, /\bscalp\b/i, /\bbald\b/i, /\bdandruff\b/i, /\bgàu\b/i, /\bkelemumur\b/i,
    ],
  },
  {
    niche: 'health-functional',
    // EXPANDED v2 — orthopedic, joint, respiratory, digestive, metabolic
    keywords: [
      // Orthopedic / joint / brace / support (v2 — NEW)
      /\bknee\b/i, /\bgối\b/i, /\bđầu gối\b/i, /\bkneecap\b/i,
      /\bback\b/i, /\blưng\b/i, /\bspine\b/i, /\bcột sống\b/i, /\btulang belakang\b/i,
      /\bankle\b/i, /\bcổ chân\b/i, /\bpergelangan kaki\b/i,
      /\belbow\b/i, /\bkhuỷu tay\b/i, /\bshoulder\b/i, /\bvai\b/i, /\bbahu\b/i,
      /\bbrace\b/i, /\borthopedic\b/i, /\borthotic\b/i,
      /\bđai\b/i, /\bbăng\b/i, /\bnẹp\b/i,
      // Pain (v2 — NEW)
      /\bpain\b/i, /\bđau\b/i, /\bsakit\b/i, /\bnhức\b/i, /\bê ẩm\b/i,
      // Joint terminology
      /\bxương khớp\b/i, /\bkhớp\b/i, /\bsendi\b/i, /\bjoint\b/i, /\btulang\b/i,
      /\barthritis\b/i, /\bthấp khớp\b/i, /\bgout\b/i,
      // Nasal / sinus / respiratory
      /\bnasal\b/i, /\bsinus\b/i, /\bmũi\b/i, /\bnghẹt\b/i, /\bxoang\b/i,
      /\bhidung\b/i, /\bresdung\b/i, /\bsemburan\b/i, /\balahan\b/i,
      /\bhô hấp\b/i, /\bho\b/i, /\bdị ứng\b/i, /\bbatuk\b/i, /\bselsema\b/i,
      /\bcough\b/i, /\ballergi\b/i, /\ballergy\b/i, /\basthma\b/i, /\bhen suyễn\b/i,
      // Digestive
      /\bdạ dày\b/i, /\btiêu hóa\b/i, /\bperut\b/i, /\bdigest\b/i, /\bgastric\b/i,
      /\bbao tử\b/i, /\btrĩ\b/i, /\bhemorrhoid\b/i, /\bbuasir\b/i,
      // Metabolic / cardiovascular
      /\bhuyết áp\b/i, /\btiểu đường\b/i, /\bdiabetes\b/i, /\bdarah tinggi\b/i,
      /\bkencing manis\b/i, /\bkolesterol\b/i, /\bcholesterol\b/i, /\bmỡ máu\b/i,
      /\btim mạch\b/i, /\bjantung\b/i, /\bblood pressure\b/i,
      // Eye / vision
      /\bmắt\b/i, /\bmata\b/i, /\bvision\b/i, /\beye\b/i, /\bcataract\b/i, /\bđục thủy tinh\b/i,
    ],
  },
  {
    niche: 'supplement-wellness',
    keywords: [
      /\bvitamin\b/i, /\bsupplement\b/i, /\bomega\b/i, /\bkollagen\b/i, /\bkolagen\b/i,
      /\bcollagen\b/i, /\bglutathione\b/i, /\bprobiotic\b/i, /\benergy\b/i,
      /\bmệt\b/i, /\bfatigue\b/i, /\bsức bền\b/i, /\bstamina\b/i, /\btenaga\b/i, /\blesu\b/i,
      /\bwellness\b/i, /\bnutrition\b/i, /\bdinh dưỡng\b/i, /\bpemakanan\b/i,
      /\bimmune\b/i, /\bmiễn dịch\b/i, /\bimun\b/i, /\bantioxidant\b/i,
    ],
  },
  {
    niche: 'fitness-recovery',
    keywords: [
      /\bgym\b/i, /\bfitness\b/i, /\bmuscle\b/i, /\bcơ bắp\b/i, /\bworkout\b/i, /\botot\b/i,
      /\bweight loss\b/i, /\bgiảm cân\b/i, /\bkurus\b/i, /\bslim\b/i, /\bdiet\b/i, /\bbody fat\b/i,
      /\bcardio\b/i, /\bprotein\b/i, /\brecover\b/i, /\bpulih\b/i, /\bsenam\b/i,
    ],
  },
  {
    niche: 'relationship',
    keywords: [
      /\bmarriage\b/i, /\bhôn nhân\b/i,
      /\bsuami\b/i, /\bisteri\b/i, /\bvợ chồng\b/i, /\bsexual\b/i, /\bsinh lý\b/i,
      /\bkejantanan\b/i, /\bperkahwinan\b/i, /\blibido\b/i,
      /\berectile\b/i, /\bxuất tinh\b/i, /\bejaculation\b/i,
    ],
  },
  {
    niche: 'beauty-confidence',
    // TIGHTENED v2 — removed loose /confidence/ + /tự tin/ which falsely matched
    // "boost confidence to walk again" in knee support products. Now requires
    // COMPOUND PHRASES tied to body image / appearance.
    keywords: [
      /\bvóc dáng\b/i,
      /\bbody shape\b/i, /\bbody confidence\b/i, /\bself.?esteem\b/i,
      /\bbentuk badan\b/i, /\bkeyakinan diri\b/i, /\bposture\b/i,
      /\btẩy lông\b/i, /\bhair removal\b/i, /\bwax\b/i,
      /\bnách\b/i, /\bketiak\b/i, /\bdeodorant\b/i, /\bmùi cơ thể\b/i, /\bbau badan\b/i,
      /\bbreast\b/i, /\bngực\b/i, /\bpayudara\b/i, /\bbosom\b/i,
      /\bvòng eo\b/i, /\bbụng mỡ\b/i, /\bbelly fat\b/i,
    ],
  },
  {
    niche: 'skincare',
    // Last — strict to avoid eating other niches. Removed loose /skin/ which
    // would match "knee skin", and loose /face/ which was over-broad.
    keywords: [
      /\bskincare\b/i, /\bda mặt\b/i, /\bkem dưỡng\b/i, /\bface cream\b/i,
      /\bkulit muka\b/i, /\bjerawat\b/i, /\bacne\b/i, /\bmụn\b/i,
      /\bnám\b/i, /\btàn nhang\b/i, /\bpigmentation\b/i, /\bwhitening\b/i, /\bbleaching\b/i,
      /\banti.?aging\b/i, /\bchống lão hóa\b/i, /\bawet muda\b/i, /\bwrinkle\b/i, /\bnếp nhăn\b/i,
      /\bserum\b/i, /\bessence\b/i, /\btoner\b/i, /\bsunscreen\b/i, /\bkem chống nắng\b/i,
      /\bskin care\b/i, /\bskin treatment\b/i, /\bskin glow\b/i, /\bskin tone\b/i,
      /\bkulit cantik\b/i, /\bkulit putih\b/i, /\bkulit cerah\b/i,
    ],
  },
]

// ─── Detection logic ──────────────────────────────────────────────

export function detectNiche(input: DetectInput): DetectResult {
  // Combine ALL text signals (v2: include benefits)
  const corpus = [
    input.productName,
    input.painPoints,
    input.benefits,
    input.category,
  ]
    .filter(Boolean)
    .join(' \n ')

  if (!corpus.trim()) {
    return {
      niche: 'health-functional',
      confidence: 'low',
      matchedKeywords: [],
    }
  }

  const scores: Array<{ niche: NicheKey; hits: string[] }> = []

  for (const { niche, keywords } of NICHE_KEYWORDS) {
    const hits: string[] = []
    for (const re of keywords) {
      const match = corpus.match(re)
      if (match) hits.push(match[0])
    }
    if (hits.length > 0) {
      scores.push({ niche, hits })
    }
  }

  if (scores.length === 0) {
    return {
      niche: 'health-functional',
      confidence: 'low',
      matchedKeywords: [],
    }
  }

  // Highest-scoring niche wins. Ties go to earlier (more specific) niche.
  scores.sort((a, b) => b.hits.length - a.hits.length)
  const winner = scores[0]

  return {
    niche: winner.niche,
    confidence: winner.hits.length >= 2 ? 'high' : 'medium',
    matchedKeywords: winner.hits,
  }
}
