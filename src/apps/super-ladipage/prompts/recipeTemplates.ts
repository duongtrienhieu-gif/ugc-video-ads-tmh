import type { RecipeId, ImageSlotConcept, ProductIdentity, TextBlock, DecorElement } from '../types'

// ─────────────────────────────────────────────────────────────────────
// 8 VISUAL RECIPE TEMPLATES (P4 update).
//
// Changes from Phase 3:
// - A: drop price-tag in hero/discovery; inject subjectIdentityLock + packagingShape
// - C: enforce 4-6 cause icons for why-happens diagram
// - F: split sub-variants 'trust-news' | 'warning-news' | 'social-platform' | 'whatsapp'
// - G: split sub-variants 'promo' | 'social-proof-banner'
// - H NEW: Expert/KOL endorsement card
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
    t.style === 'glassmorphism-badge'  ? 'small rounded glassmorphism badge with emoji prefix' :
    t.style === 'star-rating'          ? 'metric chip with star rating' :
                                          'clean readable sans-serif'
  return `  - "${t.text}" — role=${t.role}, position=${t.position}, style=${styleHint}`
}

function formatDecor(d: DecorElement): string {
  const desc =
    d.type === 'glassmorphism-badge'  ? `glassmorphism rounded badge "${d.text ?? ''}"` :
    d.type === 'arrow'                ? `small decorative arrow sticker${d.text ? ` pointing to ${d.text}` : ''}` :
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

function brandLockBlock(identity: ProductIdentity, productInScene: boolean): string {
  if (!productInScene) {
    return `PRODUCT VISIBILITY: NO product visible in this image. Do NOT render any "${identity.productNameExact}" or branded bottle.`
  }
  return `PRODUCT IDENTITY (MUST match exactly — DO NOT improvise packaging):
  - Exact product name on label: "${identity.productNameExact}"
  - SHAPE LOCK: ${identity.packagingShape}
  - Packaging details: ${identity.packagingDescription}
  - Primary colors: ${identity.primaryColors.join(', ')}
  - Scale: ${identity.productScale}
  - Pose hint: ${identity.productPose}`
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

function antiPatternBlock(identity: ProductIdentity): string {
  if (identity.visualAntiPatterns.length === 0) return ''
  return `ABSOLUTE AVOID (off-niche for "${identity.productCategory}"): ${identity.visualAntiPatterns.join('; ')}.`
}

function technicalBlock(aspectRatio: string): string {
  const dims =
    aspectRatio === '1:1'  ? '1024×1024' :
    aspectRatio === '4:5'  ? '1024×1280 (mapped to 2:3 portrait)' :
    aspectRatio === '16:9' ? '1024×576 (mapped to 3:2 landscape)' :
    aspectRatio === '9:16' ? '832×1248 (mapped to 2:3 portrait)' :
                              '1024×1024'
  return `TECHNICAL: ${dims}, 1K resolution, sharp focus, web-ready.`
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
    ? `TEXT OVERLAY (render the following text PRECISELY as written, in ${langLabel(language)}, render every letter correctly):
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
    brandLockBlock(identity, concept.productInScene),
    textOverlay,
    decor,
    `STYLE: candid UGC smartphone photo — natural light, slight grain, amateur authentic. Subject fills frame; overlay readable; decor doesn't obscure subject.`,
    technicalBlock(concept.aspectRatio),
    antiPatternBlock(identity),
    `STRICT: no watermark, no price tag in image, no logos other than required brand badges.`,
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
    brandLockBlock(identity, concept.productInScene),
    `STYLE: candid UGC photo — natural light, real-life setting, amateur smartphone aesthetic. Subject naturally framed.`,
    technicalBlock(concept.aspectRatio),
    antiPatternBlock(identity),
    `STRICT: ZERO text/letters/labels/captions in image. No watermark. No decorative overlay.`,
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
    ? `LABELS & TITLES (render PRECISELY in ${langLabel(language)}, every letter correct):
${safeBlocks(concept).map(formatTextBlock).join('\n')}`
    : 'LABELS: none.'

  const isWhyHappens = concept.roleLabel.toLowerCase().includes('cause') ||
                       concept.roleLabel.toLowerCase().includes('nguyên nhân') ||
                       concept.roleLabel.toLowerCase().includes('why')

  const layout = isWhyHappens
    ? `LAYOUT: title at top. Below = 4-6 DISTINCT CAUSE ITEMS in 2-col or vertical list. Each item: circular colored icon (different color per cause: red/orange/blue/purple/green/pink) + short ${langLabel(language)} label + brief 1-sentence explanation.`
    : `LAYOUT: title at top + side-by-side / before-after comparison panels (red problem vs green healthy) + flow arrows + supporting labels with icons + sub-caption.`

  return [
    `DIAGRAM CONCEPT: ${concept.conceptScene}.`,
    brandLockBlock(identity, concept.productInScene),
    labels,
    `STYLE: clean mobile-friendly infographic — vector/flat illustration, soft pastel palette (NOT photorealistic), cartoon-anatomical icons, editorial hierarchy.`,
    layout,
    safeDecor(concept).length > 0 ? `BRAND BADGES: ${safeDecor(concept).map(formatDecor).join('; ')}` : '',
    technicalBlock(concept.aspectRatio),
    antiPatternBlock(identity),
    `STRICT: text legibility is critical (infographic). No watermark.`,
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
    ? `ICON LABELS (render PRECISELY in ${langLabel(language)}):
${safeBlocks(concept).map(formatTextBlock).join('\n')}`
    : 'LABELS: none.'

  return [
    `INFOGRAPHIC CONCEPT: ${concept.conceptScene}.`,
    brandLockBlock(identity, concept.productInScene),
    labels,
    `STYLE: clean modern product showcase — soft inviting palette matching brand colors, gradient background, icons in soft circular containers, mobile-readable.`,
    `LAYOUT: title top + ${identity.coBrandBadges.length > 0 ? `brand badge "${identity.coBrandBadges.join(' + ')}" near title + ` : ''}product packaging centered (SHAPE LOCK applied) + 5-8 icon+label items in grid/circular around product + brief description below.`,
    safeDecor(concept).length > 0 ? `EXTRA: ${safeDecor(concept).map(formatDecor).join('; ')}` : '',
    technicalBlock(concept.aspectRatio),
    antiPatternBlock(identity),
    `STRICT: all icon labels legible. Product matches SHAPE LOCK. No watermark.`,
  ].filter(Boolean).join('\n\n')
}

// ═════════════════════════════════════════════════════════════════════
// RECIPE E — Comparison table infographic (PREMIUM upgrade per P4)
// Sections: comparison
// ═════════════════════════════════════════════════════════════════════
function recipeE(input: RecipeInput): string {
  const { identity, concept, language } = input
  const cells = safeBlocks(concept).length > 0
    ? `TABLE CONTENT (render PRECISELY in ${langLabel(language)}):
${safeBlocks(concept).map(formatTextBlock).join('\n')}`
    : 'TABLE: empty (this should NOT happen).'

  return [
    `COMPARISON INFOGRAPHIC CONCEPT: ${concept.conceptScene}.`,
    brandLockBlock(identity, concept.productInScene),
    cells,
    `STYLE: PREMIUM Malaysia ecommerce comparison table — luxury feel (NOT spreadsheet). Glassmorphism / soft-shadow cards. Subtle gradient bg. Bold typography hierarchy.`,
    `LAYOUT: 2-column table. LEFT "${identity.productNameExact}" with vibrant EMERALD/teal header + glow accent + green ✓ on soft mint circular badges. RIGHT "Suplemen Lain" with neutral gray + red ✗ on soft pink badges. 5-7 rows with bold ${langLabel(language)} labels. Product image under left column header with glow halo. Optional small trust badges at bottom.`,
    safeDecor(concept).length > 0 ? `EXTRA: ${safeDecor(concept).map(formatDecor).join('; ')}` : '',
    technicalBlock(concept.aspectRatio),
    antiPatternBlock(identity),
    `STRICT: premium polish (not Excel grid). Labels legible. Green ✓ + red ✗. No watermark.`,
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
    ? `UI TEXT CONTENT (render PRECISELY in ${langLabel(language)}, every letter correct — this is a fake screenshot, text must look authentic to the platform):
${safeBlocks(concept).map(formatTextBlock).join('\n')}`
    : 'UI TEXT: empty.'

  // Variant-specific layout (each variant self-contained — no duplicate outro)
  const variantBlock =
    variant === 'warning-news' ? `
LAYOUT (WARNING NEWS):
  - Looks like Malaysian news portal article OR viral FB health warning post. Real-phone screenshot, slight JPEG compression.
  - HEADER bar RED/DARK URGENT (NOT calm blue). Site name e.g. "Berita Kesihatan", "Amaran Kesihatan MY".
  - Headline LARGE BOLD warning/scare-tactic (e.g. "AMARAN! Ribuan rakyat Malaysia...", "Bahaya! Masalah ${identity.productCategory}...").
  - Hero photo of worried subject OR alarming visual.
  - Scary subheadline, fear-amplifying paragraph, scary stats. Red boxes, ⚠️ if fits.`
  : variant === 'trust-news' ? `
LAYOUT (TRUST NEWS):
  - Malaysian news portal (mStar, Berita Harian) health section OR KKM portal.
  - Calm trustworthy institutional layout. Educational headline.`
  : variant === 'whatsapp' ? `
LAYOUT (WHATSAPP):
  - Realistic WhatsApp chat screenshot, green bubbles, real-phone aesthetic.
  - VIBE varies per image in section: 1-on-1 vs group chat / text vs photo embed vs voice bubble / different timestamps / different sender names (Kak Timah, Abang Joe, Siti Aminah, Khairul Nizam, Nurul Huda, Aishah...).
  - Casual Malay text with emojis (🙏 ✨ 🤲 ❤️ 💪).`
  : `
LAYOUT (SOCIAL PLATFORM):
  - Authentic mobile UI of target platform (FB post + comments / TikTok Shop review / Shopee product page / Instagram post / Muslim selfie UGC).
  - Real-phone aesthetic, slight JPEG compression. Casual Malay UI text + emojis. Malaysian usernames + realistic timestamps.`

  return [
    `SCREENSHOT CONCEPT: ${concept.conceptScene}.`,
    brandLockBlock(identity, concept.productInScene),
    labels,
    variantBlock.trim(),
    safeDecor(concept).length > 0 ? `EXTRA UI: ${safeDecor(concept).map(formatDecor).join('; ')}` : '',
    technicalBlock(concept.aspectRatio),
    antiPatternBlock(identity),
    `STRICT: all UI text legible. No watermark.`,
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
    ? `BANNER TEXT (render PRECISELY in ${langLabel(language)}, every letter correct):
${safeBlocks(concept).map(formatTextBlock).join('\n')}`
    : 'BANNER TEXT: empty.'

  let variantBlock = ''
  if (variant === 'social-proof-banner') {
    variantBlock = `
LAYOUT (SOCIAL PROOF BANNER variant):
  - Bold trust-building banner with 4-6 customer testimonial cards arranged in 2x2 or 2x3 grid.
  - HEADER: dark red/burgundy band + bold white headline (e.g. "BUKTI KEPERCAYAAN: RIBUAN RAKYAT MALAYSIA TELAH MENCUBA!").
  - METRICS ROW (3-4 stat blocks): ⭐4.8/5 + sales count (e.g. "25,000+ KOTAK TERJUAL") + satisfied count ("18,000+ PELANGGAN BERPUAS HATI") + optional trending badge.
  - 4-6 TESTIMONIAL CARDS: small Malaysian avatar (mix gender + age + hijab + uncles) + full name + location (KL/JB/Penang) + 5-star + 1-2 sentence Malay testimonial. Mini product thumbnail attached.
  - PRODUCT IMAGE: small-mid size center/bottom, SHAPE LOCK applied.
  - BOTTOM: trust badges (delivery "Penghantaran Pantas 1-3 Hari", warranty "Jaminan Pulangan Wang 7 Hari", QR + HALAL + KKM).
  - NO PRICE / NO currency symbol in this image — trust signals only.
  - PALETTE: dark red/burgundy + cream + gold. Premium hard-sell.`
  } else {
    variantBlock = `
LAYOUT (PROMO BANNER):
  - Native Malaysian FB/TikTok ecommerce promo banner. Hard-sell visual.
  - Product packaging large, centered or to one side, SHAPE LOCK applied.
  - Multi-line stacked headlines in bold condensed sans-serif.
  - PRICE "${identity.priceTag}" prominently displayed (promo is one of 2 places price is allowed in-image).
  - Trust badges: ${identity.trustBadges.join(', ') || '(none)'}.
  - CTA button shape with directional arrow.
  - PALETTE: vibrant high-contrast (amber/red OR violet/gold), ecommerce hard-sell.`
  }

  return [
    `BANNER CONCEPT: ${concept.conceptScene}.`,
    brandLockBlock(identity, concept.productInScene),
    banner,
    variantBlock.trim(),
    safeDecor(concept).length > 0 ? `EXTRA: ${safeDecor(concept).map(formatDecor).join('; ')}` : '',
    technicalBlock(concept.aspectRatio),
    antiPatternBlock(identity),
    variant === 'promo'
      ? `STRICT: price reads EXACTLY "${identity.priceTag}". Banner text legible. Product matches SHAPE LOCK. No watermark.`
      : `STRICT: metric numbers + testimonial text legible. Avatars look like real Malaysians. NO PRICE / currency symbol in image. No watermark.`,
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
    ? `TEXT CONTENT (render PRECISELY in ${langLabel(language)}, every letter correct):
${safeBlocks(concept).map(formatTextBlock).join('\n')}`
    : 'TEXT: empty (this should NOT happen — expert/KOL card requires text).'

  const variantBlock = variant === 'expert' ? `
LAYOUT (EXPERT):
  - Professional editorial endorsement card — Malaysian dental/health expert.
  - TOP half: head-and-shoulders portrait in professional attire (white coat for doctor/dentist OR smart attire for nutritionist), calm trustworthy expression, clinical/office bg with soft blur.
  - CENTER band: EXPERT NAME (e.g. "Dr. Siti Aminah binti Hassan") + specialty ("Pakar Pergigian / Dental Specialist") + years exp ("15+ tahun pengalaman").
  - BOTTOM half: clean quote box, professional Malay testimonial (2-4 sentences), formal endorsing tone, quotation marks decor. Optional "Pakar Disahkan" badge.
  - PALETTE: white + soft teal/navy + cream. Editorial trust feel.`
  : `
LAYOUT (KOL):
  - Instagram-style influencer endorsement card — Malaysian KOL.
  - TOP half: stylish lifestyle photo (Malaysian fashionable smiling, cafe/home/outdoor, hijab influencer OR male KOL), vibrant.
  - CENTER band: handle (e.g. "@nurul_aminah") + follower badge ("1.2M Followers" / "850K Pengikut") + platform icon (Instagram/TikTok).
  - BOTTOM half: casual quote box, friendly Malay testimonial (2-4 sentences), emoji-rich (✨ 💕 🔥), optional "Pilihan Aku" hashtag.
  - PALETTE: warm pink/peach + cream + gold. Influencer aesthetic.`

  return [
    `ENDORSEMENT CARD CONCEPT: ${concept.conceptScene}.`,
    subject,
    `PRODUCT VISIBILITY: NO product packaging in this image. Focus = person + quote. Product name only mentioned as text within the quote (NOT as visual packaging).`,
    labels,
    variantBlock.trim(),
    `STYLE: editorial polish (magazine/feature card, NOT amateur UGC). Mobile-readable.`,
    technicalBlock(concept.aspectRatio),
    antiPatternBlock(identity),
    `STRICT: name + credentials/followers + quote legible. Person matches subject lock. No watermark.`,
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
