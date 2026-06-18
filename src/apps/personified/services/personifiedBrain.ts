// ── Mode 3 — Personified Studio — BRAIN (P1) ─────────────────────────────────
// Đọc kỹ sản phẩm → HIỂU insight → sáng tạo kịch bản nhân cách hóa vấn đề.
// 2 pass:
//   1. analyzeInsight  — insight SP + khách + nỗi đau + ẩn dụ + gợi ý Kiểu kịch bản
//   2. generateScript  — Character Sheet + Storyboard (snap 4/8/12) + Full-text
//                        Voice Script SONG NGỮ (đích + VN gloss)
// Chạy trên Gemini (directGeminiText) — KHÔNG gọi model ảnh/video (đó là P2/P3).
// Giọng văn NATIVE ("tao–mày" / "tui–sếp/bà") + slang vùng miền, KHÔNG dịch máy.
// Compliance: từ "hỗ trợ" + disclaimer "tùy cơ địa" tự nhồi (ngách TPCN/mỹ phẩm).
// ─────────────────────────────────────────────────────────────────────────────

import { directGeminiText } from '../../../utils/gemini'
import type { Product } from '../../../stores/types'
import {
  type TargetMarket, type PersonifiedConfig, type ProductInsight,
  type PersonifiedScript, type PersonifiedScene, type ArchetypeId,
  TARGET_MARKET_GEMINI_NAME,
} from '../types'
import {
  ARCHETYPES, ARCHETYPE_ORDER, HERO_TYPE_LABEL, CTA_STYLE_LABEL,
  LENGTH_SCENE_COUNT, LENGTH_TARGET_SEC, pickClipDuration, estimateSpeechSec,
} from '../constants'

// ── Product context block (Mode 3 local — không phụ thuộc v3) ─────────────────
function buildProductContext(p: Product): string {
  const rows: [string, string][] = [
    ['Tên sản phẩm', p.productName],
    ['Mô tả', p.productDescription],
    ['Thị trường gốc', p.targetMarket],
    ['Nỗi đau', p.painPoints],
    ['USP', p.usps],
    ['Lợi ích', p.benefits],
    ['Thành phần / hoạt chất', p.ingredients],
    ['Cách dùng', p.usageGuide],
    ['Ưu đãi', p.offer],
  ]
  const body = rows.filter(([, v]) => v && v.trim()).map(([k, v]) => `- ${k}: ${v.trim()}`).join('\n')
  const vb = p.visualBrief ? `\n[VISUAL BRIEF]\n${p.visualBrief.trim()}` : ''
  return body ? `\n[SẢN PHẨM]\n${body}${vb}` : ''
}

function stripFence(raw: string): string {
  let s = raw.trim()
  if (s.startsWith('```')) s = s.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim()
  return s
}

// ══ PASS 1 — INSIGHT ═════════════════════════════════════════════════════════

const INSIGHT_SCHEMA = {
  type: 'object',
  properties: {
    productInsight: { type: 'string' },
    customerInsight: { type: 'string' },
    painCore: { type: 'string' },
    metaphor: { type: 'string' },
    recommendedArchetype: { type: 'string' },
    reasonVi: { type: 'string' },
  },
  required: ['productInsight', 'customerInsight', 'painCore', 'metaphor', 'recommendedArchetype', 'reasonVi'],
} as const

