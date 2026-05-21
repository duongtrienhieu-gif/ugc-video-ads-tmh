import type { RecipeId, ImageSlotConcept, ProductIdentity, TextBlock, DecorElement } from '../types'

// ─────────────────────────────────────────────────────────────────────
// 8 VISUAL RECIPE TEMPLATES (P7 update).
//
// Changes from Phase 6 — TOKEN NORMALIZATION:
// - technicalBlock(): ultra-compact, absorbs "no watermark" global rule.
// - emotionConsistencyBlock(): enum-style short tokens (pain/after/expert/social).
// - VISUAL_MODE_REGISTRY: dedup with technicalBlock — unique essence only.
// - F whatsapp / social-platform: compressed wording.
// - All STRICT lines: drop redundant "No watermark" (handled in TECHNICAL).
// - H: brandLockBlock(false) replaces hardcoded PRODUCT VISIBILITY line.
// - C/D/E/G layouts: compact structure hints, no long-form prose.
//
// Logic untouched: routing, model, product lock, size lock, emotion modes,
// hierarchy system, readability intent — all preserved, only wording compressed.
// ─────────────────────────────────────────────────────────────────────

export interface RecipeInput {
  identity: ProductIdentity
  concept:  ImageSlotConcept
  language: 'ms' | 'vi' | 'en'
}

/** Backstop: nếu concept arrays bị undefined (vd nếu rawToSections bypass),
 *  trả về empty array thay vì crash khi gọi .length / .map / .filter. */
function safeBlocks(c: ImageSlotConcept): TextBlock[] { return c.textOverlayBlocks ?? [] }
function safeDecor(c: ImageSlotConcept):  DecorElement[] { return c.decorElements ?? [] }

// ── Helpers ──────────────────────────────────────────────────────────

function formatTextBlock(t: TextBlock): string {
  const styleHint =
    t.style === 'bold-condensed'       ? 'big bold condensed sans-serif' :
    t.style === 'italic-slanted'       ? 'italic slanted modern sans-serif' :
    t.style === 'ecommerce-banner'     ? 'bold ecommerce banner typography' :
    t.style === 'glassmorphism-badge'  ? 'white solid-background rounded pill badge with drop-shadow, emoji prefix + bold text' :
    t.style === 'star-rating'          ? 'metric chip with star rating' :
                                          'clean readable sans-serif'
  return `  - "${t.text}" — role=${t.role}, position=${t.position}, style=${styleHint}`
}

function formatDecor(d: DecorElement): string {
  const desc =
    d.type === 'glassmorphism-badge'  ? `white pill badge, solid background, drop-shadow "${d.text ?? ''}"` :
    d.type === 'arrow'                ? `bold curved arrow graphic${d.text ? ` pointing to ${d.text}` : ''}, clean design accent` :
    d.type === 'glow'                 ? `soft ${d.color ?? 'red'} glow accent${d.position ? ` near ${d.position}` : ''}` :
    d.type === 'starburst'            ? `bright starburst sticker${d.text ? ` reading "${d.text}"` : ''}` :
    d.type === 'checkmark'            ? `green checkmark icon` :
    d.type === 'cross'                ? `red X mark icon` :
    d.type === 'emoji-prefix'         ? `emoji prefix "${d.text ?? ''}"` :
                                          d.type
  return `  - ${desc}`
}

function langLabel(lang: 'ms' | 'vi' | 'en'): string {
  return lang === 'ms' ? 'Bahasa Melayu' : lang === 'vi' ? 'Vietnamese' : 'English'
}

// ─────────────────────────────────────────────────────────────────────
// VISUAL_MODE — unique essence per mode. P7: deduped against technicalBlock
// (which already handles no-clutter, mobile-readable, hierarchy, typography).
// ─────────────────────────────────────────────────────────────────────
const VISUAL_MODE_REGISTRY = {
  'ugc-social':            'authentic person, natural framing, ecommerce overlay badges',
  'ugc-clean-photo':       'authentic candid photo, no overlays',
  'ecommerce-infographic': 'flat icons, scannable label grid',
  'product-showcase':      'product center, icon grid around',
  'comparison-card':       'two-column table, emerald vs gray',
  'editorial-card':        'magazine endorsement, portrait + quote box',
} as const

