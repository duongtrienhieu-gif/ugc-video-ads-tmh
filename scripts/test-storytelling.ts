/* eslint-disable no-console */
// ═════════════════════════════════════════════════════════════════════
// test-storytelling.ts — REAL GEMINI OUTPUT CALIBRATION HARNESS
//
// Runs the storytelling engine outside the browser to generate 10 packs
// across diverse niches. Saves full pack text + structured validator
// data + cross-pack summary. For audit before scaling.
//
// USAGE:
//   GEMINI_API_KEY=<key> KIE_API_KEY=<key> npx tsx scripts/test-storytelling.ts
//
// Or load from .env.local:
//   echo "GEMINI_API_KEY=..." > .env.local
//   echo "KIE_API_KEY=..." >> .env.local
//   npx tsx scripts/test-storytelling.ts
//
// Output: test-output/<ISO-timestamp>/
//   ├── _summary.md           — cross-pack patterns + table
//   ├── _summary.json         — structured aggregate stats
//   ├── <niche-slug>/pack.md       — full readable 10-section text
//   ├── <niche-slug>/pack.json     — structured pack data
//   └── <niche-slug>/validation.json — per-validator violation detail
//
// Cost estimate: ~$0.001-0.002 per pack × 10 = ~$0.01-0.02 total
// Runtime estimate: 5-15 minutes (10 packs × 30-60s each)
// ═════════════════════════════════════════════════════════════════════

import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import dotenv from 'dotenv'

import type {
  ProtagonistProfile, StorytellingInput,
} from '../src/apps/super-ladipage/storytelling/types'
import { resolveBlockPlan } from '../src/apps/super-ladipage/storytelling/resolvers/resolveBlockPlan'
import { generatePackWithRetry } from '../src/apps/super-ladipage/storytelling/runtime/retryWithFeedback'
import { buildProductBrief } from '../src/apps/super-ladipage/storytelling/runtime/buildPackGenPrompt'

// ─── Load .env.local if present ──────────────────────────────────────
dotenv.config({ path: '.env.local' })

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const KIE_API_KEY    = process.env.KIE_API_KEY

if (!GEMINI_API_KEY || !KIE_API_KEY) {
  console.error('❌ Missing env vars. Set:')
  console.error('   GEMINI_API_KEY=your-google-key')
  console.error('   KIE_API_KEY=your-kie-key')
  console.error('Or put them in .env.local')
  process.exit(1)
}

// ─── Default protagonist baselines (override per-niche as needed) ───
const PROT_VN_FEMALE_35: ProtagonistProfile = {
  gender: 'female',
  ageRange: '35-45',
  cultural: {
    world: 'vietnamese-urban',
    hijabState: 'never',
    hairVisible: true,
    modestyLevel: 'modern-modest',
  },
  wardrobeWorld: 'urban-casual',
  personalityVibe: 'warm-maternal',
  homeLifestyle: {
    setting: 'urban-apartment',
    familyStructure: 'with-children',
  },
}

const PROT_VN_FEMALE_45: ProtagonistProfile = {
  ...PROT_VN_FEMALE_35,
  ageRange: '45-55',
  personalityVibe: 'reserved-thoughtful',
  homeLifestyle: { setting: 'suburban-house', familyStructure: 'multigenerational' },
}

const PROT_VN_FEMALE_55: ProtagonistProfile = {
  ...PROT_VN_FEMALE_35,
  ageRange: '55+',
  cultural: { ...PROT_VN_FEMALE_35.cultural, world: 'vietnamese-rural', modestyLevel: 'conservative' },
  wardrobeWorld: 'modern-modest',
  personalityVibe: 'gentle-introvert',
  homeLifestyle: { setting: 'rural-traditional', familyStructure: 'multigenerational' },
}

const PROT_VN_FEMALE_28_MOM: ProtagonistProfile = {
  ...PROT_VN_FEMALE_35,
  ageRange: '25-35',
  personalityVibe: 'warm-maternal',
  homeLifestyle: { setting: 'urban-apartment', familyStructure: 'with-children' },
}

const PROT_VN_FEMALE_28: ProtagonistProfile = {
  ...PROT_VN_FEMALE_35,
  ageRange: '25-35',
  personalityVibe: 'practical-direct',
  homeLifestyle: { setting: 'urban-apartment', familyStructure: 'partnered' },
}

