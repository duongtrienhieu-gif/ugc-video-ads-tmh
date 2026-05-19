import type { RecipeId, ImageSlotConcept, ProductIdentity, TextBlock, DecorElement } from '../types'

// ─────────────────────────────────────────────────────────────────────
// 7 VISUAL RECIPE TEMPLATES — pure string template functions.
//
// MỖI RECIPE LÀ 1 FUNCTION DUY NHẤT, KHÔNG OVERRIDE, KHÔNG LAYER.
// Đây là chỗ DUY NHẤT tạo ra prompt ENG cho image API.
// Nếu cần đổi style → chỉ sửa template tương ứng. Không sửa ngoài.
//
// Recipe map:
//   A → UGC photo + text overlay decor (hero, pain, before-after)
//   B → UGC photo sạch (failed-solutions, product-discovery, lifestyle)
//   C → Science mechanism diagram (why-happens, mechanism)
//   D → Product showcase infographic (ingredients, benefits)
//   E → Comparison table infographic (comparison)
//   F → Platform UI screenshot (social-proof, whatsapp, news-proof)
//   G → Promo banner 16:9 (offer, final-cta)
// ─────────────────────────────────────────────────────────────────────

export interface RecipeInput {
  identity: ProductIdentity
  concept:  ImageSlotConcept
  language: 'ms' | 'vi' | 'en'
}

// ── Helpers (shared across recipes) ──────────────────────────────────

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
  - Packaging: ${identity.packagingDescription}
  - Primary colors: ${identity.primaryColors.join(', ')}
  - Scale: ${identity.productScale}
  - Pose hint: ${identity.productPose}`
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
// Sections: hero, pain, before-after
// ═════════════════════════════════════════════════════════════════════
function recipeA(input: RecipeInput): string {
  const { identity, concept, language } = input
  const textOverlay = concept.textOverlayBlocks.length > 0
    ? `TEXT OVERLAY (render the following text PRECISELY as written, in ${langLabel(language)}, render every letter correctly — these are NOT placeholders):
${concept.textOverlayBlocks.map(formatTextBlock).join('\n')}`
    : 'TEXT OVERLAY: none.'

  const decor = concept.decorElements.length > 0
    ? `DECORATIVE ELEMENTS (compose on top of photo):
${concept.decorElements.map(formatDecor).join('\n')}`
    : 'DECORATIVE ELEMENTS: none.'

  return [
    `SCENE: ${concept.conceptScene}.`,
    brandLockBlock(identity, concept.productInScene),
    textOverlay,
    decor,
    `STYLE: UGC selfie / candid smartphone photo, natural indoor or real-life setting, soft daylight, slight grain, amateur authentic feel — NOT studio, NOT corporate, NOT overly polished. Real person, not stock model.`,
    `COMPOSITION: subject takes most of frame, text overlay placed clearly readable, decor elements do not obscure subject.`,
    technicalBlock(concept.aspectRatio),
    antiPatternBlock(identity),
    `STRICT: no watermarks, no fake logos other than what is required.`,
  ].filter(Boolean).join('\n\n')
}

// ═════════════════════════════════════════════════════════════════════
// RECIPE B — UGC photo sạch (no text, no decor)
// Sections: failed-solutions, product-discovery, lifestyle
// ═════════════════════════════════════════════════════════════════════
function recipeB(input: RecipeInput): string {
  const { identity, concept } = input
  return [
    `SCENE: ${concept.conceptScene}.`,
    brandLockBlock(identity, concept.productInScene),
    `TEXT OVERLAY: ZERO text in image. Do NOT render any letters, words, signs, labels, or captions.`,
    `STYLE: candid UGC photo, natural lighting, real-life setting (home / outdoor / casual indoor), authentic amateur smartphone aesthetic, genuine moment, slight grain.`,
    `COMPOSITION: human subject naturally framed, no posed studio look.`,
    technicalBlock(concept.aspectRatio),
    antiPatternBlock(identity),
    `STRICT: no text, no watermark, no decorative overlay.`,
  ].filter(Boolean).join('\n\n')
}

// ═════════════════════════════════════════════════════════════════════
// RECIPE C — Science mechanism diagram (infographic illustration)
// Sections: why-happens, mechanism
// ═════════════════════════════════════════════════════════════════════
function recipeC(input: RecipeInput): string {
  const { identity, concept, language } = input
  const labels = concept.textOverlayBlocks.length > 0
    ? `LABELS & TITLES (render PRECISELY in ${langLabel(language)}, every letter correct):
