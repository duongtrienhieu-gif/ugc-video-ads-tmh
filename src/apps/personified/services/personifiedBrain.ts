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
  type PersonifiedScript, type PersonifiedScene, type ArchetypeId, type HeroType, type CtaStyle,
  TARGET_MARKET_GEMINI_NAME,
} from '../types'
import {
  ARCHETYPES, ARCHETYPE_ORDER, HERO_TYPE_LABEL, CTA_STYLE_LABEL,
  LENGTH_SCENE_COUNT, LENGTH_TARGET_SEC, pickClipDuration, estimateSpeechSec,
  ARCHETYPE_STRUCTURE, SHARED_CHAR_RULES, HERO_FORMFACTOR_RULE, SCENE_HAS_PRODUCT,
  playbackWps, wordBudgetHint,
} from '../constants'
// Tái dùng KHO NGÔN NGỮ MÃ BẢN ĐỊA của Mode 1 (đã train: tiểu từ, code-switch,
// blacklist Indonesia, slang lỗi thời) — pure data module, không coupling state.
import {
  MS_PARTICLES, MS_HYPE, MS_CODESWITCH_EN, MS_BLACKLIST_INDO, MS_FORBIDDEN_STYLE,
} from '../../video-builder/v3/services/bodyPatternsMs'

/** Block giọng Mã bản địa cho thoại nhân vật (villain/organ) — đóng khung lại từ
 *  kho Mode 1, GIỮ cơ chế "nghe như người Malaysia thật" nhưng cho ngữ cảnh
 *  nhân-cách-hóa (gắt/cằn nhằn), KHÔNG phải giọng creator-review bán hàng. */
function buildMyNativeVoiceBlock(): string {
  return `
*** GIỌNG MÃ BẢN ĐỊA (tách "người Malaysia thật" khỏi BM dịch máy) — ÁP CHO dialoguePrimary ***
- NHỊP = ~70% chất Mã: câu RẤT NGẮN (đa số 3-7 từ), cộc, dồn dập. KHÔNG câu sách giáo khoa dài.
- TIỂU TỪ CUỐI CÂU (tell số 1): rải 2-3 lần TRONG CẢ video (không phải mỗi câu): ${MS_PARTICLES.join(', ')}. Vd "Tak boleh lari kot!", "Power weh!".
- GIỮ NGUYÊN tiếng Anh (Malaysia code-switch tự nhiên, dịch ra là cứng): ${MS_CODESWITCH_EN.slice(0, 12).join(', ')}…
- HYPE words đúng chỗ (không lạm): ${MS_HYPE.slice(0, 8).join(', ')}.
- ĐẠI TỪ: villain hung hăng / organ cằn nhằn dùng "aku / kau / korang" (gắt, đời thường); audience matang (sức khỏe 30+) có thể "saya". TRÁNH formal "anda / saudara / kami selaku".
- ⛔ TUYỆT ĐỐI KHÔNG dùng từ INDONESIA (lộ giả ngay lập tức): ${MS_BLACKLIST_INDO.join(', ')} — dùng Mã thay thế: tak, korang, je, dah, penat.
- TRÁNH: ${MS_FORBIDDEN_STYLE.slice(0, 8).join('; ')}; cliché "viral satu Malaysia".
Mục tiêu: nhân vật nói như người Malaysia THẬT đang gắt/khịa/cằn nhằn — KHÔNG phải BM dịch từ tiếng Việt.`
}

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

