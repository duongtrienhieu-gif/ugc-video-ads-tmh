// ── Atomic Avatar Generator (P5) ────────────────────────────────────────────
//
// Generates the small circular profile-photo asset used by chat-proof
// templates (visible in WhatsApp header / on every Messenger incoming
// bubble). KIE GPT-4o image-to-image, 1:1, single output.
//
// Design choices:
//   • Always 1:1 — chat avatars are square crops
//   • Persona-aware: derives subject description from a persona id when
//     provided, else from the participant.avatarHint text
//   • No product reference attached — avatars are people only

import { generateGpt4oImage } from '../../../../../utils/kieai'
import { saveAsset, getUrl } from '../../../../../utils/assetStore'
import { findPersona } from '../../../shared/metadata/personaLibrary'

export interface AvatarGenSpec {
  /** Free-form hint (used when no persona id present). */
  hint: string
  /** Persona id from personaLibrary — auth-source for archetype. */
  personaId?: string
}

const AVATAR_BASE_PROMPT =
  'Casual smartphone selfie portrait, head-and-shoulders crop, soft natural daylight, '
  + 'neutral indoor background slightly out of focus, authentic skin texture with pores and '
  + 'minor imperfections, no professional retouching, no studio lighting, no makeup gloss, '
  + 'slight asymmetric framing as if a real selfie. The person looks relaxed and looking '
  + 'slightly off-camera, NOT a posed headshot, NOT a model portfolio shot.'

const AVATAR_HARD_BANS =
  'AVOID: studio glamour photo, model headshot, magazine portrait, professional retouching, '
  + 'plastic AI-glossy skin, perfect symmetric framing, ring light reflection in eyes, '
  + 'commercial advertising look.'

/** Build the full KIE prompt for an avatar given a spec. */
export function buildAvatarPrompt(spec: AvatarGenSpec): string {
  const persona = spec.personaId ? findPersona(spec.personaId) : null
  const subjectBlock = persona
    ? `Subject (lock to this archetype): ${persona.appearance}`
    : `Subject hint: ${spec.hint}`

  return [subjectBlock, '', AVATAR_BASE_PROMPT, '', AVATAR_HARD_BANS].join('\n')
}

/** Generate one avatar via KIE, persist via saveAsset, return public URL. */
export async function generateAvatar(
  apiKey: string,
  spec: AvatarGenSpec,
  signal?: AbortSignal,
): Promise<string> {
  const prompt = buildAvatarPrompt(spec)

  const remoteUrl = await generateGpt4oImage({
    apiKey,
    prompt,
    size: '1:1',
    signal,
  })

  const res = await fetch(remoteUrl)
  if (!res.ok) throw new Error(`[ui-native avatar] fetch ${res.status}`)
  const blob = await res.blob()
  if (blob.size < 1000) throw new Error('[ui-native avatar] response too small')

  const assetRef = await saveAsset(blob, blob.type || 'image/png')
  const url = await getUrl(assetRef)
  if (!url) throw new Error('[ui-native avatar] saveAsset returned no URL')
  return url
}