const PROT_VN_MALE_42: ProtagonistProfile = {
  gender: 'male',
  ageRange: '35-45',
  cultural: {
    world: 'vietnamese-urban',
    hijabState: 'never',
    hairVisible: true,
    modestyLevel: 'urban',
  },
  wardrobeWorld: 'urban-casual',
  personalityVibe: 'reserved-thoughtful',
  homeLifestyle: {
    setting: 'urban-apartment',
    familyStructure: 'with-children',
  },
}

// ─── 10 test niches ─────────────────────────────────────────────────
interface TestNiche {
  label: string
  slug: string
  productName: string
  painPoint: string
  input: StorytellingInput
}

const baseInput = (
  niche: StorytellingInput['niche'],
  prot: ProtagonistProfile,
  overrides: Partial<StorytellingInput> = {},
): StorytellingInput => ({
  productId: `mock-${niche}`,
  niche,
  targetCountry: 'VN' as never,
  targetLanguage: 'vi',
  protagonistProfile: prot,
  emotionalIntensity: 'medium',
  pacingType: 'steady',
  productRevealSection: 7,
  culturalWorld: prot.cultural.world,
  ctaSoftness: 'invitation-only',
  supportingCharacterMode: 'family',
  visualRealismLevel: 'family-album',
  overlayMode: 'minimal-1',
  ...overrides,
})

