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

LUẬT VIẾT (bắt buộc):
1. THOẠI NATIVE, KHÔNG DỊCH MÁY: ${arch.narratorVi}. Dùng slang đời thường ${isVN ? 'tiếng Việt' : 'tiếng Mã + chêm sức sống bản địa'} (vd VN: "xả lũ axit", "đình công", "bay màu", "tao cút đây").
2. Thoại NGẮN GỌN theo độ dài TỰ NHIÊN của cảnh (đừng kéo dài cho đầy clip): ${wordBudgetHint(market)} Mỗi cảnh chỉ render 4s/8s — viết quá số từ trên sẽ bị CẮT CHỮ khi ghép. Punchy, cộc.
3. COMPLIANCE (ngách sức khỏe/mỹ phẩm): dùng từ "hỗ trợ", KHÔNG hứa tuyệt đối/chữa khỏi. Cảnh CTA phải có ý "hiệu quả tùy cơ địa".
4. dialoguePrimary = thoại bằng ${langName} (đưa vào giọng đọc). dialogueVi = ${isVN ? 'GIỐNG HỆT dialoguePrimary' : 'bản dịch NGHĨA sang tiếng Việt cho operator hiểu'}.
5. videoPromptEn = 1 prompt image-to-video TIẾNG ANH: shot type + hành động cụ thể + bối cảnh (3D Pixar character trên nền cơ thể tả thực). KHÔNG bắt model render chữ.
6. imagePromptEn cho mỗi nhân vật = prompt EN tạo ảnh nhân vật 3D (Pixar style, cinematic lighting, --ar 9:16).
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
    characters?: PersonifiedScript['characters']; scenes?: RawScene[]
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