export async function analyzeInsight(
  product: Product, market: TargetMarket, problemHint: string, geminiKey: string,
): Promise<ProductInsight> {
  const archetypeList = ARCHETYPE_ORDER
    .map((id) => `- ${id}: ${ARCHETYPES[id].labelVi} — ${ARCHETYPES[id].whenVi}`).join('\n')

  const systemInstruction =
`Bạn là chiến lược gia quảng cáo cho format video "nhân cách hóa vấn đề" 3D (kiểu mụn-cóc-có-mặt,
dạ-dày-công-nhân — đang viral ở VN/MY, ngách mỹ phẩm/sức khỏe/TPCN). Mục tiêu: BÁN HÀNG.
Đọc KỸ sản phẩm dưới đây, HIỂU rồi mới phân tích. Trả lời các trường bằng TIẾNG VIỆT.${buildProductContext(product)}

4 KIỂU KỊCH BẢN có thể chọn:
${archetypeList}

Phân tích và xuất JSON:
- productInsight: USP thật, hoạt chất/cơ chế, điểm khác biệt, uy tín/thương hiệu (1-3 câu).
- customerInsight: chân dung khách, nỗi đau, nỗi sợ, insecurity, tình huống dùng (1-3 câu).
- painCore: nỗi đau CỐT LÕI gói trong 1 câu ngắn.
- metaphor: ẩn dụ nên dùng để nhân cách hóa vấn đề (vd "quái vật xâm lược da", "công nhân nội tạng đình công", "quỷ tự ti soi gương").
- recommendedArchetype: CHỌN ĐÚNG 1 id trong [${ARCHETYPE_ORDER.join(', ')}] hợp nhất với sản phẩm/vấn đề.
- reasonVi: 1 câu vì sao chọn kiểu đó.`

  const userPrompt = problemHint.trim()
    ? `Vấn đề khách muốn nhân cách hóa: "${problemHint.trim()}". Phân tích cho thị trường ${TARGET_MARKET_GEMINI_NAME[market]}.`
    : `Tự suy ra vấn đề cốt lõi từ sản phẩm. Phân tích cho thị trường ${TARGET_MARKET_GEMINI_NAME[market]}.`

  const raw = await directGeminiText({
    apiKey: geminiKey, systemInstruction, prompt: userPrompt,
    maxOutputTokens: 1200, temperature: 0.7, thinkingBudget: 0,
    responseMimeType: 'application/json', responseSchema: INSIGHT_SCHEMA,
  })
  const p = JSON.parse(stripFence(raw)) as Partial<ProductInsight>
  const rec = (ARCHETYPE_ORDER as string[]).includes(p.recommendedArchetype ?? '')
    ? (p.recommendedArchetype as ArchetypeId) : 'KB1_invader'
  return {
    productInsight: p.productInsight ?? '',
    customerInsight: p.customerInsight ?? '',
    painCore: p.painCore ?? '',
    metaphor: p.metaphor ?? '',
    recommendedArchetype: rec,
    reasonVi: p.reasonVi ?? '',
  }
}

// ══ PASS 2 — SCRIPT (characters + storyboard + full voice script) ════════════

const SCRIPT_SCHEMA = {
  type: 'object',
  properties: {
    characters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          role: { type: 'string' },
          name: { type: 'string' },
          represents: { type: 'string' },
          appearance: { type: 'string' },
          renderStyle: { type: 'string' },
          voice: {
            type: 'object',
            properties: {
              vungMien: { type: 'string' }, gioiTinh: { type: 'string' }, tuoi: { type: 'string' },
              pitch: { type: 'string' }, texture: { type: 'string' }, tinhCach: { type: 'string' },
            },
            required: ['vungMien', 'gioiTinh', 'tuoi', 'pitch', 'texture', 'tinhCach'],
          },
          imagePromptEn: { type: 'string' },
        },
        required: ['role', 'name', 'represents', 'appearance', 'renderStyle', 'voice', 'imagePromptEn'],
      },
    },
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sceneType: { type: 'string' },
          speaker: { type: 'string' },
          dialoguePrimary: { type: 'string' },
          dialogueVi: { type: 'string' },
          emotion: { type: 'string' },
          camera: { type: 'string' },
          sfx: { type: 'array', items: { type: 'string' } },
          action: { type: 'string' },
          videoPromptEn: { type: 'string' },
        },
        required: ['sceneType', 'speaker', 'dialoguePrimary', 'dialogueVi', 'emotion', 'camera', 'sfx', 'action', 'videoPromptEn'],
      },
    },
  },
  required: ['characters', 'scenes'],
} as const