function visualModeBlock(mode: keyof typeof VISUAL_MODE_REGISTRY): string {
  return `VISUAL_MODE: ${VISUAL_MODE_REGISTRY[mode]}`
}

function brandLockBlock(
  identity: ProductIdentity,
  productInScene: boolean,
  lockLevel: 'none' | 'minimal' | 'full' = 'full',
): string {
  if (!productInScene) {
    return `PRODUCT: not visible in this image. Do NOT render any "${identity.productNameExact}".`
  }
  // PRODUCT_LOCK_LEVEL MINIMAL:
  //   Recipes: C (infographic), D (icon grid), E (table), G promo/banner,
  //            F non-whatsapp. Product = thumbnail/decorative, no person holds.
  //   Output: name + colors. SIZE_LOCK handled by sizeLockBlock().
  if (lockLevel === 'minimal') {
    return `PRODUCT (match reference image): "${identity.productNameExact}". Colors: ${identity.primaryColors.join(', ')}.`
  }
  // PRODUCT_LOCK_LEVEL FULL:
  //   Recipes: A (UGC photo), B (clean UGC), F whatsapp, G combo-vertical.
  //   Person interacts with product OR product is primary hero.
  //   SIZE_LOCK handled separately by sizeLockBlock() at recipe level.
  return `PRODUCT: match the uploaded reference image — same label, shape, proportions, lid, colors. (SKU: "${identity.productNameExact}".)`
}

type SizeLockMode = 'handheld-natural' | 'shelf-packshot' | 'infographic-mini' | 'foreground-dominant' | 'secondary-product'

function sizeLockBlock(mode: SizeLockMode): string {
  if (mode === 'handheld-natural')    return `SIZE_LOCK (handheld): Product must look smaller than the hand holding it. Natural arm's-length — NOT macro close-up (close-up = 2-3× oversize).`
  if (mode === 'shelf-packshot')      return `SIZE_LOCK (shelf): Product at natural scene scale on surface/shelf. No hand anchor.`
  if (mode === 'infographic-mini')    return `SIZE_LOCK (infographic): Product = small decorative element. Icons/labels are primary — product never dominates layout.`
  if (mode === 'foreground-dominant') return `SIZE_LOCK (hero): Product IS the hero — fills 40-60% of frame, centered, sharp.`
  /* secondary-product */              return `SIZE_LOCK (secondary): Product visible but secondary — small-mid scale, not competing with main subject.`
}

function multiProductBlock(): string {
  return `MULTI-PRODUCT: All product units must match the same reference — identical label, shape, lid, colors. Scale units to match tier quantity. Consistent proportions across all tiers.`
}

// ─────────────────────────────────────────────────────────────────────
// EMOTION CONSISTENCY — Phase 6.
// SUBJECT LOCK = identity only (gender/age/ethnicity/clothing). Emotion
// must come from this block so pain/after/expert images don't conflict
// with a "warm friendly genuine" identity description.
// ─────────────────────────────────────────────────────────────────────
type EmotionMode = 'pain' | 'after' | 'expert' | 'whatsapp-social' | 'neutral'

function detectEmotionMode(concept: ImageSlotConcept, variant?: string): EmotionMode {
  // Variant takes priority (F + H carry explicit semantic)
  if (variant === 'whatsapp' || variant === 'social-platform' || variant === 'kol') return 'whatsapp-social'
  if (variant === 'warning-news') return 'pain'
  if (variant === 'expert')       return 'expert'
  if (variant === 'trust-news')   return 'neutral'

  const text = `${concept.roleLabel ?? ''} ${concept.conceptScene ?? ''}`.toLowerCase()
  if (/\bpain\b|problem|failed|why-happens|cause|congested|irritated|frustrated|worried|trước khi|khó chịu|đau/.test(text)) return 'pain'
  if (/after|benefit|success|relief|relieved|smile|happy|sau khi|lợi ích|khỏe|relaxed/.test(text)) return 'after'
  return 'neutral'
}

function emotionConsistencyBlock(mode: EmotionMode): string {
  if (mode === 'pain')            return `EMOTION: discomfort, congestion, irritation. No smile.`
  if (mode === 'after')           return `EMOTION: relief, healthy breathing, natural smile.`
  if (mode === 'expert')          return `EMOTION: confident, trustworthy, calm.`
  if (mode === 'whatsapp-social') return `EMOTION: casual natural.`
  /* neutral */                    return ''
}

