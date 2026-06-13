// ── Hook Viral Patterns (P3j) ────────────────────────────────────────────────
// Lookup library that powers `generateHooks`. The user curated 150 Vietnamese
// scroll-stop hooks (50 Tier S+/S + 100 viral TikTok Shop / e-commerce) — they
// live here as REFERENCE STYLE for Gemini, not as templates to be filled in.
//
// Architecture (after P3j move from "8 frameworks" → "2 groups"):
//   • The user picks ONE of 2 GROUPS — INSTANT (product in hook) or LEAD
//     (product revealed later).
//   • The hook generator builds 6 hooks by MIX-MATCHING the 3 POOLS below
//     (linguistic device × tension mechanism × credibility bait). Each of the
//     6 hooks uses a DIFFERENT combination so none paraphrase the others.
//   • The reference hooks below are injected as style references so Gemini
//     learns the TONE / RHYTHM / SHOCK VOCABULARY of viral Vietnamese ad
//     openers — not a fill-in template.
// ─────────────────────────────────────────────────────────────────────────────

// ── POOL 1 · LINGUISTIC DEVICE (HOW the sentence is structured) ─────────────

export type LinguisticDevice =
  | 'statement'      // Tuyên bố thẳng — "Mình đã…", "Đây là…"
  | 'imperative'     // Mệnh lệnh — "Đừng…", "Xem…", "Cẩn thận…"
  | 'question_trap'  // Câu hỏi tu từ — "Bạn có…?", "Tại sao…?"
  | 'confession'     // Tự thú — "Tôi đã…", "Tôi từng nghĩ…"
  | 'claim_bold'     // Tuyên bố mạnh — "90% mọi người…", "Sự thật là…"
  | 'comparison'     // So sánh — "Tôi đã so sánh…", "Trước/sau…"

export const LINGUISTIC_DEVICES: { id: LinguisticDevice; labelVi: string; cue: string; examples: string[] }[] = [
  {
    id: 'statement',
    labelVi: 'Tuyên bố thẳng',
    cue: 'Câu khẳng định ngắn, gọn — không sáo ngữ, không vòng vo.',
    examples: [
      'Đây là thứ tôi dùng mỗi ngày.',
      'Một thay đổi nhỏ nhưng khác biệt lớn.',
      'Điều này thay đổi hoàn toàn cách tôi làm.',
    ],
  },
  {
    id: 'imperative',
    labelVi: 'Mệnh lệnh',
    cue: 'Mở bằng động từ chỉ huy — "Đừng / Xem / Stop / Cẩn thận / Đợi đã".',
    examples: [
      'Đừng mua [PRODUCT] cho đến khi xem hết video này.',
      'Đừng mắc lỗi mà tôi từng mắc.',
      'Đừng bỏ qua chi tiết này.',
    ],
  },
  {
    id: 'question_trap',
    labelVi: 'Câu hỏi cắm chốt',
    cue: 'Câu hỏi mà người xem thầm gật đầu — KHÔNG phải câu hỏi pain dài lê thê.',
    examples: [
      'Bạn có nhận ra sự khác biệt không?',
      'Tại sao người khác làm được còn bạn thì không?',
      'Điều gì làm nó khác biệt?',
    ],
  },
  {
    id: 'confession',
    labelVi: 'Tự thú',
    cue: 'First-person past — "Tôi đã… / Tôi từng nghĩ… / Hồi đó mình…".',
    examples: [
      'Tôi đã thử để chứng minh nó vô dụng.',
      'Tôi đã sai về sản phẩm này.',
      'Tôi không tin cho tới khi thử.',
    ],
  },
  {
    id: 'claim_bold',
    labelVi: 'Tuyên bố mạnh',
    cue: 'Bold claim — "90% mọi người…", "Sự thật là…", "Hầu hết chuyên gia…".',
    examples: [
      '90% mọi người đang làm sai điều này.',
      'Hầu hết mọi người bỏ qua điều này.',
      'Điều này đáng lẽ phải được biết sớm hơn.',
    ],
  },
  {
    id: 'comparison',
    labelVi: 'So sánh',
    cue: 'Đặt 2 đối tượng cạnh nhau — A vs B, trước/sau, gấp đôi/một nửa.',
    examples: [
      'Tôi đã so sánh tất cả để bạn không phải làm vậy.',
      'Bên trái giá gấp đôi, bên phải rẻ hơn.',
      'Tôi đã thử cách đắt tiền trước.',
    ],
  },
]