const NICHES: TestNiche[] = [
  {
    label: 'Skincare nữ 35+',
    slug: '01-skincare-nu-35',
    productName: 'Serum X28',
    painPoint: 'nám sạm tàn nhang sau 35, da xỉn màu, không đều màu',
    input: baseInput('skincare', PROT_VN_FEMALE_35, { pacingType: 'slow-burn' }),
  },
  {
    label: 'Tóc rụng',
    slug: '02-toc-rung',
    productName: 'Tinh chất Hair-Restore',
    painPoint: 'tóc rụng nhiều khi gội đầu, tóc mỏng dần, da đầu yếu',
    input: baseInput('haircare', PROT_VN_FEMALE_35),
  },
  {
    label: 'Nội tiết phụ nữ 45+',
    slug: '03-noi-tiet',
    productName: 'Viên cân bằng nội tiết HormoBalance',
    painPoint: 'rối loạn nội tiết, mệt mỏi, mất cân bằng, bốc hỏa, khó ngủ',
    input: baseInput('supplement-wellness', PROT_VN_FEMALE_45, { emotionalIntensity: 'medium', pacingType: 'slow-burn' }),
  },
  {
    label: 'Giảm cân nữ 28',
    slug: '04-giam-can',
    productName: 'Bổ sung SlimFit',
    painPoint: 'tăng cân sau sinh, khó giảm, vòng eo to ra, mất tự tin',
    input: baseInput('fitness-recovery', PROT_VN_FEMALE_28, { emotionalIntensity: 'medium' }),
  },
  {
    label: 'Xương khớp 55+ rural',
    slug: '05-xuong-khop',
    productName: 'Viên hỗ trợ xương khớp JointEase',
    painPoint: 'đau khớp gối, đau lưng, tê tay buổi sáng, đi đứng khó',
    input: baseInput('health-functional', PROT_VN_FEMALE_55, { pacingType: 'slow-burn', supportingCharacterMode: 'family' }),
  },
  {
    label: 'Mẹ bỉm kiệt sức',
    slug: '06-me-bim',
    productName: 'Viên hỗ trợ mẹ sau sinh MomVita',
    painPoint: 'kiệt sức sau sinh, ít sữa, không đủ năng lượng chăm con',
    input: baseInput('mom-baby', PROT_VN_FEMALE_28_MOM, { pacingType: 'steady', emotionalIntensity: 'medium' }),
  },
  {
    label: 'Nam 40+ giảm sinh lực',
    slug: '07-nam-40',
    productName: 'Viên ManVita 40+',
    painPoint: 'mệt mỏi, giảm sinh lực, áp lực công việc, ngủ không sâu',
    input: baseInput('supplement-wellness', PROT_VN_MALE_42),
  },
  {
    label: 'Mất ngủ chronic',
    slug: '08-mat-ngu',
    productName: 'Viên SleepWell',
    painPoint: 'mất ngủ, thức giấc giữa đêm, mệt mỏi sáng dậy, tâm trí không yên',
    input: baseInput('supplement-wellness', PROT_VN_FEMALE_35, { pacingType: 'slow-burn' }),
  },
  {
    label: 'COD hard-sell (reveal sớm)',
    slug: '09-cod-hard-sell',
    productName: 'Kem trắng da Brightex',
    painPoint: 'da xỉn màu, không đều, mất tự tin khi gặp người',
    input: baseInput('beauty-confidence', PROT_VN_FEMALE_28, {
      pacingType: 'quicker',
      productRevealSection: 5,    // EDGE TEST: reveal sớm
      ctaSoftness: 'gentle-direct',
      emotionalIntensity: 'medium',
    }),
  },
  {
    label: 'Emotional soft-sell (reveal trễ)',
    slug: '10-emotional-soft',
    productName: 'Tinh dầu RelaxRoom',
    painPoint: 'không có thời gian cho bản thân, mỏi mệt cảm xúc, không muốn về nhà',
    input: baseInput('relationship', PROT_VN_FEMALE_35, {
      pacingType: 'slow-burn',
      productRevealSection: 8,    // EDGE TEST: reveal rất trễ
      emotionalIntensity: 'low',
      ctaSoftness: 'invitation-only',
    }),
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────
function ensureDir(path: string) {
  mkdirSync(path, { recursive: true })
}

function countWords(s: string): number {
  return s.split(/\s+/).filter((w) => w.length > 0).length
}

function isoStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
}

// ─── Per-pack writer ─────────────────────────────────────────────────
interface PackRunResult {
  niche: TestNiche
  attempts: number
  validationPass: boolean
  totalWords: number
  retrySectionCount: number
  fallbackSectionCount: number
  runtimeSeconds: number
  errors: string[]
}

async function runPack(niche: TestNiche, outDir: string, idx: number, total: number): Promise<PackRunResult> {
  console.log(`\n[storytelling-test] [${idx + 1}/${total}] ${niche.label} (${niche.slug})`)
  console.log(`  niche=${niche.input.niche}, pacing=${niche.input.pacingType}, intensity=${niche.input.emotionalIntensity}, productReveal=s${niche.input.productRevealSection}`)
  const packDir = join(outDir, niche.slug)
  ensureDir(packDir)

  const errors: string[] = []
  const startedAt = Date.now()

  try {
    const plan = resolveBlockPlan(niche.input)
    const productBrief = buildProductBrief(niche.productName, niche.input.niche, niche.painPoint)

    const result = await generatePackWithRetry({
      input: niche.input,
      plan,
      productBrief,
      geminiApiKey: GEMINI_API_KEY!,
      kieApiKey: KIE_API_KEY!,
      // v5.7 Phase B v2 — enables separate review-only Gemini call.
      productInfo: {
        productName: niche.productName,
        painPoint: niche.painPoint,
      },
    })

    const runtimeSec = (Date.now() - startedAt) / 1000
    const totalWords = result.sections.reduce((sum, s) => sum + countWords(s.copy), 0)
    const retrySectionCount = result.perSectionStatus.filter((s) => s.kind === 'retry-pass').length
    const fallbackSectionCount = result.perSectionStatus.filter((s) => s.kind === 'fallback').length

    // ── Write pack.md (readable) ──
    const mdLines: string[] = []
    mdLines.push(`# Pack — ${niche.label}`)
    mdLines.push('')
    mdLines.push('## Run meta')
    mdLines.push(`- Slug: \`${niche.slug}\``)
    mdLines.push(`- Niche: ${niche.input.niche}`)
    mdLines.push(`- Pacing: ${niche.input.pacingType}`)
    mdLines.push(`- Intensity: ${niche.input.emotionalIntensity}`)
    mdLines.push(`- Product reveal: section ${niche.input.productRevealSection}`)
    mdLines.push(`- CTA softness: ${niche.input.ctaSoftness}`)
    mdLines.push(`- Cultural world: ${niche.input.culturalWorld}`)
    mdLines.push(`- Protagonist: ${niche.input.protagonistProfile.gender}, ${niche.input.protagonistProfile.ageRange}, ${niche.input.protagonistProfile.personalityVibe}`)
    mdLines.push(`- Product: ${niche.productName}`)
    mdLines.push(`- Pain: ${niche.painPoint}`)
    mdLines.push('')
    mdLines.push('## Pipeline result')
    mdLines.push(`- Attempts: ${result.attempts}`)
    mdLines.push(`- Final validation: ${result.finalValidation.pass ? '✓ CLEAN' : '⚠ FALLBACK'} (${result.finalValidation.byValidator ? Object.values(result.finalValidation.byValidator).filter((v) => v.pass).length : '?'}/5 validators passed)`)
    mdLines.push(`- Initial violations (attempt 1): ${result.initialValidation.violations.length}`)
    mdLines.push(`- Runtime: ${runtimeSec.toFixed(1)}s`)
    mdLines.push(`- Total words: ${totalWords}`)
    mdLines.push('')
    // v5.6 — Surface variation engine selection so duplicate-output audits can
    // verify that different packs are actually getting different narrators/curves/hooks.
    mdLines.push('## Variation selection (v5.6 audit trail)')
    mdLines.push(`- Seed: \`${result.selection.seed.slice(-20)}\``)
    mdLines.push(`- Narrator: \`${result.selection.narrator.id}\``)
    mdLines.push(`- Emotional DNA: \`${result.selection.emotionalDna?.niche ?? 'generic'}\``)
    mdLines.push(`- Energy curve: \`${result.selection.energyCurve.id}\` — ${result.selection.energyCurve.label}`)
    mdLines.push(`- Hook pattern (s1): \`${result.selection.hookPattern}\``)
    mdLines.push(`- Hook axis (s1): \`${result.selection.hookAxis}\``)
    mdLines.push(`- Belief catalyst (s5): \`${result.selection.beliefCatalystType}\``)
    mdLines.push(`- Discovery channel (s6): \`${result.selection.discoveryChannel}\``)
    mdLines.push(`- Payoff archetype: \`${result.selection.payoffArchetype.id}\` — ${result.selection.payoffArchetype.destination}`)
    mdLines.push(`- You-first opener (Block 1): \`${result.selection.youFirstOpener.id}\` — starter "${result.selection.youFirstOpener.starter}..."`)
    mdLines.push(`- Bridge phrase (Block 1 close): \`${result.selection.bridgePhrase.id}\` — "${result.selection.bridgePhrase.phrase}"`)
    mdLines.push(`- Memory snapshots: ${result.selection.memorySnapshots.map((m) => `\`${m.id}\``).join(', ')}`)
    if (result.reviewsCall) {
      const rc = result.reviewsCall
      const status = rc.status === 'ok' ? `✓ ok (${rc.pieces.length} proof pieces)`
        : rc.status === 'parse-error' ? '⚠ parse-error'
        : rc.status === 'call-error' ? '⚠ call-error'
        : '⚠ empty'
      const stances = rc.sampledStances ? ` · stances=[${rc.sampledStances.join(', ')}]` : ''
      mdLines.push(`- Proof call (separate Gemini): ${status} · ${rc.runtimeSec.toFixed(1)}s${stances}${rc.errorMessage ? ` — ${rc.errorMessage.slice(0, 80)}` : ''}`)
    }
    mdLines.push('')
    mdLines.push('## Per-section status')
    for (let i = 0; i < result.sections.length; i++) {
      const s = result.sections[i]
      const st = result.perSectionStatus[i]
      const stLabel = st.kind === 'pass' ? '✓' : st.kind === 'retry-pass' ? '↻ retry-pass' : '⚠ fallback'
      mdLines.push(`- Chương ${i + 1} \`${s.id}\`: ${stLabel} · ${countWords(s.copy)} từ`)
    }
    mdLines.push('')
    mdLines.push('---')
    mdLines.push('')

    for (let i = 0; i < result.sections.length; i++) {
      const s = result.sections[i]
      const bp = plan[i]?.blueprint
      mdLines.push(`## Chương ${i + 1} — ${s.title}`)
      const paraCount = s.paragraphs.length
      const blockMeta = bp
        ? `\`${s.id}\` · phase=${bp.phase} · function=${bp.psychologicalFunction} · balance=${bp.youIBalance}`
        : `\`${s.id}\``
      mdLines.push(`*${blockMeta} · ${countWords(s.copy)} từ · ${paraCount} đoạn*`)
      mdLines.push('')
      mdLines.push(s.copy)
      // v5.6 — Render reviews for trust-continuity (was invisible — only s.copy was shown).
      if (s.reviews && s.reviews.length > 0) {
        mdLines.push('')
        mdLines.push('**Reviews (v5.5 Trust Realism):**')
        mdLines.push('')
        for (const r of s.reviews) {
          mdLines.push(`> "${r.quote}"`)
          if (r.author || r.meta) {
            const tail = [r.author, r.meta].filter(Boolean).join(' · ')
            mdLines.push(`> — ${tail}`)
          }
          mdLines.push('')
        }
      }
      mdLines.push('')
      mdLines.push('---')
      mdLines.push('')
    }

    writeFileSync(join(packDir, 'pack.md'), mdLines.join('\n'), 'utf-8')

    // ── Write pack.json (structured) ──
    writeFileSync(
      join(packDir, 'pack.json'),
      JSON.stringify({
        niche: { label: niche.label, slug: niche.slug, productName: niche.productName, painPoint: niche.painPoint },
        input: niche.input,
        plan: plan.map((p) => ({
          id: p.blueprint.id,
          phase: p.blueprint.phase,
          psychologicalFunction: p.blueprint.psychologicalFunction,
          youIBalance: p.blueprint.youIBalance,
        })),
        sections: result.sections,
        perSectionStatus: result.perSectionStatus,
        attempts: result.attempts,
        runtimeSeconds: runtimeSec,
      }, null, 2),
      'utf-8',
    )

    // ── Write validation.json ──
    writeFileSync(
      join(packDir, 'validation.json'),
      JSON.stringify({
        initial: result.initialValidation,
        final: result.finalValidation,
      }, null, 2),
      'utf-8',
    )

    console.log(`  ✓ done in ${runtimeSec.toFixed(1)}s — attempts=${result.attempts}, validation=${result.finalValidation.pass ? 'PASS' : 'FALLBACK'}, words=${totalWords}`)

    return {
      niche,
      attempts: result.attempts,
      validationPass: result.finalValidation.pass,
      totalWords,
      retrySectionCount,
      fallbackSectionCount,
      runtimeSeconds: runtimeSec,
      errors,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(msg)
    console.error(`  ✗ ERRORED: ${msg.slice(0, 200)}`)
    writeFileSync(
      join(packDir, 'error.txt'),
      `${msg}\n\nStack:\n${err instanceof Error ? err.stack ?? '' : ''}`,
      'utf-8',
    )
    return {
      niche,
      attempts: 0,
      validationPass: false,
      totalWords: 0,
      retrySectionCount: 0,
      fallbackSectionCount: 0,
      runtimeSeconds: (Date.now() - startedAt) / 1000,
      errors,
    }
  }
}

