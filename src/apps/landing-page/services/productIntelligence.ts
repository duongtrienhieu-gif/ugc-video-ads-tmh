// ─────────────────────────────────────────────────────────────────────────
// Landing-page PRODUCT INTELLIGENCE ENGINE (Phase 2)
//
// Detects the product's WELLNESS NICHE from its name + claim + audience
// keywords, then returns a `ProductIntelligence` bundle that downstream
// form modules inject into the Gemini userPrompt as an "overlay" — Gemini
// uses these niche-specific scenes / emotions / transformations instead
// of the static generic spec.
//
// Why: previously a JOINT-PAIN gel was getting PAIN section scenes about
// office burnout / sleepless nights / dining-table fatigue (the generic
// hardcoded set in SYSTEM_PROMPT). Result: prompts completely off-niche.
//
// This module is PURE — no IO, no fetches. Just keyword matching + a
// per-niche taxonomy. Safe to call from every form's userPrompt builder.
// ─────────────────────────────────────────────────────────────────────────

import type { Product } from '../../../stores/types'
import type { LandingLanguage } from '../types'

/** Canonical wellness niches we serve in the Malaysian COD market. */
export type ProductNiche =
  | 'joint-pain'        // gel xương khớp / dầu giảm đau / kem bóp
  | 'digestive-gut'     // probiotic / men vi sinh / digestion
  | 'skincare'          // serum / kem / acne / whitening / anti-aging
  | 'weight-loss'       // slimming / fat burner / detox
  | 'hair-care'         // hair loss / scalp / hair growth
  | 'vision'            // eye health / eye drops / vision support
  | 'cardio'            // blood pressure / heart / cholesterol
  | 'diabetes'          // blood sugar / glucose control
  | 'women-health'      // menopause / menstrual / breast / feminine
  | 'men-vitality'      // libido / prostate / male energy
  | 'immunity-general'  // multivitamin / immune booster (fallback supplement)
  | 'sleep-stress'      // insomnia / anxiety / burnout
  | 'dental-oral'       // teeth / gums / breath
  | 'unknown'           // could not classify

export interface ProductIntelligence {
  niche: ProductNiche
  /** Free-form sub-niche hint shown to Gemini (eg "gel bôi xương khớp"). */
  subNicheLabel: string
  /** Demographic target — Gemini uses for hero / lifestyle / before-after. */
  targetAudience: {
    primary: string         // eg "Malaysian middle-aged men/women, 45-65, parents/grandparents"
    ageRange: string        // eg "45-65"
    genderHint: 'female' | 'male' | 'mixed'
  }
  /** Niche-specific pain points — 4-6 concrete scenes Gemini can pick from. */
  painPoints: string[]
  /** Niche-specific everyday scenarios — used by pain / lifestyle sections. */
  scenarios: string[]
  /** Emotional state mapping: BEFORE → AFTER for transformation sections. */
  emotionalState: { before: string; after: string }
  /** Believable transformation outcome — used by before/after + benefits. */
  transformationOutcome: string
  /** Social-proof style — what kind of reviewer feels authentic for this niche. */
  socialProofStyle: string
  /** Expert authority style — what kind of specialist fits. */
  expertStyle: string
  /** Urgency triggers that sound credible for this niche. */
  urgencyTriggers: string[]
  /** Cultural context lines specific to Malaysia + the niche. */
  culturalContext: string[]
  /** Forbidden scenes — explicit bans on the generic off-niche scenes that
   *  used to leak (eg "no office-burnout shots for a joint-pain product"). */
  forbiddenScenes: string[]
}

// ─────────────────────────────────────────────────────────────────────────
// Keyword library — case-insensitive substring matching against
// (productName + productClaim + targetAudience + nicheHint), in priority
// order. First match wins.
// ─────────────────────────────────────────────────────────────────────────

interface NicheRule {
  niche: ProductNiche
  /** Keywords (English + Vietnamese + Malay) that signal this niche. */
  keywords: string[]
}

