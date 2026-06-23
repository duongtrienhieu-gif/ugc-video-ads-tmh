// ── Hook Viral Patterns ──────────────────────────────────────────────────────
// Curated viral scroll-stop hook LIBRARIES that power `generateHooks`.
//
// Architecture (P3u — deterministic pick, NOT Gemini-from-scratch):
//   • The user picks a GROUP — INSTANT (product in hook) or LEAD (revealed later)
//     — and a SHAPE (narrative / listicle / comparison / journey).
//   • `pickShapedViralHooks` randomly picks 6 DISTINCT skeletons from the library
//     matching that shape + language (excluding any already-seen batch on re-roll).
//   • `generateHooks` (scriptGenerator) then ADAPTS each skeleton to the product
//     via one cheap Gemini call — keeps the Tier S+ structure/voice, only swaps
//     the vague placeholder for a short product reference.
//   • Picking from a curated pool (not Gemini-from-scratch) bypasses the pronoun /
//     spelling / fabricated-stat drift the user audited on generated hooks.
// ─────────────────────────────────────────────────────────────────────────────

// ── Viral hook REFERENCE LIBRARIES — split by language (P3m) ────────────────
// Plain native strings. `pickShapedViralHooks` picks 6 DISTINCT skeletons per
// call (by shape + language), which `generateHooks` then adapts to the product.
// Lang-specific because Vietnamese viral hooks DO NOT translate one-to-one into
// Bahasa Malaysia (different cadence, code-switching, "korang/aku/eh wait").