interface RawScene {
  sceneType: string; speaker: string; dialoguePrimary: string; dialogueVi: string
  emotion: string; camera: string; sfx: string[]; action: string; videoPromptEn: string
}

const VALID_SCENE_TYPES = new Set<string>([
  'challenger', 'rootcause', 'agitation', 'false_solution', 'hero_entrance',
  'application', 'destruction', 'social_proof', 'result', 'cta',
])

export async function generateScript(
  product: Product, market: TargetMarket, config: PersonifiedConfig,
  insight: ProductInsight, geminiKey: string, variant = 0,
): Promise<PersonifiedScript> {
  const arch = ARCHETYPES[config.archetype]
  const sceneCount = LENGTH_SCENE_COUNT[config.length]
  const targetSec = LENGTH_TARGET_SEC[config.length]
  const langName = TARGET_MARKET_GEMINI_NAME[market]
  const isVN = market === 'VN'

  // Word budget hint theo 4/8/12s (tiếng Việt ~3.3 từ/giây, chừa thở):
  //   4s ≈ 10-14 từ · 8s ≈ 22-28 từ · 12s ≈ 34-42 từ.
  const systemInstruction =
`Bạn là biên kịch quảng cáo cho format video "NHÂN CÁCH HÓA VẤN ĐỀ" 3D (kiểu mụn-cóc-có-mặt,
dạ-dày-công-nhân — viral VN/MY). Mục tiêu: BÁN HÀNG. Viết kịch bản theo đúng DNA format này.

KIỂU KỊCH BẢN = ${arch.labelVi}: ${arch.taglineVi}
${arch.brainHint}

CẤU HÌNH:
- Hero (sản phẩm): ${HERO_TYPE_LABEL[config.heroType]}
- Cảnh "đồ thường thất bại" (FalseSolution): ${config.falseSolution ? 'CÓ — chèn 1 cảnh giải pháp thường thất bại / phản diện mạnh thêm trước HeroEntrance' : 'KHÔNG'}
- Kiểu CTA cuối: ${CTA_STYLE_LABEL[config.ctaStyle]}
- Số cảnh: ĐÚNG ${sceneCount} cảnh.
- ⏱ ĐỘ DÀI: tổng video phải GẦN ${targetSec}s (KHÔNG vượt ${targetSec + 12}s). Mỗi cảnh chỉ render được 4/8/12s → viết thoại NGẮN để đa số cảnh rơi vào 4-8s; chỉ tối đa 1 cảnh giải thích dài (rootcause) được tới 12s. Video kiểu này thoại phải punchy, cộc, KHÔNG lê thê.

INSIGHT (đã phân tích):
- Sản phẩm: ${insight.productInsight}
- Khách: ${insight.customerInsight}
- Nỗi đau cốt lõi: ${insight.painCore}
- Ẩn dụ: ${insight.metaphor}
${buildProductContext(product)}

KHUNG CẢNH (chọn & sắp đúng thứ tự, bỏ cảnh tùy chọn nếu không hợp số lượng):
challenger(hook khịa) → rootcause(khoe cách gây hại) → agitation(làm nặng thêm) →
${config.falseSolution ? 'false_solution(đồ thường thất bại) → ' : ''}hero_entrance(SP xuất hiện) →
application(tác động; KB4 = mỗi hoạt chất 1 cảnh) → destruction(tan rã) → result(sạch đẹp) → cta(chốt).

LUẬT VIẾT (bắt buộc):
1. THOẠI NATIVE, KHÔNG DỊCH MÁY: ${arch.narratorVi}. Dùng slang đời thường ${isVN ? 'tiếng Việt' : 'tiếng Mã + chêm sức sống bản địa'} (vd VN: "xả lũ axit", "đình công", "bay màu", "tao cút đây").
2. Thoại NGẮN GỌN, bám độ dài: ĐA SỐ cảnh 8-16 từ (≈4-6s); cảnh thường tối đa ~20 từ (8s); CHỈ 1 cảnh rootcause được tới ~32 từ (12s). Viết thoại quá dài = lỗi làm video phình giờ — đừng lê thê.
3. COMPLIANCE (ngách sức khỏe/mỹ phẩm): dùng từ "hỗ trợ", KHÔNG hứa tuyệt đối/chữa khỏi. Cảnh CTA phải có ý "hiệu quả tùy cơ địa".
4. dialoguePrimary = thoại bằng ${langName} (đưa vào giọng đọc). dialogueVi = ${isVN ? 'GIỐNG HỆT dialoguePrimary' : 'bản dịch NGHĨA sang tiếng Việt cho operator hiểu'}.
5. videoPromptEn = 1 prompt image-to-video TIẾNG ANH: shot type + hành động cụ thể + bối cảnh (3D Pixar character trên nền cơ thể tả thực). KHÔNG bắt model render chữ.
6. imagePromptEn cho mỗi nhân vật = prompt EN tạo ảnh nhân vật 3D (Pixar style, cinematic lighting, --ar 9:16).

XUẤT JSON: { characters:[...], scenes:[${sceneCount} cảnh đúng thứ tự] }. Không markdown.`

  const variantNudge = variant
    ? `\nĐây là LẦN TẠO LẠI #${variant} — cho một hướng sáng tạo KHÁC HẲN (nhân vật/cách khịa/ẩn dụ mới), cùng sản phẩm & mục tiêu.`
    : ''

  const raw = await directGeminiText({
    apiKey: geminiKey, systemInstruction,
    prompt: `Viết kịch bản ${sceneCount} cảnh cho thị trường ${langName} ngay bây giờ.${variantNudge} Trả JSON.`,
    maxOutputTokens: 8192, temperature: variant ? 0.95 : 0.8, thinkingBudget: 0,
    responseMimeType: 'application/json', responseSchema: SCRIPT_SCHEMA,
  })

  const parsed = JSON.parse(stripFence(raw)) as {
    characters?: PersonifiedScript['characters']; scenes?: RawScene[]
  }

  // Snap mỗi cảnh về 4/8/12 theo độ dài thoại (đo bằng word-count).
  const scenes: PersonifiedScene[] = (parsed.scenes ?? []).map((s, i): PersonifiedScene => {
    const speech = estimateSpeechSec(s.dialoguePrimary || s.dialogueVi || '')
    return {
      idx: i + 1,
      sceneType: VALID_SCENE_TYPES.has(s.sceneType) ? (s.sceneType as PersonifiedScene['sceneType']) : 'challenger',
      clipDuration: pickClipDuration(speech),
      speaker: s.speaker ?? '',
      dialoguePrimary: s.dialoguePrimary ?? '',
      dialogueVi: isVN ? (s.dialoguePrimary ?? s.dialogueVi ?? '') : (s.dialogueVi ?? ''),
      emotion: s.emotion ?? '',
      camera: s.camera ?? '',
      sfx: Array.isArray(s.sfx) ? s.sfx : [],
      action: s.action ?? '',
      videoPromptEn: s.videoPromptEn ?? '',
    }
  })

  const fullVoiceScriptPrimary = scenes.map((s) => s.dialoguePrimary).filter(Boolean).join('\n')
  const fullVoiceScriptVi = scenes.map((s) => s.dialogueVi).filter(Boolean).join('\n')
  const totalSec = scenes.reduce((sum, s) => sum + s.clipDuration, 0)

  return {
    insight,
    characters: parsed.characters ?? [],
    scenes,
    fullVoiceScriptPrimary,
    fullVoiceScriptVi,
    totalSec,
  }
}