const NICHE_RULES: NicheRule[] = [
  // Joint / bone / orthopedic — high COD volume in MY market
  { niche: 'joint-pain', keywords: [
    'joint', 'bone', 'cartilage', 'arthritis', 'rheumatism', 'gout', 'lumbago',
    'xương', 'khớp', 'thoái hóa', 'đau lưng', 'gối', 'cột sống',
    'sendi', 'tulang', 'sakit lutut', 'sakit pinggang', 'sakit belakang',
    'glucosamine', 'chondroitin', 'collagen tulang', 'cốt', 'gel xương',
    'analgesic', 'pain relief gel', 'topical pain', 'rub',
  ]},
  // Digestive / gut / probiotic
  { niche: 'digestive-gut', keywords: [
    'probiotic', 'gut', 'digestive', 'digestion', 'bloat', 'constipation', 'ibs', 'colon',
    'tiêu hóa', 'đường ruột', 'táo bón', 'đầy hơi', 'men vi sinh',
    'usus', 'perut', 'pencernaan', 'sembelit', 'kembung',
    'lactobacillus', 'bifidobacterium', 'enzyme', 'fiber',
  ]},
  // Skincare
  { niche: 'skincare', keywords: [
    'skincare', 'skin', 'acne', 'whitening', 'serum', 'cream', 'wrinkle', 'anti-aging', 'glow',
    'da', 'mụn', 'trắng da', 'lão hóa', 'serum', 'kem dưỡng', 'sạm', 'nám',
    'kulit', 'jerawat', 'pencerah', 'penuaan', 'kerutan', 'cerah',
    'retinol', 'niacinamide', 'hyaluronic', 'vitamin c', 'collagen kulit',
  ]},
  // Weight loss
  { niche: 'weight-loss', keywords: [
    'weight loss', 'slimming', 'fat burn', 'detox', 'diet', 'thin', 'flatten',
    'giảm cân', 'giảm mỡ', 'giảm béo', 'thon gọn',
    'kurus', 'turun berat', 'bakar lemak', 'pelangsing', 'detoks',
    'l-carnitine', 'green tea extract', 'cla',
  ]},
  // Hair care
  { niche: 'hair-care', keywords: [
    'hair', 'scalp', 'hair loss', 'hair growth', 'baldness', 'dandruff',
    'tóc', 'rụng tóc', 'mọc tóc', 'hói', 'gàu',
    'rambut', 'gugur', 'tumbuh rambut', 'kelemumur', 'botak',
    'biotin', 'minoxidil',
  ]},
  // Vision
  { niche: 'vision', keywords: [
    'eye', 'vision', 'cataract', 'macular', 'dry eye',
    'mắt', 'thị lực', 'cận thị', 'đục thủy tinh thể',
    'mata', 'penglihatan', 'rabun', 'katarak',
    'lutein', 'zeaxanthin', 'bilberry',
  ]},
  // Cardio / blood pressure
  { niche: 'cardio', keywords: [
    'heart', 'cardio', 'blood pressure', 'hypertension', 'cholesterol', 'stroke',
    'tim', 'huyết áp', 'mỡ máu', 'đột quỵ', 'tim mạch',
    'jantung', 'darah tinggi', 'tekanan darah', 'kolesterol',
    'coq10', 'omega 3', 'nattokinase', 'red yeast',
  ]},
  // Diabetes / blood sugar
  { niche: 'diabetes', keywords: [
    'diabetes', 'blood sugar', 'glucose', 'insulin', 'glycemic',
    'tiểu đường', 'đường huyết', 'đái tháo đường',
    'kencing manis', 'diabetes', 'gula darah',
    'chromium', 'berberine', 'cinnamon',
  ]},
  // Women health
  { niche: 'women-health', keywords: [
    'menopause', 'menstrual', 'feminine', 'breast', 'fertility', 'pms', 'period',
    'kinh nguyệt', 'mãn kinh', 'ngực', 'phụ nữ', 'sinh sản',
    'haid', 'wanita', 'payudara', 'menopaus',
    'evening primrose', 'soy isoflavone', 'red clover',
  ]},
  // Men vitality
  { niche: 'men-vitality', keywords: [
    'libido', 'prostate', 'male enhancement', 'testosterone', 'sperm', 'sexual',
    'sinh lý nam', 'tiền liệt', 'cương dương', 'tinh trùng',
    'lelaki', 'tenaga lelaki', 'prostat', 'tongkat ali',
    'tongkat ali', 'maca', 'ginseng panax',
  ]},
  // Dental
  { niche: 'dental-oral', keywords: [
    'teeth', 'gum', 'oral', 'dental', 'breath', 'tartar', 'plaque', 'whitening teeth',
    'răng', 'lợi', 'nướu', 'hơi thở',
    'gigi', 'gusi', 'nafas',
  ]},
  // Sleep / stress
  { niche: 'sleep-stress', keywords: [
    'sleep', 'insomnia', 'stress', 'anxiety', 'burnout', 'relax', 'calm',
    'mất ngủ', 'mất ngủ', 'stress', 'lo âu', 'thư giãn',
    'tidur', 'insomnia', 'tekanan', 'risau', 'tenang',
    'melatonin', 'ashwagandha', 'gaba', 'l-theanine',
  ]},
  // Immunity (last — fallback for generic vitamins)
  { niche: 'immunity-general', keywords: [
    'immune', 'immunity', 'multivitamin', 'vitamin c', 'zinc', 'wellness', 'energy',
    'miễn dịch', 'sức đề kháng', 'đa vitamin', 'kẽm',
    'imuniti', 'vitamin', 'zink', 'tenaga',
  ]},
]

/** Match score: count of keyword hits inside `haystack`. */
function matchScore(haystack: string, rule: NicheRule): number {
  let score = 0
  for (const kw of rule.keywords) {
    if (haystack.includes(kw)) score += 1
  }
  return score
}

/** Decide niche by best keyword match. Returns 'unknown' if no rule scores. */
export function detectNiche(input: {
  productName?: string
  productClaim?: string
  targetAudience?: string
  nicheHint?: string
}): ProductNiche {
  const haystack = [
    input.productName, input.productClaim, input.targetAudience, input.nicheHint,
  ].filter(Boolean).join(' ').toLowerCase()
  if (!haystack) return 'unknown'

  let best: { niche: ProductNiche; score: number } | null = null
  for (const rule of NICHE_RULES) {
    const score = matchScore(haystack, rule)
    if (score === 0) continue
    if (!best || score > best.score) best = { niche: rule.niche, score }
  }
  return best?.niche ?? 'unknown'
}

// ─────────────────────────────────────────────────────────────────────────
// Per-niche intelligence catalog.
//
// All text fields are in ENGLISH because they're embedded inside imagePrompt
// bodies (which Gemini renders as image-generation prompts in English). The
// copy / headlines / bullets stay in the output language — only the
// scenario / pain descriptions live in English.
// ─────────────────────────────────────────────────────────────────────────

type NichePayload = Omit<ProductIntelligence, 'niche' | 'subNicheLabel'>

