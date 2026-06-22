/* eslint-disable no-console */
// ═══════════════════════════════════════════════════════════════════════════
// verify-director.ts — HYPOTHESIS TEST (no P2). Runs the REAL scriptGenerator +
// brollDirector across N diverse products, snapshots scenes after EVERY
// deterministic layer (via the temp `onLayer` hook), then attributes — per scene —
// whether the FINAL role/concept still agrees with Gemini's declared `shotIntent`,
// and IF it diverged, WHICH layer broke it.
//
//   npx tsx scripts/verify-director.ts
//
// Tests: "intent đa số đúng; các lớp deterministic ghi đè sai."
// ═══════════════════════════════════════════════════════════════════════════
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import dotenv from 'dotenv'
import { generateScript } from '../src/apps/video-builder/v3/services/scriptGenerator'
import { directBrollScenes, assignSceneTiming, type BrollScene } from '../src/apps/video-builder/v3/services/brollDirector'
import type { ScriptLang, AdStructure, AdAngle, ScriptTargetDurationSec } from '../src/apps/video-builder/v3/types'
import type { Product } from '../src/stores/types'

dotenv.config({ path: '.env.local' })
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
if (!GEMINI_API_KEY) { console.error('❌ thiếu GEMINI_API_KEY trong .env.local'); process.exit(1) }
const KEY: string = GEMINI_API_KEY

// ─── 5 diverse products (VN + MY, khác ngách hoàn toàn) ──────────────────────
type Spec = {
  slug: string; lang: ScriptLang; structure: AdStructure; angle: AdAngle; dur: ScriptTargetDurationSec
  product: Pick<Product, 'productName'|'productDescription'|'targetMarket'|'painPoints'|'usps'|'benefits'|'offer'|'ingredients'|'usageGuide'>
}
const SPECS: Spec[] = [
  { slug: '1-vien-bo-gan-vi', lang: 'vi', structure: 'INSTANT', angle: 'problem_solution', dur: 50,
    product: { productName: 'Viên Bổ Gan Thanh Độc', productDescription: 'Viên uống thảo dược hỗ trợ giải độc gan, hạ men gan', targetMarket: 'Nam 30-50 hay nhậu, gan yếu', painPoints: 'Mệt mỏi, nóng trong, nổi mụn, men gan cao do bia rượu', usps: 'Cà gai leo + atiso + diệp hạ châu chuẩn hoá', benefits: 'Mát gan, hạ men gan sau 2 tuần, hết nóng trong, da đỡ mụn', offer: 'Mua 2 tặng 1', ingredients: 'Cà gai leo, atiso, diệp hạ châu, kế sữa', usageGuide: 'Uống 2 viên/ngày sau ăn' } },
  { slug: '2-serum-trang-da-vi', lang: 'vi', structure: 'LEAD', angle: 'testimonial', dur: 60,
    product: { productName: 'Serum Sáng Da Vitamin C 15%', productDescription: 'Serum dưỡng sáng, mờ thâm nám, đều màu da', targetMarket: 'Nữ 25-40 da xỉn, thâm nám sau sinh', painPoints: 'Da xỉn màu, thâm nám hai bên gò má, kém tươi tắn', usps: 'Vitamin C 15% ổn định + niacinamide + HA', benefits: 'Da sáng đều sau 4 tuần, mờ thâm, căng bóng', offer: 'Giảm 40% hôm nay', ingredients: 'Vitamin C 15%, Niacinamide, Hyaluronic Acid', usageGuide: 'Thoa 3-4 giọt buổi sáng trước kem chống nắng' } },
  { slug: '3-noi-chien-khong-dau-vi', lang: 'vi', structure: 'INSTANT', angle: 'direct_response', dur: 50,
    product: { productName: 'Nồi Chiên Không Dầu 8L', productDescription: 'Nồi chiên không dầu dung tích lớn, màn cảm ứng', targetMarket: 'Mẹ bỉm, gia đình 4-5 người bận rộn', painPoints: 'Chiên rán dầu mỡ bắn, ngại nấu, đồ ăn nhiều dầu hại sức khoẻ', usps: 'Dung tích 8L, 12 chế độ, công nghệ đối lưu 360', benefits: 'Chiên giòn không cần dầu, dọn nhanh, ăn healthy', offer: 'Tặng kèm giấy nến + kẹp gắp', ingredients: '', usageGuide: 'Chọn chế độ, hẹn giờ, không cần lật trở' } },
  { slug: '4-collagen-tri-an-ms', lang: 'ms', structure: 'LEAD', angle: 'emotional', dur: 60,
    product: { productName: 'Kolagen Marine Premium', productDescription: 'Serbuk kolagen ikan laut dalam untuk kulit & sendi', targetMarket: 'Wanita 30-50 kulit mula kendur, sendi sakit', painPoints: 'Kulit kendur, kedut halus, lutut sakit bila naik tangga', usps: 'Kolagen peptida ikan + Vitamin C + 5000mg', benefits: 'Kulit anjal, kedut berkurang, sendi kurang sakit selepas 3 minggu', offer: 'Beli 2 percuma 1', ingredients: 'Marine collagen peptide, Vitamin C, Biotin', usageGuide: 'Campur 1 sachet dengan air, minum sebelum tidur' } },
  { slug: '5-mesin-urut-leher-ms', lang: 'ms', structure: 'INSTANT', angle: 'curiosity', dur: 50,
    product: { productName: 'Alat Urut Leher EMS', productDescription: 'Alat urut leher & bahu guna teknologi EMS + haba', targetMarket: 'Pekerja office sakit leher bahu kerana duduk lama', painPoints: 'Leher kaku, bahu tegang, sakit kepala sebab duduk depan laptop', usps: 'EMS pulse + haba 42°C + 6 mod', benefits: 'Leher relaks, tegang hilang dalam 15 minit, boleh guna sambil kerja', offer: 'Diskaun 50% hari ini', ingredients: '', usageGuide: 'Lekap pada leher, pilih mod, guna 15 minit' } },
]