// ── POOL 2 · TENSION MECHANISM (HOW tension is created) ─────────────────────

export type TensionMechanism =
  | 'curiosity_gap'    // Tò mò — "Có 1 chi tiết nhỏ…", "Điều đầu tiên tôi nhận ra…"
  | 'loss_aversion'    // Sợ mất — "Đang mất tiền…", "Tôi đã tốn…"
  | 'contrarian_shock' // Đi ngược — "90% đang làm sai", "Hầu hết bỏ sót…"
  | 'fomo_crowd'       // Đám đông — "10.000 người…", "Cộng đồng đang bàn…"
  | 'insider_secret'   // Bí mật — "Người bán không muốn bạn biết", "Không ai nói…"

export const TENSION_MECHANISMS: { id: TensionMechanism; labelVi: string; cue: string; examples: string[] }[] = [
  {
    id: 'curiosity_gap',
    labelVi: 'Khoảng trống tò mò',
    cue: 'Hé lộ "có 1 thứ đáng biết", chưa nói ra — kéo người xem qua khoảng trống.',
    examples: [
      'Có một chi tiết nhỏ mà hầu hết mọi người đều bỏ qua.',
      'Điều đầu tiên tôi nhận ra sau 7 ngày sử dụng là...',
      'Hóa ra vấn đề không nằm ở chỗ bạn nghĩ.',
    ],
  },
  {
    id: 'loss_aversion',
    labelVi: 'Sợ mất / Tiếc tiền',
    cue: '"Bạn đang mất / tôi đã tốn / lãng phí" — nhấn cảm giác hao tổn.',
    examples: [
      'Nếu bạn còn đang làm điều này thì bạn đang mất tiền mỗi ngày.',
      'Tôi đã lãng phí tiền cho đến khi tìm ra thứ này.',
      'Đây là sai lầm khiến nhiều người tốn gấp đôi chi phí.',
    ],
  },
  {
    id: 'contrarian_shock',
    labelVi: 'Đi ngược số đông',
    cue: 'Bẻ niềm tin phổ biến — "Sai rồi / Hầu hết đang làm sai / Bị lừa".',
    examples: [
      '90% mọi người đang làm sai điều này.',
      'Điều mọi người khuyên bạn thực ra là sai.',
      'Hầu hết chuyên gia đều bỏ sót điều này.',
    ],
  },
  {
    id: 'fomo_crowd',
    labelVi: 'Đám đông + FOMO',
    cue: 'Quy mô / xu hướng — "10.000 người đã… / cộng đồng đang…".',
    examples: [
      'Hơn 10.000 người đã chuyển sang cách này.',
      'Cộng đồng đang bàn tán về điều này vì một lý do.',
      'Thứ này đang viral vì một lý do.',
    ],
  },
  {
    id: 'insider_secret',
    labelVi: 'Bí mật người trong cuộc',
    cue: 'Insider — "Người bán không muốn bạn biết / không ai nói cho bạn".',
    examples: [
      'Không ai nói với bạn điều này trước khi mua.',
      'Đây là điều người bán không muốn bạn biết.',
      'Đây là bí mật mà người bán không muốn bạn biết.',
    ],
  },
]

// ── POOL 3 · CREDIBILITY BAIT (concrete hook bait) ──────────────────────────

export type CredibilityBait =
  | 'stat_number'           // Số liệu — 90%, 10.000, 3 lần
  | 'time_marker'           // Thời gian — 3 năm, 7 ngày, 30 ngày liên tục
  | 'personal_stake'        // Cá nhân — Tôi đã thử / Tôi tốn / Tôi mất
  | 'concrete_comparison'   // So sánh cụ thể — gấp đôi / nửa / cái này vs cái kia