const CATALOG: Record<ProductNiche, NichePayload> = {
  'joint-pain': {
    targetAudience: {
      primary: 'Malaysian middle-aged & elderly adults 45-70 (parents / grandparents), labourers / homemakers, occasionally young athletes with sports injuries',
      ageRange: '45-70',
      genderHint: 'mixed',
    },
    painPoints: [
      'sharp knee pain when standing up from a chair',
      'lower-back stiffness when bending over to pick up grandchildren / groceries',
      'difficulty climbing stairs — has to grip the railing tightly',
      'aching joints when waking up in the morning, takes 10+ minutes to loosen',
      'unable to squat or kneel during prayer (solat) without grimacing',
      'limited mobility — can no longer walk to the market or play with grandchildren',
    ],
    scenarios: [
      'elderly Malaysian holding their lower back while struggling to stand up from the sofa',
      'middle-aged uncle clutching his knee mid-step on the stairs, grimacing',
      'grandmother sitting on the prayer mat unable to bow comfortably, hand pressed on knee',
      'older man sitting on the edge of the bed, both hands rubbing aching knees in dim morning light',
      'auntie at the wet market wincing as she lifts a grocery bag, free hand on lower back',
    ],
    emotionalState: {
      before: 'frustrated, defeated, withdrawn — visibly limited by pain, hesitant to move',
      after: 'visibly relieved, smiling, moving with ease — can walk / kneel / lift again',
    },
    transformationOutcome:
      'AFTER state: visibly easier movement — same person now able to stand up smoothly, climb stairs without grabbing the rail, perform full sujud during prayer, walk to market with grandchildren. The body posture is upright, expression is relieved, hands no longer clutching the painful joint.',
    socialProofStyle: 'older Malaysian (50-70) testimonials — uncles & aunties, parents / grandparents, NOT young UGC influencers. Photos taken at home with everyday clothing.',
    expertStyle: 'orthopedic / rehab specialist, traditional medicine practitioner (sinseh / herbalist), pharmacist — clinical white-coat aesthetic in a clinic setting',
    urgencyTriggers: [
      '"Setiap pagi semakin teruk" / "Each morning gets worse"',
      '"Akan hilang mobiliti jika tidak ditangani"',
      '"Mak/ayah anda akan terima kasih" — family-care framing',
    ],
    culturalContext: [
      'Solat (Islamic prayer) — pain during sujud/ruku is a culturally specific trigger',
      'Caring for elderly parents is a strong filial-piety driver in MY market',
      'Wet-market visits + grocery carrying are everyday activities affected by joint pain',
    ],
    forbiddenScenes: [
      'office worker burnout / laptop fatigue — NOT joint pain niche',
      'sleepless young adult on phone at night — NOT joint pain niche',
      'stressed mother dining-table headache — NOT joint pain niche',
      'office desk + paperwork scene — wrong audience',
      'bathroom-bloated-belly gesture — wrong niche (that\'s digestive)',
    ],
  },

  'digestive-gut': {
    targetAudience: {
      primary: 'Malaysian adults 25-55 with chronic bloating / IBS / constipation — mix of office workers, mothers, foodies',
      ageRange: '25-55',
      genderHint: 'mixed',
    },
    painPoints: [
      'bloating after every meal — uncomfortable tight waistband',
      'days of constipation — straining unsuccessfully on the toilet',
      'embarrassing stomach gurgling during meetings / social occasions',
      'bloated belly visible under shirt — embarrassed in mirror',
      'inconsistent bowel movement — anxiety about every meal',
    ],
    scenarios: [
      'Malaysian person standing in front of bathroom mirror, lifting shirt slightly to reveal bloated belly with hand pressed on stomach, uncomfortable expression',
      'office worker discreetly clutching stomach under the desk during a meeting, faint pained smile',
      'Malaysian mother turning away from a delicious meal at home, hand on stomach, looking embarrassed',
      'person sitting hunched on the sofa with hand on abdomen, can\'t focus on phone',
      'Malaysian eating durian / spicy food then immediately rubbing stomach',
    ],
    emotionalState: {
      before: 'uncomfortable, anxious, self-conscious — hides bloated belly, avoids social meals',
      after: 'relieved, light, comfortable — flatter stomach, enjoys meals freely',
    },
    transformationOutcome:
      'AFTER state: visibly flatter stomach, relaxed posture, smiling at the dining table, eating normally, no hand on stomach. Energy returned. Confidence back when wearing tighter clothing.',
    socialProofStyle: 'Malaysian young adults & mothers — relatable everyday people who eat local food (nasi lemak / mamak / durian). UGC selfie style with bathroom mirror or kitchen background.',
    expertStyle: 'gastroenterologist / dietitian / nutritionist — clinical white coat, nutrition consultation room with vegetables and gut-microbiome diagram on wall',
    urgencyTriggers: [
      '"Setiap kali makan, perut kembung" / "Each meal leaves you bloated"',
      '"Risiko IBS jangka panjang"',
      '"Tak boleh nikmati makanan kegemaran"',
    ],
    culturalContext: [
      'Nasi lemak / mamak / durian — heavy local food culture is a daily trigger',
      'Ramadan fasting / iftar gluttony affects digestion patterns',
      'Open-plan kampung living means embarrassment around digestion is real',
    ],
    forbiddenScenes: [
      'joint pain / knee scenes — NOT digestive niche',
      'scenes of elderly clutching back — wrong age + wrong body part',
      'office burnout fatigue scenes — too generic',
    ],
  },

  'skincare': {
    targetAudience: {
      primary: 'Malaysian women 18-45 — students, young professionals, mothers concerned about acne / dark spots / aging skin',
      ageRange: '18-45',
      genderHint: 'female',
    },
    painPoints: [
      'sudden acne breakout right before an important event — frantic mirror inspection',
      'dark spots / pigmentation under harsh bathroom lighting — close-up on face',
      'fine lines forming around eyes / mouth — woman pulling skin gently in mirror',
      'dull tired skin — comparing to old photo of herself, sighing',
      'uneven skin tone visible under makeup — frustrated touch-up',
    ],
    scenarios: [
      'young Malaysian woman in bathroom mirror, leaning close, examining a fresh pimple with frustrated expression',
      'Malaysian woman applying concealer trying to hide pigmentation, soft natural daylight',
      'woman holding an old photo of herself smiling with clear skin, expression bittersweet',
      'dressing-table close-up — fingers gently checking fine lines at the eye corner',
      'woman frowning at her reflection in dim light, light-spot uneven on cheeks',
    ],
    emotionalState: {
      before: 'insecure, self-conscious — avoids close-up photos, applies thick concealer',
      after: 'confident, glowing — bare-faced selfie, natural light, genuine smile',
    },
    transformationOutcome:
      'AFTER state: visibly clearer skin, even tone, natural glow under daylight. Bare-faced selfie posture, confident eye contact with camera, genuine smile. Lifestyle shift: less makeup needed, willing to go out without foundation.',
    socialProofStyle: 'young Malaysian women UGC — bathroom selfies, dressing-table moments, before/after pairs with same person same lighting',
    expertStyle: 'dermatologist / aesthetic doctor — clean clinical setting with skin-analysis tools, treatment chair visible',
    urgencyTriggers: [
      '"Sebelum kulit bertambah teruk"',
      '"Stok terhad — hanya minggu ini"',
      '"Sebelum acara penting"',
    ],
    culturalContext: [
      'MY humidity + sun = pigmentation is a top concern',
      'Bridal preparation / hari raya / family photo events drive urgency',
      'Hijab-wearing women experience specific skin issues around the hairline',
    ],
    forbiddenScenes: [
      'joint pain scenes — wrong niche',
      'elderly demographic — skincare is mostly 18-45',
      'office burnout — too generic',
      'digestive bloating — wrong body part',
    ],
  },

  'weight-loss': {
    targetAudience: {
      primary: 'Malaysian adults 25-55 — post-pregnancy mothers, busy office workers, stress-eaters concerned about belly fat',
      ageRange: '25-55',
      genderHint: 'mixed',
    },
    painPoints: [
      'jeans no longer fit — sitting on the bed defeated holding the waistband',
      'visible belly fat under shirt — uncomfortable mirror-side view',
      'tried every diet — fridge full of failed slimming products',
      'avoiding social photos — always hiding behind others or the camera angle',
      'breathlessness climbing one flight of stairs',
    ],
    scenarios: [
      'Malaysian person sitting on the bed in dim bedroom light, holding old jeans they can no longer button',
      'side-profile mirror shot in pajamas — hand lifting shirt to reveal belly, sad expression',
      'kitchen scene with healthy salad untouched on the counter — person looking at it tired',
      'closet door open showing tight clothes — person rubbing the back of their neck, sighing',
      'side-on photo at a family gathering — person stepping behind a relative to hide',
    ],
    emotionalState: {
      before: 'discouraged, self-conscious — hides body, avoids photos, withdrawn',
      after: 'energetic, confident — visibly slimmer waist, wearing the old jeans, smiling in selfies',
    },
    transformationOutcome:
      'AFTER state: visibly slimmer waist + flatter belly, same person now fitting old jeans comfortably, posture confident upright, taking a full-body selfie at a family event, no hand-hiding gesture.',
    socialProofStyle: 'Malaysian mothers + young office workers UGC — bathroom scale photos, jean-fitting moments, family gathering full-body shots',
    expertStyle: 'nutritionist / personal trainer — gym setting OR nutrition lab with food / supplement on table',
    urgencyTriggers: [
      '"Sebelum hari raya / kenduri"',
      '"Setiap minggu, badan semakin besar"',
      '"Kos kesihatan jangka panjang"',
    ],
    culturalContext: [
      'Hari raya / kenduri = food-heavy social events trigger weight anxiety',
      'Post-pregnancy weight is a major concern for MY mothers',
      'Hijab-wearing women have specific concerns about visible body shape under modest clothing',
    ],
    forbiddenScenes: [
      'joint pain / knee scenes — wrong niche',
      'skincare close-ups — wrong body focus',
      'elderly demographic — wrong age range',
    ],
  },

  'hair-care': {
    targetAudience: {
      primary: 'Malaysian adults 28-55 — men with thinning crown, women with post-pregnancy hair loss, hijabi women noticing scalp issues',
      ageRange: '28-55',
      genderHint: 'mixed',
    },
    painPoints: [
      'clumps of hair in the shower drain after washing',
      'visible scalp through thinning hair — top-down phone selfie',
      'receding hairline visible in mirror — hand brushing back hair',
      'noticeable strands on pillow / clothing every morning',
      'avoids photos showing head-on / overhead angles',
    ],
    scenarios: [
      'Malaysian person in bathroom, hand holding a clump of fallen hair from the shower drain, dismayed',
      'top-down mirror selfie revealing thinning crown — worried expression',
      'man examining receding hairline in dim mirror, fingers brushing back the temples',
      'pillow with visible loose hair strands in morning light — hand reaching to pick them up',
      'hijab being removed reveals patchy scalp — woman looking down sadly',
    ],
    emotionalState: {
      before: 'insecure, self-conscious — avoids overhead angles, wears caps / hijab to hide',
      after: 'visibly thicker fuller hair — confident overhead photo, no hat-covering, smiling',
    },
    transformationOutcome:
      'AFTER state: visibly fuller hair density, no visible scalp, confident overhead selfie pose, hair worn loose / styled without anxiety. Same person same lighting same angle.',
    socialProofStyle: 'Malaysian men & women UGC — bathroom photos, top-down crown shots, before/after pairs at same angle',
    expertStyle: 'trichologist / dermatologist — scalp analysis tool, hair-growth diagram on wall',
    urgencyTriggers: [
      '"Sebelum semakin teruk"',
      '"Setiap hari, rambut gugur lebih banyak"',
    ],
    culturalContext: [
      'Hijabi women have specific scalp concerns under constant fabric',
      'Wedding photos / public events trigger hair anxiety',
    ],
    forbiddenScenes: [
      'unrelated body parts — joint / belly / face acne',
      'office burnout — not the trigger',
    ],
  },

  'vision': {
    targetAudience: {
      primary: 'Malaysian adults 40-70 — office workers with screen fatigue, elderly with deteriorating vision / cataract concern',
      ageRange: '40-70',
      genderHint: 'mixed',
    },
    painPoints: [
      'blurred vision when reading the phone — pinching to zoom constantly',
      'tired sore eyes after a day of computer work — rubbing eyes',
      'difficulty reading street signs / restaurant menus from a distance',
      'eye strain headache by evening — pressing temples',
      'fear of losing independence due to vision loss',
    ],
    scenarios: [
      'middle-aged Malaysian holding phone at arm\'s length, squinting to read small text',
      'office worker rubbing closed eyes with both hands, computer glow on face',
      'elderly person trying to read a newspaper at the dining table, glasses pushed up onto forehead',
      'person tilting head back to look through reading glasses at a restaurant menu',
      'soft moment of dim eye fatigue — eyes closed, fingers pressed on the temple',
    ],
    emotionalState: {
      before: 'frustrated, anxious about progressive loss — relies on glasses, avoids fine print',
      after: 'clear-eyed, confident — reads phone / book without squinting, lifestyle restored',
    },
    transformationOutcome:
      'AFTER state: comfortable reading at normal distance, no squinting, no glasses pushed up, expression relaxed, full lifestyle activities restored.',
    socialProofStyle: 'middle-aged + elderly Malaysian testimonials — reading newspaper, watching grandchildren, driving comfortably',
    expertStyle: 'ophthalmologist / optometrist — clinic with eye-exam chair and vision-chart wall',
    urgencyTriggers: [
      '"Mata semakin kabur setiap minggu"',
      '"Risiko kehilangan kebebasan"',
    ],
    culturalContext: [
      'MY elderly often live with extended family — vision loss = dependency',
    ],
    forbiddenScenes: [
      'joint pain knee scenes — wrong body part',
      'skincare face close-ups — wrong focus (this is about eyes specifically)',
    ],
  },

  'cardio': {
    targetAudience: {
      primary: 'Malaysian adults 40-70 with hypertension / cholesterol concerns — middle-aged + elderly, often family-history driven',
      ageRange: '40-70',
      genderHint: 'mixed',
    },
    painPoints: [
      'checking blood pressure monitor at home with worried face — high reading',
      'chest tightness climbing stairs — pausing on the landing, hand on chest',
      'family doctor visit anxiety — clutching prescription bag',
      'avoiding favourite food (salty / fatty) — withdrawn at the table',
      'fear of stroke seeing family / friends suffer one',
    ],
    scenarios: [
      'middle-aged Malaysian sitting at the dining table looking at home blood-pressure cuff reading, worried',
      'person pausing on stairs landing, free hand on chest, breathing heavily',
      'doctor consultation room — patient receiving prescription with serious expression',
      'family member visiting their elderly parent in hospital — emotional driver',
      'kitchen scene with high-sodium food being pushed away',
    ],
    emotionalState: {
      before: 'anxious, fearful — constant BP monitoring, dietary restrictions, withdrawn',
      after: 'calm, healthy — normal BP reading, active lifestyle, eating freely',
    },
    transformationOutcome:
      'AFTER state: normal BP monitor reading, person smiling holding the device, returning to active lifestyle (walking / playing with family), no chest-clutching gesture.',
    socialProofStyle: 'middle-aged + elderly Malaysian — family-photo testimonials, dining-table monitoring scenes',
    expertStyle: 'cardiologist / clinic doctor — stethoscope visible, blood-pressure cuff in scene',
    urgencyTriggers: [
      '"Risiko strok meningkat"',
      '"Setiap hari tekanan darah tinggi adalah hari berisiko"',
    ],
    culturalContext: [
      'MY middle-aged demographic has high hypertension prevalence — family history is a strong driver',
      'Caring for elderly parents with stroke risk is a filial concern',
    ],
    forbiddenScenes: [
      'joint pain scenes — wrong niche',
      'skincare close-ups — wrong focus',
      'digestive bloating — wrong body part',
    ],
  },

  'diabetes': {
    targetAudience: {
      primary: 'Malaysian adults 40-70 with prediabetes / type 2 diabetes — chronic-condition demographic',
      ageRange: '40-70',
      genderHint: 'mixed',
    },
    painPoints: [
      'pricking finger for blood-glucose test multiple times a day',
      'avoiding sweet local food (kuih / teh tarik) at family gatherings — withdrawn',
      'frequent urination disrupting sleep / outings',
      'fatigue every afternoon — needing to lie down',
      'fear of long-term complications (kidney / vision / amputation)',
    ],
    scenarios: [
      'middle-aged Malaysian at dining table using a glucose monitor on fingertip, focused worried face',
      'person looking longingly at a tray of kuih at a kenduri but holding back, hand declining politely',
      'restless night — person sitting on bed checking the clock, glass of water on nightstand',
      'after-meal scene — person flopping onto sofa exhausted, family eating in the background',
      'doctor showing patient an HbA1c lab result with serious expression',
    ],
    emotionalState: {
      before: 'restricted, anxious — constant blood-sugar checks, social withdrawal, fatigue',
      after: 'controlled, energetic — stable readings, can enjoy social meals in moderation, full energy',
    },
    transformationOutcome:
      'AFTER state: stable glucose reading shown with relief, person enjoying a family meal in moderation, restored afternoon energy, no fatigue-collapse gesture.',
    socialProofStyle: 'middle-aged + elderly Malaysian with family — kenduri / dining moments, glucose-monitor moments',
    expertStyle: 'endocrinologist / diabetic specialist — clinic with glucose-meter and HbA1c chart visible',
    urgencyTriggers: [
      '"Risiko komplikasi buah pinggang / mata"',
      '"Setiap suapan boleh memburukkan keadaan"',
    ],
    culturalContext: [
      'MY food culture (sweet drinks / kuih / nasi lemak) is a chronic driver of diabetes',
      'Hari raya feast culture clashes with diabetic restriction',
    ],
    forbiddenScenes: [
      'joint pain / skincare / hair loss — wrong niche',
    ],
  },

  'women-health': {
    targetAudience: {
      primary: 'Malaysian women 30-60 — menstrual / pre-menopause / menopause / fertility / feminine wellness concerns',
      ageRange: '30-60',
      genderHint: 'female',
    },
    painPoints: [
      'menstrual cramps doubling-over on the sofa, hot pad on belly',
      'menopausal hot flashes — fanning herself with sweat on the forehead',
      'mood swings affecting family relationships — visible tension at dinner',
      'fertility struggle — staring at a calendar with pregnancy-test sticks nearby',
      'feminine discomfort affecting daily confidence',
    ],
    scenarios: [
      'Malaysian woman curled up on the sofa with hot water bottle on lower belly, soft warm lamp light',
      'menopausal woman fanning herself near a window with sweat on temple, irritated expression',
      'kitchen-table moment — woman with hand on forehead overwhelmed by family chaos in background',
      'soft bathroom moment — woman pausing reflective in mirror, hand on abdomen',
      'bedroom — woman sitting on the edge of the bed exhausted, mood low',
    ],
    emotionalState: {
      before: 'uncomfortable, mood-disrupted — hot flashes, cramps, emotional volatility',
      after: 'balanced, comfortable — restored mood, regular cycle, freedom to enjoy daily life',
    },
    transformationOutcome:
      'AFTER state: woman calm and balanced, enjoying family time at the dining table, no hot-pad / belly-clutching gesture, body language relaxed.',
    socialProofStyle: 'Malaysian women 30-60 — home / dining / bedroom scenes with hijab variants and modest attire',
    expertStyle: 'OB-GYN / women\'s wellness doctor — clinic with female-anatomy chart',
    urgencyTriggers: [
      '"Sebelum menopaus semakin teruk"',
      '"Setiap bulan dengan kesakitan adalah satu bulan terbuang"',
    ],
    culturalContext: [
      'MY Muslim women may have specific feminine wellness concerns around solat / wudhu',
      'Menopause is still a stigmatised topic — privacy + dignity are important',
    ],
    forbiddenScenes: [
      'joint pain / skincare-only — too narrow a focus',
      'male demographic — this is women-specific',
    ],
  },

  'men-vitality': {
    targetAudience: {
      primary: 'Malaysian men 35-60 — concerned about libido / prostate / energy / sexual wellness — often privately',
      ageRange: '35-60',
      genderHint: 'male',
    },
    painPoints: [
      'morning fatigue — sitting on bed edge exhausted, partner still asleep',
      'urinary urgency during the night — repeated bathroom trips',
      'declining intimacy with spouse — emotional distance at the dining table',
      'midday energy crash — slumped at the office desk',
      'losing confidence in physical strength',
    ],
    scenarios: [
      'Malaysian man sitting on the bed edge in early morning, head in hands, partner sleeping in background',
      'dim bathroom corridor at night — man on his way to the toilet again, tired',
      'dining table scene with wife — man eating quietly, emotional distance visible',
      'man at office desk slumping in chair mid-afternoon, eyes half-closed',
      'gym mirror — man examining declining muscle tone, frustrated',
    ],
    emotionalState: {
      before: 'fatigued, withdrawn — low energy, distant from partner, lost confidence',
      after: 'energetic, confident — restored morning energy, reconnected with partner, active lifestyle',
    },
    transformationOutcome:
      'AFTER state: man awake fresh in the morning, walking briskly, engaging warmly with spouse, confident body language. No fatigue-slump gesture.',
    socialProofStyle: 'middle-aged Malaysian men — discreet bedroom / dining / gym scenes',
    expertStyle: 'urologist / men\'s wellness doctor — clinical clinic setting',
    urgencyTriggers: [
      '"Sebelum prestasi semakin merosot"',
      '"Setiap minggu tanpa tindakan adalah kerugian"',
    ],
    culturalContext: [
      'MY men\'s wellness is often a private topic — discreet packaging / discreet COD delivery',
      'Tongkat Ali is a culturally recognised traditional remedy — leverage authenticity',
    ],
    forbiddenScenes: [
      'female demographic — this is men-specific',
      'joint pain / skincare — wrong niche',
    ],
  },

  'immunity-general': {
    targetAudience: {
      primary: 'Malaysian families — parents wanting to protect children + themselves, busy adults, post-COVID consciousness',
      ageRange: '25-65',
      genderHint: 'mixed',
    },
    painPoints: [
      'frequent flu / cough — taking sick leave repeatedly',
      'tired easily after work — no energy for family',
      'child catching cold from school — mother worried',
      'post-illness slow recovery — weeks of low energy',
      'seasonal allergies / haze affecting daily life',
    ],
    scenarios: [
      'Malaysian mother feeling her child\'s forehead at the dining table, worried',
      'office worker blowing nose into tissue at desk, tired',
      'family activity outdoors with one member coughing, concern on others\' faces',
      'pharmacy aisle scene with parent picking up cold medicine, fatigued',
      'morning waking up with low energy — sitting on edge of bed rubbing eyes',
    ],
    emotionalState: {
      before: 'fatigued, sickly — frequent illness, missed family activities',
      after: 'energetic, resilient — active family life, no missed days',
    },
    transformationOutcome:
      'AFTER state: family activities restored, healthy energy, no tissue / cough scenes, parent and child both visibly well.',
    socialProofStyle: 'Malaysian families — mother + child + father wellness shots, daily-life scenes',
    expertStyle: 'family GP / pharmacist — community clinic setting',
    urgencyTriggers: [
      '"Musim haze / flu / hujan"',
      '"Lindungi keluarga sebelum jangkitan"',
    ],
    culturalContext: [
      'MY haze season + monsoon are recurring health drivers',
      'Family-first culture — protecting children is the strongest message',
    ],
    forbiddenScenes: [
      'overly specific niches that aren\'t generic immunity',
    ],
  },

  'sleep-stress': {
    targetAudience: {
      primary: 'Malaysian adults 25-50 — office workers, students, mothers — burnout / insomnia / anxiety demographic',
      ageRange: '25-50',
      genderHint: 'mixed',
    },
    painPoints: [
      'tossing in bed at 3am — phone light on face, dark circles',
      'morning fatigue despite hours in bed — heavy head on pillow',
      'overwhelmed at the office desk — staring blank at screen',
      'racing thoughts at bedtime — sitting on bed edge unable to lie down',
      'social withdrawal due to mood — avoiding family interactions',
    ],
    scenarios: [
      'Malaysian young adult lying in bed at 2-3am with phone glow on face, dark circles, can\'t sleep',
      'office worker slumped at desk mid-afternoon, head in hands, screen glowing',
      'kitchen morning scene — woman pouring coffee, looking exhausted, hair still messy',
      'soft bedroom moment — person sitting on edge of bed with face in palms, lamp dim',
      'dim dining table scene — person picking at food, no appetite, withdrawn',
    ],
    emotionalState: {
      before: 'exhausted, anxious, withdrawn — insomnia + burnout cycle',
      after: 'restored, calm, focused — deep sleep, refreshed mornings, social re-engagement',
    },
    transformationOutcome:
      'AFTER state: refreshed morning waking, smiling at the breakfast table, productive at work, social re-engagement with family.',
    socialProofStyle: 'Malaysian young office workers + mothers — bedroom / kitchen / office scenes',
    expertStyle: 'sleep specialist / psychologist / nutritionist — calm clinic with sleep-cycle chart',
    urgencyTriggers: [
      '"Setiap malam tanpa tidur adalah hari hilang"',
      '"Sebelum burnout panjang"',
    ],
    culturalContext: [
      'MY office culture + long commutes drive insomnia',
      'Caregiving mothers experience chronic sleep debt',
    ],
    forbiddenScenes: [
      'joint pain knee scenes — wrong niche',
      'digestive bloating — wrong body part (unless directly linked)',
    ],
  },

  'dental-oral': {
    targetAudience: {
      primary: 'Malaysian adults 20-60 — concerned about yellow teeth, gum bleeding, bad breath, smile confidence',
      ageRange: '20-60',
      genderHint: 'mixed',
    },
    painPoints: [
      'gum bleeding when brushing — concerned look at toothbrush',
      'yellow teeth in mirror selfie — covering mouth when smiling',
      'morning breath embarrassment in close conversations',
      'visible plaque / tartar on teeth in close-up',
      'avoiding wide-smile photos at family events',
    ],
    scenarios: [
      'Malaysian person in bathroom mirror, lifting upper lip to examine yellow teeth, frowning',
      'someone covering their mouth when laughing at a family gathering',
      'toothbrush close-up with visible blood, person looking concerned',
      'morning bathroom scene — person cupping hand to mouth checking breath',
      'photographer asking for a smile but person closes mouth instead',
    ],
    emotionalState: {
      before: 'self-conscious, withdrawn — covers mouth, avoids photos',
      after: 'confident, open smile — wide bright-teeth smile in selfies and family photos',
    },
    transformationOutcome:
      'AFTER state: visibly whiter teeth, confident open-mouth smile, no hand-covering gesture, fresh breath confidence.',
    socialProofStyle: 'Malaysian adults — bathroom selfies + family-photo smile moments',
    expertStyle: 'dentist / oral hygienist — dental clinic with chair / x-ray visible',
    urgencyTriggers: [
      '"Sebelum kerosakan gigi kekal"',
      '"Tarik balik senyuman anda"',
    ],
    culturalContext: [
      'Hari raya / wedding family photos drive teeth-whitening urgency',
    ],
    forbiddenScenes: [
      'unrelated body parts — joint / belly / scalp',
    ],
  },

  'unknown': {
    targetAudience: {
      primary: 'Malaysian adults — general wellness audience',
      ageRange: '25-55',
      genderHint: 'mixed',
    },
    painPoints: [
      'general daily-life discomfort related to the product\'s claimed concern',
    ],
    scenarios: [
      'Malaysian person in a relatable home / office setting experiencing the product\'s targeted concern',
    ],
    emotionalState: {
      before: 'uncomfortable / concerned about the wellness issue the product addresses',
      after: 'visibly improved, comfortable, restored daily lifestyle',
    },
    transformationOutcome:
      'AFTER state: visible improvement of the specific concern the product addresses, restored daily activities.',
    socialProofStyle: 'Malaysian everyday adults — relatable home + office settings',
    expertStyle: 'general healthcare practitioner — clinical clinic setting',
    urgencyTriggers: [
      '"Sebelum keadaan memburuk"',
      '"Setiap hari tanpa tindakan adalah hari terbuang"',
    ],
    culturalContext: [
      'Generic Malaysian wellness context — adapt to product specifics',
    ],
    forbiddenScenes: [
      'no specific bans — defer to per-section spec',
    ],
  },
}

