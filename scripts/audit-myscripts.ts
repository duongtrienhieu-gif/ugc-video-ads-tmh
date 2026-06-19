/* eslint-disable no-console */
// ═══════════════════════════════════════════════════════════════════════════
// audit-myscripts.ts — Feed the USER'S OWN finished scripts straight into the
// REAL brollDirector (Gemini carve + every deterministic pass), then DERIVE the
// exact render prompt each scene WOULD send to i2v (mirroring hybridRenderer),
// and auto-flag against the fix criteria (pain-unresolved, before/after same-
// person lock, closeup no-hands, mechanism3d site, social-proof 1-card + crowd).
//
// Does NOT call KIE (no credit, no video). It audits the LOGIC layer end-to-end:
//   câu chữ → shotIntent → role/kind/concept → FINAL render prompt.
//
//   npx tsx scripts/audit-myscripts.ts
//
// Output → test-output/audit-myscripts-<stamp>/ : per-script .md (table) +
// .full.md (verbatim render prompts) + _summary.md.
// ═══════════════════════════════════════════════════════════════════════════
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import dotenv from 'dotenv'
import {
  directBrollScenes, assignSceneTiming, isWeakConceptPrompt, deriveConceptPrompt,
  type BrollScene, type TimedBrollScene,
} from '../src/apps/video-builder/v3/services/brollDirector'
import type { GeneratedScript, ScriptBlock, ScriptBlockId, ScriptLang } from '../src/apps/video-builder/v3/types'
import type { Product } from '../src/stores/types'

dotenv.config({ path: '.env.local' })
const KEY = process.env.GEMINI_API_KEY
if (!KEY) { console.error('❌ thiếu GEMINI_API_KEY trong .env.local'); process.exit(1) }