${concept.textOverlayBlocks.map(formatTextBlock).join('\n')}`
    : 'LABELS: none.'

  return [
    `DIAGRAM CONCEPT: ${concept.conceptScene}.`,
    brandLockBlock(identity, concept.productInScene),
    labels,
    `STYLE: clean mobile-friendly infographic illustration, vector / flat illustration style, soft pastel color palette (NOT photorealistic). Cartoon-style anatomical icons for organs/biology if relevant. Modern editorial layout with clear hierarchy.`,
    `COMPOSITION: title at top, side-by-side or before/after comparison panels with clear visual contrast (red/problem vs green/healthy), arrows or flow indicators between panels, supporting labels with icons, sub-caption at bottom.`,
    concept.decorElements.length > 0
      ? `BRAND BADGES TO INCLUDE: ${concept.decorElements.map(formatDecor).join('; ')}`
      : '',
    technicalBlock(concept.aspectRatio),
    antiPatternBlock(identity),
    `STRICT: text must be perfectly legible (this is an infographic — text accuracy is critical). No watermarks.`,
  ].filter(Boolean).join('\n\n')
}

// ═════════════════════════════════════════════════════════════════════
// RECIPE D — Product showcase infographic (icon grid)
// Sections: ingredients, benefits
// ═════════════════════════════════════════════════════════════════════
function recipeD(input: RecipeInput): string {
  const { identity, concept, language } = input
  const labels = concept.textOverlayBlocks.length > 0
    ? `ICON LABELS (render PRECISELY in ${langLabel(language)}):
${concept.textOverlayBlocks.map(formatTextBlock).join('\n')}`
    : 'LABELS: none.'

  return [
    `INFOGRAPHIC CONCEPT: ${concept.conceptScene}.`,
    brandLockBlock(identity, concept.productInScene),
    labels,
    `STYLE: clean modern product showcase infographic, soft inviting color palette (gradients of light blue / mint / white / cream), subtle gradient background. Mobile-friendly readable typography. Icons in soft circular containers.`,
    `COMPOSITION: prominent title at top, ${identity.coBrandBadges.length > 0 ? `brand badge "${identity.coBrandBadges.join(' + ')}" near title, ` : ''}product bottle centered or to one side, 4-8 icon-with-label items arranged in grid or circular layout around product, brief supporting Malay/target-language description below.`,
    concept.decorElements.length > 0
      ? `EXTRA ELEMENTS: ${concept.decorElements.map(formatDecor).join('; ')}`
      : '',
    technicalBlock(concept.aspectRatio),
    antiPatternBlock(identity),
    `STRICT: all icon labels must be perfectly legible. Product must match identity exactly. No watermark.`,
  ].filter(Boolean).join('\n\n')
}

// ═════════════════════════════════════════════════════════════════════
// RECIPE E — Comparison table infographic
// Sections: comparison
// ═════════════════════════════════════════════════════════════════════
function recipeE(input: RecipeInput): string {
  const { identity, concept, language } = input
  const cells = concept.textOverlayBlocks.length > 0
    ? `TABLE CONTENT (render PRECISELY in ${langLabel(language)}):