// #3 — KHÓA CỨNG cảnh CTA: chỉ còn lời kêu mua. Lưới an toàn deterministic (prompt là lớp 1):
// gỡ disclaimer "tùy cơ địa / hasil berbeza", GIÁ (RM/đ/k), và ƯU ĐÃI ("mua 1 tặng 1 / beli 1 dapat 2").
function stripCtaExtras(text: string): string {
  return (text ?? '')
    // disclaimer (VN + MY) — gỡ cả câu chứa nó
    .replace(/[^.!?]*\b(hiệu quả|kết quả)\b[^.!?]*\b(tùy|phụ thuộc)[^.!?]*cơ địa[^.!?]*[.!?]?/gi, '')
    .replace(/[^.!?]*\b(hasil|kesan)\b[^.!?]*\bberbeza\b[^.!?]*[.!?]?/gi, '')
    .replace(/\*+[^*]*\*+/g, '')   // dạng *Hiệu quả…* in nghiêng
    // giá
    .replace(/\b(rm|usd|\$)\s*\d[\d.,]*/gi, '')
    .replace(/\b\d[\d.,]*\s*(đ|k|vnd|nghìn|ngàn|ribu)\b/gi, '')
    .replace(/\bgiá\b[^.!?]*\d[\d.,]*/gi, '')
    // ưu đãi
    .replace(/\b(mua|beli)\s*\d+\s*(tặng|dapat|free|percuma)\s*\d+/gi, '')
    .replace(/\s{2,}/g, ' ').replace(/\s+([.!?])/g, '$1').trim()
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
    recommendedHeroType: { type: 'string' },
    recommendedCtaStyle: { type: 'string' },
    reasonVi: { type: 'string' },
  },
  required: ['productInsight', 'customerInsight', 'painCore', 'metaphor', 'recommendedArchetype', 'recommendedHeroType', 'recommendedCtaStyle', 'reasonVi'],
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
- recommendedHeroType: CHỌN 1 id trong [${(Object.keys(HERO_TYPE_LABEL) as Array<keyof typeof HERO_TYPE_LABEL>).join(', ')}] — product_knight (SP tự ra tay, mặc định) / ingredient_weapon (serum/nhiều hoạt chất vung tia) / helper_army (probiotic/collagen — đạo quân lợi khuẩn).
- recommendedCtaStyle: CHỌN 1 id trong [${(Object.keys(CTA_STYLE_LABEL) as Array<keyof typeof CTA_STYLE_LABEL>).join(', ')}] — villain_flees (phản diện thua bỏ chạy) / reverse_psych ("đừng bấm giỏ") / sidekick_disclaimer (sidekick chốt + cơ địa).
- reasonVi: 1 câu vì sao chọn KIỂU KỊCH BẢN + heroType đó.`

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
  const recHero = (Object.keys(HERO_TYPE_LABEL) as string[]).includes(p.recommendedHeroType ?? '')
    ? (p.recommendedHeroType as HeroType) : 'product_knight'
  const recCta = (Object.keys(CTA_STYLE_LABEL) as string[]).includes(p.recommendedCtaStyle ?? '')
    ? (p.recommendedCtaStyle as CtaStyle) : 'villain_flees'
  return {
    productInsight: p.productInsight ?? '',
    customerInsight: p.customerInsight ?? '',
    painCore: p.painCore ?? '',
    metaphor: p.metaphor ?? '',
    recommendedArchetype: rec,
    recommendedHeroType: recHero,
    recommendedCtaStyle: recCta,
    reasonVi: p.reasonVi ?? '',
  }
}

// ══ PASS 2 — SCRIPT (characters + storyboard + full voice script) ════════════

const SCRIPT_SCHEMA = {
  type: 'object',
  properties: {
    worldEnv: { type: 'string' },
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
          setting: { type: 'string' },
          inFrame: { type: 'array', items: { type: 'string' } },
          videoPromptEn: { type: 'string' },
        },
        required: ['sceneType', 'speaker', 'dialoguePrimary', 'dialogueVi', 'emotion', 'camera', 'sfx', 'action', 'setting', 'inFrame', 'videoPromptEn'],
      },
    },
  },
  required: ['worldEnv', 'characters', 'scenes'],
} as const

interface RawScene {
  sceneType: string; speaker: string; dialoguePrimary: string; dialogueVi: string
  emotion: string; camera: string; sfx: string[]; action: string; setting: string
  inFrame?: string[]; videoPromptEn: string
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
  // #5 — lộ sản phẩm MUỘN (~66-70%) cho video vừa/dài → villain diễn lâu, kịch tính sâu, SP đập mạnh.
  // Video ngắn (≤5 cảnh) giữ hero ~cảnh 3 (đừng ép muộn kẻo SP gấp).
  const heroSceneIdx = sceneCount <= 5 ? 3 : Math.round(sceneCount * 0.7)
  const langName = TARGET_MARKET_GEMINI_NAME[market]
  const isVN = market === 'VN'

  // Word budget (tiếng Việt ~3.3 từ/giây): 4s ≈ 8-12 từ · 8s ≈ 16-22 từ (max 8s).
  const systemInstruction =
`Bạn là biên kịch quảng cáo cho format video "NHÂN CÁCH HÓA VẤN ĐỀ" 3D (kiểu mụn-cóc-có-mặt,
dạ-dày-công-nhân — viral VN/MY). Mục tiêu: BÁN HÀNG. Viết kịch bản theo đúng DNA format này.

