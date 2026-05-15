import type { GenerateScriptInput, GeneratedVariants } from '../types'
import { useSettingsStore } from '../../../stores/settingsStore'
import { kieTextGenerate, kieAnalyzeImage } from '../../../utils/kieai'

const SYSTEM_INSTRUCTION = `You are an elite UGC ad script writer. Write authentic, natural-sounding scripts that sound like a real customer speaking on camera.

Output exactly THREE variants using this PLAIN TEXT format (no JSON, no markdown, no code fences):

===VARIANT 1===
HOOK:
<one short hook sentence>

SCRIPT:
<full script, one sentence per line>

===VARIANT 2===
HOOK:
<different hook>

SCRIPT:
<full script>

===VARIANT 3===
HOOK:
<another different hook>

SCRIPT:
<full script>

Rules:
- Write in ENGLISH only.
- Each VARIANT must start with the exact line "===VARIANT N===" (N = 1, 2, 3).
- Each variant has TWO sections: "HOOK:" and "SCRIPT:".
- Hooks must be DIFFERENT across variants (different angle each).
- Scripts: natural conversational tone, not salesy. Like someone filming on their phone.
- One sentence per line in the SCRIPT section.
- No stage directions, no [brackets], no timestamps.
- No explanations, no preamble — start directly with "===VARIANT 1===".`

const UGC_PROMPT_PREFIX = `I need your help writing user-generated content (UGC) ad scripts that sound like a real customer speaking into the camera. Use all the data attached below as inspiration and further develop the ad. The tone should be natural, conversational, not overly salesy or polished. Think authentic, like someone filming themselves with their phone and talking about their experience. The script will be spoken verbatim in the final ad, so make sure it sounds natural when read aloud. Each ad should start with a strong opening statement (Hook) to keep viewers engaged. In the SCRIPT body, create at least two to four benefits, recount your experience with the product and how it solved your problem, provide basic information about the product's ingredients and how it works, and end with a natural call to action.`

export async function generateScript(input: GenerateScriptInput): Promise<GeneratedVariants> {
  const kieKey = useSettingsStore.getState().getApiKey()

  let prompt = UGC_PROMPT_PREFIX + '\n\n'

  if (input.winningTranscript) {
    prompt += `SCRIPT TEMPLATE (use as inspiration):\n${input.winningTranscript}\n\n`
  }

  if (input.productContext) {
    prompt += `PRODUCT DETAILS:\n`
    if (input.productContext.productDescription) prompt += `- Product: ${input.productContext.productDescription}\n`
    if (input.productContext.targetMarket) prompt += `- Target Market: ${input.productContext.targetMarket}\n`
    if (input.productContext.painPoints) prompt += `- Pain Points: ${input.productContext.painPoints}\n`
    if (input.productContext.usps) prompt += `- USPs: ${input.productContext.usps}\n`
    if (input.productContext.benefits) prompt += `- Benefits: ${input.productContext.benefits}\n`
    if (input.productContext.offer) prompt += `- Offer: ${input.productContext.offer}\n`
    if (input.productContext.cta) prompt += `- CTA: ${input.productContext.cta}\n`
    prompt += '\n'
  }

  if (input.attachedImage) {
    prompt += `A screenshot of the product's sales page is attached above — extract additional context from it.\n\n`
  }

  prompt += `Now produce THREE script variants in the exact plain-text format described in the system instructions. Start your response with "===VARIANT 1===" — no preamble.`

  let responseText: string

  if (input.attachedImage) {
    responseText = await kieAnalyzeImage(
      kieKey,
      input.attachedImage.base64,
      input.attachedImage.mimeType,
      prompt,
      SYSTEM_INSTRUCTION,
    )
  } else {
    responseText = await kieTextGenerate(kieKey, prompt, SYSTEM_INSTRUCTION)
  }

  const variants = parseVariants(responseText)
  if (variants.length === 0) {
    console.error('[generateScript] could not parse any variants from response:', responseText)
    throw new Error('Không trích xuất được kịch bản từ phản hồi của AI. Vui lòng thử lại.')
  }
  return { variants }
}

/**
 * Parse the plain-text variant format into an array of formatted strings.
 * Robust to extra whitespace, missing variant numbers, and minor formatting drift.
 */
function parseVariants(raw: string): string[] {
  const text = raw.trim()
  // Split on variant separator (handles "===VARIANT 1===", "=== VARIANT 1 ===", etc.)
  const parts = text.split(/={2,}\s*VARIANT\s*\d+\s*={2,}/i).map((p) => p.trim()).filter(Boolean)

  const variants: string[] = []
  for (const part of parts) {
    // Each part should contain "HOOK:" and "SCRIPT:" sections
    const hookMatch = part.match(/HOOK:\s*([\s\S]*?)(?=\n\s*SCRIPT:|$)/i)
    const scriptMatch = part.match(/SCRIPT:\s*([\s\S]*?)$/i)
    const hook = hookMatch?.[1]?.trim() ?? ''
    const script = scriptMatch?.[1]?.trim() ?? ''
    if (hook && script) {
      variants.push(`HOOK:\n${hook}\n\nSCRIPT:\n${script}`)
    } else if (hook || script) {
      variants.push(hook || script)
    } else if (part.length > 50) {
      // Fallback: treat entire chunk as one script if no markers found
      variants.push(part)
    }
  }

  // If no separators found at all but response has content, fall back to splitting by HOOK markers
  if (variants.length === 0 && text.length > 50) {
    const hookSplit = text.split(/\n\s*HOOK:/i)
    if (hookSplit.length > 1) {
      hookSplit.slice(1).forEach((chunk) => {
        const scriptMatch = chunk.match(/SCRIPT:\s*([\s\S]*?)$/i)
        const hookPart = chunk.split(/SCRIPT:/i)[0]?.trim() ?? ''
        const scriptPart = scriptMatch?.[1]?.trim() ?? ''
        if (hookPart || scriptPart) {
          variants.push(`HOOK:\n${hookPart}\n\nSCRIPT:\n${scriptPart}`)
        }
      })
    }
  }

  return variants.slice(0, 3)
}

export async function translateToMalay(scriptText: string): Promise<string> {
  const kieKey = useSettingsStore.getState().getApiKey()
  const prompt = `Translate the following UGC ad script into natural Malaysian Malay (Bahasa Malaysia). Use native, colloquial phrasing that sounds authentic — like a real Malaysian person speaking casually on camera. Preserve the tone, energy, and sentence-by-sentence structure. Keep any "HOOK:" / "SCRIPT:" section labels in English but translate everything else. Return ONLY the translated script, no explanations.\n\n${scriptText}`
  return await kieTextGenerate(kieKey, prompt)
}