const norm = (q: string) => (q || '').toLowerCase().replace(/[^a-z0-9à-ỹ\s]/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 45)
const sig = (cp?: string): string => {
  const p = (cp || '').toLowerCase()
  if (!p.trim()) return '∅empty'
  if (/different shot|look nothing like|over-the-shoulder|from-behind|selfie-distance|unguarded/.test(p)) return 'DEDUP-rewrite'
  if (/thumbs-up|enthusiastic thumbs|endorsement at the call/.test(p)) return 'CTA-endorse'
  if (/offer moment|tapping \/ pointing|deal is announced/.test(p)) return 'OFFER'
  if (/split-screen|before.*after|left=before|completely different outfit/.test(p)) return 'SPLIT-before/after'
  if (/simple real-life moment|illustrates the spoken line|a clean, well-lit close-up|texture and a key detail|hands actively using and holding/.test(p)) return 'WEAK-default'
  return 'custom'
}
// intent → expected role family (the P2 mapping under test)
const expectRole = (intent?: string): string => {
  switch (intent) {
    case 'lips': return 'lips'
    case 'mechanism3d': return 'mechanism3d'
    case 'social_proof': return 'social_proof'
    case 'product_macro': case 'product_demo': case 'reaction':
    case 'result_behavior': case 'before_after': case 'offer': case 'endorsement': return 'broll'
    default: return '?'
  }
}

const STAGES = ['00_gemini_raw','01_lips_ladder','02_establish','03_cta_penult_lock','04_product_hero','05_cap_social_proof','06_before_after','07_backfill_weak','08_render_safe_holds','09_cap_endorsement']