export const CREDIBILITY_BAITS: { id: CredibilityBait; labelVi: string; cue: string; examples: string[] }[] = [
  {
    id: 'stat_number',
    labelVi: 'Số liệu',
    cue: 'Phần trăm / số người / số lần — neo người xem bằng con số.',
    examples: [
      '90% mọi người đang làm sai điều này.',
      'Hơn 10.000 người đã chuyển sang cách này.',
      'Tôi hỏi 100 người và đây là câu trả lời chung.',
    ],
  },
  {
    id: 'time_marker',
    labelVi: 'Thời gian cụ thể',
    cue: 'Mốc thời gian — 3 năm / 7 ngày / 30 ngày / sau 1 tháng.',
    examples: [
      'Tôi ước gì mình biết điều này sớm hơn 3 năm.',
      'Tôi đã dùng nó 30 ngày liên tục.',
      'Điều đầu tiên tôi nhận ra sau 7 ngày sử dụng là...',
    ],
  },
  {
    id: 'personal_stake',
    labelVi: 'Cá nhân đã thử',
    cue: '"Tôi đã thử / Tôi tốn / Tôi mất" — bằng chứng cá nhân.',
    examples: [
      'Tôi đã thử để chứng minh nó là lừa đảo.',
      'Tôi đã tốn tiền để kiểm chứng.',
      'Tôi đã thử mọi lựa chọn khác.',
    ],
  },
  {
    id: 'concrete_comparison',
    labelVi: 'So sánh cụ thể',
    cue: 'Số liệu so sánh cụ thể — gấp đôi / một nửa / A so với B.',
    examples: [
      'Đây là sai lầm khiến nhiều người tốn gấp đôi chi phí.',
      'Bên trái giá gấp đôi, bên phải rẻ hơn.',
      'Tôi đã so sánh cả hai và kết quả hoàn toàn khác dự đoán.',
    ],
  },
]

// ── Viral hook REFERENCES — split by language (P3m) ─────────────────────────
// Stored as plain native strings — Gemini reads them as STYLE reference
// (tone / rhythm / shock vocabulary), NOT as templates to be filled in. The
// hook generator picks a random subset each call so 6 generations across the
// session aren't all anchored on the same 5 references. Lang-specific because
// Vietnamese viral hooks DO NOT translate one-to-one into Bahasa Malaysia
// (different cadence, code-switching, "korang/aku/eh wait" register).

