export interface EditableProductContext {
  productDescription: string
  targetMarket: string
  painPoints: string
  usps: string
  benefits: string
  offer: string
  cta: string
}

export interface GenerateScriptInput {
  winningTranscript: string
  productId: string | null
  productContext?: EditableProductContext
  attachedImage?: { base64: string; mimeType: string } | null
}

export interface GeneratedVariants {
  variants: string[]
}