// 60 Vietnamese viral hooks — Tier S+/S curated by the user. The earlier
// "100 TikTok Shop e-commerce" pool was dropped at the user's request because
// many of those entries were softer e-commerce paraphrases that diluted the
// Tier S+ scroll-stop voice. The 60 below are the only references injected.
// (+10 Buying-frame block added to match the MS BUYING pattern — VN had only 1.)
export const VIRAL_HOOK_REFERENCES_VI: string[] = [
  // ── Tier S+ (cực mạnh) ────────────────────────────────────────────────────
  'Nếu bạn còn đang làm điều này thì bạn đang mất tiền mỗi ngày.',
  'Mình ước gì biết điều này sớm hơn 3 năm.',
  '90% mọi người đang làm sai mà không hề biết.',
  'Đây là lý do tại sao bạn vẫn chưa có kết quả.',
  'Đừng mua thứ này cho đến khi xem hết video.',
  'Mình đã thử để chứng minh nó là lừa đảo, và đây là kết quả.',
  'Thứ khiến mình bất ngờ không phải là kết quả cuối cùng.',
  'Không ai nói với bạn điều này trước khi mua.',
  'Đây là sai lầm khiến nhiều người tốn gấp đôi chi phí.',
  'Mình đã so sánh cả hai và kết quả hoàn toàn khác dự đoán.',
  // ── Tier S — Tò mò cực mạnh ───────────────────────────────────────────────
  'Có một chi tiết nhỏ mà hầu hết mọi người đều bỏ qua.',
  'Tại sao người khác làm được còn bạn thì không?',
  'Điều đầu tiên mình nhận ra sau 7 ngày dùng là...',
  'Đây là bí mật mà người bán không muốn bạn biết.',
  'Mình không tin cho đến khi tự kiểm chứng.',
  'Điều này nghe vô lý nhưng lại hoạt động.',
  'Hóa ra vấn đề không nằm ở chỗ bạn nghĩ.',
  'Đây là lý do thật sự đằng sau chuyện đó.',
  'Mình đã tìm ra nguyên nhân sau nhiều tháng.',
  'Kết quả này khiến mình phải kiểm tra lại lần thứ hai.',
  // ── Tier S — Đánh trúng nỗi đau ───────────────────────────────────────────
  'Bạn có đang gặp tình trạng này không?',
  'Nếu bạn chán cảnh này thì xem tiếp.',
  'Tại sao bạn đã thử đủ mọi cách nhưng vẫn thất bại?',
  'Bạn đang tốn tiền cho thứ không giải quyết được vấn đề.',
  'Đây là lỗi phổ biến nhất mình thấy mỗi ngày.',
  'Nếu bạn giống mình trước đây thì video này dành cho bạn.',
  'Mình từng nghĩ không có cách nào xử lý được chuyện này.',
  'Điều khó chịu nhất là chẳng ai chỉ cho bạn điều này.',
  'Đây là thứ khiến mình bực mình suốt nhiều năm.',
  'Mình đã mất rất nhiều tiền vì không biết điều này.',
  // ── Tier S — Đi ngược số đông ─────────────────────────────────────────────
  'Càng cố gắng, bạn càng làm tình hình tệ hơn.',
  'Điều mọi người khuyên bạn thực ra là sai.',
  'Mình ngừng làm điều này và kết quả tốt hơn hẳn.',
  'Sự thật là bạn không cần thứ mà ai cũng đang quảng cáo.',
  'Mình đã đổi ý hoàn toàn về điều này.',
  'Đây là quan điểm không phải nhiều người đồng ý.',
  'Hầu hết chuyên gia đều bỏ sót điều này.',
  'Đừng làm theo xu hướng này nếu bạn muốn kết quả tốt.',
  'Cách cũ không còn hiệu quả nữa.',
  'Điều phổ biến nhất lại là điều kém hiệu quả nhất.',
  // ── Tier S — Social Proof + FOMO ──────────────────────────────────────────
  'Hơn 10.000 người đã chuyển sang cách này.',
  'Ban đầu mình nghĩ mọi người đang phóng đại.',
  'Bây giờ mình hiểu vì sao nó bán chạy đến vậy.',
  'Mình hỏi 100 người và đây là câu trả lời chung.',
  'Đây là lý do ai dùng rồi cũng quay lại mua.',
  'Cộng đồng đang bàn tán về điều này vì một lý do.',
  'Mình thấy nó xuất hiện ở khắp mọi nơi nên quyết định thử.',
  'Thứ này đang thay đổi cách mọi người làm việc mỗi ngày.',
  'Sau khi xem hàng nghìn đánh giá, đây là kết luận.',
  'Mình cuối cùng cũng hiểu tại sao nó viral.',
  // ── Buying-frame (khung mua — trước khi mua / đừng chốt vội / tiếc nuối) ────
  'Khoan đã, đừng chốt đơn trước khi nghe mình nói.',
  'Trước khi bỏ vào giỏ, đây là thứ bạn nên biết.',
  'Đây là điều mình luôn kiểm tra trước khi xuống tiền.',
  'Mình tiếc vì không mua cái này sớm hơn.',
  'Mình từng mua nhầm loại rẻ tiền, giờ kể bạn nghe.',
  'Nếu định mua, xem cái này rồi hẵng quyết.',
  'Có 1 thứ phải check trước khi đặt, kẻo phí tiền.',
  'Đừng để tiền mất oan chỉ vì mua vội.',
  'Mình suýt lướt qua, may mà dừng lại mua.',
  'Giỏ hàng để đó đã, nghe mình 30 giây thôi.',
]