// ─── The user's 5 finished MS scripts, split into blocks + product context ───
type Spec = {
  slug: string; lang: ScriptLang; dur: number; anchor: string
  blocks: Record<ScriptBlockId, string>
  product: Partial<Product>
}
const SPECS: Spec[] = [
  {
    slug: '1-eelhoe-ear-drops', lang: 'ms', dur: 60, anchor: 'Ginkgo Biloba lancarkan darah ke telinga',
    blocks: {
      hook: 'Memang lain macam bila telinga aku dah tak berdesing.',
      pain: 'Dulu aku selalu sangat rasa telinga berdesing macam ada konsert dalam kepala, sampai nak fokus pun susah.',
      discovery: 'Tapi sekarang, aku dah jumpa EELHOE Sokongan Pendengaran Sihat ni. Gila weh, benda ni memang game changer! Dia bukan setakat bersihkan telinga, tapi formula dia ada ekstrak Ginkgo Biloba yang bantu lancarkan darah ke telinga, pastu ada Lavender Oil yang tenangkan keradangan. Yang paling aku suka, ada Olive Oil, senang gila nak lembutkan tahi telinga yang degil tu.',
      benefit: 'Aku titik je dua tiga titis, pastu tunggu sikit, memang cair terus tahi telinga tu, senang nak bersihkan. Sekarang ni telinga aku dah tak berdesing langsung, dengar apa pun jelas gila. Tak payah nak jerit-jerit dah orang panggil. Rasa bersih je telinga, takde gatal-gatal atau sakit-sakit macam dulu. Ramai dah cuba benda ni, feedback semua padu, memang berbaloi sangat.',
      cta: 'Korang jangan tunggu lama-lama, nanti menyesal tak sudah. Stok tengah laku keras ni, grab cepat sebelum habis! Jangan lepaskan peluang dapatkan balik pendengaran yang jelas dan sihat.',
    },
    product: {
      productName: 'EELHOE Sokongan Pendengaran Sihat',
      productDescription: 'Titisan telinga herba untuk lembutkan tahi telinga & sokong pendengaran sihat',
      targetMarket: 'Dewasa yang telinga berdesing, tahi telinga degil, pendengaran kurang jelas',
      painPoints: 'Telinga berdesing (tinnitus), tahi telinga keras degil, susah fokus, dengar tak jelas',
      usps: 'Ekstrak Ginkgo Biloba + Lavender Oil + Olive Oil',
      benefits: 'Telinga tak berdesing, dengar jelas, telinga bersih, takde gatal/sakit',
      offer: 'Stok terhad — grab cepat',
      ingredients: 'Ginkgo Biloba extract, Lavender Oil, Olive Oil',
      usageGuide: 'Titik 2-3 titis ke dalam telinga, tunggu sekejap, tahi telinga cair, kemudian bersihkan',
    },
  },
  {
    slug: '2-manuka-throat-gel', lang: 'ms', dur: 60, anchor: 'madu Manuka asli UMF 10+',
    blocks: {
      hook: 'Aku try gel batuk Manuka ni sebab tak percaya.',
      pain: 'Selalu sangat batuk sampai mengganggu tidur malam, memang stress betul. Dah macam-macam ubat batuk aku cuba, tapi takde satu pun yang betul-betul berkesan. Kadang-kadang sampai rasa nak nangis sebab penat sangat batuk, especially bila tengah malam tu, memang tak boleh nak lelap mata langsung.',
      discovery: 'Rupanya, Gel Batuk & Sakit Tekak Manuka Herba ni ada madu Manuka asli UMF 10+. Tekstur dia best, tak melekit langsung, rasa macam balm lembut je. Bila sapu, rasa suam-suam manja kat tekak, terus lega. Madu Manuka ni terkenal dengan sifat antibakteria dan anti-radang dia yang kuat, bantu lawan kuman dan kurangkan bengkak. Dia macam satu lapisan pelindung yang menenangkan tekak kita dari dalam.',
      benefit: 'Aku sapu sikit je kat leher, tak sampai 10 minit, batuk terus reda. Memang terkejut gila aku! Malam tu boleh tidur lena sampai pagi, takde dah terjaga tengah malam sebab batuk. Rasa macam dapat hidup balik lepas berbulan-bulan tak cukup tidur. Ramai gila dah cuba, review pun semua 5 bintang. Kawan aku yang skeptikal pun dah jadi peminat setia lepas dia cuba sendiri.',
      cta: 'Jangan tunggu lagi, grab cepat sementara stok masih ada. Sekarang ada promo beli 1 free 2! Memang berbaloi sangat-sangat!',
    },
    product: {
      productName: 'Gel Batuk & Sakit Tekak Manuka Herba',
      productDescription: 'Gel sapu luar untuk leher/tekak dengan madu Manuka, melegakan batuk & sakit tekak',
      targetMarket: 'Orang dewasa batuk malam, sakit tekak, susah tidur',
      painPoints: 'Batuk malam mengganggu tidur, sakit tekak, ubat lain tak berkesan',
      usps: 'Madu Manuka asli UMF 10+, tekstur balm tak melekit, antibakteria & anti-radang',
      benefits: 'Tekak lega dalam 10 minit, batuk reda, tidur lena',
      offer: 'Promo beli 1 free 2',
      ingredients: 'Madu Manuka UMF 10+',
      usageGuide: 'Sapu sedikit gel pada kulit leher / luar tekak, tunggu < 10 minit',
    },
  },
  {
    slug: '3-lanzf-joint-gel', lang: 'ms', dur: 60, anchor: 'Curcumin + Emu Oil teknologi Nano',
    blocks: {
      hook: 'Aku harap aku tengok video pasal gel penyejuk ni lebih awal.',
      pain: 'Sebab selalu sangat aku rasa sengal-sengal sendi, terutama lepas seharian mengadap laptop.',
      discovery: 'Tapi bila aku try LANZF Gel Penyejuk Cepat ni, gila weh, lain macam terus! Dia ada Curcumin dengan Emu Oil, tau. Bahan ni memang power sebab dia pakai teknologi Nano, so gel ni serap terus masuk dalam sendi kita. Bila sapu tu, rasa sejuk nyaman je, takde langsung rasa melekit atau panas membakar. Memang best gila.',
      benefit: 'Yang paling penting, sakit sendi aku yang kerap datang tu, dalam 3 minit je dah rasa kurang. Lepas 3 hari pakai, bangun pagi dah takde rasa kaku-kaku sendi, boleh gerak sana sini senang je. Ni bukan cerita kosong, ramai dah repeat order sebab memang berkesan untuk pulihkan rawan sendi yang rosak. Aku dah tak risau dah nak buat aktiviti lasak, confirm mood pun happy je.',
      cta: 'Korang wajib ada LANZF Gel Penyejuk Cepat ni kat rumah. Jangan lepaskan peluang Beli 1 Percuma 1 ni, stok terhad sangat! Jangan sampai menyesal nanti.',
    },
    product: {
      productName: 'LANZF Gel Penyejuk Cepat',
      productDescription: 'Gel sapu penyejuk untuk sakit sendi, serapan Nano',
      targetMarket: 'Orang sengal/sakit sendi, duduk lama depan laptop, aktif',
      painPoints: 'Sengal-sengal sendi, kaku sendi bangun pagi, sakit sendi kerap',
      usps: 'Curcumin + Emu Oil, teknologi Nano serap cepat, sejuk tak melekit',
      benefits: 'Sakit sendi kurang dalam 3 minit, tak kaku selepas 3 hari, boleh gerak bebas',
      offer: 'Beli 1 Percuma 1',
      ingredients: 'Curcumin, Emu Oil',
      usageGuide: 'Sapu gel pada sendi yang sakit, serap masuk, rasa sejuk',
    },
  },
  {
    slug: '4-knee-support-brace', lang: 'ms', dur: 60, anchor: '3 spring power',
    blocks: {
      hook: 'Aku test penggalak sokongan lutut ni supaya korang tak payah bazir duit.',
      pain: 'Serious la, kadang tu nak naik tangga pun rasa lutut macam nak goyang, tak stabil langsung.',
      discovery: 'Day 1 aku terus sarung Penggalak Sokongan Lutut ni. Dia ada 3 spring power kat dalam, tau! Spring ni la yang tolak lutut kita, bantu bagi kekuatan ekstra masa kita gerak. Material dia lembut gila, jenis bernafas, tak rasa rimas pun kalau pakai lama-lama. Rasa macam lutut kita ada bodyguard sendiri, padu.',
      benefit: 'Yang aku perasan, bila pakai benda ni, lutut tak rasa sakit dah bila jalan jauh. Nak berdiri lama kat dapur pun dah tak lenguh. Paling best, keyakinan tu naik mendadak, tak payah risau lagi lutut lemah bila nak melangkah. Memang ramai gila dah bagi 5 bintang kat produk ni, confirm berbaloi.',
      cta: 'Jangan tunggu lagi, grab Penggalak Sokongan Lutut ni sekarang. Stok terhad tau, nanti menyesal tak dapat. Cepat-cepat tekan link bawah ni, beli sekarang ada promo beli 1 dapat! Jangan lepaskan peluang ni!',
    },
    product: {
      productName: 'Penggalak Sokongan Lutut',
      productDescription: 'Pendakap lutut dengan 3 spring sokongan, bahan bernafas',
      targetMarket: 'Orang lutut lemah/tak stabil, sakit lutut naik tangga, berdiri lama',
      painPoints: 'Lutut goyang naik tangga, tak stabil, sakit jalan jauh, lenguh berdiri lama',
      usps: '3 spring power sokongan, material lembut bernafas, selesa pakai lama',
      benefits: 'Lutut tak sakit jalan jauh, tak lenguh berdiri lama, keyakinan naik',
      offer: 'Beli 1 dapat (free)',
      ingredients: '',
      usageGuide: 'Sarung pendakap pada lutut, spring beri sokongan masa bergerak',
    },
  },
  {
    slug: '5-mini-tire-pump', lang: 'ms', dur: 60, anchor: '20,000mAh, 3 minit penuh',
    blocks: {
      hook: 'Ramai cakap pam tayar ni best, aku check sendiri.',
      pain: 'Sebabnya, aku dah penat sangat bila tayar tiba-tiba kempis tengah jalan, nak cari stesen minyak memang satu hal.',
      discovery: 'Korang, Pam Tayar Mini Mudah Alih ni memang legit gila. Dia ada bateri 20,000mAh, boleh guna sampai 4 jam tau. Berat dia cuma 2kg je, senang nak simpan bawah seat kereta. Yang bestnya, dia ni boleh pam semua benda — tayar kereta, basikal, bola, sampai tilam angin pun boleh. Power gila.',
      benefit: 'Aku mula-mula skeptikal, tapi ramai dah repeat order benda ni, so aku pun try. Serious tak tipu, pam ni laju gila. Cuma sambungkan kat tayar, tekan butang, tak sampai 3 minit dah penuh. Dia ada auto-stop bila dah cukup tekanan, so tak payah risau over-pam. Sekarang, aku tak risau dah kalau tayar kempis masa nak balik kerja malam-malam. Rasa selamat je bila ada benda ni dalam kereta. Memang next level punya kemudahan.',
      cta: 'Jangan tunggu lagi, grab cepat Pam Tayar Mini Mudah Alih ni. Promo sekarang ni memang tak masuk akal, beli satu dapat free gift sekali. Stok terhad tau, jangan sampai menyesal nanti!',
    },
    product: {
      productName: 'Pam Tayar Mini Mudah Alih',
      productDescription: 'Pam tayar elektrik mudah alih dengan bateri, auto-stop tekanan',
      targetMarket: 'Pemandu kereta, penunggang basikal, sesiapa risau tayar kempis',
      painPoints: 'Tayar kempis tengah jalan, susah cari stesen minyak, risau balik kerja malam',
      usps: 'Bateri 20,000mAh (4 jam), 2kg ringan, pam pelbagai (kereta/basikal/bola/tilam), auto-stop',
      benefits: 'Pam penuh < 3 minit, tak risau tayar kempis, rasa selamat',
      offer: 'Beli satu dapat free gift',
      ingredients: '',
      usageGuide: 'Sambung pada valve tayar, tekan butang, auto-stop bila cukup tekanan',
    },
  },
]