// ─── Cross-pack summary ─────────────────────────────────────────────
function writeSummary(outDir: string, results: PackRunResult[], totalRuntimeSec: number) {
  const mdLines: string[] = []
  mdLines.push(`# Storytelling Test Run — ${outDir.split(/[\\\/]/).pop()}`)
  mdLines.push('')

  const successful = results.filter((r) => r.errors.length === 0).length
  const totalCalls = results.reduce((sum, r) => sum + r.attempts, 0)
  const estCost = totalCalls * 0.0015

  mdLines.push('## Overall')
  mdLines.push(`- Packs attempted: ${results.length}`)
  mdLines.push(`- Packs successful (no infra error): ${successful}/${results.length}`)
  mdLines.push(`- Total Gemini calls (attempts): ${totalCalls}`)
  mdLines.push(`- Total runtime: ${(totalRuntimeSec / 60).toFixed(1)} min`)
  mdLines.push(`- Estimated cost: ~$${estCost.toFixed(3)}`)
  mdLines.push('')

  mdLines.push('## Per-pack table')
  mdLines.push('')
  mdLines.push('| # | Niche | Status | Attempts | Words | Retry-pass | Fallback | Runtime |')
  mdLines.push('|---|---|---|---|---|---|---|---|')
  results.forEach((r, i) => {
    const status = r.errors.length > 0 ? '✗ ERROR'
      : r.fallbackSectionCount > 0 ? `⚠ FALLBACK·${r.fallbackSectionCount}`
      : r.attempts > 1 ? `↻ RETRY ${r.attempts}`
      : '✓ CLEAN'
    mdLines.push(`| ${i + 1} | ${r.niche.label} | ${status} | ${r.attempts} | ${r.totalWords} | ${r.retrySectionCount} | ${r.fallbackSectionCount} | ${r.runtimeSeconds.toFixed(1)}s |`)
  })
  mdLines.push('')

  mdLines.push('## Files')
  mdLines.push('')
  for (const r of results) {
    if (r.errors.length > 0) {
      mdLines.push(`- ⚠ \`${r.niche.slug}/error.txt\` — ${r.errors[0].slice(0, 100)}`)
    } else {
      mdLines.push(`- \`${r.niche.slug}/pack.md\` — full readable text (${r.totalWords} words)`)
    }
  }
  mdLines.push('')

  mdLines.push('## Next steps')
  mdLines.push('1. Paste this `_summary.md` + 1-2 packs you want deep-dive into Claude')
  mdLines.push('2. Claude audits brutally — finds drift, recurring failures, BEFORE/AFTER fixes')
  mdLines.push('3. Calibration loop until target reader feeling reached')
  mdLines.push('')

  writeFileSync(join(outDir, '_summary.md'), mdLines.join('\n'), 'utf-8')

  writeFileSync(
    join(outDir, '_summary.json'),
    JSON.stringify({
      attempted: results.length,
      successful,
      totalGeminiCalls: totalCalls,
      totalRuntimeSeconds: totalRuntimeSec,
      estimatedCostUsd: estCost,
      packs: results.map((r) => ({
        slug: r.niche.slug,
        label: r.niche.label,
        attempts: r.attempts,
        validationPass: r.validationPass,
        totalWords: r.totalWords,
        retrySectionCount: r.retrySectionCount,
        fallbackSectionCount: r.fallbackSectionCount,
        runtimeSeconds: r.runtimeSeconds,
        errors: r.errors,
      })),
    }, null, 2),
    'utf-8',
  )
}