/** Subject identity injection — chỉ dùng khi recipe có người làm chủ thể.
 *  productInScene = true → người + sản phẩm.
 *  productInScene = false → người không có sản phẩm. */
function subjectLockBlock(identity: ProductIdentity, concept: ImageSlotConcept): string {
  const which = concept.subjectLockKey ?? 'primary'
  const lock = which === 'secondary' && identity.subjectIdentityLock.secondary
    ? identity.subjectIdentityLock.secondary
    : identity.subjectIdentityLock.primary
  return `SUBJECT LOCK (the person in this image MUST match this description): ${lock}.`
}

// antiPatternBlock removed Phase 3 (Cut 1): off-niche prevention enforced
// at Stage 2 (systemPromptPackGen R2 4-tier gate). Image gen Stage 3 just
// renders what conceptScene says — Gemini already filtered tier4 there.
// Save ~40 tokens × 35 ảnh = 1,400 tokens/pack.

function technicalBlock(aspectRatio: string): string {
  const dims =
    aspectRatio === '1:1'  ? '1024×1024' :
    aspectRatio === '4:5'  ? '1024×1280 (mapped to 2:3 portrait)' :
    aspectRatio === '16:9' ? '1024×576 (mapped to 3:2 landscape)' :
    aspectRatio === '9:16' ? '832×1248 (mapped to 2:3 portrait)' :
                              '1024×1024'
  return `TECHNICAL: ${dims}, 1K mobile-first. Bold sans-serif, dominant headline/CTA, clean hierarchy, no clutter, no watermark.`
}

// ═════════════════════════════════════════════════════════════════════
// RECIPE A — UGC photo + text overlay + decor
// Sections: hero, pain, product-discovery, before-after
// P4: drop price tag (handled by G recipes only); inject subjectLock
// ═════════════════════════════════════════════════════════════════════
function recipeA(input: RecipeInput): string {
  const { identity, concept, language } = input

  // Filter out price-role blocks from hero/discovery (price now lives in G recipes)
  const filteredBlocks = safeBlocks(concept).filter((b) => b.role !== 'price')

  const textOverlay = filteredBlocks.length > 0
    ? `TEXT (in ${langLabel(language)}, exact spelling):
${filteredBlocks.map(formatTextBlock).join('\n')}`
    : 'TEXT OVERLAY: none.'

  const decor = safeDecor(concept).length > 0
    ? `DECORATIVE ELEMENTS (compose on top of photo):
${safeDecor(concept).map(formatDecor).join('\n')}`
    : 'DECORATIVE ELEMENTS: none.'

  // Subject lock only when image has a person (most recipe A scenes have people)
  const subject = subjectLockBlock(identity, concept)

  return [
    `SCENE: ${concept.conceptScene}.`,
    emotionConsistencyBlock(detectEmotionMode(concept)),
    subject,
    brandLockBlock(identity, concept.productInScene, 'full'),
    concept.productInScene ? sizeLockBlock('handheld-natural') : '',
    textOverlay,
    decor,
    visualModeBlock('ugc-social'),
    technicalBlock(concept.aspectRatio),
  ].filter(Boolean).join('\n\n')
}

// ═════════════════════════════════════════════════════════════════════
// RECIPE B — UGC photo sạch (no text, no decor)
// Sections: failed-solutions (no product), lifestyle if used
// ═════════════════════════════════════════════════════════════════════
function recipeB(input: RecipeInput): string {
  const { identity, concept } = input
  const subject = subjectLockBlock(identity, concept)
  return [
    `SCENE: ${concept.conceptScene}.`,
    emotionConsistencyBlock(detectEmotionMode(concept)),
    subject,
    brandLockBlock(identity, concept.productInScene, 'full'),
    concept.productInScene ? sizeLockBlock('handheld-natural') : '',
    visualModeBlock('ugc-clean-photo'),
    technicalBlock(concept.aspectRatio),
    `STRICT: ZERO text/letters in image.`,
  ].filter(Boolean).join('\n\n')
}

