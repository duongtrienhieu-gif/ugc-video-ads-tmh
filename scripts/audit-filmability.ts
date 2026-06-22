/* eslint-disable no-console */
// ═══════════════════════════════════════════════════════════════════════════
// audit-filmability.ts — đo % câu kịch bản mang "nhiên liệu hành động" cho đạo diễn.
// Sinh kịch bản THẬT (scriptGenerator) cho N sản phẩm đa ngách, tách câu, rồi cho
// Gemini phân loại mỗi câu: hành động cụ thể / kết quả quan sát được / nêu tính năng /
// social proof / cảm xúc-claim trừu tượng / hook-cta. "Fuel" = action_demo + observable_result.
//   npx tsx scripts/audit-filmability.ts
// ═══════════════════════════════════════════════════════════════════════════
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import dotenv from 'dotenv'
import { generateScript } from '../src/apps/video-builder/v3/services/scriptGenerator'
import { directGeminiText } from '../src/utils/gemini'
import type { ScriptLang, AdStructure, AdAngle, ScriptTargetDurationSec } from '../src/apps/video-builder/v3/types'

dotenv.config({ path: '.env.local' })
const KEY = process.env.GEMINI_API_KEY
if (!KEY) { console.error('❌ thiếu GEMINI_API_KEY'); process.exit(1) }

type Spec = { slug: string; lang: ScriptLang; structure: AdStructure; angle: AdAngle; dur: ScriptTargetDurationSec; name: string; pitch: string }
const SPECS: Spec[] = [
  { slug: '1-bo-gan', lang: 'vi', structure: 'INSTANT', angle: 'problem_solution', dur: 50, name: 'Viên Bổ Gan Thanh Độc', pitch: 'Viên thảo dược giải độc gan, hạ men gan cho người hay nhậu' },
  { slug: '2-serum', lang: 'vi', structure: 'LEAD', angle: 'testimonial', dur: 60, name: 'Serum Sáng Da Vitamin C 15%', pitch: 'Serum dưỡng sáng, mờ thâm nám cho nữ 25-40' },
  { slug: '3-noi-chien', lang: 'vi', structure: 'INSTANT', angle: 'direct_response', dur: 50, name: 'Nồi Chiên Không Dầu 8L', pitch: 'Nồi chiên không dầu lớn cho gia đình bận rộn' },
  { slug: '4-collagen', lang: 'ms', structure: 'LEAD', angle: 'emotional', dur: 60, name: 'Kolagen Marine Premium', pitch: 'Serbuk kolagen ikan untuk kulit & sendi wanita 30-50' },
  { slug: '5-urut-leher', lang: 'ms', structure: 'INSTANT', angle: 'curiosity', dur: 50, name: 'Alat Urut Leher EMS', pitch: 'Alat urut leher EMS + haba untuk pekerja office' },
]

const CATS = ['action_demo', 'observable_result', 'product_feature', 'social_proof', 'abstract_feeling', 'hook_cta'] as const
type Cat = typeof CATS[number]
const FUEL: Cat[] = ['action_demo', 'observable_result']   // nhiên liệu hành động trực tiếp
const SEMI: Cat[] = ['product_feature']                    // macro-able, nửa nhiên liệu

const splitSentences = (t: string): string[] =>
  (t.match(/[^.!?…]+[.!?…]*/g) ?? [t]).map((s) => s.trim()).filter((s) => s.split(/\s+/).filter(Boolean).length >= 2)

const SCHEMA = {
  type: 'object',
  properties: { items: { type: 'array', items: { type: 'object', properties: { i: { type: 'number' }, cat: { type: 'string', enum: CATS as unknown as string[] } }, required: ['i', 'cat'] } } },
  required: ['items'],
}

async function classify(sentences: string[]): Promise<Cat[]> {
  const list = sentences.map((s, i) => `${i}. ${s}`).join('\n')
  const sys = `You analyse spoken TikTok ad lines from a VIDEO DIRECTOR's point of view: does the line hand the director a CONCRETE thing to FILM, or only an abstract feeling/claim they must invent a visual for? Classify EACH line into ONE category:
- "action_demo": a concrete PHYSICAL action with the product someone can be filmed doing (hold up / break / pour / apply / spray / eat a bite / press a button / strap on / pinch skin...).
- "observable_result": a result shown through a CONCRETE observable action or visible state (walking up stairs pain-free, brighter skin seen in a mirror, no-more-bloated flat tummy shown, crispy food cross-section) — filmable as a moment.
- "product_feature": names a spec / ingredient / how-it-works / what-it-contains (a macro of the product or a 3D mechanism — filmable but NOT a human action).
- "social_proof": crowds / sold counts / reviews / "many people bought".
- "abstract_feeling": a pure FEELING, opinion, or claim with NO concrete visual ("I feel more confident", "it's amazing", "life-changing", vague pain like "I was so tired of it") — the director has nothing concrete, must invent a generic reaction/face.
- "hook_cta": an attention hook question/statement OR a buy/offer call-to-action.
Judge by what's FILMABLE, not by sentiment. A vague pain/feeling with no observable moment = abstract_feeling. Output one entry per input line, same index.`
  const raw = await directGeminiText({ apiKey: KEY!, systemInstruction: sys, prompt: `Classify these ${sentences.length} lines:\n${list}`, responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0, thinkingBudget: 0, maxOutputTokens: 2048 })
  const parsed = JSON.parse(raw) as { items: { i: number; cat: Cat }[] }
  const out: Cat[] = sentences.map(() => 'abstract_feeling')
  for (const it of parsed.items) if (it.i >= 0 && it.i < out.length && CATS.includes(it.cat)) out[it.i] = it.cat
  return out
}

