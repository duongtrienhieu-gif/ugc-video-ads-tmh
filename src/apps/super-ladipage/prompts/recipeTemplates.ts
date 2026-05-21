import type { RecipeId, ImageSlotConcept, ProductIdentity, TextBlock, DecorElement } from '../types'

// ─────────────────────────────────────────────────────────────────────
// 8 VISUAL RECIPE TEMPLATES (P5 update).
//
// Changes from Phase 4:
// - All recipes: PRODUCT_LOCK_LEVEL NONE/MINIMAL/FULL (renamed from bool Mode A/B)
// - All recipes: SIZE_LOCK separated into sizeLockBlock() — handheld-natural /
//   infographic-mini / foreground-dominant / secondary-product / shelf-packshot
// - G combo-vertical: lockLevel=FULL + multiProductBlock() for tier consistency
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
// GLOBAL VISUAL STYLE — source of truth for all VISUAL_MODE values.
// NOT injected directly (would bloat every prompt).
// Each recipe draws a condensed line from this registry.
// ─────────────────────────────────────────────────────────────────────
const VISUAL_MODE_REGISTRY = {
  'ugc-social':            'ugc-social — authentic person, natural framing, ecommerce overlays, high contrast, flat badge system. No cinematic poster look.',
  'ugc-clean-photo':       'ugc-clean-photo — authentic candid photo, natural handheld framing, believable expression, zero overlays.',
  'ecommerce-infographic': 'ecommerce-infographic — flat clean icons, mobile-readable labels, minimal effects, scannable layout.',
  'product-showcase':      'product-showcase — product-centered, brand colors, icon grid, flat circular badges, minimal decorative FX.',
  'comparison-card':       'comparison-card — two-column table, white panels with drop-shadow, emerald vs. gray headers, flat badge fills.',
  'editorial-card':        'editorial-card — magazine endorsement style, portrait + quote box, professional polish. No cinematic FX.',
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
  return `TECHNICAL: ${dims}, 1K, sharp focus. HIERARCHY: one focal point, headline/CTA dominant, max 2 short lines supporting text, bold phrases. COLOR: max 3 brand colors, CTA/price highlights only. AVOID: cinematic FX, glow effects, floating particles, AI-collage composition.`
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
    subject,
    brandLockBlock(identity, concept.productInScene, 'full'),
    concept.productInScene ? sizeLockBlock('handheld-natural') : '',
    textOverlay,
    decor,
    visualModeBlock('ugc-social'),
    technicalBlock(concept.aspectRatio),
    `STRICT: no watermark.`,
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
    subject,
    brandLockBlock(identity, concept.productInScene, 'full'),
    concept.productInScene ? sizeLockBlock('handheld-natural') : '',
    visualModeBlock('ugc-clean-photo'),
    technicalBlock(concept.aspectRatio),
    `STRICT: ZERO text/letters in image. No watermark.`,
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
    ? `LAYOUT: title at top. Below = 4-6 DISTINCT CAUSE ITEMS in 2-col or vertical list. Each item: colored icon + short ${langLabel(language)} label (max 8 words) + 1-line explanation. NO paragraph blocks, NO tiny dense text.`
    : `LAYOUT: title at top + before-after panels (red problem vs green healthy) + flow arrows + short icon labels (max 8 words each). NO explanatory paragraphs.`

  return [
    `DIAGRAM CONCEPT: ${concept.conceptScene}.`,
    brandLockBlock(identity, concept.productInScene, 'minimal'),
    concept.productInScene ? sizeLockBlock('infographic-mini') : '',
    labels,
    visualModeBlock('ecommerce-infographic'),
    layout,
    safeDecor(concept).length > 0 ? `BRAND BADGES: ${safeDecor(concept).map(formatDecor).join('; ')}` : '',
    technicalBlock(concept.aspectRatio),
    `STRICT: text legible. No watermark.`,
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
    `LAYOUT: title top + ${identity.coBrandBadges.length > 0 ? `brand badge "${identity.coBrandBadges.join(' + ')}" near title + ` : ''}product center (SHAPE LOCK) + 5-8 icon+label grid around product. Each item: ingredient/benefit name dominant + max 5-word benefit label. NO stacked text paragraphs.`,
    safeDecor(concept).length > 0 ? `EXTRA: ${safeDecor(concept).map(formatDecor).join('; ')}` : '',
    technicalBlock(concept.aspectRatio),
    `STRICT: icon labels legible. No watermark.`,
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
    `LAYOUT: LEFT column: emerald-green header, product image centered below header, green ✓ on white rows. RIGHT column: neutral gray header, red ✗ on white rows. 3-5 rows MAX, each row = ONE bold label (max 5 words) — NO sub-text, NO annotations. Bold white header text for column titles.`,
    safeDecor(concept).length > 0 ? `EXTRA: ${safeDecor(concept).map(formatDecor).join('; ')}` : '',
    technicalBlock(concept.aspectRatio),
    `STRICT: labels legible. Green ✓ + red ✗. No watermark.`,
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
      ? `LAYOUT (WARNING NEWS): Malaysian health news portal screenshot. RED/dark urgent header. LARGE BOLD alarming headline ("AMARAN!" / "Bahaya!" / "${identity.productCategory}..."). Worried subject hero photo, scary stats, ⚠️ red boxes.`
    : variant === 'trust-news'
      ? `LAYOUT (TRUST NEWS): Malaysian news portal (mStar / Berita Harian / KKM) health section. Calm institutional layout, educational headline.`
    : variant === 'whatsapp'
      ? `LAYOUT (WHATSAPP): Realistic WhatsApp chat screenshot, green bubbles, mobile portrait. Casual Malay text with emojis (🙏 ✨ ❤️). Malaysian sender names + realistic timestamps. Vary vibe per image: 1-on-1 vs group, text vs photo embed vs long reply chain. Max 2-4 short messages visible per screen focus — no bubble clutter. ⛔ CONSISTENT TYPOGRAPHY across all 4 ảnh trong section §14: SAME chat bubble font size, SAME text density, SAME bubble width proportion. NO oversized headline overlay, NO mixed-size text (chữ to chữ nhỏ lộn xộn). NO English overlay banners — ALL text in target language.`
      : `LAYOUT (SOCIAL PLATFORM): Authentic mobile UI of target platform (Facebook post / TikTok Shop review / Shopee product page / Instagram). Real-phone aesthetic, native platform spacing, casual Malay UI text + emojis, Malaysian usernames, realistic timestamps. No oversized floating typography, no cinematic overlay — realistic feed composition.`

  // whatsapp: person holds product → FULL + handheld-natural
  // social-platform / news: product = thumbnail in UI screenshot → MINIMAL + secondary
  const fLockLevel: 'full' | 'minimal' = variant === 'whatsapp' ? 'full' : 'minimal'
  const fSizeMode: SizeLockMode = variant === 'whatsapp' ? 'handheld-natural' : 'secondary-product'

  return [
    `SCREENSHOT CONCEPT: ${concept.conceptScene}.`,
    brandLockBlock(identity, concept.productInScene, fLockLevel),
    concept.productInScene ? sizeLockBlock(fSizeMode) : '',
    labels,
    variantBlock.trim(),
    safeDecor(concept).length > 0 ? `EXTRA UI: ${safeDecor(concept).map(formatDecor).join('; ')}` : '',
    technicalBlock(concept.aspectRatio),
    `STRICT: UI text legible. No watermark.`,
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
    variantBlock = `LAYOUT (SOCIAL PROOF BANNER): Bold trust banner, dark red/burgundy + cream + gold palette. Top: red header band + bold white headline. Below: 3-4 metric chips (⭐rating, "25,000+ KOTAK TERJUAL", "18,000+ PELANGGAN"). Center: 4-6 testimonial cards in 2x2/2x3 grid — Malaysian avatars (mix hijab + uncles + younger) + name + location (KL/JB/Penang) + 5-star + 1-sentence Malay quote + mini product thumb. Product image small-mid center/bottom. Trust badges bottom (HALAL, KKM, delivery, warranty). NO PRICE / currency symbol.`
  } else if (variant === 'combo-vertical') {
    variantBlock = `LAYOUT (COMBO DEALS VERTICAL): Portrait infographic stacking ALL tiers from FULL DEALS LIST. Header bold title ("HARGA TERBAIK" / "TAWARAN COMBO" in target lang). Each tier block contains: tier badge (escalating naming "RAWATAN CEPAT / MENDALAMI / MAMPAN / MAKSIMUM") + product mockup (N units = tier quantity, SHAPE LOCK on each) + deal label + price block (originalPrice gạch + salePrice highlight + savings starburst) + 2-4 benefit bullets ✅. Tier 1=blue/teal, tier 2=red/orange "HOT DEAL", tier 3=amber/gold "BEST SELLER", tier 4=purple "MAX VALUE". Vibrant ecommerce palette, clear vertical separation.`
  } else {
    variantBlock = `LAYOUT (PROMO BANNER): Native Malaysian FB/TikTok promo banner, hard-sell. Product packaging large center/side (SHAPE LOCK). Headline from PRIMARY DEAL LABEL above (e.g. "BELI 1 PERCUMA 1!"). Price block: originalPrice gạch → salePrice highlight — 1 dominant price only, visually separated from headline. Savings starburst if available. Trust badges (flat fills): ${identity.trustBadges.join(', ') || '(none)'}. CTA button visually separate. Vibrant amber/red or violet/gold palette. ⛔ KHÔNG bịa offers ngoài PRIMARY DEAL DATA above.`
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
      ? `STRICT: prices + deal label EXACTLY from PRIMARY DEAL DATA. No watermark. No invented offers.`
      : variant === 'combo-vertical'
        ? `STRICT: all tier prices + labels EXACTLY from FULL DEALS LIST. Each tier distinct + readable. No watermark.`
        : `STRICT: metric numbers + testimonial text legible. NO PRICE. No watermark.`,
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
    ? `LAYOUT (EXPERT): Editorial endorsement card — Malaysian ${specialtyHint}. Top half: head-and-shoulders portrait, calm trustworthy expression, clinical bg soft blur. Center band: "Dr. [Malaysian name]" + specialty title + "[N]+ tahun pengalaman". Bottom half: quote box with 2-4 sentence Malay testimonial endorsing this product. Optional "Pakar Disahkan" badge. Palette: white + soft teal/navy + cream.`
    : `LAYOUT (KOL): Instagram-style influencer card — Malaysian KOL. Top half: lifestyle photo (Malaysian fashionable, cafe/home/outdoor, hijab or male KOL). Center band: "@handle" + "[N]M Followers / Pengikut" + IG/TikTok icon. Bottom half: casual Malay quote 2-4 sentences with emojis (✨ 💕 🔥), optional "Pilihan Aku" hashtag. Palette: warm pink/peach + cream + gold.`

  return [
    `ENDORSEMENT CARD CONCEPT: ${concept.conceptScene}.`,
    subject,
    `PRODUCT VISIBILITY: NO product packaging in this image. Focus = person + quote. Product name only mentioned as text within the quote (NOT as visual packaging).`,
    labels,
    variantBlock.trim(),
    visualModeBlock('editorial-card'),
    technicalBlock(concept.aspectRatio),
    `STRICT: name + credentials + quote legible. No watermark.`,
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
