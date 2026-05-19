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
    `STYLE: UGC selfie / candid smartphone photo, natural indoor or real-life setting, soft daylight, slight grain, amateur authentic feel — NOT studio, NOT corporate, NOT overly polished.`,
    `COMPOSITION: subject takes most of frame, text overlay placed clearly readable, decor elements do not obscure subject.`,
    `STRICT TEXT RULE: do NOT render any price tag, currency symbol (RM/Rp/$/đ), or numeric price in this image.`,
    technicalBlock(concept.aspectRatio),
    antiPatternBlock(identity),
    `STRICT: no watermarks, no fake logos other than required brand badges.`,
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
    `TEXT OVERLAY: ZERO text in image. Do NOT render any letters, words, signs, labels, or captions.`,
    `STYLE: candid UGC photo, natural lighting, real-life setting, authentic amateur smartphone aesthetic, genuine moment, slight grain.`,
    `COMPOSITION: human subject naturally framed, no posed studio look.`,
    technicalBlock(concept.aspectRatio),
    antiPatternBlock(identity),
    `STRICT: no text, no watermark, no decorative overlay.`,
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

  const compositionExtra = isWhyHappens
    ? `COMPOSITION: title at top. Below: list of 4-6 DISTINCT CAUSE ITEMS, each one having: (a) a circular colored icon on the left (different color per cause: red/orange/blue/purple/green/pink), (b) a short Malay/target-language label next to icon, (c) brief 1-sentence explanation. Arrange in 2 columns OR vertical list. Modern editorial layout.`
    : `COMPOSITION: title at top, side-by-side or before/after comparison panels with clear visual contrast (red/problem vs green/healthy), arrows or flow indicators between panels, supporting labels with icons, sub-caption at bottom.`

  return [
    `DIAGRAM CONCEPT: ${concept.conceptScene}.`,
    brandLockBlock(identity, concept.productInScene),
    labels,
    `STYLE: clean mobile-friendly infographic illustration, vector / flat illustration style, soft pastel color palette (NOT photorealistic). Cartoon-style anatomical icons for organs/biology if relevant. Modern editorial layout with clear hierarchy.`,
    compositionExtra,
    safeDecor(concept).length > 0
      ? `BRAND BADGES TO INCLUDE: ${safeDecor(concept).map(formatDecor).join('; ')}`
      : '',
    technicalBlock(concept.aspectRatio),
    antiPatternBlock(identity),
    `STRICT: text must be perfectly legible (this is an infographic — text accuracy is critical). No watermarks.`,
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
    `STYLE: clean modern product showcase infographic, soft inviting color palette (gradients matching product brand colors), subtle gradient background. Mobile-friendly readable typography. Icons in soft circular containers.`,
    `COMPOSITION: prominent title at top, ${identity.coBrandBadges.length > 0 ? `brand badge "${identity.coBrandBadges.join(' + ')}" near title, ` : ''}product packaging centered (in proper SHAPE — see SHAPE LOCK above), 5-8 icon-with-label items arranged in grid or circular layout around product. Each item: distinct colored icon + short target-language label. Brief supporting description below.`,
    safeDecor(concept).length > 0
      ? `EXTRA ELEMENTS: ${safeDecor(concept).map(formatDecor).join('; ')}`
      : '',
    technicalBlock(concept.aspectRatio),
    antiPatternBlock(identity),
    `STRICT: ALL icon labels must be perfectly legible. Product MUST match SHAPE LOCK exactly. No watermark.`,
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
    `STYLE: PREMIUM Malaysia ecommerce comparison table — clean modern luxury feel, NOT basic spreadsheet look. Bold typography hierarchy. Glassmorphism or soft-shadow card style for the table. Subtle gradient background.`,
    `COMPOSITION: 2-column comparison table — LEFT COLUMN "${identity.productNameExact}" header with vibrant EMERALD/teal highlighted background + premium glow accent + green ✓ checkmark icons in each cell (each on a soft mint circular badge). RIGHT COLUMN "Suplemen Lain" / "Other products" with neutral GRAY background + red ✗ X mark icons (each on a soft pink/red circular badge). 5-7 rows of comparison attributes with bold target-language labels. Product image of "${identity.productNameExact}" placed prominently under left column header with subtle glow halo. Optional: small trust badges at bottom.`,
    safeDecor(concept).length > 0
      ? `EXTRA ELEMENTS: ${safeDecor(concept).map(formatDecor).join('; ')}`
      : '',
    technicalBlock(concept.aspectRatio),
    antiPatternBlock(identity),
    `STRICT: premium polished aesthetic — NOT basic Excel-like grid. Row labels legible. Checkmarks emerald green, X marks soft red. No watermark.`,
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

  // Variant-specific composition + style
  let variantBlock = ''
  if (variant === 'warning-news') {
    variantBlock = `
LAYOUT (WARNING NEWS variant):
  - Looks like a Malaysian news portal article OR viral Facebook health warning post.
  - HEADER bar in RED or DARK URGENT color (NOT calm blue). Site name like "Berita Kesihatan", "Amaran Kesihatan MY", or "Mediahealth Malaysia".
  - Headline LARGE BOLD reading like a warning/scare-tactic news article (e.g. "AMARAN! Ribuan rakyat Malaysia mengalami...", "Bahaya! Masalah ${identity.productCategory} jika tidak dirawat...")
  - Hero photo shows a worried/concerned subject OR alarming visual (illustration of damage).
  - Below: scary subheadline, fear-amplifying paragraph, scary statistics.
  - Red highlight boxes, exclamation marks, warning emoji ⚠️ if appropriate.
  - Authentic Malaysian news article layout — NOT promotional/marketing.
  - Slight JPEG compression artifacts, real-phone screenshot aesthetic.`
  } else if (variant === 'trust-news') {
    variantBlock = `
LAYOUT (TRUST NEWS variant):
  - Authentic Malaysian news portal (e.g. mStar, Berita Harian) health section OR Kementerian Kesihatan Malaysia (KKM) website.
  - Calm trustworthy layout with institutional branding.
  - Headline informational/educational tone.
  - Authoritative visuals.`
  } else if (variant === 'whatsapp') {
    variantBlock = `
LAYOUT (WHATSAPP variant):
  - Realistic WhatsApp chat screenshot — green bubbles.
  - VIBE variation: each WhatsApp image in a section should have DIFFERENT vibe — vary by: (a) 1-on-1 chat vs group chat with many participants visible, (b) text-only message vs message with product photo embed vs voice message bubble, (c) different time-of-day timestamps, (d) different sender names (Malaysian: Kak Timah, Abang Joe, Siti Aminah, Khairul Nizam, Nurul Huda, Aishah, etc).
  - Casual Malay text with emojis (🙏 ✨ 🤲 ❤️ 💪).`
  } else {
    variantBlock = `
LAYOUT (SOCIAL PLATFORM variant):
  - Authentic mobile UI of target platform (Facebook post + comments / TikTok Shop review / Shopee product page / Instagram post / Muslim selfie style UGC).
  - Real-phone aesthetic with slight JPEG compression.
  - Casual Malay UI text with emojis. Malaysian real-user-name placeholders. Realistic timestamps.`
  }

  return [
    `SCREENSHOT CONCEPT: ${concept.conceptScene}.`,
    brandLockBlock(identity, concept.productInScene),
    labels,
    variantBlock.trim(),
    `STYLE: looks like a screenshot a real Malaysian user would have on their phone.`,
    safeDecor(concept).length > 0
      ? `EXTRA UI ELEMENTS: ${safeDecor(concept).map(formatDecor).join('; ')}`
      : '',
    technicalBlock(concept.aspectRatio),
    antiPatternBlock(identity),
    `STRICT: All UI text legible. No watermark.`,
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
  - HEADER: dark red or burgundy band at top with bold white headline (e.g. "BUKTI KEPERCAYAAN: RIBUAN RAKYAT MALAYSIA TELAH MENCUBA!").
  - METRICS ROW just below header (3-4 large stat blocks): ⭐ 4.8/5 Rating + Sales count (e.g. "25,000+ KOTAK TERJUAL") + Satisfied customer count (e.g. "18,000+ PELANGGAN BERPUAS HATI") + optional trending badge.
  - TESTIMONIAL CARDS: each card shows a small avatar (Malaysian — mix male + female + various ages including hijab women + uncles), full Malaysian name, location (e.g. "Kuala Lumpur", "Johor Bahru", "Penang"), 5-star rating, short Malay testimonial 1-2 sentences. Mini product thumbnail attached to some cards.
  - PRODUCT IMAGE: small to mid-size in center or bottom — packaging in correct SHAPE LOCK.
  - BOTTOM ROW: trust badges (delivery icon "Penghantaran Pantas 1-3 Hari", warranty icon "Jaminan Pulangan Wang 7 Hari", QR code "Pengesahan Keaslian", HALAL + KKM badges).
  - Color palette: dark red/burgundy primary + cream/off-white secondary + gold accents. Premium hard-sell ecommerce feel.`
  } else {
    // promo variant
    variantBlock = `
LAYOUT (PROMO BANNER variant):
  - Native Malaysian Facebook/TikTok ecommerce promo banner. Bold hard-sell visual.
  - Product packaging large and clearly centered or to one side — SHAPE LOCK must be respected.
  - Multi-line stacked headlines in bold modern condensed sans-serif.
  - PRICE TAG "${identity.priceTag}" prominently displayed (this is allowed — promo banner is the ONE place price is rendered in-image).
  - Trust badges visible: ${identity.trustBadges.join(', ') || '(none)'}.
  - CTA button shape with directional arrow.
  - Color palette: vibrant high-contrast (amber/red gradient OR violet/gold) matching ecommerce hard-sell aesthetic.`
  }

  return [
    `BANNER CONCEPT: ${concept.conceptScene}.`,
    brandLockBlock(identity, concept.productInScene),
    banner,
    variantBlock.trim(),
    safeDecor(concept).length > 0
      ? `EXTRA ELEMENTS: ${safeDecor(concept).map(formatDecor).join('; ')}`
      : '',
    technicalBlock(concept.aspectRatio),
    antiPatternBlock(identity),
    variant === 'promo'
      ? `STRICT: price must read EXACTLY "${identity.priceTag}". All banner text legible. Product exactly matches SHAPE LOCK. No watermark.`
      : `STRICT: all metric numbers + testimonial text legible. Avatars look like real Malaysian people. No watermark.`,
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

  let variantBlock = ''
  if (variant === 'expert') {
    variantBlock = `
LAYOUT (EXPERT variant):
  - Professional editorial endorsement card — Malaysian dental/health expert.
  - TOP half (~50%): clean head-and-shoulders portrait of expert in professional attire (white coat for dentist/doctor, OR smart business attire for nutritionist). Calm trustworthy expression. Clinical or office background, soft blur.
  - CENTER overlay band: EXPERT NAME (e.g. "Dr. Siti Aminah binti Hassan"), specialty/title (e.g. "Pakar Pergigian / Dental Specialist"), years of experience (e.g. "15+ tahun pengalaman").
  - BOTTOM half: clean quote box with professional Malay testimonial (2-4 sentences) — formal tone endorsing the product. Quotation marks decoration. Optional small "Pakar Disahkan" or verified badge.
  - Color palette: clean white + soft teal/navy + cream. Editorial trust feel.`
  } else {
    variantBlock = `
LAYOUT (KOL variant):
  - Instagram-style influencer endorsement card — Malaysian KOL/celebrity.
  - TOP half: stylish lifestyle photo of KOL (Malaysian, fashionable, smiling, modern setting like cafe / home / outdoor — could be hijab influencer OR male KOL). Vibrant aesthetic.
  - CENTER overlay band: KOL NAME (e.g. "@nurul_aminah"), follower count badge (e.g. "1.2M Followers" or "850K Pengikut"), platform icon (Instagram/TikTok).
  - BOTTOM half: casual quote box with friendly Malay testimonial (2-4 sentences) — informal personal recommendation tone. Emoji-rich (✨ 💕 🔥). Optional "Pilihan Aku" or hashtag.
  - Color palette: warm pink/peach + cream + soft gold accents. Influencer aesthetic.`
  }

  return [
    `ENDORSEMENT CARD CONCEPT: ${concept.conceptScene}.`,
    subject,
    `PRODUCT VISIBILITY: NO product packaging shown in this image — focus is on the PERSON and the QUOTE. Do NOT include the "${identity.productNameExact}" jar/box in this image. (The product name only appears as text mention within the quote.)`,
    labels,
    variantBlock.trim(),
    `STYLE: editorial polish — looks like a magazine/feature endorsement card, NOT amateur UGC. Mobile-readable layout.`,
    technicalBlock(concept.aspectRatio),
    antiPatternBlock(identity),
    `STRICT: name + credentials/followers + quote text MUST all be legible. Person must match subject lock. No watermark.`,
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