// ═════════════════════════════════════════════════════════════════════
// RECIPE C — Science mechanism / cause diagram (infographic illustration)
// Sections: why-happens (4-6 causes), mechanism (before/after diagram)
// P4: enforce explicit cause-list count for why-happens
// ═════════════════════════════════════════════════════════════════════
function recipeC(input: RecipeInput): string {
  const { identity, concept, language } = input
  const labels = safeBlocks(concept).length > 0
    ? `LABELS (in ${langLabel(language)}, exact spelling):
${safeBlocks(concept).map(formatTextBlock).join('\n')}`
    : 'LABELS: none.'

  const isWhyHappens = concept.roleLabel.toLowerCase().includes('cause') ||
                       concept.roleLabel.toLowerCase().includes('nguyên nhân') ||
                       concept.roleLabel.toLowerCase().includes('why')

  const layout = isWhyHappens
    ? `LAYOUT: title top, 4-6 cause items (2-col/vertical). Each: colored icon + DOMINANT ${langLabel(language)} label (max 8w) + secondary text (max 5w). No paragraphs.`
    : `LAYOUT: title top + before/after panels (red vs green) + flow arrows + DOMINANT icon labels (max 8w), supporting text max 5w. No paragraphs.`

  return [
    `DIAGRAM CONCEPT: ${concept.conceptScene}.`,
    brandLockBlock(identity, concept.productInScene, 'minimal'),
    concept.productInScene ? sizeLockBlock('infographic-mini') : '',
    labels,
    visualModeBlock('ecommerce-infographic'),
    layout,
    safeDecor(concept).length > 0 ? `BRAND BADGES: ${safeDecor(concept).map(formatDecor).join('; ')}` : '',
    technicalBlock(concept.aspectRatio),
    `STRICT: text legible.`,
  ].filter(Boolean).join('\n\n')
}

// ═════════════════════════════════════════════════════════════════════
// RECIPE D — Product showcase infographic (icon grid)
// Sections: ingredients, benefits
// P4: ingredients now 1 image must show ALL ingredients
// ═════════════════════════════════════════════════════════════════════
function recipeD(input: RecipeInput): string {
  const { identity, concept, language } = input
  const labels = safeBlocks(concept).length > 0
    ? `ICON LABELS (in ${langLabel(language)}):
${safeBlocks(concept).map(formatTextBlock).join('\n')}`
    : 'LABELS: none.'

  return [
    `INFOGRAPHIC CONCEPT: ${concept.conceptScene}.`,
    brandLockBlock(identity, concept.productInScene, 'minimal'),
    concept.productInScene ? sizeLockBlock('foreground-dominant') : '',
    labels,
    visualModeBlock('product-showcase'),
    `LAYOUT: title top${identity.coBrandBadges.length > 0 ? ` + brand badge "${identity.coBrandBadges.join(' + ')}"` : ''} + product center (SHAPE LOCK) + 5-8 icon+label grid. Each: DOMINANT name + max 5w benefit. No paragraphs.`,
    safeDecor(concept).length > 0 ? `EXTRA: ${safeDecor(concept).map(formatDecor).join('; ')}` : '',
    technicalBlock(concept.aspectRatio),
    `STRICT: icon labels legible.`,
  ].filter(Boolean).join('\n\n')
}

// ═════════════════════════════════════════════════════════════════════
// RECIPE E — Comparison table infographic (PREMIUM upgrade per P4)
// Sections: comparison
// ═════════════════════════════════════════════════════════════════════
function recipeE(input: RecipeInput): string {
  const { identity, concept, language } = input
  const cells = safeBlocks(concept).length > 0
    ? `TABLE (in ${langLabel(language)}):
${safeBlocks(concept).map(formatTextBlock).join('\n')}`
    : 'TABLE: empty (this should NOT happen).'

  return [
    `COMPARISON INFOGRAPHIC CONCEPT: ${concept.conceptScene}.`,
    brandLockBlock(identity, concept.productInScene, 'minimal'),
    concept.productInScene ? sizeLockBlock('infographic-mini') : '',
    cells,
    visualModeBlock('comparison-card'),
    `LAYOUT: LEFT col = emerald header + product image + green ✓ rows. RIGHT col = gray header + red ✗ rows. 3-5 rows, each = ONE bold label (max 5w). No sub-text.`,
    safeDecor(concept).length > 0 ? `EXTRA: ${safeDecor(concept).map(formatDecor).join('; ')}` : '',
    technicalBlock(concept.aspectRatio),
    `STRICT: labels legible. Green ✓ + red ✗.`,
  ].filter(Boolean).join('\n\n')
}