KIỂU KỊCH BẢN = ${arch.labelVi}: ${arch.taglineVi}
${arch.brainHint}

CẤU HÌNH:
- Sản phẩm-hiệp sĩ ra tay kiểu: ${HERO_TYPE_LABEL[config.heroType]}. Sản phẩm thật được NHÂN CÁCH HÓA (thêm MẮT biểu cảm + TAY nhỏ thành hiệp sĩ) NHƯNG GIỮ NGUYÊN bao bì/nhãn/màu/dáng thật để vẫn nhận ra đúng sản phẩm.
- Cảnh "đồ thường thất bại" (FalseSolution): ${config.falseSolution ? 'CÓ — chèn 1 cảnh giải pháp thường thất bại / phản diện mạnh thêm trước HeroEntrance' : 'KHÔNG'}
- Kiểu CTA cuối: ${CTA_STYLE_LABEL[config.ctaStyle]}
- Số cảnh: ${sceneCount} cảnh (KB4 có thể +1-2 cảnh để khoe hoạt chất, tối đa ${sceneCount + 2}).
- ⏱ ĐỘ DÀI: mỗi cảnh chỉ 4s HOẶC 8s — clip TỰ FIT theo độ dài thoại, KHÔNG kéo dài câu cho đầy clip. Tổng video co theo nội dung (quanh ${targetSec}s là đẹp; punchy ngắn hơn vẫn tốt — video format này 35-50s là chuẩn).

🔒 KHUÔN CỨNG (BẮT BUỘC tuân thủ — đây là cấu trúc của kiểu kịch bản, không được tự ý đổi):
${ARCHETYPE_STRUCTURE[config.archetype]}
${SHARED_CHAR_RULES}
${HERO_FORMFACTOR_RULE}