${concept.textOverlayBlocks.map(formatTextBlock).join('\n')}`
    : 'TABLE: empty (this should NOT happen).'

  return [
    `COMPARISON INFOGRAPHIC CONCEPT: ${concept.conceptScene}.`,
    brandLockBlock(identity, concept.productInScene),
    cells,
    `STYLE: clean Malaysia ecommerce-style comparison table infographic. Mobile-readable. Bold modern sans-serif typography.`,
    `COMPOSITION: 2-column comparison table — LEFT COLUMN "${identity.productNameExact}" with vibrant EMERALD green highlighted header + green checkmark icons in each cell. RIGHT COLUMN "Suplemen Lain" (or "Other Products") with GRAY background + red X mark icons. 5-7 rows of comparison attributes. Product image of "${identity.productNameExact}" placed under left column.`,
    concept.decorElements.length > 0
      ? `EXTRA ELEMENTS: ${concept.decorElements.map(formatDecor).join('; ')}`
      : '',
    technicalBlock(concept.aspectRatio),
    antiPatternBlock(identity),
    `STRICT: all row labels must be readable. Checkmarks green, X marks red. No watermark.`,
  ].filter(Boolean).join('\n\n')
}

// ═════════════════════════════════════════════════════════════════════
// RECIPE F — Platform UI screenshot (FB / TikTok / Shopee / WhatsApp / News)
// Sections: social-proof, whatsapp-testimonials, news-proof
// ═════════════════════════════════════════════════════════════════════
function recipeF(input: RecipeInput): string {
  const { identity, concept, language } = input
  const labels = concept.textOverlayBlocks.length > 0
    ? `UI TEXT CONTENT (render PRECISELY in ${langLabel(language)}, every letter correct — this is a fake screenshot, text must look authentic to the platform):
${concept.textOverlayBlocks.map(formatTextBlock).join('\n')}`
    : 'UI TEXT: empty.'

  return [
    `SCREENSHOT CONCEPT: ${concept.conceptScene}.`,
    brandLockBlock(identity, concept.productInScene),
    labels,
    `STYLE: realistic mobile phone screenshot, real-phone aesthetic with slight JPEG compression artifacts, soft phone-camera lighting if any photo is embedded. Authentic UI of the target platform (Facebook / TikTok Shop / Shopee / WhatsApp / Malaysian news website / Malaysian government health portal — whichever fits the scene). Casual Malay text with emojis if testimonial-style.`,
    `COMPOSITION: full mobile-portrait screenshot layout, includes platform UI chrome (status bar, header, action buttons) appropriate to that platform. Embedded product images (if any) match identity exactly.`,
    `AUTHENTICITY: subtle imperfections like slightly compressed image quality, real-user-name placeholders (Malaysian names like Siti, Aminah, Kak Timah, Abang Joe, Khairul, Nurul), realistic timestamps. NOT polished marketing material.`,
    concept.decorElements.length > 0
      ? `EXTRA UI ELEMENTS: ${concept.decorElements.map(formatDecor).join('; ')}`
      : '',
    technicalBlock(concept.aspectRatio),
    antiPatternBlock(identity),
    `STRICT: must look like a screenshot a real Malaysian user would have on their phone. No watermark. All UI text legible.`,
  ].filter(Boolean).join('\n\n')
}

// ═════════════════════════════════════════════════════════════════════
// RECIPE G — Promo banner 16:9 (offer, final-cta)
// ═════════════════════════════════════════════════════════════════════
function recipeG(input: RecipeInput): string {
  const { identity, concept, language } = input
  const banner = concept.textOverlayBlocks.length > 0
    ? `BANNER TEXT (render PRECISELY in ${langLabel(language)}, every letter correct, bold ecommerce-banner typography):
${concept.textOverlayBlocks.map(formatTextBlock).join('\n')}`
    : 'BANNER TEXT: empty.'

  return [
    `BANNER CONCEPT: ${concept.conceptScene}.`,
    brandLockBlock(identity, concept.productInScene),
    banner,
    `STYLE: native Malaysian Facebook/TikTok ecommerce promo banner, bold hard-sell visual, NOT luxury or cinematic. Vibrant color contrast. Bold modern sans-serif typography with multi-line stacked headlines.`,
    `COMPOSITION: product packaging large and clearly centered or to one side, main offer text occupying significant area, ${identity.trustBadges.length > 0 ? `trust badges (${identity.trustBadges.join(', ')}) visible, ` : ''}price tag "${identity.priceTag}" prominently displayed, CTA button shape (rounded rectangle with directional arrow).`,
    concept.decorElements.length > 0
      ? `EXTRA ELEMENTS: ${concept.decorElements.map(formatDecor).join('; ')}`
      : '',
    technicalBlock(concept.aspectRatio),
    antiPatternBlock(identity),
    `STRICT: price must read EXACTLY "${identity.priceTag}". All banner text legible. Product exactly matches identity. No watermark.`,
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
}