// ═════════════════════════════════════════════════════════════════════
// RECIPE F — Platform UI screenshot
// Variants: 'trust-news' | 'warning-news' | 'social-platform' | 'whatsapp'
// P4: news-proof now uses 'warning-news' (fear-mongering layout, red accent)
// ═════════════════════════════════════════════════════════════════════
function recipeF(input: RecipeInput): string {
  const { identity, concept, language } = input
  const variant = concept.recipeVariant ?? 'social-platform'

  const labels = safeBlocks(concept).length > 0
    ? `UI TEXT (in ${langLabel(language)}, exact spelling, authentic platform style):
${safeBlocks(concept).map(formatTextBlock).join('\n')}`
    : 'UI TEXT: empty.'

  // Variant-specific layout — compressed to keywords only.
  // Detailed instructions (INTRA-SECTION consistency, vibe rotation) were
  // verbose placebos KIE can't actually enforce per-image. Removed.
  const variantBlock =
    variant === 'warning-news'
      ? `LAYOUT (WARNING NEWS): Malaysian health news portal. RED/dark urgent header + bold alarming headline ("AMARAN!" / "Bahaya!" / "${identity.productCategory}..."). Worried subject photo, scary stats, ⚠️ red boxes.`
    : variant === 'trust-news'
      ? `LAYOUT (TRUST NEWS): Malaysian news portal (mStar / Berita Harian / KKM) health section. Calm institutional, educational headline.`
    : variant === 'whatsapp'
      ? `LAYOUT (WHATSAPP): Clean sparse mobile chat UI, green bubbles. Malaysian Malay text with emojis (🙏 ✨ ❤️), readable timestamps. Vary 1-on-1 / group / photo embed. Target language only.`
      : `LAYOUT (SOCIAL PLATFORM): Authentic mobile UI (Facebook post / TikTok Shop review / Shopee product / Instagram). Native platform spacing, casual Malay text + emojis, Malaysian usernames, realistic timestamps.`

  // whatsapp: person holds product → FULL + handheld-natural
  // social-platform / news: product = thumbnail in UI screenshot → MINIMAL + secondary
  const fLockLevel: 'full' | 'minimal' = variant === 'whatsapp' ? 'full' : 'minimal'
  const fSizeMode: SizeLockMode = variant === 'whatsapp' ? 'handheld-natural' : 'secondary-product'

  return [
    `SCREENSHOT CONCEPT: ${concept.conceptScene}.`,
    emotionConsistencyBlock(detectEmotionMode(concept, variant)),
    brandLockBlock(identity, concept.productInScene, fLockLevel),
    concept.productInScene ? sizeLockBlock(fSizeMode) : '',
    labels,
    variantBlock.trim(),
    safeDecor(concept).length > 0 ? `EXTRA UI: ${safeDecor(concept).map(formatDecor).join('; ')}` : '',
    technicalBlock(concept.aspectRatio),
    `STRICT: UI text legible.`,
  ].filter(Boolean).join('\n\n')
}