// ── Build a GeneratedScript from a finished script (no scriptGenerator) ──────
const ORDER: ScriptBlockId[] = ['hook', 'pain', 'discovery', 'benefit', 'cta']
function buildScript(spec: Spec): GeneratedScript {
  const totalWords = ORDER.reduce((n, id) => n + spec.blocks[id].split(/\s+/).length, 0)
  const blocks: ScriptBlock[] = ORDER.map((id) => ({
    id,
    text: spec.blocks[id],
    estDurationSec: Math.max(1, Math.round((spec.blocks[id].split(/\s+/).length / totalWords) * spec.dur)),
  }))
  return {
    structure: 'INSTANT', angle: 'problem_solution', targetDurationSec: spec.dur as never,
    blocks, totalDurationSec: spec.dur, generatedAt: 0, anchor: spec.anchor,
  }
}

// ── Mirror hybridRenderer's render-prompt derivation (NO KIE call) ───────────
// Produces the EXACT text/preset that would go to i2v, so we audit the fixes.
function deriveRenderPrompt(scene: BrollScene, product: Product, lang: ScriptLang): { preset: string; prompt: string } {
  if (scene.role === 'lips') return { preset: 'LIPS(Kling)', prompt: `voice: "${scene.quote}"` }
  if (scene.role === 'social_proof') return { preset: 'CARD(GPT-4o)', prompt: `FB-post proof card, lang=${lang}` }

  let cp = scene.conceptPrompt || ''
  if (isWeakConceptPrompt(cp)) {
    cp = deriveConceptPrompt({ role: scene.role, kind: scene.kind, cameraFraming: scene.cameraFraming, product })
  }
  const emptyBroll = scene.role === 'broll' && !cp.trim()
  const preset =
    scene.role === 'mechanism3d' ? 'CONCEPT_SCENE'
    : scene.kind === 'concept' ? 'CONCEPT_SCENE'
    : scene.kind === 'product_closeup' ? 'PRODUCT_CLOSEUP'
    : emptyBroll ? 'PRODUCT_CLOSEUP'
    : 'PRODUCT_IN_ACTION'
  if (scene.role === 'mechanism3d' && !cp.startsWith('3D ')) {
    cp = `3D ANIMATION (no people…): ${cp}. Keep the EXACT body site / subject; cross-section OR product-hero + molecules orbiting.`
  }
  return { preset, prompt: cp }
}