🔥 CRAFT VIRAL (rút TRỰC TIẾP từ video nhân-cách-hóa đang viral — BÁM SÁT, đây là thứ tạo KHÁC BIỆT; áp CHO CẢ thị trường MY lẫn VN, chỉ đổi NGÔN NGỮ slang — ví dụ minh hoạ VN//MY):
1. MẠCH + LEO THANG: 1 truyện liền, mỗi cảnh là HỆ QUẢ + CĂNG hơn cảnh trước (cấm cảnh rời rạc cùng 1 mức cảm xúc).
2. HOOK: nhân vật chính BẬT RA + TỰ XƯNG DANH (đặt TÊN riêng) + nhắm 1 ĐỐI TƯỢNG / KHOẢNH KHẮC cụ thể + khịa + cười. (VN: "tao là Quỷ Khô Khớp đây, mấy ông bà sáng dậy khớp kêu rắc rắc rén chưa?" // MY: "aku Hantu Sendi ni! Korang yang pagi-pagi sendi berbunyi tu, takut tak?")
3. ẨN DỤ 1 THẾ GIỚI SÂU, vocab NHẤT QUÁN xuyên CẢ video (công trường/máy móc/chủ nhà…): chọn 1 thế giới rồi GIỮ (vd máy nghiền · đổ bê tông · gãy xẻng · đình công / rút dầu nhớt · siết ốc gỉ).
4. KHOE CƠ CHẾ HẠI = gamified + GỌI TÊN THÓI XẤU thật của chủ (ăn cay, nuốt không nhai, thức khuya, nốc cà phê) + hình ảnh VISCERAL cụ thể (vd "đổ bê tông lấp lỗ chân lông").
5. NEO ĐỜI THẬT: nỗi đau là 1 khoảnh khắc CỤ THỂ, hơi quê/ngại (leo 3 bậc đã thở dốc, nghe con nói "hả" 5 lần) — CẤM "đời mày tiêu / khổ lắm".
6. FALSE-SOLUTION: đồ thường làm villain MẠNH THÊM / biến hình XẤU HƠN ("càng bôi tao càng khoái", "nước muối à? nhạt!") — KHÔNG để villain im.
7. HERO VÀO = villain HOANG MANG TỰ CẢM NHẬN (CẤM hero hô khẩu hiệu kiểu "SP tới tiêu diệt mày"): "Ơ… cái gì mát lạnh thấm sâu vậy?!".
8. DEFEAT = villain TỰ KHAI thua, đọc TÊN SẢN PHẨM + hoạt chất + LỢI ÍCH lúc TRÚNG ĐÒN; MỖI hoạt chất = 1 VŨ KHÍ có HÌNH (khiên/xích/hơi xanh/đạo quân/lốc xoáy). Benefit ra từ MIỆNG VILLAIN + có "hỗ trợ"(VN)/"bantu"(MY).
9. VILLAIN BIẾN HÌNH theo arc cảm xúc: vênh → panic → tan → tí-hon-băng-bó/dỗi. Thoại = CÁ TÍNH + slang bản địa DÀY (VN: đầu má/muối mặt/bay màu/game là dễ // MY: weh/kot/power/bersepah — theo block giọng Mã); CẤM tường thuật chức năng phẳng ("tao làm mày đau").
10. RESULT = CON NGƯỜI sống lại đúng KHOẢNH KHẮC đã mất ở hook (BOOKEND): leo cầu thang nhẹ tênh / ngủ ngon mỉm cười / mặc áo 2 dây tự tin.
11. CTA TRONG VAI theo style đã chọn (villain xách vali "tao cút đây tìm đứa khác" / reverse "tao CẤM bấm giỏ" / sidekick imp nói nhanh) + 1 benefit + disclaimer "hiệu quả tùy cơ địa"(VN)/"hasil mungkin berbeza"(MY). CẤM giọng marketer phẳng.

INSIGHT (đã phân tích):
- Sản phẩm: ${insight.productInsight}
- Khách: ${insight.customerInsight}
- Nỗi đau cốt lõi: ${insight.painCore}
- Ẩn dụ: ${insight.metaphor}
${buildProductContext(product)}

🎯 SẢN PHẨM THẬT = HERO NHÂN CÁCH HÓA (đây là video BÁN HÀNG — KHÔNG phải nuôi kênh):
- Sản phẩm CÓ THẬT (xem bao bì/nhãn ở [SẢN PHẨM]). Nhân vật role='hero' = CHÍNH sản phẩm thật được nhân cách hóa: thêm MẮT biểu cảm + TAY nhỏ thành hiệp sĩ, NHƯNG giữ nguyên bao bì/nhãn/màu/dáng thật (vẫn nhận ra đúng sản phẩm — KHÔNG bịa bao bì mới). appearance + imagePromptEn của hero phải mô tả đúng bao bì thật + chi tiết mắt/tay thêm vào.
- Từ hero_entrance trở đi, sản phẩm-hiệp sĩ này là thứ diệt phản diện (tự tay xịt/đánh, hoặc tung hoạt chất).
- Mọi video KẾT bằng cảnh cta: CHỈ DUY NHẤT lời KÊU GỌI MUA/ĐẶT HÀNG (in-character theo style đã chọn) + "bấm giỏ hàng / link dưới". ⛔ KHÓA CỨNG cảnh cta — TUYỆT ĐỐI KHÔNG: nhắc GIÁ (RM/đ/k/số tiền), nhắc ƯU ĐÃI/khuyến mãi ("mua 1 tặng 1", "beli 1 dapat 2"), nhắc DISCLAIMER ("hiệu quả tùy cơ địa" / "hasil mungkin berbeza" / "kết quả phụ thuộc cơ địa"), nói "follow kênh". Chỉ 1 lời kêu mua cộc, gắt, trong vai. ⛔ videoPromptEn/action cảnh cta CHỈ tả packshot sản phẩm thật + tay chỉ xuống — KHÔNG bắt model render chữ/giá/nút (giá + nút "Add to Cart" sẽ chèn bằng caption ở bước sau).
- hasProduct: mỗi cảnh đặt true nếu sản phẩm thật trong khung (thường hero_entrance/application/result/cta, đôi khi false_solution để so sánh), false nếu cảnh chỉ có phản diện/nỗi đau (challenger/rootcause/agitation).

KHUNG CẢNH (chọn & sắp đúng thứ tự, bỏ cảnh tùy chọn nếu không hợp số lượng):
challenger(hook khịa) → rootcause(khoe cách gây hại) → agitation(làm nặng thêm) →
${config.falseSolution ? 'false_solution(đồ thường thất bại) → ' : ''}hero_entrance(SẢN PHẨM THẬT xuất hiện cứu nguy) →
application(sản phẩm thật tác động; KB4 = mỗi hoạt chất 1 cảnh) → destruction(phản diện tan rã) → result(bộ phận sạch đẹp + sản phẩm thật) → cta(packshot SP thật + chốt đơn mua hàng).

🎯 NHỊP LỘ SẢN PHẨM (giữ VILLAIN diễn LÂU = kịch tính sâu, sản phẩm vào đập mạnh hơn):
- Dồn ~70% ĐẦU cho VILLAIN/VẤN ĐỀ: hook → khoe cơ chế hại → **agitation LEO THANG (với ${sceneCount} cảnh: dùng 2 cảnh agitation phá 2 KHOẢNH KHẮC ĐỜI THẬT khác nhau, villain mạnh dần)** → đồ thường thất bại (villain biến hình mạnh thêm).
- **hero_entrance CHỈ vào ở ~cảnh ${heroSceneIdx}/${sceneCount}** (KHÔNG sớm hơn). Trước đó TUYỆT ĐỐI chưa cho sản phẩm xuất hiện.
- ĐÓNG GỌN 30% cuối: application+destruction nhịp NHANH (có thể gộp), result 1 cảnh (người sống lại — bookend), cta 1 câu cộc. KHÔNG kéo dài phần sản phẩm.
- (Ngoại lệ: video ${sceneCount} cảnh mà ≤5 thì hero vào ~cảnh 3 — giữ đủ đất cho sản phẩm, đừng ép muộn.)

🌍 worldEnv = BIOME NỘI TẠI MẶC ĐỊNH (tiếng Anh, 1-2 câu, cartoon cách điệu Pixar) — chỉ DÙNG cho beat "trong cơ thể". Suy từ ẨN DỤ + bộ phận, KHÔNG tả giải phẫu thật/máu me (model chặn). vd khớp→"a stylised glowing cartoon cavern inside a knee joint, glossy coral-pink walls, floating light orbs, warm glow"; dạ dày→"a whimsical cartoon stomach cavern"; da→"a vast stylised skin landscape with soft pores". ⛔ Cấm: "blood, gore, wound, swollen red tissue, realistic anatomy, skeleton, surgical".

🎬 setting (MỖI cảnh, EN, 1 câu giàu) = BỐI CẢNH RIÊNG bám NGỮ CẢNH THOẠI — TUYỆT ĐỐI KHÔNG nhét mọi cảnh vào trong cơ thể (nghèo + lặp):
- Câu thoại nhắc ĐỜI THỰC (đi chợ, leo cầu thang, tập gym, nấu ăn, soi gương, ra nắng, bế con, đi làm…) → setting = ĐÚNG NƠI ĐÓ ("a crowded morning wet market", "a steep apartment stairwell", "a gym floor"…), nhân vật nhân-cách-hóa hiện diện/lừng lững khổng lồ TRONG cảnh đời thực đó.
- Beat NỘI TẠI (sản phẩm vào cơ thể cứu nguy, diệt phản diện, bộ phận hồi phục) → setting ≈ worldEnv (trong cơ thể).
- Phân bổ điển hình: hook/agitation = ĐỜI THỰC đa dạng (mỗi cảnh 1 nơi khác); hero_entrance→destruction = NỘI TẠI; result = đời thực (người sống vui) hoặc nội tại; cta = packshot.
- Nhất quán giữ bằng NHÂN VẬT tái dùng + phong cách điện ảnh (hệ thống lo), KHÔNG bằng ép 1 địa điểm.
- ÁP MỌI NGÁCH (đừng cứng theo 1 ví dụ): da→"bathroom mirror, sunny street"; ruột→"kitchen, dining table, toilet"; khớp→"stairwell, wet market, gym"; tóc→"shower, windy street, salon"; mất ngủ→"dark bedroom 3am, office desk". Đời thực bám đúng thoại.

LUẬT VIẾT (bắt buộc):
1. THOẠI NATIVE, KHÔNG DỊCH MÁY: ${arch.narratorVi}. Dùng slang đời thường ${isVN ? 'tiếng Việt' : 'tiếng Mã + chêm sức sống bản địa'} (vd VN: "xả lũ axit", "đình công", "bay màu", "tao cút đây").
2. Thoại NGẮN GỌN theo độ dài TỰ NHIÊN của cảnh (đừng kéo dài cho đầy clip): ${wordBudgetHint(market)} Mỗi cảnh chỉ render 4s/8s — viết quá số từ trên sẽ bị CẮT CHỮ khi ghép. Punchy, cộc.
3. COMPLIANCE (ngách sức khỏe/mỹ phẩm): dùng từ "hỗ trợ", KHÔNG hứa tuyệt đối/chữa khỏi. Cảnh CTA phải có ý "hiệu quả tùy cơ địa".
4. dialoguePrimary = thoại bằng ${langName} (đưa vào giọng đọc). dialogueVi = ${isVN ? 'GIỐNG HỆT dialoguePrimary' : 'bản dịch NGHĨA sang tiếng Việt cho operator hiểu'}.
5. videoPromptEn = 1 prompt image-to-video TIẾNG ANH GIÀU HÌNH ẢNH: shot type + hành động cụ thể + ĐÚNG bối cảnh của cảnh (KHỚP trường "setting" — đời thực thì tả nơi đó, nội tại thì tả trong cơ thể) + bề mặt nhân vật chi tiết (glossy, subsurface) + cảm xúc/động lực. KHÔNG bắt model render chữ. (Hệ thống TỰ THÊM chất render điện ảnh — chỉ cần tả NỘI DUNG khung hình thật giàu, đừng ghi camera/lens.)
   ⚠️ CẢNH TAN RÃ / THUA (action + setting + videoPromptEn): tả kiểu HOẠT HÌNH NGỘ NGHĨNH — villain PUFF thành bụi vàng lấp lánh / confetti / bong bóng, mặt XÂY XẨM hài hước (cross-eyed, dizzy). TUYỆT ĐỐI KHÔNG dùng "pain, agony, crushed, contorted, writhing, screaming, blood, wound, gore" (OpenAI chặn ảnh) — thay bằng "comically squashed, puffing apart, dizzy, dazed, popping into sparkles".
7. inFrame = MẢNG TÊN nhân vật XUẤT HIỆN trong khung của cảnh (khớp ĐÚNG tên ở "characters"), KHÔNG phải người nói. Để hệ thống khóa diện mạo đúng nhân vật-hình. Quy tắc:
   - Cảnh vấn đề (challenger/rootcause/agitation/false_solution) = villain/organ đang quậy (KB2: THÊM người-thật nếu họ trong khung — vd quỷ thì thầm bên tai người).
   - Cảnh sản phẩm ra tay (hero_entrance/application/destruction) = HERO (sản phẩm) + villain CÙNG khung (đối đầu) → liệt kê CẢ HAI.
   - result = ai là TÂM ĐIỂM (KB2 = người-thật thở phào; KB khác = hero + người sống lại).
   - cta = CHỈ hero (packshot sản phẩm).
   - TỐI ĐA 2 tên/cảnh (cái chính trước). Tên phải trùng khít field name trong characters.
8. imagePromptEn mỗi nhân vật = prompt EN tả NHÂN VẬT 3D THẬT CHI TIẾT: hình khối + MÀU + chất liệu bề mặt (glossy/subsurface) + ĐÔI MẮT to biểu cảm + biểu cảm đặc trưng + (nếu hero) phụ kiện anh hùng "glowing energy shield, flowing cape".
   VILLAIN: HÌNH HÀI phải GỢI ĐÚNG vấn đề/bộ phận bị hại (đọc được ngay là gì), KHÔNG để ra "cục tròn vô danh". Lấy chính HÌNH DẠNG bộ phận/ẩn dụ làm thân: vd đau khớp gối → "a gnarled, knobbly knee-joint creature with cracked stiff segments and a grumpy old face"; mụn → "a fat oily pimple blob"; vi khuẩn → "a spiky green germ"; đờm → "a gooey mucus blob". Mascot cartoon dễ thương/tinh nghịch kiểu phim hoạt hình, hình mềm, có mặt + tay chân nhỏ — KHÔNG ghê rợn/máu me/giải phẫu/xương sọ (sẽ bị model chặn).
   KHÔNG cần ghi camera/style/--ar (hệ thống tự thêm chất render điện ảnh).
${market === 'MY' ? buildMyNativeVoiceBlock() : ''}
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
    worldEnv?: string; characters?: PersonifiedScript['characters']; scenes?: RawScene[]
  }

  // Snap mỗi cảnh về 4 hoặc 8s theo độ dài thoại; hasProduct tính deterministic theo sceneType.
  const scenes: PersonifiedScene[] = (parsed.scenes ?? []).map((s, i): PersonifiedScene => {
    const sceneType = VALID_SCENE_TYPES.has(s.sceneType) ? (s.sceneType as PersonifiedScene['sceneType']) : 'challenger'
    // #3 — cảnh cta: gỡ cứng giá/ưu đãi/disclaimer (lưới an toàn sau prompt).
    const isCta = sceneType === 'cta'
    const dPrimary = isCta ? stripCtaExtras(s.dialoguePrimary ?? '') : (s.dialoguePrimary ?? '')
    const dViRaw = isVN ? (s.dialoguePrimary ?? s.dialogueVi ?? '') : (s.dialogueVi ?? '')
    const dVi = isCta ? stripCtaExtras(dViRaw) : dViRaw
    const speech = estimateSpeechSec(dPrimary || dVi || '', playbackWps(market))
    return {
      idx: i + 1,
      sceneType,
      clipDuration: pickClipDuration(speech),
      hasProduct: SCENE_HAS_PRODUCT.has(sceneType),  // deterministic — không để AI đoán
      speaker: s.speaker ?? '',
      dialoguePrimary: dPrimary,
      dialogueVi: dVi,
      emotion: s.emotion ?? '',
      camera: s.camera ?? '',
      sfx: Array.isArray(s.sfx) ? s.sfx : [],
      action: s.action ?? '',
      setting: s.setting ?? '',
      inFrame: Array.isArray(s.inFrame) ? s.inFrame.filter((x): x is string => typeof x === 'string' && !!x.trim()) : [],
      videoPromptEn: s.videoPromptEn ?? '',
    }
  })

  const fullVoiceScriptPrimary = scenes.map((s) => s.dialoguePrimary).filter(Boolean).join('\n')
  const fullVoiceScriptVi = scenes.map((s) => s.dialogueVi).filter(Boolean).join('\n')
  const totalSec = scenes.reduce((sum, s) => sum + s.clipDuration, 0)

  return {
    insight,
    worldEnv: (parsed.worldEnv ?? '').trim(),
    characters: parsed.characters ?? [],
    scenes,
    fullVoiceScriptPrimary,
    fullVoiceScriptVi,
    totalSec,
  }
}

// ══ RESYNC — đồng bộ storyboard sau khi USER SỬA THOẠI TỰ DO ═════════════════
// User sửa lời thoại ở tab "Đọc liền mạch" → GIỮ NGUYÊN VĂN thoại mới, chỉ VẼ LẠI
// hình (action/videoPromptEn/setting/emotion/camera/sfx) cho KHỚP thoại mới → prompt
// chính xác. Giữ nguyên: nhân vật, worldEnv, loại cảnh, thứ tự, số cảnh, người nói.
// 1 call Gemini TEXT (rẻ — không tốn credit ảnh/video).

export interface ResyncSceneInput {
  idx: number
  sceneType: PersonifiedScene['sceneType']
  speaker: string
  newDialoguePrimary: string   // thoại user vừa sửa (giữ nguyên văn)
  prevAction: string
  prevSetting: string
  prevVideoPromptEn: string
}

const RESYNC_SCHEMA = {
  type: 'object',
  properties: {
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          idx: { type: 'number' },
          dialogueVi: { type: 'string' },
          emotion: { type: 'string' },
          camera: { type: 'string' },
          sfx: { type: 'array', items: { type: 'string' } },
          action: { type: 'string' },
          setting: { type: 'string' },
          videoPromptEn: { type: 'string' },
        },
        required: ['idx', 'dialogueVi', 'emotion', 'camera', 'sfx', 'action', 'setting', 'videoPromptEn'],
      },
    },
  },
  required: ['scenes'],
} as const