// 24 listicle-shape hooks (N reasons / N lý do) — curated to match the same
// Tier S+ shock register as the narrative pool but with a clear list opener.
export const VIRAL_HOOK_REFERENCES_VI_LISTICLE: string[] = [
  '3 lý do mình bỏ luôn món cũ chỉ sau 1 tuần.',
  'Có 2 lý do thôi mà mình không thèm thử brand khác.',
  '3 thứ mình ước biết trước khi mua.',
  'Mình mua đúng 1 lần, 3 lý do dưới đây bạn hiểu liền.',
  '4 thứ mọi người tưởng đúng mà thực ra sai bét.',
  '5 lý do dân trong ngành chỉ recommend cái này.',
  '3 lý do làm mình bỏ chục triệu thử brand khác cũng quay về.',
  'Có 3 thứ cái này làm được mà cái cũ thì không.',
  '2 lý do mình giữ luôn không trả lại.',
  '3 thứ ai dùng rồi cũng nhận ra.',
  '4 lý do khiến mình tin nó worth từng đồng.',
  'Đúng 3 thứ mình check trước khi mua bất kỳ món gì.',
  // +12 (nâng depth → 24 cho re-roll đa dạng) — phủ thêm sub-archetype
  'Đây là 3 thứ làm mình chốt đơn ngay lần đầu.',
  '2 điều nhỏ xíu nhưng đổi hẳn trải nghiệm của mình.',
  'Nói thật, 3 lý do này mới giữ chân mình lâu vậy.',
  '4 sai lầm mình từng mắc trước khi biết tới cái này.',
  '5 thứ mình từng nghĩ là sang chảnh, hoá ra cần thật.',
  'Có đúng 1 lý do khiến mình không đổi sang cái khác.',
  'Đây là 3 câu hỏi mình tự đặt trước khi xuống tiền.',
  '3 điểm cái này ăn đứt mấy món mình từng xài.',
  'Mình kể 3 thứ mà review không ai nói cho bạn.',
  '2 lý do mình mua thêm cái thứ hai để tặng.',
  'Đây là 4 dấu hiệu cho thấy bạn nên đổi ngay.',
  '3 thứ mình tiếc là không mua sớm hơn.',
]

// 24 comparison-shape hooks (A vs B / side-by-side).
export const VIRAL_HOOK_REFERENCES_VI_COMPARISON: string[] = [
  'Mình so sánh cả hai và kết quả hoàn toàn khác dự đoán.',
  'Cách cũ mình làm cả năm vs cách mới — cái nào đỡ cực hơn?',
  'Mình mua cả hai về test, sự khác biệt rõ luôn.',
  'Bên trái mắc gấp đôi, bên phải rẻ hơn — đoán cái nào thắng.',
  'Mình lấy cái này so với cái mình dùng 2 năm, ngạc nhiên thật.',
  'Mua cả 2 về thử, có 1 cái mình giữ.',
  'Mình test song song để bạn không phải mất tiền oan.',
  'Cái rẻ hơn nửa giá mà mình lại chọn nó.',
  'So với brand quen, cái này khác hẳn ở 1 chỗ.',
  'Cũ vs mới — mình giữ cái nào sau 1 tuần test?',
  'Mình đặt 2 cái cạnh nhau, sự thật rõ ràng.',
  'Đây là sai lầm khiến nhiều người tốn gấp đôi chi phí.',
  // +12 (nâng depth → 24) — price-gap / old-vs-new / expensive≠best / familiar / hyped-vs-real
  'Hàng hot trên mạng vs cái mình đang xài — ai thắng?',
  'Cái đắt nhất chưa chắc ngon nhất, mình thử cho biết.',
  'Loại bình dân với loại cao cấp, khác nhau đúng 1 điểm.',
  'Mình để cái cũ cạnh cái mới, quay luôn cho bạn xem.',
  'Cùng một việc, mình thử 2 cách — cách nào nhanh hơn?',
  'Bạn mình team cái kia, mình team cái này — thử thì biết.',
  'Mình mua bản rẻ trước, rồi bản xịn, kể thật khác biệt.',
  'Loại mình bỏ lâu rồi vs loại đang xài — đặt cạnh quay luôn.',
  'So với thứ mình xài 3 năm nay, cái này hơn ở đâu?',
  'Một bên mọi người khen, một bên mình tự thử — kết quả?',
  'Giá gấp ba lần nhưng có đáng gấp ba không? Mình test.',
  'Trước mình dùng loại thường, giờ so lại mới thấy tiếc.',
]

