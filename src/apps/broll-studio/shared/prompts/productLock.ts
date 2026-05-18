// ── Shared Product Identity Lock Block (P3) ─────────────────────────────────
//
// Extracted from BrollStudio.tsx legacy `productLock` block. Single source
// of truth — every photographic module composes its final prompt with
// this string. Modules MUST NOT redefine or weaken the lock.

export const PRODUCT_LOCK_BLOCK =
`[PRODUCT LOCK — HIGHEST PRIORITY]
The product in the FIRST reference image must be reproduced EXACTLY:
- Same container shape (jar / bottle / tube / box / pouch as shown)
- Same colors on the packaging
- Same logo / brand mark — do not redraw
- Same label text, same typography, same wording — do not rewrite or invent text
- Same proportions and silhouette
This product MUST be recognizable as the SAME real-world item. Do NOT substitute a similar product, do NOT redesign the packaging, do NOT invent new label copy.`

export const AVATAR_LOCK_BLOCK =
`[AVATAR REFERENCE — RELAXED]
Generate a person who resembles the SECOND reference image:
- Same approximate age, gender, ethnicity, skin tone
- Similar hair / hijab color and overall hairstyle
- Similar body type
An approximate resemblance is enough — a perfect face match is NOT required, but do NOT generate an obviously different random person.`

/** Reference-map text matching the legacy buildPrompt() refMap branch. */
export function buildRefMapText(hasAvatar: boolean, hasBaseRef: boolean): string {
  if (hasBaseRef && hasAvatar) {
    return 'The FIRST reference image is the product. The SECOND reference image is the person (avatar). The THIRD reference image is the previously generated photo from this same shoot — use it as a cohesion anchor for outfit, background, and overall look.'
  }
  if (hasBaseRef) {
    return 'The FIRST reference image is the product. The SECOND reference image is the previously generated photo from this same shoot — use it as a cohesion anchor.'
  }
  if (hasAvatar) {
    return 'The FIRST reference image is the product. The SECOND reference image is the person (avatar).'
  }
  return 'The FIRST reference image is the product.'
}