// ═════════════════════════════════════════════════════════════════════
// RECIPE G — Banner (split variants P4)
// Variants: 'promo' (offer pos 17) | 'social-proof-banner' (final-cta pos 2)
// ═════════════════════════════════════════════════════════════════════
function recipeG(input: RecipeInput): string {
  const { identity, concept, language } = input
  const variant = concept.recipeVariant ?? 'promo'

  const banner = safeBlocks(concept).length > 0
    ? `BANNER TEXT (in ${langLabel(language)}, exact spelling):
${safeBlocks(concept).map(formatTextBlock).join('\n')}`
    : 'BANNER TEXT: empty.'

  // Primary deal (used by promo variant) — comboDeals[0] hoặc fallback priceTag
  const primaryDeal = identity.comboDeals?.[0]
  const primaryDealLine = primaryDeal
    ? `PRIMARY DEAL DATA (use this EXACTLY in banner text — NOT generic invented offers):
  - Label: "${primaryDeal.label}"
  - Price: "${primaryDeal.price}"${primaryDeal.originalPrice ? `\n  - Original price (gạch): "${primaryDeal.originalPrice}"` : ''}${primaryDeal.savingsLabel ? `\n  - Savings: "${primaryDeal.savingsLabel}"` : ''}`
    : `PRICE: "${identity.priceTag}" (no combo deals — use single price).`

  // Full combo deals list (used by combo-vertical variant)
  const allDealsLines = (identity.comboDeals && identity.comboDeals.length > 0)
    ? identity.comboDeals.map((d, i) =>
        `  Tier ${i + 1}: label="${d.label}", price="${d.price}"${d.originalPrice ? `, original="${d.originalPrice}"` : ''}${d.savingsLabel ? `, savings="${d.savingsLabel}"` : ''}${d.benefits?.length ? `, benefits=[${d.benefits.map((b) => `"${b}"`).join(', ')}]` : ''}`,
      ).join('\n')
    : '  (no combo deals available)'

  let variantBlock = ''
  if (variant === 'social-proof-banner') {
    variantBlock = `LAYOUT (SOCIAL PROOF): Dark red/burgundy + cream + gold. Top: red header + white headline. 3-4 metric chips (⭐rating, "25,000+ KOTAK TERJUAL"). 4-6 testimonial cards 2x2/2x3 — Malaysian avatars (hijab + uncles + younger) + name + location (KL/JB/Penang) + 5-star + 1-line Malay quote + mini product thumb. Product small-mid. Trust badges (HALAL/KKM/delivery). NO PRICE.`
  } else if (variant === 'combo-vertical') {
    variantBlock = `LAYOUT (COMBO VERTICAL): Portrait infographic stacking ALL tiers from FULL DEALS LIST. Bold title ("HARGA TERBAIK" / "TAWARAN COMBO" in target lang). Each tier: badge (RAWATAN CEPAT/MENDALAMI/MAMPAN/MAKSIMUM) + product mockup (N units = tier qty, SHAPE LOCK) + deal label + price block (originalPrice gạch + salePrice highlight + savings) + 2-4 ✅ benefits. T1=blue/teal, T2=red/orange "HOT DEAL", T3=amber/gold "BEST SELLER", T4=purple "MAX VALUE".`
  } else {
    variantBlock = `LAYOUT (PROMO): Malaysian FB/TikTok promo banner. Product large center/side (SHAPE LOCK). Headline from PRIMARY DEAL LABEL. Price block: originalPrice gạch → salePrice highlight — 1 dominant price. Savings starburst if available. Trust badges: ${identity.trustBadges.join(', ') || '(none)'}. CTA separate. Amber/red or violet/gold palette. ⛔ KHÔNG bịa offers ngoài PRIMARY DEAL DATA.`
  }

  // combo-vertical: product IS the hero of each tier block → FULL lock
  // promo / social-proof-banner: product = banner element → MINIMAL
  const gLockLevel: 'full' | 'minimal' = variant === 'combo-vertical' ? 'full' : 'minimal'
  const gSizeMode: SizeLockMode = variant === 'social-proof-banner' ? 'secondary-product' : 'foreground-dominant'

  return [
    `BANNER CONCEPT: ${concept.conceptScene}.`,
    brandLockBlock(identity, concept.productInScene, gLockLevel),
    concept.productInScene ? sizeLockBlock(gSizeMode) : '',
    variant === 'combo-vertical' ? multiProductBlock() : '',
    banner,
    // Deal data injection — CONDITIONAL by variant:
    // - social-proof-banner has "NO PRICE" rule → SKIP price block (was
    //   creating conflict signal: data has price but layout says no price)
    // - promo → inject primary deal (single headline price)
    // - combo-vertical → inject full deals list (all tiers)
    variant === 'social-proof-banner'
      ? ''  // NO price for social proof banner
      : variant === 'combo-vertical'
        ? `FULL DEALS LIST (use ALL tiers below — each as a separate vertical block):\n${allDealsLines}`
        : primaryDealLine,
    variantBlock.trim(),
    safeDecor(concept).length > 0 ? `EXTRA: ${safeDecor(concept).map(formatDecor).join('; ')}` : '',
    technicalBlock(concept.aspectRatio),
    variant === 'promo'
      ? `STRICT: prices + deal label EXACTLY from PRIMARY DEAL DATA. No invented offers.`
      : variant === 'combo-vertical'
        ? `STRICT: all tier prices + labels EXACTLY from FULL DEALS LIST. Each tier distinct + readable.`
        : `STRICT: metric numbers + quote legible. NO PRICE.`,
  ].filter(Boolean).join('\n\n')
}