const SUB_NICHE_LABELS: Record<ProductNiche, string> = {
  'joint-pain':       'joint / bone / orthopedic relief',
  'digestive-gut':    'digestive / probiotic / gut health',
  'skincare':         'skincare / acne / pigmentation / anti-aging',
  'weight-loss':      'weight loss / slimming / fat-burn',
  'hair-care':        'hair loss / scalp / hair growth',
  'vision':           'vision / eye health',
  'cardio':           'cardiovascular / blood pressure / cholesterol',
  'diabetes':         'diabetes / blood sugar control',
  'women-health':     'women health / menstrual / menopause / feminine wellness',
  'men-vitality':     'men vitality / libido / prostate / male energy',
  'immunity-general': 'general immunity / multivitamin',
  'sleep-stress':     'sleep / stress / anxiety / burnout',
  'dental-oral':      'dental / teeth / gums / oral care',
  'unknown':          'general wellness (niche not auto-detected)',
}

/** Build a complete ProductIntelligence payload from a product. Pure.
 *  Reads from any subset of common bank-product fields — none required. */
export function buildProductIntelligence(args: {
  product: Partial<Pick<Product, 'productName' | 'productDescription' | 'painPoints' | 'usps' | 'benefits' | 'ingredients' | 'targetMarket' | 'offer'>>
  language: LandingLanguage
  nicheHint?: string
}): ProductIntelligence {
  const p = args.product
  // Aggregate every signal we have into one haystack for keyword matching.
  const haystack = [
    p.productName, p.productDescription, p.painPoints, p.usps, p.benefits,
    p.ingredients, p.targetMarket, args.nicheHint,
  ].filter(Boolean).join(' ')
  const niche = detectNiche({
    productName: haystack,  // pack everything into one field; detectNiche just substring-matches
    nicheHint: args.nicheHint,
  })
  const payload = CATALOG[niche]
  return {
    niche,
    subNicheLabel: SUB_NICHE_LABELS[niche],
    ...payload,
  }
}