/** Sleep helper for inter-pack delays. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  const stamp = isoStamp()
  const outDir = join('test-output', stamp)
  ensureDir(outDir)

  // Anti rate-limit: 60s delay between packs (Google Gemini free tier
  // ~10 req/min — 10 packs × 2 attempts ÷ 60s = 20 calls/10min = OK)
  // Override via INTER_PACK_DELAY_SEC env var. Set to 0 to disable.
  const interPackDelaySec = process.env.INTER_PACK_DELAY_SEC !== undefined
    ? Number(process.env.INTER_PACK_DELAY_SEC)
    : 60

  // SINGLE_NICHE=skincare              → only run that 1 niche by slug/key (for debugging)
  // SINGLE_NICHE=2                     → only run niche at index 2 (1-based)
  // SINGLE_NICHE=2,3,9,10              → run multiple niches (comma-separated, any mix of indices/slugs)
  let activeNiches = NICHES
  if (process.env.SINGLE_NICHE) {
    const raw = process.env.SINGLE_NICHE
    const keys = raw.split(',').map((k) => k.trim()).filter(Boolean)
    const picked: TestNiche[] = []
    const missing: string[] = []
    for (const key of keys) {
      const byIdx = NICHES[parseInt(key, 10) - 1]
      const bySlug = NICHES.find((n) => n.slug.includes(key) || n.input.niche.includes(key))
      const match = byIdx ?? bySlug
      if (match && !picked.includes(match)) picked.push(match)
      else if (!match) missing.push(key)
    }
    if (picked.length > 0) activeNiches = picked
    if (missing.length > 0) console.warn(`[storytelling-test] SINGLE_NICHE: no match for ${missing.join(', ')} — skipped`)
    console.log(`[storytelling-test] SINGLE_NICHE=${raw} → running ${activeNiches.length}: ${activeNiches.map((n) => n.label).join(', ')}`)
  }

  console.log(`[storytelling-test] starting run, output → ${outDir}/`)
  console.log(`[storytelling-test] generating ${activeNiches.length} pack(s) sequentially (~30-90s each)`)
  console.log(`[storytelling-test] inter-pack delay: ${interPackDelaySec}s (anti rate-limit)`)
  console.log('')

  const overallStart = Date.now()
  const results: PackRunResult[] = []
  for (let i = 0; i < activeNiches.length; i++) {
    const r = await runPack(activeNiches[i], outDir, i, activeNiches.length)
    results.push(r)
    // Inter-pack cooldown (skip after last pack)
    if (i < activeNiches.length - 1 && interPackDelaySec > 0) {
      console.log(`[storytelling-test]   ⏸ cooldown ${interPackDelaySec}s before next pack...`)
      await sleep(interPackDelaySec * 1000)
    }
  }
  const totalRuntimeSec = (Date.now() - overallStart) / 1000

  writeSummary(outDir, results, totalRuntimeSec)

  console.log('')
  console.log(`[storytelling-test] ═══ DONE in ${(totalRuntimeSec / 60).toFixed(1)} min ═══`)
  console.log(`[storytelling-test] summary → ${outDir}/_summary.md`)
  console.log(`[storytelling-test] paste _summary.md + 1-2 pack.md files back to Claude for audit`)
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