// ═════════════════════════════════════════════════════════════════════
// RECIPE H — Expert / KOL endorsement card (NEW P4)
// Variants: 'expert' | 'kol'
// Sections: expert-kol (pos 12)
// ═════════════════════════════════════════════════════════════════════
function recipeH(input: RecipeInput): string {
  const { identity, concept, language } = input
  const variant = concept.recipeVariant ?? 'expert'
  const subject = subjectLockBlock(identity, concept)

  const labels = safeBlocks(concept).length > 0
    ? `TEXT (in ${langLabel(language)}, exact spelling):
${safeBlocks(concept).map(formatTextBlock).join('\n')}`
    : 'TEXT: empty (this should NOT happen — expert/KOL card requires text).'

  // Specialty mapping kept (was anti-default-to-dentist fix). All other
  // explanatory bullet expansion removed — KIE gets the keywords directly.
  const specialtyHint = (() => {
    const cat = identity.productCategory.toLowerCase()
    if (cat.includes('dental') || cat.includes('oral') || cat.includes('teeth')) return 'Pakar Pergigian (white coat + dental clinic bg)'
    if (cat.includes('probiotic') || cat.includes('gut') || cat.includes('digestive')) return 'Pakar Pemakanan / Gastroenterologist (white coat + clinic bg)'
    if (cat.includes('hair'))                                                          return 'Pakar Trikologi / Dermatologi (white coat + hair clinic bg)'
    if (cat.includes('nasal') || cat.includes('rhinitis') || cat.includes('allergy'))  return 'Pakar ENT (white coat + ENT tools bg)'
    if (cat.includes('skincare') || cat.includes('anti-aging'))                        return 'Pakar Dermatologi (white coat + derm clinic bg)'
    if (cat.includes('joint') || cat.includes('orthopedic'))                           return 'Pakar Ortopedik / Physio (white coat + ortho bg)'
    if (cat.includes('weight'))                                                        return 'Pakar Pemakanan (smart attire + nutrition bg)'
    if (cat.includes('beauty') || cat.includes('cosmetic'))                            return 'Pakar Dermatologi / Aesthetic (smart attire + beauty bg)'
    return 'Pakar Kesihatan (white coat + clinic bg)'
  })()

  const variantBlock = variant === 'expert'
    ? `LAYOUT (EXPERT): Editorial endorsement — Malaysian ${specialtyHint}. Top: head-and-shoulders portrait, clinical bg soft blur. Center band: "Dr. [Malaysian name]" + specialty title + "[N]+ tahun pengalaman". Bottom: quote box with 2-4 sentence Malay testimonial. Optional "Pakar Disahkan" badge. Palette: white + soft teal/navy + cream.`
    : `LAYOUT (KOL): Instagram-style influencer card — Malaysian KOL. Top: lifestyle photo (hijab or male KOL, cafe/home/outdoor). Center band: "@handle" + "[N]M Followers / Pengikut" + IG/TikTok icon. Bottom: casual Malay quote 2-4 sentences with emojis (✨ 💕 🔥), optional "Pilihan Aku" hashtag. Palette: warm pink/peach + cream + gold.`

  return [
    `ENDORSEMENT CARD CONCEPT: ${concept.conceptScene}.`,
    emotionConsistencyBlock(detectEmotionMode(concept, variant)),
    subject,
    // P7: replaces hardcoded PRODUCT VISIBILITY line — endorsement card
    // is product-name-in-quote only (no packaging in image).
    brandLockBlock(identity, false),
    labels,
    variantBlock.trim(),
    visualModeBlock('editorial-card'),
    technicalBlock(concept.aspectRatio),
    `STRICT: name + credentials + quote legible.`,
  ].filter(Boolean).join('\n\n')
}

// ─────────────────────────────────────────────────────────────────────
// Recipe registry — chỗ DUY NHẤT route recipeId → template function.
// ─────────────────────────────────────────────────────────────────────
export const RECIPE_TEMPLATES: Record<RecipeId, (input: RecipeInput) => string> = {
  A: recipeA,
  B: recipeB,
  C: recipeC,
  D: recipeD,
  E: recipeE,
  F: recipeF,
  G: recipeG,
  H: recipeH,
}
