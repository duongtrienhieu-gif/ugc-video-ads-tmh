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

// ── 150 viral hook REFERENCES (50 Tier S+/S curated + 100 TikTok Shop) ──────
// Stored as plain Vietnamese strings — Gemini reads them as STYLE reference
// (tone / rhythm / shock vocabulary), NOT as templates to be filled in. The
// hook generator picks a random subset each call so 6 generations across the
// session aren't all anchored on the same 5 references.

export const VIRAL_HOOK_REFERENCES: string[] = [
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
  // ── 100 viral hooks — TikTok Shop / E-commerce ────────────────────────────
  'Đừng mua [PRODUCT] cho đến khi xem hết video này.',
  'Tôi đã thử để chứng minh nó vô dụng.',
  '90% mọi người đang làm sai điều này.',
  'Không ai nói với bạn điều này trước khi mua.',
  'Đây là lý do [PROBLEM] của bạn vẫn chưa hết.',
  'Tôi đã so sánh tất cả để bạn không phải làm vậy.',
  'Xem chuyện gì xảy ra sau 30 giây.',
  'Tôi thực sự không mong đợi kết quả này.',
  'Hóa ra vấn đề không nằm ở chỗ bạn nghĩ.',
  'Đây là sai lầm khiến nhiều người mất tiền.',
  'Tôi đã lãng phí tiền cho đến khi tìm ra thứ này.',
  'Thứ này đang viral vì một lý do.',
  'Đừng mắc lỗi mà tôi từng mắc.',
  'Nếu bạn đang gặp [PROBLEM], hãy xem tiếp.',
  'Tôi ước mình biết điều này sớm hơn.',
  'Đây là thứ khiến tôi bất ngờ nhất.',
  'Tôi đã dùng nó 30 ngày liên tục.',
  'Đây là kết quả thực tế.',
  'Không quảng cáo, đây là trải nghiệm thật.',
  'Tôi đã kiểm chứng điều này.',
  'Bạn đang dùng [PRODUCT] sai cách.',
  'Tôi đã nghĩ nó là trò lừa đảo.',
  'Đây là điều đầu tiên tôi nhận ra.',
  'Điều này đáng lẽ phải được biết sớm hơn.',
  'Tôi không tin cho tới khi thử.',
  'Đây là điều người bán không muốn bạn biết.',
  'Bạn sẽ muốn xem phần cuối.',
  'Điều này thay đổi hoàn toàn cách tôi làm.',
  'Chỉ mất vài giây để thấy khác biệt.',
  'Đây là lý do nó luôn cháy hàng.',
  'Hầu hết mọi người bỏ qua điều này.',
  'Tôi đã thử cách đắt tiền trước.',
  'Đây là cách rẻ hơn nhưng hiệu quả hơn.',
  'Kết quả khiến tôi kiểm tra lại lần hai.',
  'Tôi ước mình đừng mua cái cũ.',
  'Thứ này tốt hơn tôi tưởng.',
  'Đây là thứ tôi dùng mỗi ngày.',
  'Tôi không nghĩ nó hoạt động nhanh như vậy.',
  'Đây là lý do tôi đổi sang dùng nó.',
  'Kết quả sau lần đầu tiên.',
  'Nếu tôi phải mua lại từ đầu, tôi sẽ chọn cái này.',
  'Tôi đã thử để xem hype có thật không.',
  'Điều khiến tôi sốc nhất là...',
  'Đây là trước và sau khi dùng.',
  'Điều gì xảy ra nếu dùng liên tục 7 ngày?',
  'Hầu hết mọi người không biết mẹo này.',
  'Tôi đã phát hiện điều này một cách tình cờ.',
  'Đây là phiên bản nâng cấp thật sự.',
  'Bạn có nhận ra sự khác biệt không?',
  'Tôi đã sai về sản phẩm này.',
  'Đây là cách đơn giản nhất để xử lý [PROBLEM].',
  'Đừng lặp lại sai lầm này.',
  'Tôi đã tìm thấy giải pháp sau nhiều tháng.',
  'Điều này đáng giá từng đồng.',
  'Bạn sẽ ngạc nhiên bởi kết quả.',
  'Đây là điều không ai nhắc tới.',
  'Tôi không còn quay lại cách cũ nữa.',
  'Đây là lý do mọi người mua lại.',
  'Một thay đổi nhỏ nhưng khác biệt lớn.',
  'Tôi đã thử cả hai.',
  'Bên trái giá gấp đôi, bên phải rẻ hơn.',
  'Bạn chọn cái nào?',
  'Tôi đã kiểm tra để tìm ra sự thật.',
  'Đây là điều xảy ra sau 1 tuần.',
  'Tôi không nghĩ nó lại khác biệt như vậy.',
  'Hầu hết đánh giá đều bỏ sót điều này.',
  'Đây là điều làm tôi đổi ý.',
  'Tôi đã tốn tiền để kiểm chứng.',
  'Xem kết quả trước khi quyết định mua.',
  'Đây là lý do tôi giới thiệu nó.',
  'Bạn đang trả quá nhiều tiền cho điều này.',
  'Đây là cách tiết kiệm hơn.',
  'Tôi không thể tin kết quả này.',
  'Điều này đáng lẽ phải nổi tiếng hơn.',
  'Nếu bạn biết điều này sớm hơn...',
  'Đây là bài kiểm tra thực tế.',
  'Tôi thử nó để khỏi phải hối tiếc.',
  'Đây là điều làm tôi mua lần thứ hai.',
  'Tôi không nghĩ nó vượt kỳ vọng như vậy.',
  'Đây là sản phẩm khiến tôi đổi thói quen.',
  'Điều gì làm nó khác biệt?',
  'Đây là bằng chứng rõ nhất.',
  'Tôi đã thử mọi lựa chọn khác.',
  'Cuối cùng tôi giữ lại cái này.',
  'Đây là thứ duy nhất còn sót lại sau thử nghiệm.',
  'Hầu hết mọi người đánh giá sai điều này.',
  'Đây là kết quả không qua chỉnh sửa.',
  'Xem kỹ phần này.',
  'Đừng bỏ qua chi tiết này.',
  'Đây là thứ đáng tiền nhất tôi từng mua.',
  'Điều này thay đổi mọi thứ.',
  'Tôi đã ngừng dùng sản phẩm cũ.',
  'Đây là lý do thực sự.',
  'Chỉ cần nhìn sự khác biệt.',
  'Đây là thứ tôi sẽ tiếp tục mua.',
  'Tôi đã tìm thấy thứ mình cần.',
  'Điều này hiệu quả hơn mong đợi.',
  'Đây là sự thật sau khi dùng thật.',
  'Bạn sẽ hiểu ngay khi xem.',
  'Đây là điều khiến tôi quyết định mua.',
]

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Pick `count` random hooks from the viral library — Gemini reads them as style
 *  reference each call so different "Tạo 6 hook" presses anchor on different
 *  examples. Pure JS shuffle (no extra deps). */
export function pickRandomViralReferences(count = 8): string[] {
  const pool = VIRAL_HOOK_REFERENCES.slice()
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