// 24 journey-shape hooks (multi-day / multi-week test).
export const VIRAL_HOOK_REFERENCES_VI_JOURNEY: string[] = [
  'Mình dùng đúng 7 ngày, đây là kết quả thật.',
  'Test 30 ngày liên tục — ngày cuối mình ngạc nhiên.',
  'Sau 2 tuần, mình nhận ra 1 thay đổi mình không ngờ.',
  'Mình ghi lại từng ngày trong 1 tháng, hôm nay chia sẻ.',
  'Hết 14 ngày, mình quyết định ở lại với cái này.',
  'Mình thử 3 ngày đầu thấy thường, ngày thứ 7 mới sốc.',
  '21 ngày test — đây là cái mình rút ra.',
  'Sau 30 ngày, mình hiểu vì sao nó cháy hàng.',
  'Mình bắt đầu hôm thứ Hai, hết tuần đã có kết quả.',
  '7 ngày một thử thách, ngày cuối mình quay lại nhìn.',
  'Sau 1 tháng, mình không muốn quay lại cách cũ.',
  'Test đủ 4 tuần — đây là sự thật.',
  // +12 (nâng depth → 24) — turning-point / before-after / daily-log / fixed-duration / escalating
  'Ngày 1 mình còn nghi, ngày 10 thì khỏi bàn.',
  'Mình quay lại đúng chỗ cũ sau 3 tuần để so.',
  'Tuần đầu chưa thấy gì, tuần thứ ba mới rõ.',
  '10 ngày dùng thử, mình chốt luôn không nghĩ nhiều.',
  'Mình chụp hình ngày đầu và ngày cuối để tự so.',
  'Cứ mỗi tối mình dùng, đến ngày thứ 7 mới tin.',
  'Hôm đầu mình suýt trả lại, giờ thì mừng vì giữ.',
  'Một tháng trôi qua, mình mới hiểu mình mua đúng.',
  'Ngày nào mình cũng dùng và đây là điều xảy ra.',
  'Mình hẹn 2 tuần mới đánh giá, và đây là lúc đó.',
  'Từ ngày đầu lóng ngóng đến giờ làm trong 1 nốt nhạc.',
  'Sau 5 ngày mình đã thấy khác, 1 tháng thì rõ hẳn.',
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

// ── MS shape-specific pools ─────────────────────────────────────────────────

export const VIRAL_HOOK_REFERENCES_MS_LISTICLE: string[] = [
  '3 sebab aku stop pakai yang lama.',
  'Ada 2 sebab je aku setia dengan benda ni.',
  '3 benda aku check sebelum beli.',
  '4 perkara ramai orang silap fikir.',
  '5 sebab aku recommend ni kat korang.',
  '3 sebab aku tak nak balik kat brand lama.',
  '2 sebab cukup, aku tak nak try yang lain.',
  '3 perkara aku tak tahu sebelum cuba.',
  '4 sebab aku rasa worth every sen.',
  '3 benda yang aku nampak orang lain miss.',
  'Aku ada 3 reason kenapa ni different.',
  'Ada 2 sebab utama aku tetap dengan ni.',
  // +12 (nâng depth → 24) — mirror sub-archetype VN
  '3 benda buat aku checkout terus kali pertama.',
  '2 perkara kecil tapi ubah pengalaman aku terus.',
  'Jujur, 3 sebab ni je buat aku setia lama.',
  '4 silap aku buat sebelum jumpa benda ni.',
  '5 benda aku ingat mahal-mahal, rupanya berbaloi.',
  'Satu sebab je aku tak nak tukar lain.',
  'Ni 3 soalan aku tanya diri sebelum bayar.',
  '3 benda yang ni boleh buat, yang lama tak.',
  'Aku share 3 benda review lain tak cerita.',
  '2 sebab aku beli satu lagi untuk hadiah.',
  'Ni 4 tanda korang patut tukar sekarang.',
  '3 benda aku menyesal tak beli awal-awal.',
]

export const VIRAL_HOOK_REFERENCES_MS_COMPARISON: string[] = [
  'Cara lama aku buat vs cara guna benda ni — mana lagi senang?',
  'Aku test side by side, korang tengok sendiri.',
  'Yang murah vs yang mahal, satu menang clear.',
  'Aku beli dua-dua dan check sendiri.',
  'Aku compare supaya korang tak bazir duit.',
  'Yang mahal tak semestinya terbaik.',
  'Aku test paling murah lawan paling mahal.',
  'Aku letak dua-dua side by side, beza terang.',
  'Brand A vs Brand B — aku pilih yang ni.',
  'Mahal vs murah — result buat aku rethink.',
  'Aku try kedua-duanya, satu je yang kekal.',
  'Beza dia memang gila weh, korang nak tengok?',
  // +12 (nâng depth → 24) — mirror sub-archetype VN
  'Yang viral vs yang aku guna — mana menang?',
  'Yang paling mahal belum tentu paling best, aku try.',
  'Kelas biasa vs kelas premium, beza satu benda je.',
  'Aku letak yang lama sebelah yang baru, rakam terus.',
  'Satu kerja, dua cara — mana lagi laju?',
  'Member aku team yang tu, aku team yang ni.',
  'Aku beli versi murah dulu, lepas tu versi mahal.',
  'Dulu aku ikut cara biasa, sekarang aku buat lain — result?',
  'Banding dengan yang aku guna 3 tahun, lagi best tak?',
  'Sebelah orang puji, sebelah aku test sendiri.',
  'Harga tiga kali ganda, berbaloi tiga kali tak?',
  'Dulu aku guna yang biasa, banding baru rasa rugi.',
]

export const VIRAL_HOOK_REFERENCES_MS_JOURNEY: string[] = [
  'Aku test 7 hari, ni result dia.',
  'Aku guna 30 hari, hari last buat aku terkejut.',
  'Selepas 2 minggu, aku nampak perubahan jelas.',
  'Aku try selama sebulan, jujur cakap...',
  'Day 1 hingga Day 7, aku rakam semua.',
  'Hari pertama biasa, hari ke-7 baru terasa.',
  'Aku test 21 hari, kesimpulan aku macam ni.',
  'Selepas sebulan guna, aku tak nak kembali.',
  'Aku mula Isnin, hujung minggu dah ada hasil.',
  '14 hari challenge, hari last aku speechless.',
  'Aku catat setiap hari selama 30 hari.',
  'Test 4 minggu — ni sebab aku stick dengan ni.',
  // +12 (nâng depth → 24) — mirror sub-archetype VN
  'Hari 1 aku ragu, hari 10 dah tak payah cakap.',
  'Aku balik tengok tempat sama lepas 3 minggu.',
  'Minggu pertama biasa je, minggu ketiga baru jelas.',
  '10 hari cuba, aku terus decide tak fikir panjang.',
  'Aku snap gambar hari pertama dan hari akhir.',
  'Tiap malam aku guna, hari ke-7 baru aku percaya.',
  'Hari pertama aku nak refund, sekarang bersyukur simpan.',
  'Sebulan berlalu, baru aku faham aku beli betul.',
  'Tiap hari aku guna, ni apa yang jadi.',
  'Aku janji nilai lepas 2 minggu, ni masanya.',
  'Dari kekok hari pertama sampai laju sekarang.',
  'Lepas 5 hari dah rasa beza, sebulan makin jelas.',
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

// ── Shape-aware viral picker (P3u — Fix #5) ─────────────────────────────────
// The user asked for hook generation to STOP being a Gemini call and START
// being a deterministic RANDOM PICK from the 50-hook viral library (per shape).
// Reasons: every Gemini hook generation that we audited drifted in one of three
// ways — pronoun ("tôi" instead of "mình"), typo ("Hấu hết"), or fabricated
// stat ("740.000 hộp"). The viral library has none of these by construction,
// so picking from it bypasses the drift entirely and the result is guaranteed
// to be Tier S+ viral voice.
//
// Each shape (narrative / listicle / comparison / journey) has its own pool;
// 'narrative' falls back to the full library (the original 50) so the user
// always sees broad Tier S+ variety on the default shape.

type ScriptShapeTag = 'narrative' | 'listicle' | 'comparison' | 'journey'

function shapedPoolForLang(shape: ScriptShapeTag, lang: string): string[] {
  const isMs = lang === 'ms' || lang === 'Bahasa Malaysia'
  if (shape === 'listicle')   return isMs ? VIRAL_HOOK_REFERENCES_MS_LISTICLE   : VIRAL_HOOK_REFERENCES_VI_LISTICLE
  if (shape === 'comparison') return isMs ? VIRAL_HOOK_REFERENCES_MS_COMPARISON : VIRAL_HOOK_REFERENCES_VI_COMPARISON
  if (shape === 'journey')    return isMs ? VIRAL_HOOK_REFERENCES_MS_JOURNEY    : VIRAL_HOOK_REFERENCES_VI_JOURNEY
  // narrative → full curated library
  return libraryForLang(lang)
}

/** Pick `count` DISTINCT viral hooks matching the picked shape. Excludes any
 *  hook the caller has already seen (used by the "Đổi 6 hook" re-roll so the
 *  next batch is genuinely different). If the shaped pool is smaller than
 *  count + exclude.size, supplements from the general narrative pool so the
 *  user always gets 6 hooks. */
export function pickShapedViralHooks(args: {
  shape: ScriptShapeTag
  count?: number
  lang: string
  exclude?: string[]
}): string[] {
  const count = args.count ?? 6
  const exclude = new Set((args.exclude ?? []).map((s) => s.trim()))
  const shaped = shapedPoolForLang(args.shape, args.lang).filter((h) => !exclude.has(h.trim()))
  const shuffle = (arr: string[]): string[] => {
    const a = arr.slice()
    for (let i = 0; i < a.length - 1; i++) {
      const j = i + Math.floor(Math.random() * (a.length - i))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }
  // C — STRATIFIED pick: the pools are ordered in sub-archetype BLOCKS (curiosity / pain /
  // buying / comparison-subtype …). A pure shuffle can cluster 4-of-6 in one block → 6 hooks
  // that "feel the same". Instead split the pool into `count` contiguous segments and take ONE
  // random hook per segment, so the batch spans DIFFERENT registers. Falls back to a plain
  // shuffle when the pool is too small to stratify.
  let picked: string[]
  if (shaped.length >= count) {
    const seg = shaped.length / count
    picked = []
    for (let k = 0; k < count; k++) {
      const slice = shaped.slice(Math.floor(k * seg), Math.max(Math.floor((k + 1) * seg), Math.floor(k * seg) + 1))
      const cand = slice[Math.floor(Math.random() * slice.length)]
      if (cand && !picked.includes(cand)) picked.push(cand)
    }
    // fill gaps (a dup landed across segments) from the remainder
    if (picked.length < count) {
      picked = picked.concat(shuffle(shaped.filter((h) => !picked.includes(h))).slice(0, count - picked.length))
    }
    picked = shuffle(picked)   // hide the segment order
  } else {
    picked = shuffle(shaped).slice(0, count)
  }
  // Top-up from the general narrative pool if the shaped pool didn't have enough.
  if (picked.length < count) {
    const general = libraryForLang(args.lang)
      .filter((h) => !exclude.has(h.trim()) && !picked.includes(h))
    const generalShuffled = general.slice()
    for (let i = 0; i < generalShuffled.length - 1; i++) {
      const j = i + Math.floor(Math.random() * (generalShuffled.length - i))
      ;[generalShuffled[i], generalShuffled[j]] = [generalShuffled[j], generalShuffled[i]]
    }
    picked = picked.concat(generalShuffled.slice(0, count - picked.length))
  }
  return picked.slice(0, count)
}