/**
 * Build the Gemini userPrompt overlay block. Inject this near the TOP of
 * the user prompt (above the form-blueprint section list) so Gemini uses
 * niche-specific scenes when emitting imagePrompts — overriding generic
 * static spec hardcoded into each SYSTEM_PROMPT.
 *
 * The block is in English (so it matches the imagePrompt.prompt language)
 * but the niche / cultural context lines mention MY-specific triggers.
 */
export function buildIntelligencePromptBlock(pi: ProductIntelligence): string {
  const lines: string[] = []
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push(`PRODUCT INTELLIGENCE OVERRIDE — niche: ${pi.niche} (${pi.subNicheLabel})`)
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  lines.push('You MUST shape every imagePrompt — especially the pain / lifestyle / before-after / benefits sections — around this niche. The generic stress / fatigue / office-burnout scenes in the section spec above are OVERRIDDEN by the niche-specific scenes below. Always pick the most niche-relevant scene; never default to a generic emotional setting.')
  lines.push('')
  lines.push(`TARGET AUDIENCE: ${pi.targetAudience.primary}. Age range: ${pi.targetAudience.ageRange}. Gender hint: ${pi.targetAudience.genderHint}.`)
  lines.push('')
  lines.push('NICHE-SPECIFIC PAIN POINTS — pick from these when building pain section imagePrompts:')
  pi.painPoints.forEach((p) => lines.push(`  • ${p}`))
  lines.push('')
  lines.push('NICHE-SPECIFIC SCENARIOS — use these as the setting / posture / body-language for hero / pain / lifestyle / before-after image prompts:')
  pi.scenarios.forEach((s) => lines.push(`  • ${s}`))
  lines.push('')
  lines.push('EMOTIONAL STATE MAPPING:')
  lines.push(`  • BEFORE state: ${pi.emotionalState.before}`)
  lines.push(`  • AFTER state: ${pi.emotionalState.after}`)
  lines.push('')
  lines.push(`TRANSFORMATION OUTCOME (use in before-after + benefits sections): ${pi.transformationOutcome}`)
  lines.push('')
  lines.push(`SOCIAL PROOF STYLE (testimonials / selfies / crowd shots): ${pi.socialProofStyle}`)
  lines.push(`EXPERT AUTHORITY STYLE (expert-feedback / news-proof / mechanism): ${pi.expertStyle}`)
  lines.push('')
  lines.push('NICHE-APPROPRIATE URGENCY TRIGGERS (use in offer / final-cta urgencyText):')
  pi.urgencyTriggers.forEach((u) => lines.push(`  • ${u}`))
  lines.push('')
  lines.push('CULTURAL CONTEXT (weave these into copy / scenarios where natural):')
  pi.culturalContext.forEach((c) => lines.push(`  • ${c}`))
  lines.push('')
  if (pi.forbiddenScenes.length > 0) {
    lines.push('FORBIDDEN SCENES — these are off-niche and MUST NOT appear in any imagePrompt for this product:')
    pi.forbiddenScenes.forEach((f) => lines.push(`  ✗ ${f}`))
    lines.push('')
  }
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  return lines.join('\n')
}