// 50 Vietnamese viral hooks — Tier S+/S curated by the user. The earlier
// "100 TikTok Shop e-commerce" pool was dropped at the user's request because
// many of those entries were softer e-commerce paraphrases that diluted the
// Tier S+ scroll-stop voice. The 50 below are the only references injected.
export const VIRAL_HOOK_REFERENCES_VI: string[] = [
  // ── Tier S+ (cực mạnh) ────────────────────────────────────────────────────
  'Nếu bạn còn đang làm điều này thì bạn đang mất tiền mỗi ngày.',
  'Tôi ước gì mình biết điều này sớm hơn 3 năm.',
  '90% mọi người đang làm sai mà không hề biết.',
  'Đây là lý do tại sao bạn vẫn chưa có kết quả.',
  'Đừng mua thứ này cho đến khi xem hết video.',
  'Tôi đã thử để chứng minh nó là lừa đảo, và đây là kết quả.',
  'Thứ khiến tôi bất ngờ không phải là kết quả cuối cùng.',
  'Không ai nói với bạn điều này trước khi mua.',
  'Đây là sai lầm khiến nhiều người tốn gấp đôi chi phí.',
  'Tôi đã so sánh cả hai và kết quả hoàn toàn khác dự đoán.',
  // ── Tier S — Tò mò cực mạnh ───────────────────────────────────────────────
  'Có một chi tiết nhỏ mà hầu hết mọi người đều bỏ qua.',
  'Tại sao người khác làm được còn bạn thì không?',
  'Điều đầu tiên tôi nhận ra sau 7 ngày sử dụng là...',
  'Đây là bí mật mà người bán không muốn bạn biết.',
  'Tôi không tin cho đến khi tự kiểm chứng.',
  'Điều này nghe vô lý nhưng lại hoạt động.',
  'Hóa ra vấn đề không nằm ở chỗ bạn nghĩ.',
  'Đây là lý do thật sự đằng sau chuyện đó.',
  'Tôi đã tìm ra nguyên nhân sau nhiều tháng.',
  'Kết quả này khiến tôi phải kiểm tra lại lần thứ hai.',
  // ── Tier S — Đánh trúng nỗi đau ───────────────────────────────────────────
  'Bạn có đang gặp tình trạng này không?',
  'Nếu bạn chán cảnh [PROBLEM] thì xem tiếp.',
  'Tại sao bạn đã thử đủ mọi cách nhưng vẫn thất bại?',
  'Bạn đang tốn tiền cho thứ không giải quyết được vấn đề.',
  'Đây là lỗi phổ biến nhất tôi thấy mỗi ngày.',
  'Nếu bạn giống tôi trước đây thì video này dành cho bạn.',
  'Tôi từng nghĩ không có cách nào xử lý được chuyện này.',
  'Điều khó chịu nhất là chẳng ai chỉ cho bạn điều này.',
  'Đây là thứ khiến tôi bực mình suốt nhiều năm.',
  'Tôi đã mất rất nhiều tiền vì không biết điều này.',
  // ── Tier S — Đi ngược số đông ─────────────────────────────────────────────
  'Càng cố gắng, bạn càng làm tình hình tệ hơn.',
  'Điều mọi người khuyên bạn thực ra là sai.',
  'Tôi ngừng làm điều này và kết quả tốt hơn hẳn.',
  'Sự thật là bạn không cần thứ mà ai cũng đang quảng cáo.',
  'Tôi đã đổi ý hoàn toàn về điều này.',
  'Đây là quan điểm không phải nhiều người đồng ý.',
  'Hầu hết chuyên gia đều bỏ sót điều này.',
  'Đừng làm theo xu hướng này nếu bạn muốn kết quả tốt.',
  'Cách cũ không còn hiệu quả nữa.',
  'Điều phổ biến nhất lại là điều kém hiệu quả nhất.',
  // ── Tier S — Social Proof + FOMO ──────────────────────────────────────────
  'Hơn 10.000 người đã chuyển sang cách này.',
  'Ban đầu tôi nghĩ mọi người đang phóng đại.',
  'Bây giờ tôi hiểu vì sao nó bán chạy đến vậy.',
  'Tôi hỏi 100 người và đây là câu trả lời chung.',
  'Đây là lý do ai dùng rồi cũng quay lại mua.',
  'Cộng đồng đang bàn tán về điều này vì một lý do.',
  'Tôi thấy nó xuất hiện ở khắp mọi nơi nên quyết định thử.',
  'Thứ này đang thay đổi cách mọi người làm việc mỗi ngày.',
  'Sau khi xem hàng nghìn đánh giá, đây là kết luận.',
  'Tôi cuối cùng cũng hiểu tại sao nó viral.',
]

