export interface Product {
  id: string
  productImage: string
  productName: string
  productDescription: string
  targetMarket: string
  painPoints: string
  usps: string
  benefits: string
  offer: string
  ingredients: string
  createdAt: number
}

/** A variant is a different angle/expression of the SAME avatar.
 *  Used as additional reference image(s) when generating B-roll to lock
 *  identity across multiple shots. */
export interface AvatarVariant {
  id: string
  imageUrl: string       // asset:// reference
  label: string          // e.g. "3/4 left", "side profile", "smiling close-up"
  source: 'ai-generated' | 'manual-upload'
  createdAt: number
}

export interface Model {
  id: string
  characterImage: string
  jsonProfile: Record<string, unknown> | null
  name: string
  notes: string
  source: 'character-studio' | 'image-dna-extractor' | 'manual-import'
  variants?: AvatarVariant[]   // optional alternate angles for identity-lock
  createdAt: number
}

export interface Script {
  id: string
  title: string
  scriptText: string
  linkedProductId: string
  source: 'script-architect' | 'manual'
  createdAt: number
}

export interface VoicePreset {
  id: string
  label: string
  voiceName: string
  gender: 'Female' | 'Male'
  styleInstructions: string
  creativity: number
  ambience: 'Studio' | 'Small Room'
  linkedModelId: string
  createdAt: number
}

export interface BRollVideo {
  url: string
  aspectRatio: string
  createdAt: number
}

export interface BRoll {
  id: string
  imageUrl: string
  prompt: string
  productId?: string
  modelId?: string
  scriptId?: string
  videoUrl?: string
  videos?: BRollVideo[]
  createdAt: number
}

export interface VoiceHistoryItem {
  id: string
  voiceName: string
  voiceId: string
  modelId: string
  scriptText: string
  scriptPreview: string
  audioUrl: string
  duration: number
  createdAt: number
}

export interface InterAppPayload {
  targetApp: string
  targetField: string
  data: unknown
}
