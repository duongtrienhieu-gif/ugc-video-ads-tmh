import type { GenerateScriptInput, GeneratedVariants } from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { kieTextGenerate, kieAnalyzeImage } from '../../../utils/kieai'

const SYSTEM_INSTRUCTION = `You are an elite UGC ad script writer creating authentic, natural-sounding short-form video scripts that sound like a real customer speaking into a camera.

Your task: write THREE distinct UGC ad script variants.

OUTPUT FORMAT (CRITICAL):
Return ONLY a valid JSON object with this exact structure:
{
  "scripts": [
    { "hook": "Strong opening statement here", "script": "Full script body here\\nNext line\\nNext line" },
    { "hook": "Different hook", "script": "Different script body" },
    { "hook": "Third different hook", "script": "Third script body" }
  ]
}

RULES:
1. NO markdown, NO code fences, NO explanations outside the JSON.
2. Each variant has TWO parts: "hook" (opening statement) and "script" (full script body including benefits, story, ingredients, CTA).
3. Each "hook" must be a DIFFERENT strong opening that hooks viewers in the first 3 seconds.
4. The "script" should be plain spoken dialogue only, sentence per line (use \\n between sentences).
5. NO stage directions, NO timestamps, NO bracketed visual cues.
6. Write in ENGLISH.
7. Natural conversational tone — like someone filming on their phone, NOT salesy or polished.`

const UGC_PROMPT_PREFIX = `I need your help writing a user-generated (UGC) ad script that sounds like a real customer speaking into the camera. Use all the data attached below (script template + details of the target product + images from the sales page) as inspiration and further develop the ad. The tone should be natural, conversational, not overly salesy or polished. Think authentic, like someone filming themselves with their phone and talking about their experience. Your script will be spoken verbatim in the final ad, so make sure it sounds natural when read aloud. Each ad should start with a strong opening statement to keep viewers engaged. Create at least two to four benefits, recount your experience with the product and how it solved your problem, provide basic information about the product's ingredients and how it works (to give viewers more information about the product), and end with a natural call to action... I've also attached a screenshot of the product's homepage for your research purposes! The final output consists of two parts: Hook and Script, no further explanation needed.

Please produce THREE distinct variants, each with a different hook angle.`

export async function generateScript(input: GenerateScriptInput): Promise<GeneratedVariants> {
  const kieKey = useSettingsStore.getState().getApiKey()

  let prompt = UGC_PROMPT_PREFIX + '\n\n'

  if (input.winningTranscript) {
    prompt += `SCRIPT TEMPLATE (use as structural inspiration):\n${input.winningTranscript}\n\n`
  }

  if (input.productContext) {
    prompt += `TARGET PRODUCT DETAILS:\n`
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
    prompt += `A screenshot of the product's sales page is attached above — extract additional context from it.\n\n`
  }

  prompt += `Generate THREE script variants now as the JSON object specified.`

  let responseText: string

  if (input.attachedImage) {
    // Vision: GPT-4o reads image + writes scripts
    responseText = await kieAnalyzeImage(
      kieKey,
      input.attachedImage.base64,
      input.attachedImage.mimeType,
      prompt,
      SYSTEM_INSTRUCTION,
    )
  } else {
    // Text only: GPT-4o via kie.ai
    responseText = await kieTextGenerate(kieKey, prompt, SYSTEM_INSTRUCTION)
  }

  let cleaned = responseText.trim()
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) cleaned = jsonMatch[0]
  else cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  const parsed = JSON.parse(cleaned) as { scripts?: Array<{ hook?: string; script?: string } | string> }
  const rawVariants = parsed.scripts ?? []
  if (rawVariants.length === 0) throw new Error('GPT không trả về variant nào')

  // Normalize: accept either { hook, script } or plain string
  const variants = rawVariants.map((v) => {
    if (typeof v === 'string') return v
    const hook = (v.hook ?? '').trim()
    const script = (v.script ?? '').trim()
    if (hook && script) return `HOOK:\n${hook}\n\nSCRIPT:\n${script}`
    return hook || script || ''
  }).filter(Boolean)

  if (variants.length === 0) throw new Error('GPT trả về dữ liệu không hợp lệ')
  return { variants }
}

export async function translateToMalay(scriptText: string): Promise<string> {
  const kieKey = useSettingsStore.getState().getApiKey()
  const prompt = `Translate the following UGC ad script into natural Malaysian Malay (Bahasa Malaysia). Use native, colloquial phrasing that sounds authentic — like a real Malaysian person speaking casually on camera. Preserve the tone, energy, and sentence-by-sentence structure. Keep any "HOOK:" / "SCRIPT:" section labels in English but translate everything else. Return ONLY the translated script, no explanations.\n\n${scriptText}`
  return await kieTextGenerate(kieKey, prompt)
}
