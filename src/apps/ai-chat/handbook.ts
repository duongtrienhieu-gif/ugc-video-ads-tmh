// ── Cẩm nang app UGC Lab — nạp vào system prompt của Trợ lý AI ──
// Sinh từ AUDIT CODE THẬT (5 agent đọc component/service từng app). Chỉ mô tả thứ app
// thật sự làm. KHI APP ĐỔI → cập nhật mục tương ứng để chat không trả lời sai.
export const APP_HANDBOOK = `UGC Lab là bộ công cụ AI tạo quảng cáo UGC cho TMH GROUP (thị trường chính: Malaysia COD, phụ: Việt Nam). Mọi app dùng chung "Kho/Project" (Bank sản phẩm, Avatar, Kịch bản, Giọng…). API key đặt 1 lần trong Cài đặt (Gemini, kie.ai, ElevenLabs). Menu chia 3 nhóm: Sáng tạo · Bán hàng · Thư viện.

## NHÓM SÁNG TẠO

### Trợ lý AI (chính là app này)
- Mục đích: Chat AI nội bộ — hỏi đáp, viết/tóm tắt, đọc ảnh, đọc video, tạo ảnh, và hỏi cách dùng app UGC Lab.
- Model: chọn Gemini (mặc định, rẻ) hoặc GPT (cần OpenAI API key riêng — KHÁC gói ChatGPT Go). GPT có 2 mức: mini (rẻ ~15×) / 4o (đỉnh).
- Tính năng: gửi ảnh (cả 2 model đọc được), gửi video <15MB (CHỈ Gemini đọc, GPT không), nút "Tạo ảnh" (qua kie.ai, tốn credit), chữ chạy dần (streaming).
- Lịch sử: lưu riêng theo email đăng nhập; Gemini và GPT là 2 luồng tách riêng; nút "Lịch sử" + "Trò chuyện mới".
- Giới hạn: KHÁC "Chat Bot" (Chat Bot là bot bán hàng mô phỏng). Trợ lý AI chỉ tư vấn/giải thích, không tự thao tác hộ app khác và hiện chưa đọc số liệu thật trong Bank/Kho.

### Avatar AI (Character Studio)
- Mục đích: Tạo ảnh chân dung KOL/người mẫu ảo bằng AI (kie.ai) làm gương mặt cho video/quảng cáo.
- Cần: kie.ai API key. Chế độ Clone cần thêm 1 ảnh khuôn mặt.
- Bước: chọn 1 trong 3 chế độ trên cùng (Tạo Avatar Random / Tạo Avatar Clone / Thư viện Avatar). Random: điền tab thuộc tính (Ngoại hình/Bối cảnh/Tư thế/Máy quay), chọn tỉ lệ + model + độ phân giải (1K/2K/4K), bấm "Tạo Avatar AI". Clone: tải ảnh mặt → giữ nguyên mặt. Thư viện Avatar: chọn avatar đã tạo để thêm góc mặt/tải/lưu lại. Ra ảnh chính có thể "Tạo 3 biến thể cùng người".
- Kết quả: ảnh avatar + JSON; đặt tên → "Lưu vào Project" (vào Thư viện Avatar, tái dùng ở app khác).
- Lưu ý: tốn Credit kie.ai theo model+độ phân giải; ảnh tham chiếu KHÔNG lưu khi F5.

### Giọng đọc (Voice Studio)
- Mục đích: Chuyển kịch bản chữ → giọng đọc (TTS ElevenLabs), ưu tiên giọng Malaysian, hỗ trợ clone giọng.
- Cần: ElevenLabs API key + văn bản kịch bản.
- Bước: cột trái chọn giới tính + giọng (nghe thử nút ▶); có "Thư viện giọng", "Clone", "Preset". Chỉnh Độ sáng tạo/Tốc độ/Giống giọng gốc/Cường độ/Speaker Boost. Tab Soạn: nhập kịch bản (có thể thêm chỉ dẫn phong cách trong [ngoặc]) → "Tạo giọng đọc".
- Kết quả: file audio ở tab Lịch sử (nghe/tải/xóa).
- Lưu ý: phải chọn giọng mới tạo được; engine eleven_v3 (tự lùi v2 nếu cần); chỉ hiện giọng clone + Malaysian.

### Kịch bản (Script Architect)
- Mục đích: Sinh kịch bản video UGC quảng cáo COD theo công thức thực chiến, song ngữ Việt + Bahasa Melayu, rồi tách thành cảnh để tìm clip dựng.
- Cần: Gemini API key + 1 sản phẩm trong Project.
- Bước: chọn sản phẩm → chọn công thức (classic/educational) → thời lượng (15/30/45/60s) → độ mạnh hook (An toàn/Cân bằng/Gắt) → "Tạo kịch bản UGC". Xem 2 ô: VN (tham khảo) + MY (bản chính, SỬA ĐƯỢC). Có Sao chép/Tạo lại/"Lưu vào Kịch bản" (chỉ lưu bản MY). Bấm "Tách cảnh & Source" → bảng cảnh.
- Kết quả: kịch bản MY lưu Project; bảng tách cảnh cho khóa SP nguồn 1688, sửa cảnh, tìm/chọn clip, "Export CapCut" ra ZIP (clips + cutlist.csv + .srt + hướng dẫn).
- Lưu ý: bản VN KHÔNG được lưu; tạo kịch bản mới sẽ xóa bảng tách cảnh cũ.

### MKT Agent
- Mục đích: Tự quét + lọc SP "win" loại GENERIC (clone-test được, có nguồn 1688) tại Malaysia rồi kiểm chứng đa nền tảng.
- Cần: Gemini API key; nhập danh sách ngách tiếng Malay (cách nhau dấu phẩy) + số SP/ngách (5–50, mặc định 30).
- Bước: chọn chế độ duyệt (Duyệt mọi bước/3 chốt/Tự động) → nhập ngách + số lượng → "⚡ Quét MY" → xem thẻ SP (tick "Chỉ hiện generic"). Mỗi SP mở link kiểm chứng (TikTok/Google Lens/FB Ads/Video), gửi sang Spy Ads/Tìm nguồn/Research, hoặc "🔬 Soi sâu" (video·ads·1688 + giám khảo Gemini). "Chọn SP này".
- Kết quả: danh sách SP có verdict (BRANDED/TEST được), điểm WIN, số bán, gợi ý ship, cảnh báo rủi ro.
- Lưu ý: thiếu Gemini key chỉ xem danh sách thô; Soi sâu tốn quota API ngoài.

### Xưởng Video AI (Video Builder)
- Mục đích: Engine HYBRID biến kịch bản → video quảng cáo UGC hoàn chỉnh (lipsync ngắn + B-roll + ghép tự động).
- Cần: avatar + sản phẩm + kịch bản + giọng đọc; key Gemini/ElevenLabs/kie.
- Bước: 3 chế độ đầu app ("🎬 Tạo Video" mặc định, "🎞️ Xưởng B-roll", "👹 Nhân Vật Hoá"). Luồng Tạo Video 3 bước: Input (chọn avatar/SP + kịch bản + giọng) → Tạo Video (AI đạo diễn chia cảnh, render 9:16, nghe/xem thử trước khi tốn credit) → Xuất (ghép MP4).
- Kết quả: video MP4 (thư viện "Đã xuất" tải lại 0 credit), hoặc clip cảnh rời (Xưởng B-roll).
- Lưu ý: B-roll/insert rẻ test trước khi tốn nhiều credit cho lipsync; giữ tab mở khi render; 3 chế độ tách biệt.

### Xưởng Ảnh (Image Studio) — gộp 3 mode
- Mục đích: Tạo ảnh marketing bằng AI; chọn mode bằng tab đầu app.
- Cần: Gemini key + kie key + 1 sản phẩm có ảnh tham chiếu.
- Mode 🎁 Quà tặng kèm: nhập tên quà + giá trị RM + ảnh quà + nội dung mốc tặng → AI tạo 3 ảnh (Banner/Combo/Thẻ thông tin), chữ nướng trong ảnh, song ngữ MY chính/VN phụ.
- Mode 🖼 Form Sale (nền form đặt hàng): chọn 1 trong 3 preset (Bìa tạp chí / Mâm quà / Trước–Sau) → AI render 2 biến thể nền 2:3 chừa vùng form trống ở giữa.
- Mode 🏷 Re-Brand: upload ảnh gốc + kích thước (cm) + thị trường → "Phân tích & gợi ý tên" (AI 3 tên + palette + copy nhãn) → "Tạo bộ rebrand" (ảnh nhãn in đúng kích thước + ảnh SP/set). Phải tạo Nhãn trước rồi mới tới SP/Set.

## NHÓM BÁN HÀNG

### Ads Content
- Mục đích: Sinh 4 biến thể caption quảng cáo (mặc định Facebook) cho 1 SP, song ngữ (MY kèm gloss VN, hoặc bản Việt); mỗi biến thể có 3 tiêu đề giật scroll.
- Cần: 1 sản phẩm trong Project + Gemini key. KHÔNG nhập giá (engine cấm viết số tiền/%).
- Bước: chọn sản phẩm → chọn 1 trong 7 góc tiếp cận (Listicle/Kể chuyện/Gợi ý bạn bè/Bằng chứng đám đông/Cơ chế/So sánh/PAS) → chọn ngôn ngữ (Bahasa Malaysia mặc định / Tiếng Việt) → "Tạo content".
- Kết quả: 4 biến thể khác hook/nhịp/CTA; có "Tạo lại".
- Lưu ý: giữ tên ingredient thật, cấm claim chữa khỏi + cấm mọi số giá.

### TikTok Shop (Listing 9 ảnh + mô tả)
- Mục đích: Sinh trọn bộ listing TikTok Shop: 9 ảnh (arc chuyển đổi, AI dựng nguyên ảnh gồm SP+chữ+brand) + mô tả 11 block, 1 ngôn ngữ.
- Cần: sản phẩm có ĐỦ 4 ảnh + 1 Brand Kit hợp thị trường + Gemini key + kie key có credit (~55 credit/listing). Chọn ngôn ngữ (MY/VN).
- Bước: chọn ngôn ngữ → chọn Brand Kit → chọn sản phẩm → "Tạo Listing" (xác nhận chi phí).
- Kết quả: 9 ảnh sinh song song (re-roll từng slot lỗi) + mô tả; tự lưu cloud, mở lại từ Lịch sử.
- Lưu ý: KHÔNG tự gắn badge chứng nhận (chỉ badge bạn up trong Brand Kit); fidelity bám 4 ảnh.

### Super Ladipage
- Mục đích: Sinh "landing pack" hoàn chỉnh cho 1 SP: nhiều section (copy/headline/bullet/FAQ/review/comparison) + danh sách prompt ảnh để dựng landing.
- Cần: sản phẩm ĐỦ 4 ảnh + Gemini key + kie key. Chọn ngôn ngữ (Melayu mặc định/Việt/English) + 1 trong 5 kiểu form.
- Bước: chọn sản phẩm → xác nhận 4 ảnh → chọn ngôn ngữ → chọn kiểu landing (UGC Chuyển Đổi Nhanh / Kể Chuyện Hành Trình / Chuyên Gia / Chốt Đơn Mạnh / Cao Cấp) → (tùy chọn) dán link đối thủ → "Tạo Landing Pack".
- Kết quả: pack copy-ready (vd UGC ~17 section ~36 ảnh); nếu không phải VN kèm bản dịch VN. Ảnh chưa sinh ở bước này.
- Lưu ý: link đối thủ chỉ học style/cấu trúc, không đụng tên SP/giá/ngôn ngữ.

### Chat Bot (Bộ não bán hàng — MÔ PHỎNG)
- Mục đích: Cấu hình "bộ não" cho bot rep tin nhắn tư vấn & chốt đơn (WhatsApp MY / Pancake VN) và MÔ PHỎNG chat để QC. KHÁC hẳn "Trợ lý AI".
- Cần: chọn sản phẩm (đọc fact từ bank) + Sales Config riêng (thị trường, Giá chat bắt buộc, ưu đãi, TRẦN giảm giá, media theo bậc, objection bank, playbook, hội thoại mẫu) + Gemini key.
- Bước: tab Cấu hình → tạo config + điền giá/dữ liệu → Lưu. Tab Mô phỏng → gõ thử như khách (kể cả "ca khó": chê mắc/đòi giảm/im lặng) → đọc bóng chat (MY+gloss VN) + panel debug.
- Lưu ý: AI không bịa giá/KM (thiếu fact thì hỏi lại/handover); giảm không vượt TRẦN. Đây là simulator, CHƯA nối kênh thật.

### Research (Dò SP bán chạy)
- Mục đích: Dò SP bán chạy trên TikTok Shop theo ngách/thị trường, chấm theo SỐ ĐÃ BÁN, phân tích AI, và Source Finder tìm clip nguyên liệu.
- Cần: chọn thị trường (MY/ID/TH/VN/PH) + ngách/từ khóa; phần AI cần Gemini key.
- Tính năng: Quét LIVE (chọn ngách hoặc gõ từ khóa → "🔎 Quét"; "🌏 So 5 nước"). Lưới cơ hội → mở Drawer chi tiết (Tổng quan + Go/No-Go + "AI điền → tạo SP vào Bank" + Google Lens/1688 check giá nhập + "Đem SP về MY"; 🧠 Phân tích AI; Video win + "Đọc video" dịch VN; Creator; Giá/máy tính CPA). "🎬 Tìm Source": tab "Clip có SP" (ảnh SP → khớp 1688 → clip Douyin/RED/Kuaishou/TikTok) + "Cảnh B-roll" (Scene Brief AI).
- Lưu ý: xếp theo số đã bán; Source Finder tốn quota 1688/TikHub.

### Spy Ads (Quảng cáo đối thủ)
- Mục đích: Dò creative quảng cáo đối thủ (FB Ad Library + TikTok Creative Center), tải video, đọc/bê kịch bản, bóc link salepage/ladipage.
- Cần: chọn nước; từ khóa/ngách hoặc ảnh SP/SP Kho; đọc ad/ladipage cần Gemini key.
- 3 chế độ: "🎯 Radar SP win" (dò TikTok Shop theo ngách → "Spy ad SP này"). "🔍 Tìm ad theo từ khóa" (FB/TikTok + từ khóa/chip COD → "Tìm ad"; lọc đang chạy/có Ladipage/nâng cao; mở ad → "Đọc ad" dịch VO + bóc kịch bản, "Bê kịch bản về SP của mình" gửi Ads Content, "Đọc Ladipage đối thủ", "Tất cả ad của advertiser"; chọn nhiều → tải hàng loạt). "🔗 Tìm Salepage" (từ khóa/SP Kho/ảnh → AI sinh từ khóa đa-góc bắt cả đối thủ rebrand → bóc link đích + nhận diện CMS + đối chiếu ảnh "cùng SP"; lọc Chỉ Web/Ladipage).
- Lưu ý: tự bỏ phim ngắn/cài app + video >3 phút; FB là nguồn link chính (TikTok ẩn link).

## NHÓM THƯ VIỆN

### Tác Chiến (War Room)
- Mục đích: Điều phối đội — CEO đặt target, theo dõi số thật từng nhân viên, hệ thống gợi ý việc; nhân viên có buồng lái cá nhân.
- Cần: đăng nhập đúng Gmail; CEO cần bảng Supabase team_members/targets/tasks; doanh thu/hoàn lấy từ Google Sheet.
- Bước: tab 👥 Nhân sự (thêm người + "🪄 Tự gán mã SP"), 📊 Target (chỉ tiêu tháng: DT/%CPQC/%hoàn/lãi), ✅ Việc (nhận gợi ý hoặc tự giao). Nhân viên xem 🎯 Bảng của tôi + 📒 Nhật ký + 🧪 Test SP.
- Lưu ý: chỉ CEO thấy Target/Việc/Nhân sự; nhân viên khoá vào chính mình. Quy đổi ×5800. Số "—" thường do Google chặn file → bấm ⟳ Tải lại.

### Kho & Nhập hàng (Inventory Board)
- Mục đích: Bảng read-only xem tồn kho, đề xuất nhập hàng tự tính, bom hàng theo tỉnh, + máy tính giá/lãi/ghép quà.
- Cần: không nhập tay — dữ liệu từ 6 Google Sheet công khai (link mặc định, sửa ở ⚙ Cấu hình).
- Bước: mở app (tự tải, làm mới 5 phút). Tab 📦 Kho & Nhập hàng (Đề xuất nhập/Bom theo tỉnh/Cảnh báo tồn); tab 🧮 Máy tính giá / 🔥 Lãi thật/SP / 🎁 Ghép Quà.
- Lưu ý: logic nhập = TQ 8 ngày + đệm 7 ngày, trữ đủ 30 ngày, tốc độ bán 7 ngày gần nhất; tỷ giá 5800; Google chặn → ⟳ Tải lại.

### Brand Kit (Studio Brand Kit)
- Mục đích: AI suy luận trọn bộ nhận diện thương hiệu (màu/typography/giọng/CTA mẫu/trust badge/từ ưu tiên-tránh) từ ít input; đồng bộ TikTok Shop.
- Cần: Gemini key; muốn AI vẽ logo cần kie key (không thì upload tay).
- Bước: "Tạo Brand Kit mới" → nhập tên brand + chọn ngách + thị trường (Malaysia/Việt Nam) + bật "Brand đã có thị trường" (tự up logo) → "Tạo bằng AI" → chỉnh editor → Lưu.
- Lưu ý: chỉ cần nhập tên + ngách; thị trường khoá 1 ngôn ngữ; vẽ logo có thể fail (hết credit) vẫn vào editor được.

### Dự án / Sản phẩm (Finder) — KHO DÙNG CHUNG
- Mục đích: Kho dữ liệu dùng chung cho mọi app: Sản phẩm, Người mẫu, Kịch bản, Giọng, B-Roll, Ads Content. Trọng tâm là Bank Sản phẩm.
- Cần: tự điền cần Gemini key; có thể chuẩn bị link SP (LadiPage/Shopee/Lazada/TikTok/1688…) hoặc ảnh chụp trang.
- Bước: bank Sản phẩm → "Thêm" → (tùy chọn) dán link "Lấy từ link" hoặc tải 1–5 ảnh "Phân tích ảnh" để AI tự điền → kiểm/sửa các trường (productName, targetMarket, productDescription bắt buộc, painPoints, usps, benefits, ingredients, usageGuide, offer) → tải ĐỦ 4 ảnh → "Thêm sản phẩm".
- Lưu ý: bắt buộc 3 trường + đủ 4 ảnh mới lưu; Shopee hay bị chặn → dùng ảnh chụp; mọi trường viết tiếng Việt. Đây là nơi khai báo SP để các app khác tái dùng.

### Lịch sử (History)
- Mục đích: Dòng thời gian gộp mọi creative đã sinh (Landing Page, Ads Content, Kịch bản, Product AI, Avatar AI) để xem/mở lại.
- Bước: mở History → lọc theo chip loại hoặc gõ tìm → bấm 1 thẻ để mở lại đúng app gốc (tự nạp sản phẩm).
- Lưu ý: chỉ xem lại, không tạo/sửa ở đây; item chỉ xuất hiện sau khi bấm "Lưu vào Project" ở app tạo.`