// ── Auto-flag signatures (the fixes under audit) ─────────────────────────────
const SIG = {
  samePersonLock: /ONE SINGLE person|SAME face|same identity|same individual/i,
  crowdBroll: /LOVED, popular|popular,? trusted|MANY people already use|loved-by-many/i,
  noHandsCloseup: /no hands|product alone|not held|not rotated|PRODUCT-ONLY/i,
  splitScreen: /split[- ]?screen|LEFT = BEFORE|RIGHT = AFTER/i,
  threeD: /^3D /,
}
function flags(scene: TimedBrollScene, rp: { preset: string; prompt: string }): string[] {
  const f: string[] = []
  const intent = scene.shotIntent
  const p = rp.prompt
  // before/after must carry the same-person lock
  if (intent === 'before_after' || SIG.splitScreen.test(p)) {
    f.push(SIG.samePersonLock.test(p) ? '✅BA-lock' : '🔴BA-no-lock')
  }
  // product_closeup must be no-hands
  if (scene.kind === 'product_closeup' || rp.preset === 'PRODUCT_CLOSEUP') {
    f.push(SIG.noHandsCloseup.test(p) || rp.preset === 'PRODUCT_CLOSEUP' ? '✅closeup-nohands' : '⚠closeup?')
  }
  // mechanism3d must be a 3D prompt naming a site
  if (intent === 'mechanism3d' || scene.role === 'mechanism3d') {
    f.push(SIG.threeD.test(p) ? '✅3D' : '🔴mech-not3D')
  }
  // crowd broll marker (the 2nd-proof fix)
  if (SIG.crowdBroll.test(p)) f.push('👥crowd-broll')
  return f
}