async function run() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outDir = join('test-output', `audit-filmability-${stamp}`)
  mkdirSync(outDir, { recursive: true })
  const agg: Record<Cat, number> = { action_demo: 0, observable_result: 0, product_feature: 0, social_proof: 0, abstract_feeling: 0, hook_cta: 0 }
  let grandTotal = 0
  const lines: string[] = ['# AUDIT FILMABILITY — % câu mang nhiên liệu hành động cho đạo diễn', '']

  for (const spec of SPECS) {
    console.log(`\n━━━ ${spec.slug} ━━━`)
    let gen
    try { gen = await generateScript({ geminiKey: KEY!, structure: spec.structure, angle: spec.angle, targetDurationSec: spec.dur, productName: spec.name, productPitch: spec.pitch, lang: spec.lang }) }
    catch (e) { console.error('  scriptGen FAIL:', (e as Error).message); continue }
    const sentences: string[] = []
    for (const b of gen.script.blocks) sentences.push(...splitSentences(b.text))
    let cats: Cat[]
    try { cats = await classify(sentences) } catch (e) { console.error('  classify FAIL:', (e as Error).message); continue }

    const local: Record<Cat, number> = { action_demo: 0, observable_result: 0, product_feature: 0, social_proof: 0, abstract_feeling: 0, hook_cta: 0 }
    cats.forEach((c) => { local[c]++; agg[c]++ })
    grandTotal += sentences.length
    const fuel = FUEL.reduce((s, c) => s + local[c], 0)
    const semi = SEMI.reduce((s, c) => s + local[c], 0)
    const pct = (n: number) => `${Math.round((n / sentences.length) * 100)}%`

    lines.push(`## ${spec.slug} (${spec.lang}, ${sentences.length} câu)`)
    lines.push(`**FUEL hành động (action_demo+observable_result): ${fuel}/${sentences.length} = ${pct(fuel)}** · feature(macro): ${pct(semi)} · social: ${pct(local.social_proof)} · hook/cta: ${pct(local.hook_cta)} · **trừu tượng (vô fuel): ${pct(local.abstract_feeling)}**`)
    lines.push('')
    lines.push('| # | câu | loại |')
    lines.push('|--|--|--|')
    sentences.forEach((s, i) => lines.push(`| ${i + 1} | ${s.slice(0, 70).replace(/\|/g, '/')} | ${cats[i] === 'abstract_feeling' ? '⚪ ' + cats[i] : FUEL.includes(cats[i]) ? '🟢 ' + cats[i] : cats[i]} |`))
    lines.push('')
    console.log(`  ${sentences.length} câu · FUEL ${pct(fuel)} · trừu tượng ${pct(local.abstract_feeling)}`)
  }

  const fuelTot = FUEL.reduce((s, c) => s + agg[c], 0)
  const semiTot = SEMI.reduce((s, c) => s + agg[c], 0)
  const p = (n: number) => grandTotal ? `${Math.round((n / grandTotal) * 100)}%` : '0%'
  const head = [
    '## ⭐ TỔNG HỢP', '',
    `Tổng câu: ${grandTotal}`,
    `🟢 **FUEL hành động (action_demo + observable_result): ${fuelTot}/${grandTotal} = ${p(fuelTot)}**`,
    `🟡 feature/ingredient (macro-able, nửa fuel): ${agg.product_feature} = ${p(agg.product_feature)}`,
    `   → FUEL + nửa-fuel = ${p(fuelTot + semiTot)}`,
    `social_proof: ${agg.social_proof} = ${p(agg.social_proof)}`,
    `hook/cta: ${agg.hook_cta} = ${p(agg.hook_cta)}`,
    `⚪ **trừu tượng/cảm xúc (đạo diễn KHÔNG có gì cụ thể để quay): ${agg.abstract_feeling} = ${p(agg.abstract_feeling)}**`,
    '', '---', '',
  ]
  writeFileSync(join(outDir, '_summary.md'), head.concat(lines).join('\n'))
  console.log('\n==== TỔNG ====\n' + head.join('\n'))
  console.log('Saved →', outDir)
}
run().catch((e) => { console.error(e); process.exit(1) })
