import type { GenerateScriptInput, GeneratedVariants } from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { kieTextGenerate, kieAnalyzeImage } from '../../../utils/kieai'

const SYSTEM_INSTRUCTION = `You are an elite UGC ad script writer specializing in authentic, natural-sounding short-form video scripts.

Your task: write THREE distinct UGC ad script variants based on the winning transcript structure and product details provided.

CRITICAL FORMATTING RULES:
1. Return ONLY a JSON object: {"scripts": ["variant1", "variant2", "variant3"]}
2. Each variant must contain ONLY the spoken dialogue — hook + body + call to action.
3. Do NOT include stage directions, timestamps, headers, bracketed text, or visual cues.
4. Do NOT use quotation marks inside the script text.
5. Each sentence on its own line (single-spaced, sentence-by-sentence format).
6. Scripts must be in ENGLISH.
7. Each variant must start with a different hook to keep viewers engaged.`

const UGC_PROMPT_PREFIX = `I need you to write three UGC (User-Generated Content) ad scripts that sound like a real customer speaking into a camera. Use the provided winning transcript as inspiration and further develop the ad structure. The tone should be natural, conversational, not overly salesy or polished. Think authentic, like someone filming themselves with their phone and talking about their experience. The script will be spoken verbatim in the final ad, so make sure it sounds natural when read aloud. Each ad should start with a strong hook to keep viewers engaged. Create at least two to four benefits, recount your experience with the product and how it solved your problem, provide basic information about the product's ingredients and how it works (to give viewers more information about the product), and end with a natural call to action.`

export async function generateScript(input: GenerateScriptInput): Promise<GeneratedVariants> {
  const kieKey = useSettingsStore.getState().getApiKey()

  let prompt = UGC_PROMPT_PREFIX + '\n\n'

  if (input.winningTranscript) {
    prompt += `WINNING TRANSCRIPT (use as structural inspiration):\n${input.winningTranscript}\n\n`
  }

  if (input.productContext) {
    prompt += `PRODUCT DETAILS:\n`
    if (input.productContext.productDescription) prompt += `- Product: ${input.productContext.productDescription}\n`
    if (input.productContext.targetMarket) prompt += `- Target Market: ${input.productContext.targetMarket}\n`
    if (input.productContext.painPoints) prompt += `- Pain Points: ${input.productContext.painPoints}\n`
    if (input.productContext.usps) prompt += `- USPs: ${input.productContext.usps}\n`
    if (input.productContext.benefits) prompt += `- Benefits: ${input.productContext.benefits}\n`
    if (input.productContext.offer) prompt += `- Offer: ${input.productContext.offer}\n`
    if (input.productContext.cta) prompt += `- Call-to-Action: ${input.productContext.cta}\n`
    prompt += '\n'
  }

  if (input.attachedImage) {
    prompt += `A product homepage screenshot is attached — extract additional context about the product's appearance, branding, and claims from it.\n\n`
  }

  prompt += `Generate all three script variants now as JSON.`

  let responseText: string

  if (input.attachedImage) {
    // With image: use GPT-4o vision via kie.ai
    responseText = await kieAnalyzeImage(
      kieKey,
      input.attachedImage.base64,
      input.attachedImage.mimeType,
      prompt,
      SYSTEM_INSTRUCTION,
    )
  } else {
    // Text only: use GPT-4o via kie.ai
    responseText = await kieTextGenerate(kieKey, prompt, SYSTEM_INSTRUCTION)
  }

  let cleaned = responseText.trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) cleaned = jsonMatch[0]
  else cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  const parsed = JSON.parse(cleaned) as { scripts?: string[] }
  const variants = parsed.scripts ?? []
  if (variants.length === 0) throw new Error('Gemini không trả về variant nào')

  return { variants }
}

export async function translateToMalay(scriptText: string): Promise<string> {
  const kieKey = useSettingsStore.getState().getApiKey()
  const prompt = `Translate the following UGC ad script into natural Malaysian Malay (Bahasa Malaysia). Use native, colloquial phrasing that sounds authentic — like a real Malaysian person speaking casually on camera. Preserve the tone, energy, and sentence-by-sentence structure. Return ONLY the translated script, no explanations.\n\n${scriptText}`
  return await kieTextGenerate(kieKey, prompt)
}