async function run() {
  const stamp = '0'  // Date.now() unavailable; single run dir
  const outDir = join('test-output', `audit-myscripts-${stamp}`)
  mkdirSync(outDir, { recursive: true })
  const summary: string[] = []
  let totScenes = 0, totCards = 0, totMultiCardScripts = 0, totBaLockOk = 0, totBaLockBad = 0, totMechOk = 0, totMechBad = 0, totCrowd = 0

  for (const spec of SPECS) {
    console.log(`\n━━━ ${spec.slug} (${spec.lang}) ━━━`)
    const script = buildScript(spec)
    const product = { id: 'p', productImage: '', productImages: [], createdAt: 0, ...spec.product } as Product

    let result
    try {
      result = await directBrollScenes({ geminiKey: KEY!, script, lang: spec.lang, product, voiceDurationSec: spec.dur })
    } catch (e) { console.error('  director FAIL:', (e as Error).message); summary.push(`## ${spec.slug} — ❌ DIRECTOR FAIL: ${(e as Error).message}`); continue }
    const timed = assignSceneTiming(result.scenes, null, script, spec.dur)

    const rows: string[] = []
    const full: string[] = []
    rows.push(`# ${spec.slug} (lang=${spec.lang}, ${timed.length} cảnh)`)
    rows.push('')
    rows.push('| # | t | câu (50) | intent | role/kind | preset | render-prompt (90) | flags |')
    rows.push('|--|--|--|--|--|--|--|--|')
    full.push(`# ${spec.slug} — FULL render prompts\n`)

    let cardCount = 0
    timed.forEach((s, i) => {
      const rp = deriveRenderPrompt(s, product, spec.lang)
      const fl = flags(s, rp)
      if (rp.preset === 'CARD(GPT-4o)') { cardCount++; totCards++ }
      if (fl.includes('✅BA-lock')) totBaLockOk++
      if (fl.includes('🔴BA-no-lock')) totBaLockBad++
      if (fl.includes('✅3D')) totMechOk++
      if (fl.includes('🔴mech-not3D')) totMechBad++
      if (fl.includes('👥crowd-broll')) totCrowd++
      totScenes++
      const t = `${s.startSec?.toFixed(0)}-${s.endSec?.toFixed(0)}s`
      rows.push(`| ${i + 1} | ${t} | ${(s.quote || '').slice(0, 50).replace(/\|/g, '/')} | ${s.shotIntent || '—'} | ${s.role}/${s.kind || '-'} | ${rp.preset} | ${rp.prompt.slice(0, 90).replace(/\|/g, '/').replace(/\n/g, ' ')} | ${fl.join(' ') || '-'} |`)
      full.push(`## #${i + 1} [${t}] intent=${s.shotIntent} role=${s.role} kind=${s.kind} preset=${rp.preset}`)
      full.push(`VOICE: ${s.quote || '(none)'}`)
      full.push(`PROMPT: ${rp.prompt}\n`)
    })
    if (cardCount > 1) totMultiCardScripts++
    rows.push(`\n**Số thẻ social-proof: ${cardCount}** ${cardCount > 1 ? '🔴 (>1 — vi phạm cap)' : '✅'}`)

    writeFileSync(join(outDir, `${spec.slug}.md`), rows.join('\n'))
    writeFileSync(join(outDir, `${spec.slug}.full.md`), full.join('\n'))
    console.log(rows.join('\n'))
    summary.push(rows.join('\n'))
  }

  const head = [
    `# AUDIT MY-SCRIPTS — ${SPECS.length} kịch bản Malay`,
    ``,
    `Tổng cảnh: ${totScenes}`,
    `Thẻ social-proof: ${totCards}  | kịch bản có >1 thẻ: ${totMultiCardScripts} ${totMultiCardScripts ? '🔴' : '✅'}`,
    `Crowd broll (proof #2): ${totCrowd}`,
    `Before/after same-person lock: ✅${totBaLockOk} / 🔴${totBaLockBad}`,
    `Mechanism3D đúng 3D: ✅${totMechOk} / 🔴${totMechBad}`,
    ``, '---', '',
  ]
  writeFileSync(join(outDir, '_summary.md'), head.concat(summary).join('\n\n'))
  console.log('\n\n==== SUMMARY ====\n' + head.join('\n'))
  console.log('Saved →', outDir)
}
run().catch((e) => { console.error(e); process.exit(1) })