// 120 Malaysia TikTok Shop viral hooks — bahasa rojak natural (BM + EN + code-switch).
// Uses "aku / korang / eh wait / tau dak / memang / confirm / serious la" — the
// real Gen Z MS TikTok register, NOT formal Bahasa Malaysia. Curated by the user
// from Tier S+ TikTok Shop MY content; the patterns include scam-test, wrong-way,
// secret, comparison, reaction, and buying-frame hooks.
export const VIRAL_HOOK_REFERENCES_MS: string[] = [
  // ── Tier S+ MS general (60) ───────────────────────────────────────────────
  'Korang, benda ni memang worth it ke?',
  'Aku test 7 hari, result dia gila weh.',
  'Eh wait... korang kena tengok ni dulu.',
  'Serious la, aku tak sangka macam ni.',
  'Aku ingat scam, rupanya memang jadi.',
  'Jangan buy dulu sampai tengok ni.',
  'Korang masih buat benda ni ke?',
  'Aku rugi banyak sebab tak tahu ni awal.',
  'Benda ni tengah viral tapi betul ke?',
  'Confirm korang tak tahu pasal ni.',
  'Aku compare dua-dua, result dia lain gila.',
  'Kenapa seller tak cerita part ni?',
  'Benda ni memang tak masuk akal.',
  'Aku try sebab tak percaya.',
  'Korang jangan repeat mistake aku.',
  'Ramai orang guna salah cara.',
  'Patutlah ramai repeat order.',
  'Aku jumpa benda ni secara tak sengaja.',
  'Hasil dia memang tak boleh blah.',
  'Baru aku faham kenapa viral.',
  'Kalau korang ada masalah ni, tengok sampai habis.',
  'Aku fikir benda ni overrated.',
  'Rupanya aku yang silap.',
  'Serious, benda ni buat aku speechless.',
  'Aku test supaya korang tak payah bazir duit.',
  'Korang tengok sendiri.',
  'Aku dah cuba semua cara lain.',
  'Yang ni paling menjadi.',
  'Benda kecil tapi effect besar.',
  'Aku tak expect result macam ni.',
  'Korang pernah kena macam ni tak?',
  'Aku harap aku tahu ni lebih awal.',
  'Jangan kena scam macam aku.',
  'Aku buat test betul-betul.',
  'Korang mesti tengok ni.',
  'Part ni memang ramai tak sedar.',
  'Seller lain takkan cerita benda ni.',
  'Aku dah check sendiri.',
  'Patutlah stock selalu habis.',
  'Memang lain macam.',
  'Aku ingat marketing je.',
  'Sekali try terus faham.',
  'Korang kena tengok comparison ni.',
  'Ini sebelum dan selepas.',
  'Aku guna 30 hari, ni result dia.',
  'Aku hampir tak percaya.',
  'Memang menjadi la.',
  'Serious worth every sen.',
  'Benda ni ubah rutin aku.',
  'Aku dah stop guna yang lama.',
  'Korang masih bayar mahal untuk benda ni?',
  'Aku jumpa option lagi best.',
  'Aku test paling murah lawan paling mahal.',
  'Gila weh, beza dia macam ni.',
  'Aku takkan beli yang lama lagi.',
  'Baru tahu selama ni aku buat salah.',
  'Kenapa tak ramai orang tahu ni?',
  'Korang jangan skip video ni.',
  'Rahsia ni ramai seller tak cover.',
  'Lepas tengok ni baru decide nak buy atau tak.',
  // ── SCAM TEST PATTERN ─────────────────────────────────────────────────────
  'Aku betul-betul ingat benda ni scam.',
  'Serious la, aku nak prove benda ni tak jadi.',
  'Aku beli sebab nak expose produk ni.',
  'Aku test supaya korang tak kena tipu.',
  'Ramai cakap best, aku check sendiri.',
  'Aku tak percaya langsung sampai aku try.',
  'Hype ke real? Aku test sendiri.',
  'Aku sengaja cari kelemahan dia.',
  'Aku nak tengok betul ke macam orang cakap.',
  'Result dia buat aku diam terus.',
  // ── WRONG WAY PATTERN ─────────────────────────────────────────────────────
  'Korang mungkin guna benda ni salah selama ni.',
  'Patutlah tak jadi, rupanya ramai buat macam ni.',
  'Aku baru tahu selama ni aku silap.',
  'Ini sebab kenapa result korang tak menjadi.',
  'Jangan guna macam ni lagi.',
  'Ramai orang tak sedar mistake ni.',
  'Korang buat benda ni juga tak?',
  'Aku rugi berbulan sebab tak tahu ni.',
  'Ini satu detail yang ramai terlepas.',
  'Kalau tak betulkan ni, memang susah nak nampak hasil.',
  // ── SECRET PATTERN ───────────────────────────────────────────────────────
  'Rahsia ni seller memang jarang cerita.',
  'Part ni ramai seller skip.',
  'Aku baru tahu benda ni lepas berbulan guna.',
  'Tak ramai orang Malaysia tahu pasal ni.',
  'Kenapa benda ni tak viral lagi?',
  'Rahsia sebenar ada dekat sini.',
  'Aku terkejut bila jumpa benda ni.',
  'Benda ni patutnya semua orang tahu.',
  'Serious, kenapa tak ada orang cerita?',
  'Ini part paling penting sebenarnya.',
  // ── COMPARISON PATTERN ───────────────────────────────────────────────────
  'Aku compare RM20 vs RM200.',
  'Yang murah lawan yang mahal.',
  'Korang rasa mana satu menang?',
  'Aku test side by side.',
  'Result dia memang tak sangka.',
  'Aku compare supaya korang tak bazir duit.',
  'Yang mahal tak semestinya terbaik.',
  'Ini beza sebenar selepas test.',
  'Aku beli dua-dua dan check sendiri.',
  'Korang tengok sendiri siapa menang.',
  // ── REACTION PATTERN ─────────────────────────────────────────────────────
  'Eh wait... apa benda ni?',
  'Serious la?',
  'Gila weh.',
  'Aku tak expect langsung.',
  'No way benda ni jadi macam ni.',
  'Korang tengok ni cepat.',
  'Aku speechless tengok result dia.',
  'Ini memang unexpected.',
  'Aku check dua kali sebab tak percaya.',
  'Korang nampak apa yang aku nampak?',
  // ── BUYING PATTERN ───────────────────────────────────────────────────────
  'Lepas tengok ni baru decide nak buy.',
  'Jangan checkout dulu.',
  'Aku harap aku tengok video ni lebih awal.',
  'Kalau nak beli, tengok ni dulu.',
  'Ini benda yang aku check sebelum beli.',
  'Aku menyesal tak beli awal.',
  'Aku menyesal beli yang lama.',
  'Ini sebab kenapa aku repeat order.',
  'Sekarang aku faham kenapa ramai beli.',
  'Worth it ke tak? Jom check.',
]

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Map the script's language code → which viral library to pick from. EN /
 *  fallback default to VI references (VN viral hooks transfer better in
 *  spirit than not having any anchor at all). */