async function run() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outDir = join('test-output', `verify-director-${stamp}`)
  mkdirSync(outDir, { recursive: true })
  const summary: string[] = []
  let totRaw = 0, totLayerBroke = 0, totGeminiRoleWrong = 0, totAlignFinal = 0, totScenes = 0

  for (const spec of SPECS) {
    console.log(`\n━━━ ${spec.slug} (${spec.lang}) ━━━`)
    let gen
    try {
      gen = await generateScript({
        geminiKey: KEY, structure: spec.structure, angle: spec.angle, targetDurationSec: spec.dur,
        productName: spec.product.productName, productPitch: spec.product.productDescription, lang: spec.lang,
      })
    } catch (e) { console.error('  scriptGen FAIL:', (e as Error).message); continue }
    const script = gen.script
    const product = { id: 'p', productImage: '', productImages: [], createdAt: 0, ...spec.product } as Product

    const snaps: Record<string, BrollScene[]> = {}
    let result
    try {
      result = await directBrollScenes({
        geminiKey: KEY, script, lang: spec.lang, product, voiceDurationSec: script.totalDurationSec,
        onLayer: (label, scenes) => { snaps[label] = scenes },
      })
    } catch (e) { console.error('  director FAIL:', (e as Error).message); continue }
    const timed = assignSceneTiming(result.scenes, null, script, script.totalDurationSec)
    snaps['10_TIMED_dedup'] = timed

    const raw = snaps['00_gemini_raw'] || []
    // index gemini_raw by normalized quote
    const rawByQ = new Map<string, BrollScene>()
    raw.forEach(s => { const k = norm(s.quote); if (!rawByQ.has(k)) rawByQ.set(k, s) })

    const rows: string[] = []
    rows.push(`# ${spec.slug}  (lang=${spec.lang}, dur=${script.totalDurationSec}s, gemini_raw=${raw.length} → final=${timed.length})`)
    rows.push('')
    rows.push('| # | câu (45) | intent | role raw→final | concept final | layer đổi role | layer đổi concept | verdict |')
    rows.push('|--|--|--|--|--|--|--|--|')

    timed.forEach((fin, i) => {
      const q = norm(fin.quote)
      const r0 = rawByQ.get(q)
      const intent = fin.shotIntent || '—'
      const roleRaw = r0?.role || '(new)'
      const roleFin = fin.role
      // walk stages to find first stage where role / conceptSig != gemini_raw value
      const seq = STAGES.map(st => (snaps[st] || []).find(s => norm(s.quote) === q)).filter(Boolean) as BrollScene[]
      let roleChanger = '', concChanger = ''
      if (r0) {
        let prevRole = r0.role, prevSig = sig(r0.conceptPrompt)
        for (let k = 1; k < STAGES.length; k++) {
          const s = (snaps[STAGES[k]] || []).find(x => norm(x.quote) === q)
          if (!s) continue
          if (!roleChanger && s.role !== prevRole) roleChanger = STAGES[k]
          if (!concChanger && sig(s.conceptPrompt) !== prevSig) concChanger = STAGES[k]
          prevRole = s.role; prevSig = sig(s.conceptPrompt)
        }
        // dedup (in assignSceneTiming) — compare last director stage vs timed
        const last = (snaps['09_cap_endorsement'] || []).find(x => norm(x.quote) === q)
        if (last) { if (!roleChanger && fin.role !== last.role) roleChanger = '10_TIMED_dedup'; if (sig(fin.conceptPrompt) !== sig(last.conceptPrompt)) concChanger = concChanger || '10_TIMED_dedup' }
      }
      const exp = expectRole(intent)
      const alignFinal = intent === '—' ? null : (exp === roleFin || (exp === 'broll' && roleFin === 'broll'))
      const alignRaw = (r0 && intent !== '—') ? (exp === r0.role || (exp === 'broll' && r0.role === 'broll')) : null
      let verdict = ''
      if (intent === '—') verdict = '∅no-intent'
      else if (alignRaw && !alignFinal) { verdict = '🔴 LAYER PHÁ (raw khớp intent → final lệch)'; totLayerBroke++ }
      else if (!alignRaw && r0) { verdict = '🟠 Gemini role≠intent từ đầu'; totGeminiRoleWrong++ }
      else if (alignFinal) { verdict = '🟢 khớp'; totAlignFinal++ }
      else verdict = '⚪ (scene mới/không match)'
      // concept-level divergence even if role aligns (e.g. mechanism3d w/ weak default)
      const cs = sig(fin.conceptPrompt)
      if (verdict.startsWith('🟢') && (cs === 'WEAK-default' || cs === 'DEDUP-rewrite' || (intent === 'mechanism3d' && cs !== 'custom'))) verdict = '🟡 role ok nhưng concept lệch (' + cs + ')'
      totScenes++; if (r0) totRaw++
      rows.push(`| ${i+1} | ${fin.quote.slice(0,45).replace(/\|/g,'/')} | ${intent} | ${roleRaw}→${roleFin} | ${cs} | ${roleChanger||'-'} | ${concChanger||'-'} | ${verdict} |`)
    })

    writeFileSync(join(outDir, `${spec.slug}.md`), rows.join('\n'))
    writeFileSync(join(outDir, `${spec.slug}.snaps.json`), JSON.stringify({ script: script.blocks, anchor: script.anchor, snaps }, null, 2))
    console.log(rows.join('\n'))
    summary.push(rows.join('\n'))
  }

  const head = [
    `# VERIFY DIRECTOR — tổng hợp ${SPECS.length} sản phẩm`,
    ``,
    `Tổng scene match: ${totRaw}`,
    `🟢 final khớp intent: ${totAlignFinal}`,
    `🔴 LAYER PHÁ (raw khớp intent nhưng final lệch): ${totLayerBroke}`,
    `🟠 Gemini role≠intent ngay từ raw: ${totGeminiRoleWrong}`,
    ``,
    `Giả thuyết "intent đa số đúng, lớp ghi đè sai" → đo bằng (🔴 + 🟡) vs (🟠).`,
    ``, '---', '',
  ]
  writeFileSync(join(outDir, '_summary.md'), head.concat(summary).join('\n\n'))
  console.log('\n\n==== SUMMARY ====\n' + head.join('\n'))
  console.log('Saved →', outDir)
}
run().catch(e => { console.error(e); process.exit(1) })