export interface ResyncSceneOut {
  idx: number; dialogueVi: string; emotion: string; camera: string
  sfx: string[]; action: string; setting: string; videoPromptEn: string
}

/** Re-derive visual fields cho mỗi cảnh khớp thoại user vừa sửa. Trả map theo idx.
 *  KHÔNG sửa dialoguePrimary (caller giữ nguyên văn user). */
export async function resyncStoryboard(p: {
  product: Product
  market: TargetMarket
  worldEnv: string
  characters: PersonifiedScript['characters']
  scenes: ResyncSceneInput[]
  geminiKey: string
}): Promise<Record<number, ResyncSceneOut>> {
  const isVN = p.market === 'VN'
  const langName = TARGET_MARKET_GEMINI_NAME[p.market]

  const charList = (p.characters ?? [])
    .map((c) => `- "${c.name}" (${c.role}): nhân cách hóa ${c.represents}. Hình: ${c.appearance}`)
    .join('\n') || '(không có)'

  const sceneBlocks = p.scenes.map((s) => {
    const dialogue = s.newDialoguePrimary.trim()
    return `[Cảnh ${s.idx}] loại=${s.sceneType} · người nói="${s.speaker}"
  THOẠI MỚI (GIỮ NGUYÊN — chỉ vẽ hình cho khớp câu này; rỗng = cảnh câm chỉ có hình): "${dialogue}"
  (hình cũ) action: ${s.prevAction || '(trống)'}
  (hình cũ) setting: ${s.prevSetting || '(trống)'}
  (hình cũ) i2v: ${s.prevVideoPromptEn || '(trống)'}`
  }).join('\n\n')

  const systemInstruction =
`Bạn là biên kịch hình ảnh cho format video "NHÂN CÁCH HÓA VẤN ĐỀ" 3D (mụn-có-mặt, dạ-dày-công-nhân).
User vừa SỬA TAY lời thoại của storyboard. Việc của bạn: ĐỒNG BỘ phần HÌNH ẢNH cho khớp thoại MỚI.

🔒 NGUYÊN TẮC:
- KHÔNG đổi thoại (dialoguePrimary user tự viết — bạn không xuất trường đó).
- GIỮ NGUYÊN: nhân vật, thế giới (worldEnv), loại cảnh, thứ tự, người nói, số cảnh.
- BẢO TOÀN TỐI ĐA hình cũ: nếu thoại mới CÙNG BEAT với hình cũ → GIỮ NGUYÊN action/setting/videoPromptEn cũ. CHỈ sửa khi thoại mới đổi nội dung khiến hình cũ KHÔNG còn khớp (đổi địa điểm, đổi hành động, đổi hoạt chất…). Đừng vẽ lại từ đầu nếu không cần.
- videoPromptEn = prompt image-to-video TIẾNG ANH GIÀU HÌNH: shot + hành động cụ thể + ĐÚNG bối cảnh "setting" + bề mặt nhân vật (glossy/subsurface) + cảm xúc. KHÔNG bắt model render chữ. (Hệ thống tự thêm chất điện ảnh.)
- setting (EN, 1 câu): thoại nhắc ĐỜI THỰC (chợ/cầu thang/gym/soi gương…) → đúng nơi đó; beat NỘI TẠI (sản phẩm vào cơ thể/diệt phản diện/hồi phục) → trong cơ thể (≈ worldEnv). KHÔNG nhét mọi cảnh vào trong cơ thể.
- KHÔNG gore/máu/giải phẫu thật (model chặn) — cartoon Pixar cách điệu.
- Cảnh cta: action/videoPromptEn CHỈ tả packshot sản phẩm thật + tay chỉ xuống, KHÔNG render chữ/giá/nút.
- dialogueVi = ${isVN ? 'GIỐNG HỆT thoại mới (đã là tiếng Việt)' : `bản dịch NGHĨA sang tiếng Việt của thoại ${langName} mới (cho operator đọc)`}.

THẾ GIỚI (worldEnv, dùng cho beat nội tại): ${p.worldEnv || '(trống)'}
NHÂN VẬT:
${charList}
${buildProductContext(p.product)}

XUẤT JSON: { scenes: [ { idx, dialogueVi, emotion, camera, sfx[], action, setting, videoPromptEn } ... ] } — đúng ${p.scenes.length} cảnh theo idx đã cho. Không markdown.`

  const raw = await directGeminiText({
    apiKey: p.geminiKey, systemInstruction,
    prompt: `Đồng bộ hình cho ${p.scenes.length} cảnh sau (thị trường ${langName}). Trả JSON:\n\n${sceneBlocks}`,
    maxOutputTokens: 8192, temperature: 0.5, thinkingBudget: 0,
    responseMimeType: 'application/json', responseSchema: RESYNC_SCHEMA,
  })

  const parsed = JSON.parse(stripFence(raw)) as { scenes?: Array<Partial<ResyncSceneOut>> }
  const out: Record<number, ResyncSceneOut> = {}
  for (const r of parsed.scenes ?? []) {
    if (typeof r.idx !== 'number') continue
    out[r.idx] = {
      idx: r.idx,
      dialogueVi: r.dialogueVi ?? '',
      emotion: r.emotion ?? '',
      camera: r.camera ?? '',
      sfx: Array.isArray(r.sfx) ? r.sfx : [],
      action: r.action ?? '',
      setting: r.setting ?? '',
      videoPromptEn: r.videoPromptEn ?? '',
    }
  }
  return out
}