function libraryForLang(lang: string): string[] {
  // Match the SCRIPT_LANG_GEMINI_NAME values used in scriptGenerator, plus the
  // short lang codes the store uses ('vi' / 'ms' / 'en').
  if (lang === 'ms' || lang === 'Bahasa Malaysia') return VIRAL_HOOK_REFERENCES_MS
  // 'vi' / 'Vietnamese' / 'en' / 'English' / anything else → VN (most curated).
  return VIRAL_HOOK_REFERENCES_VI
}

/** Pick `count` random hooks from the viral library — Gemini reads them as style
 *  reference each call so different "Tạo 6 hook" presses anchor on different
 *  examples. Pure JS shuffle (no extra deps). */
export function pickRandomViralReferences(count = 8, lang = 'vi'): string[] {
  const pool = libraryForLang(lang).slice()
  // Fisher-Yates partial shuffle — stop after `count` picks.
  const n = Math.min(count, pool.length)
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, n)
}

/** Build the "POOL 1 / 2 / 3" block dropped into the hook system prompt. Lists
 *  every pool option with its cue + 1 short example so Gemini can mix-match. */
export function buildHookPoolBlock(): string {
  const lines: string[] = []
  lines.push('POOL 1 · LINGUISTIC DEVICE (HOW the sentence is structured — pick a different one for each of the 6 hooks):')
  for (const d of LINGUISTIC_DEVICES) {
    lines.push(`  • ${d.id} (${d.labelVi}): ${d.cue}`)
    lines.push(`      e.g. "${d.examples[0]}"`)
  }
  lines.push('')
  lines.push('POOL 2 · TENSION MECHANISM (HOW tension is created — pick a different one for each of the 6 hooks):')
  for (const m of TENSION_MECHANISMS) {
    lines.push(`  • ${m.id} (${m.labelVi}): ${m.cue}`)
    lines.push(`      e.g. "${m.examples[0]}"`)
  }
  lines.push('')
  lines.push('POOL 3 · CREDIBILITY BAIT (optional concrete anchor — add to a hook only when it fits, not every time):')
  for (const b of CREDIBILITY_BAITS) {
    lines.push(`  • ${b.id} (${b.labelVi}): ${b.cue}`)
    lines.push(`      e.g. "${b.examples[0]}"`)
  }
  return lines.join('\n')
}
