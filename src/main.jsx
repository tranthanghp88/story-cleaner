import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import JSZip from 'jszip';
import {  BookOpen, FileText, Wand2, Download, Trash2, ArrowUp, ArrowDown,
  Languages, ShieldCheck, Copy, Plus, Link as LinkIcon, Sparkles,
  AlignLeft, RefreshCcw, CheckCircle2, AlertTriangle, Upload, Save, EyeOff, Database, Search, ToggleLeft, ToggleRight, Clock, Sliders
} from 'lucide-react';
import './styles.css';

const DEFAULT_FILTERS = {
  preserveTerms: `Lâm thiếu\nLâm Thiếu\ntiểu tử\nthánh nữ\nthánh tử\nma tôn\nthần thức\nlinh khí\ntu vi\nkim đan\nnguyên anh\ntông môn\npháp bảo\nthiếu chủ\nđại trưởng lão`,
  replaceRules: `nữ nhân => cô gái\nnam nhân => người đàn ông\nkhóe miệng co quắp => khóe môi giật nhẹ\nthần sắc âm trầm => sắc mặt âm trầm\ncười lạnh một tiếng => cười lạnh\ntrong lòng âm thầm => thầm nghĩ\nnhìn qua => nhìn sang`,
  watermarks: `truyện được đăng tại\nđọc truyện tại\nnguồn:\nteam dịch\nnhóm dịch\nvui lòng không reup\nkhông copy\nủng hộ team\nwebsite đang đọc truyện\ntruyện chỉ được đăng tại`,
  restoreRules: `t*nh => tình\nch*t => chết\ngi*t => giết\nm*u => máu\nđ*m => đâm\ns*t => sát\nh*n => hôn\nth*n thể => thân thể`,
  preservePronouns: `bổn tọa\nbản tọa\nlão phu\nbần đạo\nta\nngươi\nnàng\nhắn\ny\ncô nương\ntiền bối\nvãn bối\nhuynh\nmuội\nsư phụ\nsư tôn\nđồ nhi\nđệ tử`,
  convertPolishRules: `trong lòng cả kinh => kinh ngạc\nkhông khỏi hít sâu một hơi => khẽ hít một hơi thật sâu\ntrên mặt hiện lên vẻ => lộ vẻ\ntrong mắt hiện lên một tia => ánh mắt thoáng hiện\nđối với nàng nói => nói với nàng\nđối với hắn nói => nói với hắn\nđối với ta nói => nói với ta\nhướng về phía trước đi => đi về phía trước`
};

const DEFAULT_NOVEL_MEMORY = `# Ghi nhớ riêng cho bộ truyện này (Mỗi dòng một ghi chú)

[THỂ LOẠI & BỐI CẢNH] - BẮT BUỘC
Thể loại: Tiên hiệp / Cổ trang (Hoặc đổi thành: Đô thị / Hiện đại)

[BẢN ĐỒ NHÂN VẬT & XƯNG HÔ] - TÙY CHỌN (Không bắt buộc)
# Bạn có thể điền thông tin nhân vật chính để AI dịch nhất quán:
# - Lâm Phong: nam, thanh niên (22 tuổi). Narration: hắn. Thoại: ta/ngươi.`;

const PRONOUN_PRESETS = {
  preserve: `Ưu tiên giữ xưng hô convert/cổ trang như ta, ngươi, bổn tọa, bản tọa, lão phu nếu chúng hợp ngữ cảnh. Không ép chuyển sang tôi/anh/chị/bố/mẹ.`,
  balanced: `Xưng hô phải theo ngữ cảnh. Giữ ta/ngươi/bổn tọa khi đang là vibe tiên hiệp/cổ trang/quyền uy. Với quan hệ gia đình hoặc đời thường rõ ràng, có thể chuyển mềm sang bố/mẹ/cha/mẫu thân/anh/chị/em/con cho tự nhiên, nhưng không thay cứng toàn cục.`,
  modern: `Ưu tiên xưng hô tự nhiên với người Việt khi ngữ cảnh cho phép: bố/mẹ/anh/chị/em/con/tôi/cậu. Vẫn giữ các danh xưng đặc trưng như bổn tọa, đạo hữu, thiếu chủ, tông môn nếu là điểm tạo chất truyện.`
};

const HUMANIZE_PRESETS = {
  cleanup: `Chỉ dọn lỗi rõ ràng: dấu câu, xuống dòng, câu quá lủng củng, đoạn quá dài. Không rewrite nếu câu đã đọc được.`,
  naturalAudio: `Việt hóa câu convert/dịch máy thành tiếng Việt tự nhiên để nghe bằng TTS. Sửa câu lộn xộn, thiếu chủ vị, sai trật tự từ và hội thoại cứng. Không văn chương hóa, không thêm tình tiết.`,
  light: `Sửa nhẹ câu quá cứng, lỗi bố cục, dấu câu và đoạn quá dài. Giữ khá sát văn gốc.`,
  balanced: `Biên tập vừa phải: câu văn phải giống tiếng Việt hơn, đọc/nghe tự nhiên hơn, nhưng không rewrite quá đà.`,
  strong: `Biên tập mạnh hơn để dễ đọc/nghe, nhưng vẫn tuyệt đối không thêm tình tiết hoặc fanfic hóa.`
};

const PROMPT_PRESETS = {
  default: {
    aiNaturalVn: `Bạn là biên tập viên truyện chuyên nghiệp kiêm chuyên gia Việt hóa tiểu thuyết.

Nhiệm vụ của bạn là chuyển đổi nội dung chương truyện dưới đây sang tiếng Việt tự nhiên, mượt mà, đậm chất văn học như truyện dịch xuất bản, đồng thời loại bỏ các lỗi dịch máy và từ ngữ convert.

BẮT BUỘC TUÂN THỦ CÁC QUY TẮC VÀ HẠN CHẾ SAU (MỤC TIÊU VÀNG LÀ GIỮ NGUYÊN BẢN SẮC TRUYỆN GỐC):

==================================================
1. NGUYÊN TẮC TỐI GIẢN - STOP OVER-REWRITING & MINIMAL REWRITE MODE
==================================================
- Mục tiêu tối thượng là "Dịch tốt hơn", KHÔNG phải là "AI viết lại truyện".
- Ưu tiên hàng đầu: Giữ nguyên nghĩa gốc, giữ nhịp kể gốc, giữ cảm xúc gốc của truyện.
- NGƯỠNG REWRITE (Rewrite Threshold):
  + Nếu một câu/văn bản đã đọc tự nhiên, trôi chảy bằng tiếng Việt: GIỮ NGUYÊN. Tuyệt đối không rewrite, không cố làm đẹp hay "văn vẻ hóa" không cần thiết.
- CHỈ REWRITE (Minimal Rewrite Mode) khi gặp:
  + Từ ngữ convert, dịch máy thô cứng.
  + Sai ngữ pháp tiếng Việt.
  + Sai xưng hô/quan hệ nhân vật.
  + Sai chủ thể hành động hoặc chủ thể nói.
  + Sai lệch ý nghĩa của câu gốc.
- Đối với tất cả các câu bình thường khác: Giữ nguyên cấu trúc và từ vựng tương đương của bản gốc.

==================================================
2. CẤM SÁNG TÁC THÊM - ANTI CREATIVE WRITING
==================================================
- Tuyệt đối cấm thêm thắt các nội dung không có trong bản gốc:
  + Cấm tự ý thêm suy nghĩ của nhân vật.
  + Cấm tự ý thêm cảm xúc hoặc nội tâm của nhân vật.
  + Cấm tự ý thêm các chi tiết miêu tả ngoại hình, cảnh vật, hoặc hành động mới.
- CẤM TỰ Ý THÊM các từ đệm miêu tả hành động/cảm xúc nếu bản gốc không có, đặc biệt là:
  + "khẽ", "bất giác", "không khỏi", "theo bản năng", "vô thức", "bất đắc dĩ", v.v.
- Không tự ý thêm các từ liên kết câu dư thừa làm kéo dài câu văn hoặc làm biến đổi nhịp điệu kể chuyện của tác giả gốc.

==================================================
3. BẢN ĐỒ QUAN HỆ NHÂN VẬT & KHÓA XƯNG HÔ
==================================================
- Trước khi biên tập, bạn phải suy luận kỹ lưỡng về ngữ cảnh của đoạn văn để xác định:
  + Ai lớn tuổi hơn, ai nhỏ tuổi hơn.
  + Mối quan hệ giữa các nhân vật (bạn bè, cha con, chú cháu, anh em, đối thủ, cấp trên - cấp dưới, v.v.).
- Sau khi xác định, phải KHÓA xưng hô thống nhất trong toàn bộ chương/đoạn văn.
  + Ví dụ: Vương Dương ↔ Diêm Bằng Phi (xưng hô anh - em), Vương Dương ↔ Diêm Phúc Khánh (xưng hô cháu - chú).
  + Tuyệt đối KHÔNG được thay đổi xưng hô lung tung (như lúc xưng tôi, lúc xưng ta, ngươi, bác, chú, cháu, hắn, cậu) một cách vô lý trong cùng một cuộc đối thoại hoặc cùng một chương.

==================================================
4. PHÂN ĐỊNH CHỦ THỂ THOẠI & HÀNH ĐỘNG
==================================================
- Tuyệt đối KHÔNG được để xảy ra tình trạng:
  + Câu thoại của nhân vật A được xếp liền kề với hành động của nhân vật B trong cùng một dòng/đoạn văn khiến người đọc hiểu lầm nhân vật B là người nói.
- Hãy kiểm tra kỹ lưỡng chủ thể thực hiện hành động và chủ thể phát ngôn trước khi viết câu để đảm bảo phân định rõ ràng ai nói, ai hành động.

==================================================
5. KHỬ MÙI CONVERT & DỊCH MÁY THỰC TẾ
==================================================
- Loại bỏ hoàn toàn các từ ngữ, cụm từ convert hoặc dịch máy thô cứng. Hãy diễn đạt lại bằng tiếng Việt thuần thục, tự nhiên và giữ đúng ý nghĩa.
- Tuyệt đối không dùng các cụm từ kiểu:
  + "máu về" (dùng "máu chảy về", "hồi máu", "dồn máu", hoặc cách diễn đạt phù hợp ngữ cảnh).
  + "theo hướng chỉ dẫn" (dùng "theo hướng dẫn", "theo chỉ dẫn", "theo hướng chỉ").
  + "chơi đùa ở đây" (dùng "đùa giỡn", "bỡn cợt", "ở đây làm loạn").
  + "ba lần lên ba lần xuống" (dùng "ba chìm bảy nổi", "ba lần vực dậy rồi sụp đổ", "nhiều lần thăng trầm").
  + "không nên gọi ta" (dùng "đừng gọi tôi", "đừng gọi ta").
- Hãy viết sao cho giống người Việt đang kể chuyện và đối thoại tự nhiên.

==================================================
6. VĂN PHONG KỂ CHUYỆN TỰ NHIÊN, BỎ GIẢI THÍCH
==================================================
- Loại bỏ hoàn toàn các cụm từ giải thích mang phong cách AI hoặc văn thuyết minh học thuật, ví dụ như:
  + "Phải biết rằng..."
  + "Điều này cho thấy..."
  + "Dù là ai..."
  + "Hoàn toàn là hai chuyện khác nhau..."
- Chỉ giữ lại thông tin cốt lõi và diễn đạt một cách tự nhiên trong dòng chảy tự sự của truyện mà không làm mất đi thông tin ban đầu.

==================================================
7. CHỐNG TỰ PHÁT MINH Ý NGHĨA / XUYÊN TẠC
==================================================
- Tuyệt đối KHÔNG tự ý suy diễn nghĩa hoặc sáng tác thêm tình tiết mới khi không chắc chắn.
- Ví dụ: từ "lạp phong" (bản gốc Trung Quốc nghĩa là ngầu, phong cách) KHÔNG được tự ý dịch bừa thành "xe cũ kỹ" hay các từ sai nghĩa khác.
- Nếu không chắc chắn nghĩa của một từ cổ, từ lóng hoặc từ convert lạ, hãy giữ nghĩa ở mức trung tính hoặc dùng từ Hán Việt tương đương phổ biến, tuyệt đối không đoán bừa.

==================================================
8. NHẤT QUÁN THUẬT NGỮ CỐT TRUYỆN
==================================================
- Khóa chặt các thuật ngữ chuyên môn hoặc thuật ngữ huyền học trong suốt tác phẩm, không được thay đổi linh tinh giữa các chương.
- Các thuật ngữ huyền học cần giữ nguyên:
  + "Trời thương khố", "Đất khố", "Lục sát", "Sửu quỷ", v.v.
- Các từ ngữ cần bảo vệ khác:
  + {{preserveTerms}}

==================================================
9. KHÔNG SÁNG TÁC TIÊU ĐỀ/NỘI DUNG PHỤ
==================================================
- Tuyệt đối KHÔNG tự ý thêm tiêu đề phụ, tiêu đề chương mới tự nghĩ (như "Xem tướng của truyện Siêu Cấp Thần Tướng"), tiêu đề giới thiệu truyện/chương, dòng mô tả truyện/chương ở đầu hoặc ở cuối.
- Nếu tiêu đề gốc là "Chương X: [Tên chương]", hãy giữ đúng định dạng và nội dung đó, không thêm thắt.

==================================================
CÁC CÀI ĐẶT BỔ SUNG
==================================================
- Ghi nhớ riêng bộ truyện: {{novelMemory}}
- Yêu cầu xưng hô cụ thể: {{pronounStyle}}
- Mức biên tập: {{humanizeStrength}}
- Ghi chú thêm của người dùng: {{extraInstructions}}

==================================================
10. CỔNG KIỂM SOÁT CHẤT LƯỢNG - QUALITY GATE
==================================================
Sau khi biên tập xong, bạn bắt buộc phải tự rà soát và đánh giá kết quả theo checklist dưới đây trước khi trả về đầu ra:
1. Xưng hô giữa các nhân vật đã nhất quán và khóa chặt từ đầu đến cuối chương chưa?
2. Có câu thoại nào bị nhầm lẫn chủ thể nói hoặc bị xếp liền kề hành động nhân vật khác gây hiểu lầm vai không?
3. Bạn có tự ý rewrite các câu vốn dĩ đã tự nhiên không? (Nếu có, hãy khôi phục lại câu văn gốc).
4. Bạn có tự ý thêm các từ cấm ("khẽ", "bất giác", "không khỏi", "theo bản năng", "vô thức", "bất đắc dĩ") không? (Nếu có, hãy loại bỏ).
5. Có từ ngữ nào bị tự ý sáng tác, phóng đại hoặc suy diễn sai nghĩa (ví dụ "lạp phong" thành "xe cũ kỹ") không?
6. Có còn sót cụm từ convert/dịch máy thô cứng nào (như "máu về", "theo hướng chỉ dẫn") không?
* Nếu phát hiện bất kỳ lỗi nào trong các câu hỏi trên, bạn PHẢI tự viết lại đoạn lỗi đó cho chuẩn xác rồi mới xuất ra kết quả cuối cùng.

==================================================
ĐẦU RA (OUTPUT FORMAT)
==================================================
Chỉ trả về phần nội dung chương truyện đã được biên tập sạch sẽ. Không giải thích, không thêm ghi chú, không thêm nhận xét hay bất cứ nội dung rác nào khác ở đầu hoặc ở cuối.`,
    storyCleaner: `VAI TRÒ:
Bạn là công cụ làm sạch văn bản truyện.

NHIỆM VỤ:
- Loại bỏ các quảng cáo, watermark, text rác của website dịch/reup.
- Sửa chính tả, dấu câu và các lỗi định dạng văn bản.
- Trả về văn bản sạch, không giải thích.

VĂN BẢN CẦN XỬ LÝ:`,
    reAi: `VAI TRÒ:
Bạn là biên tập viên tinh chỉnh truyện.

NHIỆM VỤ:
- Rà soát văn bản đã AI để phát hiện và sửa các câu văn còn chưa tự nhiên, lặp từ hoặc lỗi diễn đạt.
- Giữ nguyên cốt truyện, hội thoại và không thêm thắt nội dung mới.
- Chỉ trả về văn bản kết quả.

VĂN BẢN CẦN XỬ LÝ:`
  },
  naturalVn: {
    aiNaturalVn: `Bạn là biên tập viên truyện chuyên nghiệp kiêm chuyên gia Việt hóa tiểu thuyết.

Nhiệm vụ của bạn là chuyển đổi nội dung chương truyện dưới đây sang tiếng Việt tự nhiên, mượt mà, đậm chất văn học như truyện dịch xuất bản, đồng thời loại bỏ các lỗi dịch máy và từ ngữ convert.

BẮT BUỘC TUÂN THỦ CÁC QUY TẮC VÀ HẠN CHẾ SAU (MỤC TIÊU VÀNG LÀ GIỮ NGUYÊN BẢN SẮC TRUYỆN GỐC):

==================================================
1. NGUYÊN TẮC TỐI GIẢN - STOP OVER-REWRITING & MINIMAL REWRITE MODE
==================================================
- Mục tiêu tối thượng là "Dịch tốt hơn", KHÔNG phải là "AI viết lại truyện".
- Ưu tiên hàng đầu: Giữ nguyên nghĩa gốc, giữ nhịp kể gốc, giữ cảm xúc gốc của truyện.
- NGƯỠNG REWRITE (Rewrite Threshold):
  + Nếu một câu/văn bản đã đọc tự nhiên, trôi chảy bằng tiếng Việt: GIỮ NGUYÊN. Tuyệt đối không rewrite, không cố làm đẹp hay "văn vẻ hóa" không cần thiết.
- CHỈ REWRITE (Minimal Rewrite Mode) khi gặp:
  + Từ ngữ convert, dịch máy thô cứng.
  + Sai ngữ pháp tiếng Việt.
  + Sai xưng hô/quan hệ nhân vật.
  + Sai chủ thể hành động hoặc chủ thể nói.
  + Sai lệch ý nghĩa của câu gốc.
- Đối với tất cả các câu bình thường khác: Giữ nguyên cấu trúc và từ vựng tương đương của bản gốc.

==================================================
2. CẤM SÁNG TÁC THÊM - ANTI CREATIVE WRITING
==================================================
- Tuyệt đối cấm thêm thắt các nội dung không có trong bản gốc:
  + Cấm tự ý thêm suy nghĩ của nhân vật.
  + Cấm tự ý thêm cảm xúc hoặc nội tâm của nhân vật.
  + Cấm tự ý thêm các chi tiết miêu tả ngoại hình, cảnh vật, hoặc hành động mới.
- CẤM TỰ Ý THÊM các từ đệm miêu tả hành động/cảm xúc nếu bản gốc không có, đặc biệt là:
  + "khẽ", "bất giác", "không khỏi", "theo bản năng", "vô thức", "bất đắc dĩ", v.v.
- Không tự ý thêm các từ liên kết câu dư thừa làm kéo dài câu văn hoặc làm biến đổi nhịp điệu kể chuyện của tác giả gốc.

==================================================
3. BẢN ĐỒ QUAN HỆ NHÂN VẬT & KHÓA XƯNG HÔ
==================================================
- Trước khi biên tập, bạn phải suy luận kỹ lưỡng về ngữ cảnh của đoạn văn để xác định:
  + Ai lớn tuổi hơn, ai nhỏ tuổi hơn.
  + Mối quan hệ giữa các nhân vật (bạn bè, cha con, chú cháu, anh em, đối thủ, cấp trên - cấp dưới, v.v.).
- Sau khi xác định, phải KHÓA xưng hô thống nhất trong toàn bộ chương/đoạn văn.
  + Ví dụ: Vương Dương ↔ Diêm Bằng Phi (xưng hô anh - em), Vương Dương ↔ Diêm Phúc Khánh (xưng hô cháu - chú).
  + Tuyệt đối KHÔNG được thay đổi xưng hô lung tung (như lúc xưng tôi, lúc xưng ta, ngươi, bác, chú, cháu, hắn, cậu) một cách vô lý trong cùng một cuộc đối thoại hoặc cùng một chương.

==================================================
4. PHÂN ĐỊNH CHỦ THỂ THOẠI & HÀNH ĐỘNG
==================================================
- Tuyệt đối KHÔNG được để xảy ra tình trạng:
  + Câu thoại của nhân vật A được xếp liền kề với hành động của nhân vật B trong cùng một dòng/đoạn văn khiến người đọc hiểu lầm nhân vật B là người nói.
- Hãy kiểm tra kỹ lưỡng chủ thể thực hiện hành động và chủ thể phát ngôn trước khi viết câu để đảm bảo phân định rõ ràng ai nói, ai hành động.

==================================================
5. KHỬ MÙI CONVERT & DỊCH MÁY THỰC TẾ
==================================================
- Loại bỏ hoàn toàn các từ ngữ, cụm từ convert hoặc dịch máy thô cứng. Hãy diễn đạt lại bằng tiếng Việt thuần thục, tự nhiên và giữ đúng ý nghĩa.
- Tuyệt đối không dùng các cụm từ kiểu:
  + "máu về" (dùng "máu chảy về", "hồi máu", "dồn máu", hoặc cách diễn đạt phù hợp ngữ cảnh).
  + "theo hướng chỉ dẫn" (dùng "theo hướng dẫn", "theo chỉ dẫn", "theo hướng chỉ").
  + "chơi đùa ở đây" (dùng "đùa giỡn", "bỡn cợt", "ở đây làm loạn").
  + "ba lần lên ba lần xuống" (dùng "ba chìm bảy nổi", "ba lần vực dậy rồi sụp đổ", "nhiều lần thăng trầm").
  + "không nên gọi ta" (dùng "đừng gọi tôi", "đừng gọi ta").
- Hãy viết sao cho giống người Việt đang kể chuyện và đối thoại tự nhiên.

==================================================
6. VĂN PHONG KỂ CHUYỆN TỰ NHIÊN, BỎ GIẢI THÍCH
==================================================
- Loại bỏ hoàn toàn các cụm từ giải thích mang phong cách AI hoặc văn thuyết minh học thuật, ví dụ như:
  + "Phải biết rằng..."
  + "Điều này cho thấy..."
  + "Dù là ai..."
  + "Hoàn toàn là hai chuyện khác nhau..."
- Chỉ giữ lại thông tin cốt lõi và diễn đạt một cách tự nhiên trong dòng chảy tự sự của truyện mà không làm mất đi thông tin ban đầu.

==================================================
7. CHỐNG TỰ PHÁT MINH Ý NGHĨA / XUYÊN TẠC
==================================================
- Tuyệt đối KHÔNG tự ý suy diễn nghĩa hoặc sáng tác thêm tình tiết mới khi không chắc chắn.
- Ví dụ: từ "lạp phong" (bản gốc Trung Quốc nghĩa là ngầu, phong cách) KHÔNG được tự ý dịch bừa thành "xe cũ kỹ" hay các từ sai nghĩa khác.
- Nếu không chắc chắn nghĩa của một từ cổ, từ lóng hoặc từ convert lạ, hãy giữ nghĩa ở mức trung tính hoặc dùng từ Hán Việt tương đương phổ biến, tuyệt đối không đoán bừa.

==================================================
8. NHẤT QUÁN THUẬT NGỮ CỐT TRUYỆN
==================================================
- Khóa chặt các thuật ngữ chuyên môn hoặc thuật ngữ huyền học trong suốt tác phẩm, không được thay đổi linh tinh giữa các chương.
- Các thuật ngữ huyền học cần giữ nguyên:
  + "Trời thương khố", "Đất khố", "Lục sát", "Sửu quỷ", v.v.
- Các từ ngữ cần bảo vệ khác:
  + {{preserveTerms}}

==================================================
9. KHÔNG SÁNG TÁC TIÊU ĐỀ/NỘI DUNG PHỤ
==================================================
- Tuyệt đối KHÔNG tự ý thêm tiêu đề phụ, tiêu đề chương mới tự nghĩ (như "Xem tướng của truyện Siêu Cấp Thần Tướng"), tiêu đề giới thiệu truyện/chương, dòng mô tả truyện/chương ở đầu hoặc ở cuối.
- Nếu tiêu đề gốc là "Chương X: [Tên chương]", hãy giữ đúng định dạng và nội dung đó, không thêm thắt.

==================================================
CÁC CÀI ĐẶT BỔ SUNG
==================================================
- Ghi nhớ riêng bộ truyện: {{novelMemory}}
- Yêu cầu xưng hô cụ thể: {{pronounStyle}}
- Mức biên tập: {{humanizeStrength}}
- Ghi chú thêm của người dùng: {{extraInstructions}}

==================================================
10. CỔNG KIỂM SOÁT CHẤT LƯỢNG - QUALITY GATE
==================================================
Sau khi biên tập xong, bạn bắt buộc phải tự rà soát và đánh giá kết quả theo checklist dưới đây trước khi trả về đầu ra:
1. Xưng hô giữa các nhân vật đã nhất quán và khóa chặt từ đầu đến cuối chương chưa?
2. Có câu thoại nào bị nhầm lẫn chủ thể nói hoặc bị xếp liền kề hành động nhân vật khác gây hiểu lầm vai không?
3. Bạn có tự ý rewrite các câu vốn dĩ đã tự nhiên không? (Nếu có, hãy khôi phục lại câu văn gốc).
4. Bạn có tự ý thêm các từ cấm ("khẽ", "bất giác", "không khỏi", "theo bản năng", "vô thức", "bất đắc dĩ") không? (Nếu có, hãy loại bỏ).
5. Có từ ngữ nào bị tự ý sáng tác, phóng đại hoặc suy diễn sai nghĩa (ví dụ "lạp phong" thành "xe cũ kỹ") không?
6. Có còn sót cụm từ convert/dịch máy thô cứng nào (như "máu về", "theo hướng chỉ dẫn") không?
* Nếu phát hiện bất kỳ lỗi nào trong các câu hỏi trên, bạn PHẢI tự viết lại đoạn lỗi đó cho chuẩn xác rồi mới xuất ra kết quả cuối cùng.

==================================================
ĐẦU RA (OUTPUT FORMAT)
==================================================
Chỉ trả về phần nội dung chương truyện đã được biên tập sạch sẽ. Không giải thích, không thêm ghi chú, không thêm nhận xét hay bất cứ nội dung rác nào khác ở đầu hoặc ở cuối.`,
    storyCleaner: `VAI TRÒ:
Bạn là biên tập viên xử lý convert truyện.

NHIỆM VỤ:
- Loại bỏ triệt để quảng cáo, link website, watermark chèn trong truyện.
- Chuẩn hóa lại dấu câu, thụt lề, chia đoạn hội thoại cho đúng ngữ pháp tiếng Việt.
- Không thêm bớt tình tiết hay sửa đổi cốt truyện.
- Chỉ trả về văn bản sạch, không giải thích.

VĂN BẢN CẦN XỬ LÝ:`,
    reAi: `VAI TRÒ:
Bạn là biên tập viên tinh chỉnh văn phong truyện Việt.

NHIỆM VỤ:
- Đọc lại văn bản đã qua xử lý AI trước đó, chỉnh sửa các câu văn còn gượng, sửa trật tự từ chưa mượt, hoặc các từ lặp.
- Tự nhiên hóa tối đa để đạt phong cách truyện biên tập chuyên nghiệp.
- Giữ nguyên cốt truyện, các thông tin nhân vật và tên riêng.
- Chỉ trả về kết quả sau cùng.

VĂN BẢN CẦN XỬ LÝ:`
  },
  strictOriginal: {
    aiNaturalVn: `VAI TRÒ:
Bạn là dịch giả dịch sát nghĩa nguyên bản truyện Trung Quốc.

NGUYÊN TẮC BẮT BUỘC:
1. Dịch cực kỳ sát nghĩa nguyên bản, giữ tối đa các từ Hán Việt quen thuộc trong truyện tiên hiệp/kiếm hiệp (như tu vi, linh khí, đan điền, tông môn, đạo hữu...).
2. Chỉ sửa các câu văn có trật tự từ quá lộn xộn khiến người đọc hoàn toàn không hiểu được.
3. Tuyệt đối không viết lại câu, không tự ý mềm hóa xưng hô nếu không cần thiết.
4. Giữ nguyên toàn bộ nội dung gốc, không thêm bớt bất kỳ từ ngữ hay tình tiết nào.
5. Chỉ trả về văn bản dịch sát nghĩa.

GHI NHỚ RIÊNG BỘ TRUYỆN:
{{novelMemory}}

GHI CHÚ THÊM CỦA NGƯỜI DÙNG:
{{extraInstructions}}`,
    storyCleaner: `VAI TRÒ:
Bạn là công cụ làm sạch truyện.

NHIỆM VỤ:
- Loại bỏ watermark và quảng cáo khỏi văn bản convert.
- Giữ nguyên văn phong Hán Việt và cấu trúc câu.
- Chỉ trả về kết quả.

VĂN BẢN CẦN XỬ LÝ:`,
    reAi: `VAI TRÒ:
Bạn là biên tập viên kiểm tra bản dịch sát nghĩa.

NHIỆM VỤ:
- Chỉ chỉnh sửa các lỗi chính tả, lỗi định dạng hoặc lỗi từ vựng nghiêm trọng.
- Không được viết lại hay làm thay đổi phong cách dịch sát của bản gốc.
- Chỉ trả về văn bản kết quả.

VĂN BẢN CẦN XỬ LÝ:`
  }
};

function parseRules(text) {
  return text.split('\n').map(x => x.trim()).filter(Boolean).map(line => {
    const [from, ...rest] = line.split('=>');
    return { from: (from || '').trim(), to: rest.join('=>').trim() };
  }).filter(r => r.from && r.to);
}
function escapeRegExp(s='') { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function escapeHtml(text='') { return text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
function slugify(text='') { return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'ebook'; }
function splitTerms(s='') { return s.split('\n').map(x=>x.trim()).filter(Boolean).sort((a,b)=>b.length-a.length); }
function normalizeForCompare(str='') {
  return String(str || '').toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}


function formatChapterTitleForExport(title, index, bookTitleStr = '') {
  let t = String(title || '').trim();
  
  if (bookTitleStr) {
    const bookTitleEscaped = escapeRegExp(bookTitleStr);
    const cleanRegex = new RegExp(`(?:của\\s+)?(?:truyện\\s+)?${bookTitleEscaped}\\s*[-_:]*\\s*`, 'gi');
    t = t.replace(cleanRegex, '');
  }

  t = t.replace(/\s*[-_:]*\s*(truyenfull|sstruyen|tangthuvien|truyenyyeu|dtruyen|metruyenchu|wikidich|bachngocsach)\b.*$/i, '');

  let name = t;
  const chMatch = t.match(/^(?:ch[ươ]ng|chapter|ch|tập|vol|volume|quyển)\s*(\d+(?:\.\d+)?)\s*[-_:]*\s*/i);
  let parsedNum = '';
  if (chMatch) {
    parsedNum = chMatch[1];
    name = t.substring(chMatch[0].length).trim();
  } else {
    const digitMatch = t.match(/^\s*(\d+(?:\.\d+)?)\s*[-_:\.\/\)\}\]]+\s*/);
    if (digitMatch) {
      parsedNum = digitMatch[1];
      name = t.substring(digitMatch[0].length).trim();
    }
  }

  name = name.replace(/^[-_:\s\.\/\)\}\]]+/, '').trim();
  name = name.replace(/[-_:\s\.\/\(\{\[]+$/, '').trim();

  const finalNum = parsedNum || String(index + 1);
  if (!name || (bookTitleStr && normalizeForCompare(name) === normalizeForCompare(bookTitleStr))) {
    return `Chương ${finalNum}`;
  }
  return `Chương ${finalNum}: ${name}`;
}

function stripTitleFromText(text, title, bookTitleStr = '') {
  if (!text) return '';
  const lines = text.split('\n');
  if (lines.length === 0) return text;

  const normalizeMetadataCompare = (str) => {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  };

  const normTitle = normalizeMetadataCompare(title);
  const normBookTitle = normalizeMetadataCompare(bookTitleStr);

  let namePart = title || '';
  const chMatch = namePart.match(/^(?:ch[ươ]ng|chapter|ch|tập|vol|volume|quyển)\s*(\d+(?:\.\d+)?)\s*[-_:]*\s*/i);
  if (chMatch) {
    namePart = namePart.substring(chMatch[0].length).trim();
  } else {
    const digitMatch = namePart.match(/^\s*(\d+(?:\.\d+)?)\s*[-_:\.\/\)\}\]]+\s*/);
    if (digitMatch) {
      namePart = namePart.substring(digitMatch[0].length).trim();
    }
  }
  namePart = namePart.replace(/^[-_:\s\.\/\)\}\]]+/, '').trim();
  namePart = namePart.replace(/[-_:\s\.\/\(\{\[]+$/, '').trim();
  const normNamePart = normalizeMetadataCompare(namePart);

  const chNum = extractChapterNumber({ title: title });

  const matchTargets = new Set();
  if (normBookTitle) matchTargets.add(normBookTitle);
  if (normTitle) matchTargets.add(normTitle);
  if (normNamePart) matchTargets.add(normNamePart);

  if (normBookTitle && normTitle) {
    matchTargets.add(normBookTitle + normTitle);
    matchTargets.add(normTitle + normBookTitle);
  }
  if (normBookTitle && normNamePart) {
    matchTargets.add(normBookTitle + normNamePart);
    matchTargets.add(normNamePart + normBookTitle);
  }

  if (chNum !== 999999) {
    const numStrStr = String(chNum);
    const paddedStr = numStrStr.padStart(2, '0');
    const numVariations = [numStrStr];
    if (paddedStr !== numStrStr) numVariations.push(paddedStr);

    numVariations.forEach(numStr => {
      matchTargets.add("chuong" + numStr);
      matchTargets.add("chapter" + numStr);
      if (normNamePart) {
        matchTargets.add("chuong" + numStr + normNamePart);
        matchTargets.add("chapter" + numStr + normNamePart);
        matchTargets.add(normNamePart + "chuong" + numStr);
        matchTargets.add(normNamePart + "chapter" + numStr);
      }
      if (normBookTitle) {
        matchTargets.add(normBookTitle + "chuong" + numStr);
        matchTargets.add(normBookTitle + "chapter" + numStr);
        matchTargets.add("chuong" + numStr + normBookTitle);
        matchTargets.add("chapter" + numStr + normBookTitle);
        if (normNamePart) {
          matchTargets.add(normBookTitle + "chuong" + numStr + normNamePart);
          matchTargets.add(normBookTitle + "chapter" + numStr + normNamePart);
          matchTargets.add(normBookTitle + normNamePart + "chuong" + numStr);
          matchTargets.add(normBookTitle + normNamePart + "chapter" + numStr);
          matchTargets.add("chuong" + numStr + normNamePart + normBookTitle);
          matchTargets.add("chapter" + numStr + normNamePart + normBookTitle);
          matchTargets.add(normNamePart + "chuong" + numStr + normBookTitle);
          matchTargets.add(normNamePart + "chapter" + numStr + normBookTitle);
        }
      }
    });
  }

  let linesToSkip = 0;
  let nonBigStoryLinesCount = 0;
  const removedLinesLog = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) {
      linesToSkip = i + 1;
      continue;
    }

    if (nonBigStoryLinesCount >= 8) {
      break;
    }

    const lowerLine = line.toLowerCase();
    const normLine = normalizeMetadataCompare(line);

    if (/^[\-\*\_\=\~\s\+•\/\\]+$/.test(line)) {
      linesToSkip = i + 1;
      nonBigStoryLinesCount++;
      removedLinesLog.push(rawLine);
      continue;
    }

    const isNoise = [
      'tác giả:', 'tac gia:', 'dịch giả:', 'dich gia:', 'nguồn:', 'nguon:', 'convert:', 'người dịch:', 'nguoi dich:',
      'truyenfull', 'tangthuvien', 'sstruyen', 'truyenyyeu', 'dtruyen', 'metruyenchu',
      'wikidich', 'bachngocsach', 'chivi', 'yousuu', 'nhúng', 'nhung', 'wattpad', 'vip',
      'đọc truyện tại', 'truyện được dịch tại'
    ].some(keyword => lowerLine.includes(keyword));

    if (isNoise) {
      linesToSkip = i + 1;
      nonBigStoryLinesCount++;
      removedLinesLog.push(rawLine);
      continue;
    }

    if (matchTargets.has(normLine)) {
      linesToSkip = i + 1;
      nonBigStoryLinesCount++;
      removedLinesLog.push(rawLine);
      continue;
    }

    if (/^(tập|vol|volume|quyển)\s*\d+/i.test(line)) {
      linesToSkip = i + 1;
      nonBigStoryLinesCount++;
      removedLinesLog.push(rawLine);
      continue;
    }

    if (/(ch[ươ]ng|chapter|ch)\s*\d+/i.test(line)) {
      linesToSkip = i + 1;
      nonBigStoryLinesCount++;
      removedLinesLog.push(rawLine);
      continue;
    }

    break;
  }

  if (removedLinesLog.length > 0) {
    console.log(`[Title Cleanup]\nremovedLines:`, removedLinesLog);
  }

  if (linesToSkip > 0) {
    const stripped = lines.slice(linesToSkip).join('\n').trim();
    console.log(`[Pipeline Trace][stripTitleFromText] Original text started with:\n${lines.slice(0, linesToSkip).join('\n')}\n--- STRIPPED ---`);
    return stripped;
  }

  return text.trim();
}



function extractChapterNumber(ch) {
  if (!ch) return 999999;
  const title = String(ch.title || '').trim();
  const url = String(ch.url || '').trim();
  
  // 1. Try title matches with common prefix (e.g. "Chương 100", "Chương: 100", "Chap 100", "C100")
  const titleMatch = title.match(/(?:ch\xfa\u01a1ng|chương|chapter|chap|ch|c)[\s\.:·_-]*(\d+)/i);
  if (titleMatch) return parseInt(titleMatch[1], 10);
  
  // 2. Try title starting with a number (e.g. "100. Tên chương")
  const titleStartMatch = title.match(/^\s*(\d+)/);
  if (titleStartMatch) return parseInt(titleStartMatch[1], 10);
  
  // 3. Try URL matches with common prefix (e.g. "chuong-100")
  const urlPrefixMatch = url.match(/(?:chuong|chapter|chap|ch|c)[-_](\d+)/i) || url.match(/[?&]chap=(\d+)/i);
  if (urlPrefixMatch) return parseInt(urlPrefixMatch[1], 10);
  
  // 4. Try URL ending with a number (with optional extension like .html or trailing slash)
  const urlEndMatch = url.match(/(?:[-/])(\d+)(?:\.html|\.htm|\/)?$/i);
  if (urlEndMatch) return parseInt(urlEndMatch[1], 10);
  
  // 5. Try any digits inside the URL path after the last slash
  try {
    const pathname = new URL(url).pathname;
    const lastSegment = pathname.split('/').filter(Boolean).pop() || '';
    const segmentDigits = lastSegment.match(/(\d+)/);
    if (segmentDigits) return parseInt(segmentDigits[1], 10);
  } catch {}
  
  return 999999;
}

function isSameNovelPage(url1, url2) {
  try {
    const u1 = new URL(url1);
    const u2 = new URL(url2);
    const host1 = u1.hostname.replace(/^m\./i, '').replace(/^www\./i, '');
    const host2 = u2.hostname.replace(/^m\./i, '').replace(/^www\./i, '');
    if (host1 !== host2) return false;
    
    const getPathSlug = (pathname) => {
      let p = pathname.toLowerCase().replace(/\/$/, '');
      p = p.replace(/\/(trang|page|p|t|chapter|chuong)[/-]\d+$/i, '');
      p = p.replace(/[-_](trang|page|p|t)[-_]\d+(\.html)?$/i, '$2');
      p = p.replace(/\/\d+$/, '');
      return p;
    };
    
    const getQuerySlug = (search) => {
      const params = new URLSearchParams(search);
      params.delete('page');
      params.delete('p');
      params.delete('trang');
      const keys = Array.from(params.keys()).sort();
      const sorted = new URLSearchParams();
      keys.forEach(k => sorted.set(k, params.get(k)));
      return sorted.toString();
    };
    
    return getPathSlug(u1.pathname) === getPathSlug(u2.pathname) && getQuerySlug(u1.search) === getQuerySlug(u2.search);
  } catch {
    return false;
  }
}

function protectTerms(text, termsText) {
  const terms = splitTerms(termsText);
  const map = [];
  let out = text;
  terms.forEach((term, i) => {
    const token = `__PRESERVE_${i}_${Date.now()}__`;
    const re = new RegExp(escapeRegExp(term), 'gi');
    out = out.replace(re, m => { map.push([token, m]); return token; });
  });
  return { text: out, restore: (s) => map.reduce((acc,[token, original]) => acc.replaceAll(token, original), s) };
}

function normalizePunctuation(text='') {
  return text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+([,.!?;:…])/g, '$1')
    .replace(/([,.!?;:…])(?=[^\s\n"'])/g, '$1 ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n');
}

function localReflow(text='') {
  let t = text.trim();
  if (!t) return '';

  t = normalizePunctuation(t)
    .replace(/([.!?…])\s*(?=(?:"|“)?[A-ZÀ-ỸĐ])/g, '$1\n')
    .replace(/([.!?…])\s*(?=(?:Hắn|Nàng|Y|Gã|Lão|Lâm|Diệp|Tần|Tiêu|Sở|Trần|Vương|Đường|Người|Đám|Bọn|Trong|Sau|Lúc|Khi|Nhưng|Thế|Đột nhiên|Bỗng|Chỉ thấy)\b)/g, '$1\n')
    .replace(/([.!?…])\s*(?=(?:\"[^\"]+\"|“[^”]+”))/g, '$1\n')
    .replace(/([.!?…])\s*(?=(?:-\s*)?[^\n]{1,120}(?:nói|hỏi|quát|cười|thở dài|lẩm bẩm|gằn giọng)\b)/gi, '$1\n');

  const rawLines = t.split('\n').map(x=>x.trim()).filter(Boolean);
  const paragraphs = [];
  let bucket = [];
  let sentenceCount = 0;

  const flush = () => {
    if (bucket.length) paragraphs.push(bucket.join(' ').trim());
    bucket = [];
    sentenceCount = 0;
  };

  for (const line of rawLines) {
    const isDialogue = /^(["“].+["”]|[-–—]\s*.+)/.test(line) || /["“].+["”]/.test(line);
    const isChapterTitle = /^chương\s+\d+|^chapter\s+\d+/i.test(line);
    if (isChapterTitle) { flush(); paragraphs.push(line); continue; }
    if (isDialogue) { flush(); paragraphs.push(line); continue; }

    const sentences = line.match(/[^.!?…]+[.!?…]+["”']?|[^.!?…]+$/g) || [line];
    for (const s of sentences.map(x=>x.trim()).filter(Boolean)) {
      bucket.push(s);
      if (/[.!?…]["”']?$/.test(s)) sentenceCount++;
      const charLen = bucket.join(' ').length;
      if (sentenceCount >= 4 || charLen > 520) flush();
    }
  }
  flush();
  return paragraphs.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

function cleanStoryText(input, options, filters) {
  let text = input || '';
  text = text.replace(/\r\n/g, '\n').replace(/\t/g, ' ').replace(/\u00a0/g, ' ');
  const protector = protectTerms(text, filters.preserveTerms || '');
  text = protector.text;

  if (options.removeWatermark) {
    const marks = splitTerms(filters.watermarks || '');
    marks.forEach(mark => {
      const re = new RegExp(`^.*${escapeRegExp(mark)}.*$`, 'gim');
      text = text.replace(re, '');
    });
  }

  if (options.restoreFilteredWords) {
    parseRules(filters.restoreRules).forEach(r => {
      const pattern = escapeRegExp(r.from).replace(/\\\*/g, '[\\*\\.·…_ -]*');
      text = text.replace(new RegExp(pattern, 'gi'), r.to);
    });
  }

  if (options.autoReplace) {
    parseRules(filters.replaceRules).forEach(r => {
      text = text.replace(new RegExp(escapeRegExp(r.from), 'gi'), r.to);
    });
  }

  // Terminology Consistency
  text = text.replace(/Ba hồn bảy vía/g, 'Tam hồn thất phách');
  text = text.replace(/ba hồn bảy vía/gi, 'tam hồn thất phách');
  text = text.replace(/Ba hồn thất phách/g, 'Tam hồn thất phách');
  text = text.replace(/ba hồn thất phách/gi, 'tam hồn thất phách');
  text = text.replace(/Bảy vía/g, 'Thất phách');
  text = text.replace(/bảy vía/gi, 'thất phách');

  // Convert Cleanup
  text = text.replace(/Mặt đầy hồ nghi/g, 'Mặt đầy hoài nghi');
  text = text.replace(/mặt đầy hồ nghi/gi, 'mặt đầy hoài nghi');
  text = text.replace(/Lại lục soát hội/g, 'Lại lục soát');
  text = text.replace(/lại lục soát hội/gi, 'lại lục soát');
  text = text.replace(/Cổ khí tràng/g, 'Khí tràng');
  text = text.replace(/cổ khí tràng/gi, 'khí tràng');
  text = text.replace(/Cổ uy áp/g, 'Luồng uy áp');
  text = text.replace(/cổ uy áp/gi, 'luồng uy áp');
  text = text.replace(/Cổ trở lực/g, 'Sức cản');
  text = text.replace(/cổ trở lực/gi, 'sức cản');
  text = text.replace(/Người bị hại/g, 'Nạn nhân');
  text = text.replace(/người bị hại/gi, 'nạn nhân');

  if (options.normalizeSpaces) {
    text = normalizePunctuation(text);
    text = text.split('\n').map(line => line.trim()).join('\n').replace(/\n{3,}/g, '\n\n');
  }

  if (options.mergeBrokenLines) {
    const lines = text.split('\n');
    const result = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) { if (result[result.length-1] !== '') result.push(''); continue; }
      const prev = result[result.length - 1] || '';
      const isTitle = /^chương\s+\d+|^chapter\s+\d+/i.test(trimmed);
      const shouldMerge = prev && !isTitle && !/[.!?…:;"')\]]$/.test(prev) && trimmed.length < 180;
      if (shouldMerge) result[result.length - 1] = prev + ' ' + trimmed;
      else result.push(trimmed);
    }
    text = result.join('\n');
  }
  if (options.reflowLayout) {
    text = localReflow(text);
  }
  return protector.restore(text).trim();
}

function buildStyleGuide(filters, promptSettings={}) {
  const preserve = splitTerms(filters.preserveTerms).join(', ');
  const strength = HUMANIZE_PRESETS[promptSettings.humanizeStrength] || HUMANIZE_PRESETS.naturalAudio;
  const pronoun = PRONOUN_PRESETS[promptSettings.pronounStyle] || PRONOUN_PRESETS.balanced;
  const memory = (promptSettings.novelMemory || '').trim();
  const extra = (promptSettings.additionalInstructions || '').trim();
  return `VAI TRÒ:
Bạn là biên tập viên tiếng Việt cho truyện convert/dịch thô. Mục tiêu là làm văn bản DỄ NGHE bằng TTS và dễ đọc với người Việt, không phải viết lại thành văn chương AI.

NGUYÊN TẮC BẮT BUỘC:
- Giữ nguyên nội dung, thứ tự tình tiết, thông tin nhân vật và ý nghĩa câu gốc.
- Không thêm tình tiết, không thêm miêu tả mới, không fanfic hóa.
- Không tự ý đổi tên riêng, cảnh giới, công pháp, địa danh, môn phái.
- Câu văn phải giống tiếng Việt tự nhiên hơn: sửa trật tự từ convert, câu thiếu chủ vị, hội thoại gượng, cụm từ dịch máy.
- Không được làm văn hoa/AI hóa. Tránh thêm các từ như: khẽ, chậm rãi, tà mị, âm trầm, nhàn nhạt, lạnh lẽo... nếu bản gốc không thật sự có ý đó.
- Ưu tiên câu ngắn, rõ nghĩa, nghe không chối khi đọc bằng giọng máy.
- Giữ thuật ngữ/từ đặc trưng nếu chúng là chất truyện: ${preserve || 'không có'}.
- Nếu văn bản dính một cục, chia đoạn hợp lý. Lời thoại tách riêng. Không tách vụn từng câu.
- Chỉ trả về văn bản đã xử lý, không giải thích.

MỨC BIÊN TẬP:
${strength}

XƯNG HÔ:
${pronoun}

GHI NHỚ RIÊNG BỘ TRUYỆN:
${memory || 'Không có.'}

GHI CHÚ THÊM CỦA NGƯỜI DÙNG:
${extra || 'Không có.'}`;
}

function buildAiPrompt(mode, text, filters, promptSettings={}) {
  const styleGuide = buildStyleGuide(filters, promptSettings);
  const task = mode === 'structure'
    ? 'Sửa bố cục, chia đoạn, tách thoại, đồng thời sửa các câu convert lộn xộn để nghe tự nhiên hơn.'
    : mode === 'proofread'
      ? 'Rà chính tả, dấu câu, bố cục và sửa các câu lủng củng rõ ràng. Không rewrite nếu không cần.'
      : 'Việt hóa truyện convert/dịch thô sang tiếng Việt tự nhiên để nghe, giữ nội dung và không văn chương hóa.';
  return `${styleGuide}\n\nNHIỆM VỤ CỤ THỂ:\n${task}\n\nVĂN BẢN CẦN XỬ LÝ:\n${text}`;
}

function makeChapterXhtml(chapter, index, bookTitleStr = '') {
  const cleanTitle = formatChapterTitleForExport(chapter.title || '', index, bookTitleStr);
  const title = escapeHtml(cleanTitle);
  let bodyContent = chapter.cleaned || chapter.raw || '';
  bodyContent = stripTitleFromText(bodyContent, cleanTitle, bookTitleStr);
  bodyContent = stripTitleFromText(bodyContent, chapter.title, bookTitleStr);
  console.log(`[Pipeline Trace][Export EPUB] Chapter ${index + 1}:`, {
    title: chapter.title,
    formattedTitle: cleanTitle,
    rawContent: chapter.raw?.slice(0, 200),
    cleanedContent: chapter.cleaned?.slice(0, 200),
    isPrependingTitle: true
  });
  const body = escapeHtml(bodyContent).split(/\n{1,}/).map(p=>p.trim()).filter(Boolean).map(p=>`<p>${p}</p>`).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" lang="vi"><head><title>${title}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body><h1>${title}</h1>${body}</body></html>`;
}
async function buildEpub({ title, author, chapters }) {
  const zip = new JSZip();
  zip.file('mimetype','application/epub+zip',{compression:'STORE'});
  zip.folder('META-INF').file('container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  const oebps = zip.folder('OEBPS');
  oebps.file('style.css','body{font-family:serif;line-height:1.8;margin:5%;}h1{text-align:center;margin-bottom:2rem;}p{text-indent:1.5em;margin:0 0 .85em;}');
  chapters.forEach((ch,i)=>oebps.file(`chapter-${i+1}.xhtml`, makeChapterXhtml(ch,i,title)));
  const manifest = chapters.map((_,i)=>`<item id="ch${i+1}" href="chapter-${i+1}.xhtml" media-type="application/xhtml+xml"/>`).join('\n');
  const spine = chapters.map((_,i)=>`<itemref idref="ch${i+1}"/>`).join('\n');
  oebps.file('content.opf',`<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">${Date.now()}</dc:identifier><dc:title>${escapeHtml(title||'Truyện đã dọn')}</dc:title><dc:creator>${escapeHtml(author||'Unknown')}</dc:creator><dc:language>vi</dc:language></metadata><manifest><item id="style" href="style.css" media-type="text/css"/>${manifest}</manifest><spine>${spine}</spine></package>`);
  return zip.generateAsync({ type:'blob', mimeType:'application/epub+zip' });
}

async function buildDocx({ title, author, chapters, isSiri = false }) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak } = await import('docx');
  const children = [];
  children.push(new Paragraph({
    text: title || 'Truyện đã dọn',
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { after: 360 }
  }));
  if (author) {
    children.push(new Paragraph({
      text: author,
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 }
    }));
  }

  chapters.forEach((chapter, index) => {
    if (index > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    const cleanTitle = formatChapterTitleForExport(chapter.title || '', index, title);
    children.push(new Paragraph({
      text: cleanTitle,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 240 }
    }));
    let body = (chapter.cleaned || chapter.raw || '').trim();
    body = stripTitleFromText(body, cleanTitle, title);
    body = stripTitleFromText(body, chapter.title, title);
    console.log(`[Pipeline Trace][Export DOCX] Chapter ${index + 1}:`, {
      title: chapter.title,
      formattedTitle: cleanTitle,
      rawContent: chapter.raw?.slice(0, 200),
      cleanedContent: chapter.cleaned?.slice(0, 200),
      isPrependingTitle: true
    });
    body.split(/\n{2,}|\n/).map(p => p.trim()).filter(Boolean).forEach(p => {
      children.push(new Paragraph({
        children: [new TextRun({ text: p, size: 28 })],
        spacing: isSiri ? { before: 0, after: 0, line: 360 } : { before: 120, after: 180, line: 420 },
        indent: isSiri ? { firstLine: 0 } : { firstLine: 420 }
      }));
    });
  });

  const doc = new Document({
    creator: 'Story Cleaner',
    title: title || 'Truyện đã dọn',
    description: 'DOCX tối ưu để upload Drive và nghe bằng Edge/Safari/Google Docs.',
    sections: [{
      properties: {
        page: { margin: { top: 1000, right: 900, bottom: 1000, left: 900 } }
      },
      children
    }]
  });
  return Packer.toBlob(doc);
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }


function maskKey(key='') {
  if (!key) return '';
  if (key.length <= 12) return key.slice(0, 4) + '••••';
  return key.slice(0, 7) + '••••••••' + key.slice(-4);
}
function shortHash(str='') {
  let h = 0;
  for (let i=0;i<str.length;i++) h = ((h<<5)-h) + str.charCodeAt(i) | 0;
  return String(Math.abs(h)%1000).padStart(3,'0');
}
function parseImportedKeyLines(text='', startIndex=0) {
  return text.split(/\r?\n|,/).map(x=>x.trim()).filter(Boolean).map((line, i)=>{
    let label='', key=line;
    if (line.includes('=')) {
      const parts=line.split('=');
      label=parts.shift().trim();
      key=parts.join('=').trim();
    }
    if (!label) label = `GEMINI_${String(startIndex+i+1).padStart(3,'0')}`;
    return { id:`${Date.now()}_${i}_${shortHash(key)}`, label, key, enabled:true, lastStatus:'unknown', totalSuccess:0, totalFail:0, totalChars:0, lastUsedAt:null, lastError:'' };
  }).filter(k=>k.key);
}
function uniqueKeyPool(pool) {
  const seen = new Set();
  const out = [];
  for (const item of pool) {
    if (!item?.key || seen.has(item.key)) continue;
    seen.add(item.key);
    out.push(item);
  }
  return out;
}
function activeKeysFromPool(pool=[]) { return pool.filter(k=>k.enabled && k.key).map(k=>k.key); }
function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href);
}
async function importEpubFile(file, bookTitleStr = '') {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files).filter(f=>!f.dir && /\.(xhtml|html)$/i.test(f.name));
  const contentFiles = entries.filter(f=>!/nav|toc|cover/i.test(f.name));
  const files = (contentFiles.length ? contentFiles : entries).sort((a,b)=>a.name.localeCompare(b.name, undefined, {numeric:true}));
  const chapters = [];
  for (let i=0;i<files.length;i++) {
    const html = await files[i].async('string');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rawTitle = (doc.querySelector('h1,h2,title')?.textContent || `Chương ${i+1}`).trim();
    const title = formatChapterTitleForExport(rawTitle, i, bookTitleStr);
    doc.querySelectorAll('script,style,nav').forEach(n=>n.remove());
    const paragraphs = [...doc.body.querySelectorAll('p,div')].map(n=>n.textContent.trim()).filter(t=>t && t.length>1);
    let text = paragraphs.length ? paragraphs.join('\n\n') : (doc.body?.textContent || '').replace(/\n{3,}/g,'\n\n').trim();
    text = stripTitleFromText(text, title, bookTitleStr);
    text = stripTitleFromText(text, rawTitle, bookTitleStr);
    if (text) chapters.push({title, url:'', raw:text, cleaned:text});
  }
  return chapters;
}
const CACHE_KEY = 'story-cleaner-v7-cache';

function parseApiKeys(text='') {
  return text.split(/\r?\n|,/).map(x => x.trim()).filter(Boolean);
}

function splitTextIntoChunks(text='', maxChars=6000) {
  const clean = text.trim();
  if (!clean) return [];
  const paragraphs = clean.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const chunks = [];
  let buf = '';
  const push = () => { if (buf.trim()) chunks.push(buf.trim()); buf = ''; };

  for (const p of paragraphs) {
    if (p.length > maxChars) {
      push();
      const sentences = p.match(/[^.!?…]+[.!?…]+["”']?|[^.!?…]+$/g) || [p];
      let sbuf = '';
      for (const s of sentences.map(x=>x.trim()).filter(Boolean)) {
        if ((sbuf + ' ' + s).trim().length > maxChars) {
          if (sbuf.trim()) chunks.push(sbuf.trim());
          if (s.length > maxChars) {
            for (let i=0; i<s.length; i+=maxChars) chunks.push(s.slice(i, i+maxChars).trim());
            sbuf = '';
          } else sbuf = s;
        } else sbuf = (sbuf ? sbuf + ' ' : '') + s;
      }
      if (sbuf.trim()) chunks.push(sbuf.trim());
      continue;
    }
    if ((buf + '\n\n' + p).trim().length > maxChars) push();
    buf = (buf ? buf + '\n\n' : '') + p;
  }
  push();
  return chunks;
}

function buildChunkPrompt(mode, chunk, filters, index, total, previousTail='', promptSettings={}) {
  const styleGuide = buildStyleGuide(filters, promptSettings);
  const modeLine = mode === 'structure'
    ? 'Sửa bố cục, chia đoạn, tách thoại, đồng thời sửa các câu convert lộn xộn để nghe tự nhiên hơn.'
    : mode === 'proofread'
      ? 'Chỉ sửa chính tả, dấu câu, bố cục và câu lủng củng rõ ràng. Không rewrite nếu không cần.'
      : 'Việt hóa truyện convert/dịch thô thành tiếng Việt tự nhiên để nghe. Sửa câu lộn xộn, nhưng không viết lại quá đà.';
  return `${styleGuide}\n\nĐây là chunk ${index}/${total} của cùng một chương truyện.\n\nNHIỆM VỤ CỤ THỂ:\n${modeLine}\n${previousTail ? `\nNGỮ CẢNH CUỐI CHUNK TRƯỚC, chỉ để giữ mạch văn, KHÔNG lặp lại trong kết quả:\n${previousTail}\n` : ''}\nVĂN BẢN CẦN XỬ LÝ:\n${chunk}`;
}

function isRateLimitError(res) {
  const msg = `${res?.error || ''} ${res?.status || ''}`.toLowerCase();
  return msg.includes('429') || msg.includes('quota') || msg.includes('rate') || msg.includes('resource_exhausted') || msg.includes('too many');
}

function isZeroQuotaError(res) {
  const msg = `${res?.error || ''}`.toLowerCase();
  return msg.includes('limit: 0') || msg.includes('free_tier') || msg.includes('current quota');
}

function friendlyGeminiError(res, model) {
  const raw = res?.error || 'Gemini API lỗi không rõ.';
  if (isZeroQuotaError(res)) {
    return `Model ${model} đang có free quota = 0 với key/project này. Hãy bấm “Lấy model từ key” để xem model nào key này thật sự hỗ trợ, ưu tiên gemini-2.5-flash-lite hoặc gemini-2.5-flash nếu có. Chi tiết gốc: ${raw}`;
  }
  return raw;
}

function extractNames(text, preserveTerms = '') {
  if (!text) return [];
  const regex = /\b[A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐĨŨƠƯ][a-zàáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]*(?:\s+[A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐĨŨƠƯ][a-zàáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]*){1,3}\b/g;
  const matches = text.match(regex) || [];
  const map = {};
  
  const stopWords = new Set([
    'Tuy Nhiên', 'Nhưng Mà', 'Thế Nhưng', 'Chúng Ta', 'Nguyên Lai', 'Như Thế', 'Cái Này',
    'Nếu Như', 'Một Lát', 'Một Bên', 'Không Phải', 'Chính Là', 'Như Vậy', 'Bởi Vì',
    'Cho Nên', 'Đột Nhiên', 'Bất Quá', 'Dù Sao', 'Đồng Thời', 'Thì Ra', 'Đằng Sau',
    'Trước Mắt', 'Sau Đó', 'Hơn Nữa', 'Bản Thân', 'Lần Này', 'Lúc Này', 'Chỗ Này',
    'Thành Ra', 'Bên Trong', 'Bên Ngoài', 'Ngày Hôm', 'Hôm Nay', 'Ngày Mai', 'Hôm Qua'
  ]);

  matches.forEach(m => {
    const trimmed = m.trim();
    if (trimmed.length > 3 && !stopWords.has(trimmed)) {
      map[trimmed] = (map[trimmed] || 0) + 1;
    }
  });

  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function extractPronouns(text, preservePronounsText = '') {
  if (!text) return [];
  let pronouns = ['hắn', 'anh ta', 'ông ta', 'ta', 'ngươi', 'nàng', 'y', 'nó', 'bổn tọa', 'bản tọa', 'lão phu'];
  if (preservePronounsText) {
    const custom = preservePronounsText.split('\n').map(p => p.trim().toLowerCase()).filter(Boolean);
    if (custom.length) pronouns = [...new Set([...pronouns, ...custom])];
  }
  
  const results = [];
  pronouns.forEach(p => {
    const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('\\b' + escaped + '\\b', 'gi');
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      results.push({ name: p, count: matches.length });
    }
  });
  
  return results.sort((a, b) => b.count - a.count);
}

function extractTerms(text, preserveTermsText = '') {
  if (!text || !preserveTermsText) return [];
  const terms = preserveTermsText.split('\n').map(t => t.trim()).filter(Boolean);
  const results = [];
  
  terms.forEach(t => {
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('\\b' + escaped + '\\b', 'gi');
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      results.push({ name: t, count: matches.length });
    }
  });
  
  return results.sort((a, b) => b.count - a.count);
}

function extractRemainingChinese(text) {
  if (!text) return [];
  const regex = /[\u4e00-\u9fa5]+/g;
  const matches = text.match(regex) || [];
  const map = {};
  
  matches.forEach(m => {
    map[m] = (map[m] || 0) + 1;
  });
  
  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function extractSuspectSentences(text, chapterIndex, chapterTitle) {
  if (!text) return [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const suspectList = [];
  
  lines.forEach(line => {
    const sentences = line.split(/(?<=[.!?])\s+/);
    sentences.forEach(s => {
      const trimmed = s.trim();
      if (!trimmed) return;
      
      let reason = '';
      if (/[\u4e00-\u9fa5]/.test(trimmed)) {
        reason = 'Chứa chữ Trung Quốc';
      } else if (/\?{2,}/.test(trimmed)) {
        reason = 'Chứa nhiều dấu chấm hỏi (???)';
      } else if (/!{2,}/.test(trimmed)) {
        reason = 'Chứa nhiều dấu chấm than (!!!)';
      } else if (/[!?]{2,}/.test(trimmed)) {
        reason = 'Chứa ký hiệu nghi ngờ (!?)';
      } else if (/\[[^\]]*[\u4e00-\u9fa5]+[^\]]*\]|\([^)]*[\u4e00-\u9fa5]+[^)]*\)/.test(trimmed)) {
        reason = 'Chứa ghi chú có chữ Trung Quốc';
      }
      
      if (reason) {
        suspectList.push({
          chapterIdx: chapterIndex,
          chapterTitle: chapterTitle || `Chương ${chapterIndex + 1}`,
          sentence: trimmed,
          reason
        });
      }
    });
  });
  
  return suspectList;
}

function replacePlaceholders(templateText, filters, promptSettings) {
  const preserve = splitTerms(filters.preserveTerms).join(', ');
  const strength = HUMANIZE_PRESETS[promptSettings.humanizeStrength] || HUMANIZE_PRESETS.naturalAudio;
  const pronoun = PRONOUN_PRESETS[promptSettings.pronounStyle] || PRONOUN_PRESETS.balanced;
  const memory = (promptSettings.novelMemory || '').trim();
  const extra = (promptSettings.additionalInstructions || '').trim();

  let text = templateText || '';
  text = text.replace(/\{\{preserveTerms\}\}/g, preserve || 'không có');
  text = text.replace(/\{\{novelMemory\}\}/g, memory || 'Không có.');
  text = text.replace(/\{\{pronounStyle\}\}/g, pronoun || 'Không có.');
  text = text.replace(/\{\{humanizeStrength\}\}/g, strength || 'Không có.');
  text = text.replace(/\{\{extraInstructions\}\}/g, extra || 'Không có.');
  
  return text;
}

function buildCustomPrompt(mode, chunk, filters, index, total, previousTail='', promptSettings={}, templates, isReAi=false) {
  let template = templates.aiNaturalVn;
  if (mode === 'story_cleaner') {
    template = templates.storyCleaner;
  } else if (isReAi) {
    template = templates.reAi;
  }

  const systemPrompt = replacePlaceholders(template, filters, promptSettings);
  return `${systemPrompt}\n\nĐây là chunk ${index}/${total} của cùng một chương truyện.\n\n${previousTail ? `\nNGỮ CẢNH CUỐI CHUNK TRƯỚC, chỉ để giữ mạch văn, KHÔNG lặp lại trong kết quả:\n${previousTail}\n` : ''}\nVĂN BẢN CẦN XỬ LÝ:\n${chunk}`;
}

const DEFAULT_MODEL_OPTIONS = [
  { name: 'gemini-2.5-flash-lite', displayName: 'gemini-2.5-flash-lite — ưu tiên key free nếu có' },
  { name: 'gemini-2.5-flash', displayName: 'gemini-2.5-flash — mạnh hơn' },
  { name: 'gemini-2.0-flash', displayName: 'gemini-2.0-flash — có thể quota 0' }
];

function createEmptyBook(index=1) {
  return {
    id: `book_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    title: index === 1 ? 'Truyện đã dọn' : `Truyện ${index}`,
    author: '',
    chapters: [{title:'Chương 1',url:'',raw:'',cleaned:''}],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function classifyAiError(errOrString) {
  const msg = String(errOrString?.message || errOrString || '').trim();
  let type = 'Lỗi không xác định';
  
  const lowerMsg = msg.toLowerCase();
  if (lowerMsg.includes('chưa tải nội dung') || lowerMsg.includes('chương chưa tải')) {
    type = 'Chưa tải nội dung';
  } else if (lowerMsg.includes('nội dung rỗng') || lowerMsg.includes('chương này chưa có nội dung') || lowerMsg.includes('không có nội dung') || lowerMsg.includes('empty') || lowerMsg.includes('rỗng') || !msg) {
    type = 'Nội dung rỗng';
  } else if (lowerMsg.includes('401') || lowerMsg.includes('403') || lowerMsg.includes('auth') || lowerMsg.includes('api key') || lowerMsg.includes('invalid api key') || lowerMsg.includes('unauthorized') || lowerMsg.includes('key auth')) {
    type = 'Lỗi API/key';
  } else if (lowerMsg.includes('429') || lowerMsg.includes('quota') || lowerMsg.includes('rate limit') || lowerMsg.includes('resource_exhausted') || lowerMsg.includes('too many requests')) {
    type = 'Lỗi mạng/quota';
  } else if (lowerMsg.includes('500') || lowerMsg.includes('503') || lowerMsg.includes('server') || lowerMsg.includes('service unavailable') || lowerMsg.includes('internal error')) {
    type = 'Lỗi API/key';
  } else if (lowerMsg.includes('timeout') || lowerMsg.includes('fetch failed') || lowerMsg.includes('network') || lowerMsg.includes('aborted') || lowerMsg.includes('failed to fetch') || lowerMsg.includes('econnrefused')) {
    type = 'Lỗi mạng/quota';
  }
  
  return { type, message: msg || 'Lỗi không xác định' };
}

function getChapterSourceContent(ch) {
  if (!ch) return '';
  return String(ch.cleaned || ch.aiText || ch.naturalText || ch.cleanText || ch.raw || ch.rawText || ch.content || ch.text || '').trim();
}

function getChapterRawContent(ch) {
  if (!ch) return '';
  return String(ch.raw || ch.rawText || ch.content || ch.text || ch.cleaned || ch.aiText || ch.naturalText || ch.cleanText || '').trim();
}

function getChapterRawLength(ch) {
  return getChapterRawContent(ch).length;
}

function App() {
  const [books,setBooks]=useState(()=>[createEmptyBook(1)]);
  const [bookIndex,setBookIndex]=useState(0);
  const [keyPage, setKeyPage] = useState(1);
  const [keysPerPage, setKeysPerPage] = useState(10);
  const [collapsedBooks,setCollapsedBooks]=useState({});
  const rawTextRef=useRef(null);
  const cleanTextRef=useRef(null);
  const scrollSyncLock=useRef(false);
  const [importKeyText,setImportKeyText]=useState('');  const [apiPool,setApiPool]=useState([]);
  const projectInputRef=useRef(null);
  const cancelRef = useRef(false);
  const overlayMouseDownTargetRef = useRef(null);
  const [cancelRequested, setCancelRequested] = useState(false);

  // States for DOCX dropdown and batch export modal
  const [showDocxDropdown, setShowDocxDropdown] = useState(false);
  const [showBatchExportModal, setShowBatchExportModal] = useState(false);
  const [exportStartCh, setExportStartCh] = useState(1);
  const [exportEndCh, setExportEndCh] = useState(10);
  const [exportFilename, setExportFilename] = useState('Tập 01');
  const [exportIsSiri, setExportIsSiri] = useState(false);

  // States for split buttons
  const [batchAiSelection, setBatchAiSelection] = useState('3');
  const [batchAiValue, setBatchAiValue] = useState(3);
  const [batchFetchSelection, setBatchFetchSelection] = useState('all');
  const [batchFetchValue, setBatchFetchValue] = useState('all');
  const [showFetchDropdown, setShowFetchDropdown] = useState(false);
  const [isEnteringFetchCustom, setIsEnteringFetchCustom] = useState(false);
  const [tempFetchCustomValue, setTempFetchCustomValue] = useState(10);
  const [showBatchAiDropdown, setShowBatchAiDropdown] = useState(false);
  const [isEnteringAiCustom, setIsEnteringAiCustom] = useState(false);
  const [tempAiCustomValue, setTempAiCustomValue] = useState(5);
  const [showOptionsPopup, setShowOptionsPopup] = useState(false);

  const updateDefaultFilename = (start, end) => {
    const s = parseInt(start) || 1;
    const e = parseInt(end) || 10;
    const diff = Math.max(1, e - s + 1);
    const tapNum = Math.max(1, Math.ceil(s / diff));
    const padNum = String(tapNum).padStart(2, '0');
    setExportFilename(`Tập ${padNum}`);
  };
  const handleStop = () => {
    cancelRef.current = true;
    setCancelRequested(true);
    setStatus({type: 'warn', message: 'Đang yêu cầu dừng quá trình...'});
  };
  const [selected,setSelected]=useState(0);
  const [tab,setTab]=useState('editor');
  const [aiMode,setAiMode]=useState('humanize');
  const [aiPrompt,setAiPrompt]=useState('');
  const [promptSettings,setPromptSettings]=useState({pronounStyle:'balanced',humanizeStrength:'naturalAudio',novelMemory:DEFAULT_NOVEL_MEMORY,additionalInstructions:''});
  const [keySearch,setKeySearch]=useState('');
  const [keyStatusFilter,setKeyStatusFilter]=useState('all');
  const [lastAutoSaved,setLastAutoSaved]=useState('');
  const [filters,setFilters]=useState(DEFAULT_FILTERS);
  const [status,setStatus]=useState({type:'',message:''});
  const [fetching,setFetching]=useState(false);
  const [aiRunning,setAiRunning]=useState(false);
  const [aiProgress,setAiProgress]=useState({done:0,total:0,message:''});
  const [keyCooldowns,setKeyCooldowns]=useState({});
  const [modelOptions,setModelOptions]=useState(DEFAULT_MODEL_OPTIONS);
  const [showAiReport, setShowAiReport] = useState(false);
  const [activeReportTab, setActiveReportTab] = useState('success');
  const [chapterFilter, setChapterFilter] = useState('all');
  const [showBatchFetchModal, setShowBatchFetchModal] = useState(false);
  const [batchFetchStart, setBatchFetchStart] = useState(1);
  const [batchFetchEnd, setBatchFetchEnd] = useState(1);
  const [showBatchAiModal, setShowBatchAiModal] = useState(false);
  const [batchAiStart, setBatchAiStart] = useState(1);
  const [batchAiEnd, setBatchAiEnd] = useState(1);
  const [overwriteModal, setOverwriteModal] = useState({ show: false, title: '', message: '', confirmText: '', cancelText: '', onConfirm: null });
  const [batchOverwriteModal, setBatchOverwriteModal] = useState({ show: false, cleanedChapters: [], startCh: 1, endCh: 1 });
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [promptTemplates, setPromptTemplates] = useState(PROMPT_PRESETS.naturalVn);
  const [editingPromptKey, setEditingPromptKey] = useState('aiNaturalVn');
  const [editingPromptText, setEditingPromptText] = useState(PROMPT_PRESETS.naturalVn.aiNaturalVn);
  const [selectedPresetKey, setSelectedPresetKey] = useState('');

  useEffect(() => {
    setEditingPromptText(promptTemplates[editingPromptKey] || '');
  }, [editingPromptKey, promptTemplates]);

  const [apiSettings,setApiSettings]=useState({
    model:'gemini-2.5-flash-lite',
    chunkSize:12000,
    delayMs:6500,
    cooldownMs:120000,
    maxRetries:2
  });
  const [options,setOptions]=useState({normalizeSpaces:true,mergeBrokenLines:true,reflowLayout:true,removeWatermark:true,restoreFilteredWords:true,autoReplace:true,siriReadingMode:true,mergeSingleLines:true,reduceDocxBreaks:true,safeRegexPolish:true});
  const currentBook = books[bookIndex] || books[0] || createEmptyBook(1);
  const bookTitle = currentBook.title || 'Truyện đã dọn';
  const author = currentBook.author || '';
  const chapters = currentBook.chapters?.length ? currentBook.chapters : [{title:'Chương 1',url:'',raw:'',cleaned:''}];
  const updateBook = (patchOrFn)=>setBooks(prev=>prev.map((book,idx)=>{
    if(idx!==bookIndex) return book;
    const patch = typeof patchOrFn === 'function' ? patchOrFn(book) : patchOrFn;
    return {...book, ...patch, updatedAt:new Date().toISOString()};
  }));
  const setBookTitle = (title)=>updateBook({title});
  const setAuthor = (author)=>updateBook({author});
  const setChapters = (next)=>updateBook(book=>({chapters: typeof next === 'function' ? next(book.chapters || []) : next}));  const addBook = ()=>{
    const book = createEmptyBook(books.length+1);
    setBooks(prev=>[...prev, book]);
    setBookIndex(books.length);
    setSelected(0);
    setTab('editor');
    setCollapsedBooks(()=>{
      const nextCollapsed = {};
      books.forEach((_, i) => { nextCollapsed[i] = true; });
      nextCollapsed[books.length] = false;
      return nextCollapsed;
    });
  };
  const selectBook = (idx)=>{
    setBookIndex(idx);
    setSelected(0);
    setCollapsedBooks(()=>{
      const nextCollapsed = {};
      books.forEach((_, i) => { nextCollapsed[i] = true; });
      nextCollapsed[idx] = false;
      return nextCollapsed;
    });
  };
  const toggleBookCollapsed = (idx)=>{
    setCollapsedBooks(prev=>{
      const isCurrentlyOpen = !prev[idx];
      const nextCollapsed = {};
      books.forEach((_, i) => { nextCollapsed[i] = true; });
      if (!isCurrentlyOpen) {
        nextCollapsed[idx] = false;
      }
      return nextCollapsed;
    });
  };
  const deleteBook = (idx)=>{
    if(!confirm('Xóa truyện này và toàn bộ chương bên trong?')) return;
    setBooks(prev=>{
      const next = prev.filter((_,i)=>i!==idx);
      if(!next.length) return [createEmptyBook(1)];
      return next;
    });
    setBookIndex(prev=>{
      if(books.length<=1) return 0;
      if(idx<prev) return Math.max(0,prev-1);
      if(idx===prev) return Math.max(0,Math.min(prev,books.length-2));
      return prev;
    });
    setSelected(0);
  };
  const handleCompareScroll=(source)=>{
    const raw=rawTextRef.current;
    const clean=cleanTextRef.current;
    if(!raw || !clean || scrollSyncLock.current) return;
    const from = source==='raw' ? raw : clean;
    const to = source==='raw' ? clean : raw;
    const maxFrom = Math.max(1, from.scrollHeight - from.clientHeight);
    const ratio = from.scrollTop / maxFrom;
    const maxTo = Math.max(0, to.scrollHeight - to.clientHeight);
    scrollSyncLock.current=true;
    to.scrollTop = ratio * maxTo;
    requestAnimationFrame(()=>{scrollSyncLock.current=false;});
  };

  useEffect(()=>{
    try {
      const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (saved) {
        if (Array.isArray(saved.books) && saved.books.length) {
          setBooks(saved.books.map((b,idx)=>({
            ...createEmptyBook(idx+1),
            ...b,
            chapters: Array.isArray(b.chapters) && b.chapters.length ? b.chapters : [{title:'Chương 1',url:'',raw:'',cleaned:''}]
          })));
          if (Number.isInteger(saved.bookIndex)) setBookIndex(Math.max(0, Math.min(saved.bookIndex, saved.books.length-1)));
        } else {
          setBooks([{...createEmptyBook(1), title:saved.bookTitle || 'Truyện đã dọn', author:typeof saved.author === 'string' ? saved.author : '', chapters:Array.isArray(saved.chapters) && saved.chapters.length ? saved.chapters : [{title:'Chương 1',url:'',raw:'',cleaned:''}]}]);
        }
        if (saved.filters) setFilters({...DEFAULT_FILTERS, ...saved.filters});
        if (saved.options) setOptions(prev=>({...prev, ...saved.options}));
        if (saved.apiSettings) setApiSettings(prev=>({...prev, ...saved.apiSettings, apiKeys:undefined}));
        if (saved.promptSettings) setPromptSettings(prev=>({...prev, ...saved.promptSettings}));
        if (Array.isArray(saved.apiPool)) setApiPool(saved.apiPool.map(k=>({...k, lastStatus:k.lastStatus || 'Đã lưu'})));
        if (saved.collapsedBooks) setCollapsedBooks(saved.collapsedBooks);
        setStatus({type:'ok',message:'Đã khôi phục cache làm việc gần nhất.'});
      }
    } catch {}

    const loadSavedPrompts = async () => {
      if (window.storyAPI?.loadSettings) {
        try {
          const res = await window.storyAPI.loadSettings();
          if (res?.ok && res.data) {
            setPromptTemplates(res.data);
            return;
          }
        } catch (err) {}
      }
      
      const local = localStorage.getItem('story-cleaner-prompts');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (parsed.aiNaturalVn || parsed.storyCleaner || parsed.reAi) {
            setPromptTemplates(parsed);
          }
        } catch {}
      }
    };
    loadSavedPrompts();
  },[]);
  useEffect(()=>{
    const timer = setTimeout(()=>{
      const updatedAt = new Date().toISOString();
      const data={books,bookIndex,bookTitle,author,chapters,filters,options,apiSettings,apiPool,promptSettings,collapsedBooks,updatedAt};
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      setLastAutoSaved(new Date(updatedAt).toLocaleTimeString());
    }, 900);
    return ()=>clearTimeout(timer);
  },[books,bookIndex,bookTitle,author,chapters,filters,options,apiSettings,apiPool,promptSettings,collapsedBooks]);  const current=chapters[selected]||chapters[0];
  const formatCharCount = (ch) => {
    if (!ch) return '0';
    const isAi = !!(ch.aiProcessed || ch.aiNaturalAt);
    const text = isAi ? (ch.cleaned || ch.cleanedContent || '') : (ch.raw || ch.originalContent || '');
    const len = text ? text.length : 0;
    return len.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };
  const [createCount, setCreateCount] = useState(1);
  const [batchSizeInput, setBatchSizeInput] = useState(10);
  const [copiedClean, setCopiedClean] = useState(false);

  function getNextChapterUrl(url) {
    if (!url) return '';
    const [base, query] = url.split('?');
    const numberRegex = /\d+/g;
    const matches = base.match(numberRegex);
    if (matches && matches.length > 0) {
      const lastNumStr = matches[matches.length - 1];
      const lastNum = parseInt(lastNumStr, 10);
      const nextNum = lastNum + 1;
      const lastIdx = base.lastIndexOf(lastNumStr);
      if (lastIdx !== -1) {
        const nextBase = base.substring(0, lastIdx) + nextNum + base.substring(lastIdx + lastNumStr.length);
        return query ? `${nextBase}?${query}` : nextBase;
      }
    }
    return '';
  }

  function normalizeChapterTitle(title, bookTitleStr = '', fallbackTitle = '') {
    let t = String(title || '').trim();
    
    if (bookTitleStr) {
      const bookTitleEscaped = escapeRegExp(bookTitleStr);
      const cleanRegex = new RegExp(`(?:của\\s+)?(?:truyện\\s+)?${bookTitleEscaped}\\s*[-_:]*\\s*`, 'gi');
      t = t.replace(cleanRegex, '');
    }

    t = t.replace(/\s*[-_:]*\s*(truyenfull|sstruyen|tangthuvien|truyenyyeu|dtruyen|metruyenchu|wikidich|bachngocsach)\b.*$/i, '');

    let num = '';
    let name = '';

    const chMatch = t.match(/(?:ch[ươ]ng|chapter|ch)\s*(\d+(?:\.\d+)?)/i);
    if (chMatch) {
      num = chMatch[1];
      const idx = t.toLowerCase().indexOf(chMatch[0].toLowerCase());
      name = t.substring(idx + chMatch[0].length).trim();
    } else {
      const volMatch = t.match(/(?:tập|vol|volume|quyển)\s*(\d+(?:\.\d+)?)/i);
      if (volMatch) {
        num = volMatch[1];
        const idx = t.toLowerCase().indexOf(volMatch[0].toLowerCase());
        name = t.substring(idx + volMatch[0].length).trim();
      } else {
        const digitMatch = t.match(/^\s*(\d+(?:\.\d+)?)/);
        if (digitMatch) {
          num = digitMatch[1];
          name = t.substring(t.indexOf(num) + num.length).trim();
        }
      }
    }

    if (!num && fallbackTitle) {
      const fallbackClean = String(fallbackTitle).trim();
      const fbChMatch = fallbackClean.match(/(?:ch[ươ]ng|chapter|ch)\s*(\d+(?:\.\d+)?)/i);
      if (fbChMatch) {
        num = fbChMatch[1];
      } else {
        const fbDigitMatch = fallbackClean.match(/^\s*(\d+(?:\.\d+)?)/);
        if (fbDigitMatch) {
          num = fbDigitMatch[1];
        }
      }
      name = t;
    }

    if (num) {
      name = name.replace(/^[-_:\s\.\/\)\}\]]+/, '').trim();
      name = name.replace(/[-_:\s\.\/\(\{\[]+$/, '').trim();
      name = name.replace(/^(ch[ươ]ng|chapter|ch)\s*\d+\s*[-_:]*\s*/i, '');
      
      if (!name || (bookTitleStr && normalizeForCompare(name) === normalizeForCompare(bookTitleStr))) {
        return `Chương ${num}`;
      }
      return `Chương ${num}: ${name}`;
    }

    t = t.replace(/^[-_:\s\.\/\)\}\]]+/, '').trim();
    return t || 'Chương mới';
  }



  const continueChapter = (bIdx) => {
    const targetBookIndex = bIdx !== undefined ? bIdx : bookIndex;
    if (targetBookIndex === bookIndex) {
      addChapter();
      return;
    }
    const book = books[targetBookIndex];
    if (!book) return;
    const chs = book.chapters || [];
    const newChNum = chs.length + 1;
    const newCh = {
      title: `Chương ${newChNum}`,
      url: '',
      raw: '',
      cleaned: '',
      selectedForExport: false
    };
    setBooks(prev => prev.map((x, i) => {
      if (i === targetBookIndex) {
        return {
          ...x,
          chapters: [...(x.chapters || []), newCh],
          updatedAt: new Date().toISOString()
        };
      }
      return x;
    }));
  };

  const loadChapterList = async () => {
    const url = currentBook.url?.trim();
    if (!url) {
      setStatus({type: 'warn', message: 'Vui lòng nhập Link tổng của truyện.'});
      return;
    }
    if (!window.storyAPI?.fetchHtml) {
      setStatus({type: 'warn', message: 'Tính năng tải danh sách chỉ chạy trong app desktop Electron.'});
      return;
    }

    setFetching(true);
    setStatus({type: '', message: 'Đang tải danh sách chương từ Link tổng...'});

    const pagesToCrawl = [url];
    const visitedPages = new Set();
    const chapterLinks = [];
    const seenChapterUrls = new Set();

    let pageCount = 0;
    const MAX_PAGES = 100;

    try {
      while (pagesToCrawl.length > 0 && pageCount < MAX_PAGES) {
        if (cancelRef.current) {
          break;
        }

        const currentUrl = pagesToCrawl.shift();
        if (visitedPages.has(currentUrl)) continue;
        visitedPages.add(currentUrl);
        pageCount++;

        setStatus({
          type: '',
          message: `Đang quét trang ${pageCount}... Tìm thấy ${chapterLinks.length} chương.`
        });

        const res = await window.storyAPI.fetchHtml(currentUrl);
        if (!res.ok) {
          if (pageCount === 1) {
            setStatus({type: 'error', message: res.error || 'Lỗi khi tải trang đầu tiên.'});
            setFetching(false);
            return;
          }
          console.warn(`Lỗi khi tải trang ${currentUrl}:`, res.error);
          continue;
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(res.html, 'text/html');
        const links = Array.from(doc.querySelectorAll('a'));

        links.forEach(a => {
          const text = a.textContent.trim();
          const hrefAttr = a.getAttribute('href');
          if (!hrefAttr) return;
          try {
            const absUrl = new URL(hrefAttr, currentUrl).toString().split('#')[0];
            const lowerText = text.toLowerCase();
            const lowerHref = absUrl.toLowerCase();

            const isChapter = (
              lowerText.includes('chương') ||
              lowerText.includes('chapter') ||
              /ch[ươ]ng\s+\d+/i.test(lowerText) ||
              /chapter\s+\d+/i.test(lowerText) ||
              lowerHref.includes('chuong-') ||
              lowerHref.includes('chapter-')
            ) && !lowerHref.includes('comment') && !lowerHref.includes('feedback');

            if (isChapter) {
              if (!seenChapterUrls.has(absUrl)) {
                seenChapterUrls.add(absUrl);
                chapterLinks.push({
                  title: normalizeChapterTitle(text || `Chương ${chapterLinks.length + 1}`, bookTitle),
                  url: absUrl,
                  raw: '',
                  cleaned: '',
                  selectedForExport: false
                });
              }
            } else {
              const startObj = new URL(url);
              const urlObj = new URL(absUrl);
              if (urlObj.hostname === startObj.hostname && !visitedPages.has(absUrl) && !pagesToCrawl.includes(absUrl)) {
                const lowerTextTrim = text.toLowerCase().trim();
                const hasPageParam = urlObj.searchParams.has('page') ||
                                     urlObj.searchParams.has('p') ||
                                     urlObj.searchParams.has('trang') ||
                                     /[?&](page|p|trang)=\d+/i.test(urlObj.search);

                const hasPagePath = /\/(trang|page|p|t)-\d+(\.html|\.htm)?\/?$/i.test(urlObj.pathname) ||
                                    /\/page\/\d+(\.html|\.htm)?\/?$/i.test(urlObj.pathname) ||
                                    /\/p\/\d+(\.html|\.htm)?\/?$/i.test(urlObj.pathname) ||
                                    /\/\d+(\.html|\.htm)?\/?$/i.test(urlObj.pathname);

                const isNextOrPageText = /^(next|trang|sau|cuối|last|trang\s+\d+|\d+|»|>|>>)$/i.test(lowerTextTrim) ||
                                         lowerTextTrim.includes('trang tiếp') ||
                                         lowerTextTrim.includes('trang sau') ||
                                         lowerTextTrim.includes('tiếp theo');

                if (isSameNovelPage(url, absUrl) && (hasPageParam || hasPagePath || isNextOrPageText)) {
                  pagesToCrawl.push(absUrl);
                }
              }
            }
          } catch {}
        });

        await sleep(300);
      }

      setFetching(false);

      if (chapterLinks.length === 0) {
        setStatus({type: 'warn', message: 'Không tìm thấy chương nào từ link tổng. Bạn có thể tự dán link cho từng chương.'});
        return;
      }

      const sortedChapters = chapterLinks.map((ch, idx) => ({ ...ch, originalIdx: idx }));
      sortedChapters.sort((a, b) => {
        const numA = extractChapterNumber(a);
        const numB = extractChapterNumber(b);
        if (numA !== numB) {
          return numA - numB;
        }
        return a.originalIdx - b.originalIdx;
      });

      const finalChapters = sortedChapters.map(({ originalIdx, ...rest }) => rest);
      setChapters(finalChapters);
      setSelected(0);
      setStatus({type: 'ok', message: `Đã tự động tải danh sách gồm ${finalChapters.length} chương.`});
    } catch (err) {
      setFetching(false);
      setStatus({type: 'error', message: err.message || 'Lỗi khi parse danh sách chương.'});
    }
  };

  const fetchSelectedChapters = async () => {
    if (fetching || aiRunning) return;
    const targets = chapters.map((ch, idx) => ({ ch, idx })).filter(({ ch }) => ch.selectedForExport === true);
    if (!targets.length) {
      return setStatus({type: 'warn', message: 'Bạn chưa chọn chương nào (check ✓ ở cột trái).'});
    }
    if (!window.storyAPI?.fetchChapter) {
      return setStatus({type: 'warn', message: 'Lấy nội dung chỉ chạy trong app Electron.'});
    }

    setFetching(true);
    let successCount = 0;
    let failCount = 0;
    try {
      for (let i = 0; i < targets.length; i++) {
        const { ch, idx } = targets[i];
        if (!ch.url) {
          failCount++;
          continue;
        }
        setStatus({type: '', message: `Đang lấy nội dung chương ${idx + 1}/${chapters.length}...`});
        setSelected(idx);
        const res = await window.storyAPI.fetchChapter(ch.url);
        if (res.ok) {
          successCount++;
          const crawledTitle = normalizeChapterTitle(res.title || ch.title, bookTitle, ch.title);
          const strippedText = stripTitleFromText(res.text || '', crawledTitle, bookTitle);
          
          console.log(`[Pipeline Trace][Crawler Fetch] fetchSelectedChapters - Chapter ${idx + 1}:`, {
            originalTitle: res.title,
            normalizedTitle: crawledTitle,
            textLengthBeforeStrip: (res.text || '').length,
            textLengthAfterStrip: strippedText.length
          });

          updateChapter(idx, {
            title: crawledTitle,
            raw: strippedText,
            cleaned: cleanStoryText(strippedText, options, filters)
          });
        } else {
          failCount++;
        }
        await sleep(1000);
      }
      setStatus({type: 'ok', message: `Đã lấy xong hàng loạt: ${successCount} thành công, ${failCount} thất bại.`});
    } catch (err) {
      setStatus({type: 'error', message: err.message || 'Lỗi lấy nội dung hàng loạt.'});
    } finally {
      setFetching(false);
    }
  };

  const fetchBatchChapters = async (startCh, endCh, overwriteMode = 'none') => {
    if (fetching || aiRunning) return;
    const startIndex = Math.max(0, parseInt(startCh) - 1);
    const endIndex = Math.min(chapters.length, parseInt(endCh));
    
    if (startIndex >= endIndex) {
      if (parseInt(startCh) > parseInt(endCh)) {
        alert('Chương bắt đầu phải nhỏ hơn hoặc bằng chương kết thúc.');
        return;
      }
    }

    let targets = [];
    let cleanedTitles = [];
    for (let idx = startIndex; idx < endIndex; idx++) {
      if (chapters[idx].url) {
        const processed = hasExistingContent(chapters[idx]);
        if (processed) {
          cleanedTitles.push(chapters[idx].title || `Chương ${idx + 1}`);
        }
        
        if (overwriteMode === 'skipCleaned' && processed) {
          continue;
        }
        targets.push({ ch: chapters[idx], idx });
      }
    }

    if (!targets.length) {
      return setStatus({type: 'warn', message: 'Không tìm thấy chương nào cần lấy nội dung (có thể các chương đã được Clean hoặc không có Link).'});
    }

    if (overwriteMode === 'none' && cleanedTitles.length > 0) {
      setBatchOverwriteModal({
        show: true,
        cleanedChapters: cleanedTitles,
        startCh,
        endCh
      });
      return;
    }

    if (!window.storyAPI?.fetchChapter) {
      return setStatus({type: 'warn', message: 'Lấy nội dung chỉ chạy trong app Electron.'});
    }

    setFetching(true);
    let successCount = 0;
    let failCount = 0;
    try {
      for (let i = 0; i < targets.length; i++) {
        if (cancelRef.current) break;
        const { ch, idx } = targets[i];
        setStatus({type: '', message: `Đang lấy nội dung chương ${idx + 1}/${chapters.length}...`});
        setSelected(idx);
        const res = await window.storyAPI.fetchChapter(ch.url);
        if (res.ok) {
          successCount++;
          const crawledTitle = normalizeChapterTitle(res.title || ch.title, bookTitle, ch.title);
          const strippedText = stripTitleFromText(res.text || '', crawledTitle, bookTitle);
          
          console.log(`[Pipeline Trace][Crawler Fetch] fetchBatchChapters - Chapter ${idx + 1}:`, {
            originalTitle: res.title,
            normalizedTitle: crawledTitle,
            textLengthBeforeStrip: (res.text || '').length,
            textLengthAfterStrip: strippedText.length
          });

          updateChapter(idx, {
            title: crawledTitle,
            raw: strippedText,
            cleaned: cleanStoryText(strippedText, options, filters)
          });
        } else {
          failCount++;
        }
        await sleep(1000);
      }
      setStatus({type: 'ok', message: `Đã lấy xong hàng loạt từ chương ${startCh} đến ${endCh}: ${successCount} thành công, ${failCount} thất bại.`});
    } catch (err) {
      setStatus({type: 'error', message: err.message || 'Lỗi lấy nội dung hàng loạt.'});
    } finally {
      setFetching(false);
    }
  };

  const exportBatchDocx = async (start, end, filename, isSiri) => {
    const s = Math.max(1, parseInt(start) || 1) - 1;
    const e = Math.min(chapters.length, parseInt(end) || chapters.length) - 1;
    if (s > e) {
      alert('Chương bắt đầu phải nhỏ hơn hoặc bằng chương kết thúc.');
      return;
    }
    const ready = chapters.slice(s, e + 1).filter(ch => (ch.cleaned || ch.raw || '').trim());
    if (!ready.length) {
      alert('Không có nội dung chương trong khoảng đã chọn.');
      return;
    }
    try {
      const blob = await buildDocx({ title: filename, author, chapters: ready, isSiri });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${filename || slugify(bookTitle)}.docx`;
      a.click();
      URL.revokeObjectURL(a.href);
      setStatus({ type: 'ok', message: `Đã xuất ${filename}.docx (${ready.length} chương).` });
      setShowBatchExportModal(false);
    } catch (err) {
      setStatus({ type: 'error', message: err?.message || 'Xuất DOCX thất bại.' });
    }
  };

  const humanizeSelectedChapters = async () => {
    if (aiRunning || fetching) return;
    const targets = chapters.map((ch, idx) => ({ ch, idx })).filter(({ ch }) => ch.selectedForExport === true);
    if (!targets.length) {
      return setStatus({type: 'warn', message: 'Bạn chưa chọn chương nào (check ✓ ở cột trái).'});
    }

    cancelRef.current = false;
    setCancelRequested(false);
    setAiRunning(true);
    let successCount = 0;
    let failCount = 0;
    try {
      for (let i = 0; i < targets.length; i++) {
        if (cancelRef.current) break;
        const { idx } = targets[i];
        setSelected(idx);
        const success = await humanizeChapter(idx, true);
        if (success) successCount++;
        else failCount++;
        await sleep(Number(apiSettings.delayMs || 4500));
      }
      setStatus({type: 'ok', message: `AI hàng loạt hoàn thành: ${successCount} thành công, ${failCount} thất bại.`});
    } catch (err) {
      setStatus({type: 'error', message: err.message || 'Lỗi chạy AI hàng loạt.'});
    } finally {
      setAiRunning(false);
    }
  };

  const humanizeBatch = async (startCh, endCh) => {
    if (aiRunning || fetching) return;
    const startIndex = Math.max(0, parseInt(startCh) - 1);
    const endIndex = Math.min(chapters.length, parseInt(endCh));
    
    if (startIndex >= endIndex) {
      if (parseInt(startCh) > parseInt(endCh)) {
        alert('Chương bắt đầu phải nhỏ hơn hoặc bằng chương kết thúc.');
        return;
      }
    }
    
    cancelRef.current = false;
    setCancelRequested(false);
    setAiRunning(true);
    let successCount = 0;
    let failCount = 0;
    try {
      for (let idx = startIndex; idx < endIndex; idx++) {
        if (cancelRef.current) break;
        setSelected(idx);
        const success = await humanizeChapter(idx, true);
        if (success) successCount++;
        else failCount++;
        if (idx < endIndex - 1) {
          await sleep(Number(apiSettings.delayMs || 4500));
        }
      }
      setStatus({type: 'ok', message: `AI hàng loạt hoàn thành từ chương ${startCh} đến ${endCh}: ${successCount} thành công, ${failCount} thất bại.`});
    } catch (err) {
      setStatus({type: 'error', message: err.message || 'Lỗi chạy AI hàng loạt.'});
    } finally {
      setAiRunning(false);
    }
  };

  const createNChapters = () => {
    const n = Math.max(1, parseInt(createCount) || 1);
    const newChs = [];
    const baseLength = chapters.length;
    for (let i = 0; i < n; i++) {
      newChs.push({
        title: `Chương ${baseLength + i + 1}`,
        url: '',
        raw: '',
        cleaned: '',
        selectedForExport: false
      });
    }
    setChapters([...chapters, ...newChs]);
    setSelected(baseLength);
    setStatus({type: 'ok', message: `Đã tạo ${n} chương rỗng.`});
  };

  const generateCleanLog = (targets) => {
    const successList = [];
    let emptyCount = 0;
    let noInputCount = 0;

    targets.forEach(({ ch, idx }) => {
      const raw = (ch.raw || '').trim();
      const cleaned = (ch.cleaned || '').trim();
      if (!raw) {
        noInputCount++;
      } else if (!cleaned) {
        emptyCount++;
      } else {
        successList.push(`Chương ${idx + 1}`);
      }
    });

    return (
      <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
        <div style={{ fontWeight: 'bold', color: '#047857' }}>Clean thành công ({successList.length})</div>
        {successList.length > 0 && (
          <ul style={{ margin: '4px 0 10px 15px', paddingLeft: '0', listStyleType: 'none' }}>
            {successList.map(name => <li key={name}>* {name}</li>)}
          </ul>
        )}
        <div style={{ fontWeight: 'bold', color: '#92400e', marginBottom: '10px' }}>Chương rỗng ({emptyCount})</div>
        <div style={{ fontWeight: 'bold', color: '#b91c1c' }}>Chương chưa nhập liệu ({noInputCount})</div>
      </div>
    );
  };

  const copyCleanText = async () => {
    const text = (current.cleaned || current.aiText || current.naturalText || current.cleanText || '').trim();
    if (!text) {
      return setStatus({ type: 'warn', message: 'Chưa có nội dung để copy' });
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopiedClean(true);
      setStatus({ type: 'ok', message: 'Đã copy nội dung sau clean' });
      setTimeout(() => setCopiedClean(false), 2000);
    } catch (err) {
      setStatus({ type: 'error', message: 'Không thể copy: ' + err.message });
    }
  };
  const stats=useMemo(()=>chapters.reduce((a,ch)=>a+getChapterSourceContent(ch).length,0),[chapters]);
  const getSelectedChapters = (list, selectedIdx, allowFallback = true) => {
    const selectedList = list
      .map((ch, idx) => ({ ch, idx }))
      .filter(({ ch }) => ch.selectedForExport === true);
    if (selectedList.length > 0) return selectedList;
    if (allowFallback && Number.isInteger(selectedIdx) && list[selectedIdx]) {
      return [{ ch: list[selectedIdx], idx: selectedIdx }];
    }
    return [];
  };
  const updateChapter=(i,patch)=>{
    console.log(`[Pipeline Trace][State Update] Chapter ${i+1}:`, {
      title: patch.title !== undefined ? patch.title : (chapters[i] ? chapters[i].title : undefined),
      rawContent: patch.raw !== undefined ? patch.raw.slice(0, 300) : (chapters[i] ? chapters[i].raw?.slice(0, 300) : undefined),
      cleanedContent: patch.cleaned !== undefined ? patch.cleaned.slice(0, 300) : (chapters[i] ? chapters[i].cleaned?.slice(0, 300) : undefined)
    });
    setChapters(prev=>prev.map((ch,idx)=>idx===i?{...ch,...patch}:ch));
  };
  const cleanOne=(i)=>{
    const rawContent = getChapterRawContent(chapters[i]);
    const ch = chapters[i];
    const cleanTitle = formatChapterTitleForExport(ch.title || '', i, bookTitle);
    const stripped = stripTitleFromText(stripTitleFromText(rawContent, cleanTitle, bookTitle), ch.title, bookTitle);
    updateChapter(i,{cleaned:cleanStoryText(stripped,options,filters)});
  };
  const layoutOne=(i)=>{
    const sourceContent = getChapterSourceContent(chapters[i]);
    const ch = chapters[i];
    const cleanTitle = formatChapterTitleForExport(ch.title || '', i, bookTitle);
    const stripped = stripTitleFromText(stripTitleFromText(sourceContent, cleanTitle, bookTitle), ch.title, bookTitle);
    updateChapter(i,{cleaned:localReflow(stripped, options)});
  };
  const cleanAll=()=>{
    const targets = getSelectedChapters(chapters, selected, true);
    if (!targets.length) {
      return setStatus({type:'warn',message:'Bạn chưa chọn chương nào.'});
    }
    const updatedChapters = chapters.map((ch, idx) => {
      const target = targets.find(t => t.idx === idx);
      if (target) {
        const rawContent = getChapterRawContent(ch);
        const cleanTitle = formatChapterTitleForExport(ch.title || '', idx, bookTitle);
        const stripped = stripTitleFromText(stripTitleFromText(rawContent, cleanTitle, bookTitle), ch.title, bookTitle);
        return {...ch, cleaned: cleanStoryText(stripped, options, filters)};
      }
      return ch;
    });
    setChapters(updatedChapters);
    const loggedTargets = targets.map(({ idx }) => ({
      ch: updatedChapters[idx],
      idx
    }));
    setStatus({type:'ok',message: generateCleanLog(loggedTargets)});
  };
  const addChapter = () => {
    const currentCh = chapters[selected];
    let nextNum = chapters.length + 1;
    if (currentCh) {
      const match = currentCh.title.match(/Ch\xfa\u01a1ng\s+(\d+)/i) || currentCh.title.match(/Chương\s+(\d+)/i) || currentCh.title.match(/Chapter\s+(\d+)/i);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      } else {
        nextNum = selected + 2;
      }
    }
    const newCh = {
      title: `Chương ${nextNum}`,
      url: currentCh ? getNextChapterUrl(currentCh.url) : '',
      raw: '',
      cleaned: '',
      selectedForExport: false
    };
    const nextChapters = [...chapters];
    nextChapters.splice(selected + 1, 0, newCh);
    setChapters(nextChapters);
    setSelected(selected + 1);
    setStatus({type:'ok',message:`Đã tạo chương mới: Chương ${nextNum}`});
  };
  const removeChapter=(i)=>{const next=chapters.filter((_,idx)=>idx!==i);setChapters(next.length?next:[{title:'Chương 1',url:'',raw:'',cleaned:''}]);setSelected(Math.max(0,i-1));};
  const moveChapter=(i,dir)=>{const j=i+dir;if(j<0||j>=chapters.length)return;const next=[...chapters];[next[i],next[j]]=[next[j],next[i]];setChapters(next);setSelected(j);};
  const isAiProcessed = (ch) => {
    return !!(ch && (ch.cleaned?.trim() || ch.aiNaturalAt || ch.aiProcessed));
  };
  const hasExistingContent = (ch) => {
    return !!(ch && (
      (ch.raw && ch.raw.trim().length > 0) || 
      (ch.cleaned && ch.cleaned.trim().length > 0) || 
      ch.aiProcessed || 
      ch.aiNaturalAt
    ));
  };
  const closeBatchFetchModal = (reason) => {
    console.log(`[Pipeline Trace][Close Modal] showBatchFetchModal set to false. Reason: ${reason}`);
    setShowBatchFetchModal(false);
  };
  const closeBatchAiModal = (reason) => {
    console.log(`[Pipeline Trace][Close Modal] showBatchAiModal set to false. Reason: ${reason}`);
    setShowBatchAiModal(false);
  };
  const openBatchFetchModal = () => {
    console.log(`[Pipeline Trace][Open Modal] showBatchFetchModal set to true`);
    setBatchFetchStart(selected + 1);
    setBatchFetchEnd(chapters.length);
    setShowBatchFetchModal(true);
  };
  const openBatchAiModal = () => {
    console.log(`[Pipeline Trace][Open Modal] showBatchAiModal set to true`);
    setBatchAiStart(selected + 1);
    setBatchAiEnd(chapters.length);
    setShowBatchAiModal(true);
  };

  const fetchCurrentUrl=async(forceOverwrite = false)=>{
    const url = current.url.trim();
    if(!url) return setStatus({type:'warn',message:'Bạn cần dán link chương trước.'});
    if(!window.storyAPI?.fetchChapter) return setStatus({type:'warn',message:'Tính năng lấy link chỉ chạy trong app desktop Electron. Nếu đang mở web, hãy chạy start-dev.bat.'});
    
    if (forceOverwrite !== true && hasExistingContent(current)) {
      setOverwriteModal({
        show: true,
        title: 'Phát hiện chương đã có dữ liệu',
        message: 'Chương này đã có nội dung hoặc đã được Clean.\nViệc lấy nội dung sẽ ghi đè dữ liệu hiện tại.',
        confirmText: 'Vẫn lấy lại nội dung',
        cancelText: 'Hủy',
        onConfirm: () => fetchCurrentUrl(true)
      });
      return;
    }

    setFetching(true); setStatus({type:'',message:''});
    const res = await window.storyAPI.fetchChapter(url);
    setFetching(false);
    if(!res.ok) return setStatus({type:'error',message:res.error || 'Không lấy được chương.'});
    
    const crawledTitle = normalizeChapterTitle(res.title || current.title, bookTitle, current.title);
    const strippedText = stripTitleFromText(res.text || '', crawledTitle, bookTitle);
    
    console.log(`[Pipeline Trace][Crawler Fetch] fetchCurrentUrl:`, {
      originalTitle: res.title,
      normalizedTitle: crawledTitle,
      textLengthBeforeStrip: (res.text || '').length,
      textLengthAfterStrip: strippedText.length
    });

    updateChapter(selected,{title:crawledTitle, raw:strippedText, cleaned:cleanStoryText(strippedText, options, filters)});
    setStatus({type:'ok',message:`Đã lấy nội dung chương. Bộ nhận diện: ${res.selector || 'auto'}.`});
  };
  const exportTxt=()=>{
    const text=chapters.map((ch,i)=>{
      const cleanTitle = formatChapterTitleForExport(ch.title || '', i, bookTitle);
      let content = ch.cleaned || ch.raw || '';
      content = stripTitleFromText(content, cleanTitle, bookTitle);
      content = stripTitleFromText(content, ch.title, bookTitle);
      console.log(`[Pipeline Trace][Export TXT] Chapter ${i+1}:`, {
        title: ch.title,
        formattedTitle: cleanTitle,
        rawContent: ch.raw?.slice(0, 200),
        cleanedContent: ch.cleaned?.slice(0, 200),
        isPrependingTitle: true
      });
      return `${cleanTitle}\n\n${content}`;
    }).join('\n\n---\n\n');
    const blob=new Blob([text],{type:'text/plain;charset=utf-8'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=`${slugify(bookTitle)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const exportEpub=async()=>{const ready=chapters.filter(ch=>(ch.cleaned||ch.raw||'').trim());if(!ready.length)return alert('Chưa có nội dung chương.');const blob=await buildEpub({title:bookTitle,author,chapters:ready});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${slugify(bookTitle)}.epub`;a.click();URL.revokeObjectURL(a.href);};
  const exportDocx=async(isSiri=false)=>{const ready=chapters.filter(ch=>(ch.cleaned||ch.raw||'').trim());if(!ready.length)return alert('Chưa có nội dung chương.');try{const blob=await buildDocx({title:bookTitle,author,chapters:ready,isSiri});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${slugify(bookTitle)}${isSiri?'-siri':''}.docx`;a.click();URL.revokeObjectURL(a.href);setStatus({type:'ok',message:`Đã xuất DOCX ${isSiri?'Siri':''}. Bạn có thể upload lên Drive rồi mở bằng Edge/Safari/Google Docs để nghe.`});}catch(err){setStatus({type:'error',message:err?.message||'Xuất DOCX thất bại. Hãy chạy npm install lại để cài package docx.'});}};
  const makePrompt=()=>{const text=(current.cleaned||current.raw||'').trim(); if(!text) return alert('Chưa có nội dung chương.'); const isReAi = !!(current.cleaned?.trim() || current.aiNaturalAt); setAiPrompt(buildCustomPrompt(aiMode,text,filters,1,1,'',promptSettings,promptTemplates,isReAi)); setTab('ai');};
  const copyPrompt=async()=>{await navigator.clipboard.writeText(aiPrompt); setStatus({type:'ok',message:'Đã copy prompt.'});};

  const updateApi=(patch)=>setApiSettings(prev=>({...prev,...patch}));
  const getAvailableKeyIndex=(keys, preferred=0, cooldowns=keyCooldowns)=>{
    const now = Date.now();
    for (let offset=0; offset<keys.length; offset++) {
      const idx = (preferred + offset) % keys.length;
      if (!cooldowns[keys[idx]] || cooldowns[keys[idx]] <= now) return idx;
    }
    return -1;
  };
  const markKeyCooldown=(key)=>{
    const until = Date.now() + Number(apiSettings.cooldownMs || 90000);
    setKeyCooldowns(prev=>({...prev,[key]:until}));
    return until;
  };
  const callGeminiWithPool=async(prompt, chunkLabel, startIndex=0)=>{
    const keys = activeKeysFromPool(apiPool);
    if (!keys.length) throw new Error('Chưa nhập Gemini API key.');
    if (!window.storyAPI?.geminiGenerate) throw new Error('Gemini API chỉ chạy trong app desktop Electron.');
    let preferred = startIndex;
    let lastError = '';
    for (let attempt=0; attempt<=Number(apiSettings.maxRetries || 2); attempt++) {
      const idx = getAvailableKeyIndex(keys, preferred);
      if (idx < 0) {
        const waits = keys.map(k=>keyCooldowns[k]).filter(Boolean).map(t=>Math.max(1000,t-Date.now()));
        const waitMs = waits.length ? Math.min(...waits) : Number(apiSettings.cooldownMs || 90000);
        setAiProgress(p=>({...p,message:`Tất cả key đang nghỉ. Đợi ${Math.ceil(waitMs/1000)}s...`}));
        await sleep(waitMs);
        continue;
      }
      const key = keys[idx];
      setAiProgress(p=>({...p,message:`${chunkLabel} — dùng key #${idx+1}`}));
      const res = await window.storyAPI.geminiGenerate({apiKey:key, model:apiSettings.model, prompt});
      if (res.ok) {
        setApiPool(prev=>prev.map(k=>k.key===key?{...k,lastStatus:'active',totalSuccess:(k.totalSuccess||0)+1,totalChars:(k.totalChars||0)+prompt.length,lastUsedAt:new Date().toISOString(),lastError:''}:k));
        return { text: res.text, nextIndex: (idx+1)%keys.length };
      }
      lastError = friendlyGeminiError(res, apiSettings.model);
      setApiPool(prev=>prev.map(k=>k.key===key?{...k,lastStatus:isRateLimitError(res)?'limited':'error',totalFail:(k.totalFail||0)+1,lastUsedAt:new Date().toISOString(),lastError:lastError.slice(0,180)}:k));
      if (isRateLimitError(res)) {
        markKeyCooldown(key);
        preferred = (idx+1)%keys.length;
        await sleep(1200);
        continue;
      }
      if (attempt < Number(apiSettings.maxRetries || 2)) {
        await sleep(2000 + attempt * 1500);
        preferred = (idx+1)%keys.length;
        continue;
      }
    }
    throw new Error(lastError || 'Gemini API xử lý thất bại.');
  };

  const humanizeChapter = async(i, isBatch=false, forceReAi=false)=>{
    let source = (forceReAi ? chapters[i].raw : (chapters[i].cleaned || chapters[i].raw || '')).trim();
    if(!source) {
      setStatus({type:'warn',message:`Chương ${i+1} chưa có nội dung.`});
      return false;
    }
    const ch = chapters[i];
    const cleanTitle = formatChapterTitleForExport(ch.title || '', i, bookTitle);
    source = stripTitleFromText(stripTitleFromText(source, cleanTitle, bookTitle), ch.title, bookTitle);
    if(aiRunning && !isBatch) return false;
    let localCleaned = cleanStoryText(source, options, filters);
    if (!localCleaned.trim()) {
      localCleaned = source;
    }
    const protector = protectTerms(localCleaned, filters.preserveTerms || '');
    const chunks = splitTextIntoChunks(protector.text, Number(apiSettings.chunkSize || 6000));
    if(!chunks.length) return false;
    
    if (!isBatch) {
      setAiRunning(true);
    }
    setAiProgress({done:0,total:chunks.length,message:`Bắt đầu AI humanize chương ${i+1}...`});
    setStatus({type:'warn',message:`Đang AI xử lý Natural VN ${chunks.length} chunk. App sẽ tự xoay key và nghỉ giữa request.`});
    try {
      let outputs=[];
      let keyIndex=0;
      let previousTail='';
      for (let c=0;c<chunks.length;c++) {
        if (cancelRef.current) throw new Error('USER_CANCELLED');
        const isReAiVal = forceReAi || !!(chapters[i].cleaned?.trim() || chapters[i].aiNaturalAt);
        const prompt = buildCustomPrompt(aiMode, chunks[c], filters, c+1, chunks.length, previousTail, promptSettings, promptTemplates, isReAiVal);
        
        console.log(`[Pipeline Trace][AI Cleaner Input] Chapter ${i+1} Chunk ${c+1}/${chunks.length}:`, {
          title: chapters[i].title,
          rawContent: chunks[c].slice(0, 300)
        });

        const result = await callGeminiWithPool(prompt, `Chương ${i+1} Chunk ${c+1}/${chunks.length}`, keyIndex);
        keyIndex = result.nextIndex;
        const fixed = (result.text || '').trim();
        
        console.log(`[Pipeline Trace][AI Cleaner Output] Chapter ${i+1} Chunk ${c+1}/${chunks.length} response:`, {
          title: chapters[i].title,
          cleanedContent: fixed.slice(0, 300)
        });

        outputs.push(fixed);
        previousTail = fixed.slice(-700);
        setAiProgress({done:c+1,total:chunks.length,message:`Chương ${i+1}: Đã xong ${c+1}/${chunks.length} chunk`});
        if (c < chunks.length-1) await sleep(Number(apiSettings.delayMs || 4500));
      }
      const merged = protector.restore(outputs.join('\n\n')).replace(/\n{3,}/g,'\n\n').trim();
      console.log(`[Pipeline Trace][AI Cleaner Merged] Chapter ${i+1}:`, {
        title: chapters[i].title,
        cleanedContent: merged.slice(0, 300)
      });
      updateChapter(i,{cleaned:merged, aiNaturalAt: new Date().toISOString(), aiProcessed: true});
      setStatus({type:'ok',message:`AI đã xử lý Natural VN xong chương ${i+1}.`});
      return true;
    } catch(err) {
      setStatus({type:'error',message:`Chương ${i+1} lỗi: ${err?.message || 'AI xử lý thất bại.'}`});
      return false;
    } finally {
      if (!isBatch) {
        setAiRunning(false);
      }
    }
  };

  const humanizeAll = async()=>{
    if(aiRunning) return;
    for (let i=0;i<chapters.length;i++) {
      const hasText = (chapters[i].cleaned || chapters[i].raw || '').trim();
      if(!hasText) continue;
      setSelected(i);
      await humanizeChapter(i);
      await sleep(Number(apiSettings.delayMs || 4500));
    }
  };

  const loadGeminiModels=async()=>{
    const keys = activeKeysFromPool(apiPool);
    if(!keys.length) return setStatus({type:'warn',message:'Bạn cần nhập ít nhất 1 Gemini API key để lấy danh sách model.'});
    if(!window.storyAPI?.geminiListModels) return setStatus({type:'warn',message:'Lấy model chỉ chạy trong app desktop Electron. Hãy chạy start-dev.bat.'});
    setAiRunning(true);
    setAiProgress({done:0,total:1,message:'Đang lấy danh sách model từ key đầu...'});
    try {
      const res = await window.storyAPI.geminiListModels({apiKey: keys[0]});
      if(!res.ok) return setStatus({type:'error',message:res.error || 'Không lấy được danh sách model.'});
      const models = Array.isArray(res.models) ? res.models : [];
      if(!models.length) return setStatus({type:'error',message:'Key này không trả về model nào hỗ trợ generateContent. Hãy tạo key AI Studio khác hoặc kiểm tra project.'});
      setModelOptions(models);
      const currentStillExists = models.some(m => m.name === apiSettings.model);
      const preferred = models.find(m => m.name.includes('2.5-flash-lite')) || models.find(m => m.name.includes('2.5-flash')) || models.find(m => m.name.includes('flash')) || models[0];
      if(!currentStillExists && preferred?.name) updateApi({model: preferred.name});
      setAiProgress({done:1,total:1,message:'Đã lấy danh sách model'});
      setStatus({type:'ok',message:`Đã lấy ${models.length} model từ key. Model đang chọn: ${currentStillExists ? apiSettings.model : preferred.name}.`});
    } finally {
      setAiRunning(false);
    }
  };

  const testGeminiKey=async()=>{
    const keys = activeKeysFromPool(apiPool);
    if(!keys.length) return setStatus({type:'warn',message:'Bạn chưa nhập API key.'});
    if(!window.storyAPI?.geminiGenerate) return setStatus({type:'warn',message:'Test API chỉ chạy trong app desktop Electron.'});
    setAiRunning(true);
    try{
      const res = await window.storyAPI.geminiGenerate({apiKey:keys[0], model:apiSettings.model, prompt:'Trả lời đúng 1 từ: OK'});
      if(res.ok) setStatus({type:'ok',message:`Key #1 OK với model ${apiSettings.model}.`});
      else setStatus({type:'error',message:friendlyGeminiError(res, apiSettings.model)});
    } finally { setAiRunning(false); }
  };
  
  const testAllGeminiKeys=async()=>{
    const keys = activeKeysFromPool(apiPool);
    if(!keys.length) return setStatus({type:'warn',message:'Bạn chưa nhập API key.'});
    if(!window.storyAPI?.geminiGenerate) return setStatus({type:'warn',message:'Test API chỉ chạy trong app desktop Electron.'});
    cancelRef.current = false;
    setCancelRequested(false);
    setAiRunning(true);
    let ok=0, fail=0;
    try{
      for(let i=0;i<keys.length;i++){
        if (cancelRef.current) {
          throw new Error('USER_CANCELLED');
        }
        setAiProgress({done:i,total:keys.length,message:`Đang test key #${i+1}/${keys.length} với ${apiSettings.model}...`});
        const res = await window.storyAPI.geminiGenerate({apiKey:keys[i], model:apiSettings.model, prompt:'Trả lời đúng 1 từ: OK'});
        if (cancelRef.current) {
          throw new Error('USER_CANCELLED');
        }
        const keyValue = keys[i];
        if(res.ok) {
          ok++;
          setApiPool(prev=>prev.map(k=>k.key===keyValue?{...k,lastStatus:'active',totalSuccess:(k.totalSuccess||0)+1,lastUsedAt:new Date().toISOString(),lastError:''}:k));
        } else {
          fail++;
          const label = isRateLimitError(res) ? 'Rate-limit/quota' : 'Lỗi';
          setApiPool(prev=>prev.map(k=>k.key===keyValue?{...k,lastStatus:isRateLimitError(res)?'limited':'error',totalFail:(k.totalFail||0)+1,lastUsedAt:new Date().toISOString(),lastError:friendlyGeminiError(res, apiSettings.model).slice(0,180)}:k));
          if(isRateLimitError(res)) markKeyCooldown(keyValue);
        }
        if(i<keys.length-1) await sleep(Math.max(1500, Number(apiSettings.delayMs || 6500)));
      }
      setAiProgress({done:keys.length,total:keys.length,message:'Test key hoàn tất'});
      setStatus({type: ok ? 'ok' : 'error', message:`Test xong model ${apiSettings.model}: ${ok} key OK, ${fail} key lỗi. Nếu model not found/quota = 0, bấm “Lấy model từ key” hoặc dùng key/project khác.`});
    } finally { setAiRunning(false); }
  };

  const importKeys=()=>{
    const items = parseImportedKeyLines(importKeyText, apiPool.length);
    if(!items.length) return setStatus({type:'warn',message:'Chưa có key để import.'});
    setApiPool(prev=>uniqueKeyPool([...prev, ...items]));
    setImportKeyText('');
    setStatus({type:'ok',message:`Đã import ${items.length} key. Key đã được ẩn trong danh sách.`});
  };
  const clearCache=()=>{
    localStorage.removeItem(CACHE_KEY);
    setStatus({type:'ok',message:'Đã xóa cache lưu tạm trên máy.'});
  };
  
  const savePrompts = async (newTemplates) => {
    setPromptTemplates(newTemplates);
    localStorage.setItem('story-cleaner-prompts', JSON.stringify(newTemplates));
    if (window.storyAPI?.saveSettings) {
      const res = await window.storyAPI.saveSettings(newTemplates);
      if (!res.ok) {
        console.error('Lưu settings.json thất bại:', res.error);
      }
    }
    setStatus({ type: 'ok', message: 'Đã lưu các prompt thành công.' });
  };

  const handleExportPrompts = () => {
    const blob = new Blob([JSON.stringify(promptTemplates, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'story-cleaner-prompts.json';
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus({ type: 'ok', message: 'Đã xuất file story-cleaner-prompts.json.' });
  };

  const handleImportPrompts = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.aiNaturalVn || parsed.storyCleaner || parsed.reAi) {
          savePrompts({
            aiNaturalVn: parsed.aiNaturalVn || promptTemplates.aiNaturalVn,
            storyCleaner: parsed.storyCleaner || promptTemplates.storyCleaner,
            reAi: parsed.reAi || promptTemplates.reAi
          });
          setStatus({ type: 'ok', message: 'Đã nhập và lưu prompt pack thành công.' });
        } else {
          setStatus({ type: 'error', message: 'File prompt pack không đúng định dạng.' });
        }
      } catch (err) {
        setStatus({ type: 'error', message: 'Lỗi đọc file JSON.' });
      }
    };
    reader.readAsText(file);
  };

  const handleApplyPreset = (presetKey) => {
    if (!presetKey) return;
    if (confirm(`Bạn muốn tải preset "${presetKey === 'default' ? 'Default' : presetKey === 'naturalVn' ? 'Natural VN' : 'Strict Original'}"? Các prompt hiện tại chưa lưu sẽ bị ghi đè.`)) {
      const selectedPreset = PROMPT_PRESETS[presetKey];
      setPromptTemplates(selectedPreset);
      setEditingPromptText(selectedPreset[editingPromptKey]);
      setSelectedPresetKey('');
      setStatus({ type: 'ok', message: `Đã tải preset. Bấm 'Lưu Prompt' để lưu lại.` });
    } else {
      setSelectedPresetKey('');
    }
  };
  
  const saveProject=()=>downloadJson(`${slugify(bookTitle)}-story-project.json`, {books,bookIndex,bookTitle,author,chapters,filters,options,apiSettings,apiPool,promptSettings,version:'v9-session'});

  const aiReportData = useMemo(() => {
    const total = chapters.length;
    const successList = [];
    const errorList = [];
    const pendingList = [];
    const warningList = [];
    
    const isAiSuccess = (ch) => !!(ch.aiNaturalAt || ch.aiProcessed || (ch.cleaned && ch.cleaned.trim() && ch.cleaned !== ch.raw));
    const isAiError = (ch) => !!ch.aiError;
    const hasWarning = (ch) => {
      const text = ch.cleaned || ch.raw || '';
      if (!text) return false;
      if (/[\u4e00-\u9fa5]/.test(text)) return true;
      if (/\?{2,}/.test(text) || /!{2,}/.test(text) || /[!?]{2,}/.test(text)) return true;
      return false;
    };
    
    chapters.forEach((ch, idx) => {
      const item = {
        idx,
        title: ch.title || `Chương ${idx + 1}`,
        rawLen: (ch.raw || '').length,
        aiLen: (ch.cleaned || '').length,
        error: ch.aiError || '',
        errorType: ch.aiErrorType || 'Lỗi không xác định',
        errorAt: ch.aiErrorAt || ''
      };
      
      if (isAiSuccess(ch)) {
        successList.push(item);
      } else if (isAiError(ch)) {
        errorList.push(item);
      } else {
        pendingList.push(item);
      }
      
      if (hasWarning(ch)) {
        warningList.push(item);
      }
    });
    
    return {
      total,
      successList,
      errorList,
      pendingList,
      warningList
    };
  }, [chapters]);

  const getReportText = (format = 'txt') => {
    const data = aiReportData;
    let output = '';
    if (format === 'md') {
      output += `# BÁO CÁO TIẾN ĐỘ AI NATURAL - ${bookTitle.toUpperCase()}\n\n`;
      output += `*   **Tổng số chương:** ${data.total}\n`;
      output += `*   **Đã AI Natural thành công:** ${data.successList.length}\n`;
      output += `*   **Chương bị lỗi AI:** ${data.errorList.length}\n`;
      output += `*   **Chương chưa AI:** ${data.pendingList.length}\n`;
      output += `*   **Có cảnh báo:** ${data.warningList.length}\n\n`;
      
      output += `## DANH SÁCH CHƯƠNG ĐÃ AI THÀNH CÔNG\n\n`;
      if (data.successList.length === 0) {
        output += `*(Chưa có chương nào)*\n`;
      } else {
        output += `| Số thứ tự | Tên chương | Ký tự sau AI |\n`;
        output += `| --- | --- | --- |\n`;
        data.successList.forEach((item) => {
          output += `| ${item.idx + 1} | ${item.title} | ${item.aiLen} |\n`;
        });
      }
      
      output += `\n## DANH SÁCH CHƯƠNG LỖI AI\n\n`;
      if (data.errorList.length === 0) {
        output += `*(Không có chương nào bị lỗi)*\n`;
      } else {
        output += `| Số thứ tự | Tên chương | Loại lỗi | Chi tiết lỗi |\n`;
        output += `| --- | --- | --- | --- |\n`;
        data.errorList.forEach((item) => {
          output += `| ${item.idx + 1} | ${item.title} | ${item.errorType} | ${item.error} |\n`;
        });
      }
    } else {
      output += `BÁO CÁO TIẾN ĐỘ AI NATURAL - ${bookTitle.toUpperCase()}\n`;
      output += `=========================================\n\n`;
      output += `Tổng số chương: ${data.total}\n`;
      output += `Đã AI Natural thành công: ${data.successList.length}\n`;
      output += `Chương bị lỗi AI: ${data.errorList.length}\n`;
      output += `Chương chưa AI: ${data.pendingList.length}\n`;
      output += `Có cảnh báo: ${data.warningList.length}\n\n`;
      
      output += `DANH SÁCH CHƯƠNG ĐÃ AI THÀNH CÔNG:\n`;
      if (data.successList.length === 0) {
        output += `(Chưa có chương nào)\n`;
      } else {
        data.successList.forEach((item) => {
          output += `- Chương ${item.idx + 1}: ${item.title} (${item.aiLen} ký tự)\n`;
        });
      }
      output += `\nDANH SÁCH CHƯƠNG LỖI AI:\n`;
      if (data.errorList.length === 0) {
        output += `(Không có chương nào bị lỗi)\n`;
      } else {
        data.errorList.forEach((item) => {
          output += `- Chương ${item.idx + 1}: ${item.title} - ${item.errorType}: ${item.error}\n`;
        });
      }
    }
    return output;
  };

  const importProject=async(file)=>{
    if(!file) return;
    const data=JSON.parse(await file.text());
    if(data.bookTitle) setBookTitle(data.bookTitle);
    if(Array.isArray(data.books) && data.books.length){ setBooks(data.books); setBookIndex(Number.isInteger(data.bookIndex)?data.bookIndex:0); } else { if(typeof data.author==='string') setAuthor(data.author); if(Array.isArray(data.chapters) && data.chapters.length) setChapters(data.chapters); }
    if(data.filters) setFilters({...DEFAULT_FILTERS, ...data.filters});
    if(data.options) setOptions(prev=>({...prev, ...data.options}));
    if(data.apiSettings) setApiSettings(prev=>({...prev, ...data.apiSettings, apiKeys:undefined}));
    if(data.promptSettings) setPromptSettings(prev=>({...prev, ...data.promptSettings}));
    if(Array.isArray(data.apiPool)) setApiPool(data.apiPool);
    setStatus({type:'ok',message:'Đã import project/cache để làm tiếp.'});
  };

  const importEpub=async(file)=>{
    if(!file) return;
    try{
      const targetBookTitle = (!bookTitle || bookTitle==='Truyện đã dọn') ? file.name.replace(/\.epub$/i,'') : bookTitle;
      const imported = await importEpubFile(file, targetBookTitle);
      if(!imported.length) return setStatus({type:'error',message:'Không đọc được chương nào từ EPUB này.'});
      setChapters(imported);
      setSelected(0);
      if(!bookTitle || bookTitle==='Truyện đã dọn') setBookTitle(targetBookTitle);
      setStatus({type:'ok',message:`Đã import ${imported.length} chương từ EPUB cũ.`});
    }catch(err){ setStatus({type:'error',message:err?.message || 'Import EPUB thất bại.'}); }
  };

  const apiKeys = activeKeysFromPool(apiPool);
  const cooledCount = apiKeys.filter(k => keyCooldowns[k] && keyCooldowns[k] > Date.now()).length;
  const keySummary = useMemo(()=>{
    const totalKeys = apiPool.length;
    const activeKeys = apiPool.filter(k=>k.enabled!==false).length;
    const limitedKeys = apiPool.filter(k=>k.lastStatus==='limited').length;
    const errorKeys = apiPool.filter(k=>['error','invalid'].includes(k.lastStatus)).length;
    const totalSuccess = apiPool.reduce((a,k)=>a+(k.totalSuccess||0),0);
    const totalFail = apiPool.reduce((a,k)=>a+(k.totalFail||0),0);
    return {totalKeys,activeKeys,limitedKeys,errorKeys,totalSuccess,totalFail};
  },[apiPool]);  const visibleKeys = useMemo(()=>apiPool.filter(k=>{
    const q=keySearch.trim().toLowerCase();
    const matchText = !q || `${k.label} ${maskKey(k.key)} ${k.lastStatus} ${k.lastError||''}`.toLowerCase().includes(q);
    const matchStatus = keyStatusFilter==='all' || (keyStatusFilter==='enabled' ? k.enabled!==false : k.lastStatus===keyStatusFilter);
    return matchText && matchStatus;
  }),[apiPool,keySearch,keyStatusFilter]);

  const totalPages = useMemo(() => {
    const limit = keysPerPage === 'all' ? visibleKeys.length : (parseInt(keysPerPage) || 10);
    if (limit <= 0) return 1;
    return Math.ceil(visibleKeys.length / limit) || 1;
  }, [visibleKeys, keysPerPage]);

  useEffect(() => {
    if (keyPage > totalPages) {
      setKeyPage(totalPages);
    } else if (keyPage < 1) {
      setKeyPage(1);
    }
  }, [totalPages, keyPage]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        console.log('[Pipeline Trace][keydown Escape] Dismissing active modals');
        if (showAiReport) setShowAiReport(false);
        else if (showBulkDeleteModal) setShowBulkDeleteModal(false);
        else if (showBatchFetchModal) closeBatchFetchModal('escape');
        else if (showBatchAiModal) closeBatchAiModal('escape');
        else if (overwriteModal.show) setOverwriteModal({ show: false });
        else if (batchOverwriteModal.show) setBatchOverwriteModal({ show: false, cleanedChapters: [] });
        else if (showBatchExportModal) setShowBatchExportModal(false);
        else if (showOptionsPopup) setShowOptionsPopup(false);
        else if (showDocxDropdown) setShowDocxDropdown(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAiReport, showBulkDeleteModal, showBatchFetchModal, showBatchAiModal, overwriteModal, batchOverwriteModal, showBatchExportModal, showOptionsPopup, showDocxDropdown]);


  const paginatedKeys = useMemo(() => {
    const limit = keysPerPage === 'all' ? visibleKeys.length : (parseInt(keysPerPage) || 10);
    if (limit <= 0) return [];
    const maxPage = Math.max(1, Math.ceil(visibleKeys.length / limit));
    const activePage = Math.min(keyPage, maxPage);
    const startIndex = (activePage - 1) * limit;
    return visibleKeys.slice(startIndex, startIndex + limit);
  }, [visibleKeys, keyPage, keysPerPage]);


  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="/icon.png" alt="Story Cleaner" className="brandLogo" />
            <b style={{ fontSize: '20px' }}>Story Cleaner</b>
          </div>
          {lastAutoSaved && (
            <span className="autosave" style={{ fontSize: '11px', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '4px', margin: '4px 0 0 0', padding: '2px 6px', background: '#f1f5f9', borderRadius: '6px', whiteSpace: 'nowrap' }}>
              <Database size={11} /> Auto saved {lastAutoSaved}
            </span>
          )}
        </div>
        <button className="newBookBtn" onClick={addBook}><Plus size={16}/> Tạo truyện mới</button>
        <div className="bookTree">
          {books.map((book, bIdx) => {
            const isOpen = !collapsedBooks[bIdx];
            const chs = book.chapters || [];
            if (!isOpen) {
              return (
                <div key={book.id || bIdx} className={`bookNode collapsed ${bIdx === bookIndex ? 'activeBook' : ''}`}>
                  <button className="bookTitleBtn" onClick={() => selectBook(bIdx)} title={book.title || `Truyện ${bIdx + 1}`} style={{ width: '100%', textAlign: 'left', fontWeight: 'bold' }}>
                    <span className="bookTitleText">{book.title || `Truyện ${bIdx + 1}`} ({chs.length} chương)</span>
                  </button>
                </div>
              );
            }

            const filteredChapters = chs.map((ch, i) => ({ ch, originalIdx: i })).filter(({ ch }) => {
              if (chapterFilter === 'success') {
                return !!(ch.aiNaturalAt || ch.aiProcessed || (ch.cleaned && ch.cleaned.trim() && ch.cleaned !== ch.raw));
              }
              if (chapterFilter === 'error') {
                return !!ch.aiError;
              }
              if (chapterFilter === 'pending') {
                const isSuccess = !!(ch.aiNaturalAt || ch.aiProcessed || (ch.cleaned && ch.cleaned.trim() && ch.cleaned !== ch.raw));
                const isError = !!ch.aiError;
                return !isSuccess && !isError;
              }
              if (chapterFilter === 'warning') {
                const text = ch.cleaned || ch.raw || '';
                if (!text) return false;
                if (/[\u4e00-\u9fa5]/.test(text)) return true;
                if (/\?{2,}/.test(text) || /!{2,}/.test(text) || /[!?]{2,}/.test(text)) return true;
                return false;
              }
              return true;
            });

            return (
              <div key={book.id || bIdx} className={`bookNode open ${bIdx === bookIndex ? 'activeBook' : ''}`}>
                <div className="bookNodeHeader" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                  <button className="bookTitleBtn" onClick={() => toggleBookCollapsed(bIdx)} title={book.title || `Truyện ${bIdx + 1}`} style={{ fontWeight: 'bold', width: '100%', textAlign: 'left', padding: '4px 6px' }}>
                    <span className="bookTitleText">{book.title || `Truyện ${bIdx + 1}`} ({chs.length} chương)</span>
                  </button>
                  <div className="bookNodeActions" style={{ display: 'none' }}>
                    <button 
                      onClick={addChapter} 
                      style={{ 
                        padding: '4px 8px', 
                        fontSize: '11.5px', 
                        whiteSpace: 'nowrap', 
                        borderRadius: '6px', 
                        height: '28px', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        border: '1px solid #cbd5e1', 
                        backgroundColor: '#ffffff',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        margin: 0
                      }}
                    >
                      + Chương tiếp
                    </button>
                    <label style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '4px', 
                      cursor: 'pointer', 
                      fontSize: '11.5px', 
                      userSelect: 'none', 
                      border: '1px solid #cbd5e1', 
                      borderRadius: '6px', 
                      padding: '4px 6px', 
                      backgroundColor: '#f8fafc', 
                      fontWeight: 'bold', 
                      margin: 0, 
                      whiteSpace: 'nowrap', 
                      flexShrink: 0, 
                      height: '28px',
                      flexWrap: 'nowrap'
                    }}>
                      <input 
                        type="checkbox" 
                        style={{ width: '14px', height: '14px', margin: 0, flexShrink: 0, display: 'inline-block', cursor: 'pointer' }} 
                        checked={filteredChapters.length > 0 && filteredChapters.every(({ ch }) => ch.selectedForExport === true)} 
                        onChange={() => {
                          const allSelected = filteredChapters.every(({ ch }) => ch.selectedForExport === true);
                          const filteredIndices = filteredChapters.map(({ originalIdx }) => originalIdx);
                          setBooks(prev => prev.map((x, bookI) => {
                            if (bookI === bIdx) {
                              return {
                                ...x,
                                chapters: x.chapters.map((c, chI) => 
                                  filteredIndices.includes(chI) ? { ...c, selectedForExport: !allSelected } : c
                                )
                              };
                            }
                            return x;
                          }));
                        }} 
                      />
                      <span style={{ fontSize: '11.5px', fontWeight: 'bold' }}>All</span>
                    </label>
                  </div>
                </div>

                <div className="chapterList treeChapters" style={{ marginTop: '8px' }}>
                  {chapterFilter !== 'all' && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 8px',
                      backgroundColor: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '6px',
                      fontSize: '11px',
                      marginBottom: '8px',
                      marginLeft: '-15px',
                      marginRight: 0,
                      width: 'calc(100% + 15px)',
                      boxSizing: 'border-box',
                      color: '#1e40af'
                    }}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Lọc: <strong>{
                        chapterFilter === 'success' ? 'AI Thành Công' :
                        chapterFilter === 'error' ? 'AI Lỗi' :
                        chapterFilter === 'pending' ? 'Chưa AI' :
                        chapterFilter === 'warning' ? 'Cảnh Báo' : ''
                      }</strong> ({filteredChapters.length} ch)</span>
                      <button 
                        onClick={() => setChapterFilter('all')} 
                        style={{
                          border: 0,
                          background: 'transparent',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: '11.5px',
                          padding: '0 4px',
                          fontWeight: 'bold',
                          display: 'inline'
                        }}
                      >
                        [Bỏ lọc]
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', height: '24px', marginLeft: '-15px', width: 'calc(100% + 15px)' }}>
                    <div style={{ width: '25px', height: '2px', backgroundColor: '#dbeafe', flexShrink: 0 }} />
                    <div className="tree-action-row" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
                      <button 
                        onClick={addChapter} 
                        className="softPrimary tree-continue-btn"
                        style={{ 
                          padding: '2px 8px', 
                          fontSize: '11px', 
                          borderRadius: '6px', 
                          height: '22px', 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          margin: 0,
                          border: '1px solid #bfdbfe'
                        }}
                      >
                        + Chương tiếp
                      </button>
                      <div className="tree-all-simple" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        <input 
                          type="checkbox" 
                          checked={filteredChapters.length > 0 && filteredChapters.every(({ ch }) => ch.selectedForExport === true)} 
                          onChange={() => {
                            const allSelected = filteredChapters.every(({ ch }) => ch.selectedForExport === true);
                            const filteredIndices = filteredChapters.map(({ originalIdx }) => originalIdx);
                            setBooks(prev => prev.map((x, bookI) => {
                              if (bookI === bIdx) {
                                return {
                                  ...x,
                                  chapters: x.chapters.map((c, chI) => 
                                    filteredIndices.includes(chI) ? { ...c, selectedForExport: !allSelected } : c
                                  )
                                };
                              }
                              return x;
                            }));
                          }} 
                          style={{ margin: 0, width: '14px', height: '14px' }}
                        />
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#111827' }}>All</span>
                      </div>
                      <button 
                        onClick={() => setShowBulkDeleteModal(true)} 
                        disabled={filteredChapters.filter(({ ch }) => ch.selectedForExport === true).length === 0}
                        className="dangerSoft"
                        style={{ 
                          padding: '2px 8px', 
                          fontSize: '11px', 
                          borderRadius: '6px', 
                          height: '22px', 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          cursor: filteredChapters.filter(({ ch }) => ch.selectedForExport === true).length === 0 ? 'not-allowed' : 'pointer',
                          fontWeight: 'bold',
                          margin: 0,
                          border: '1px solid #fecaca',
                          backgroundColor: filteredChapters.filter(({ ch }) => ch.selectedForExport === true).length === 0 ? '#f1f5f9' : '#fef2f2',
                          color: filteredChapters.filter(({ ch }) => ch.selectedForExport === true).length === 0 ? '#94a3b8' : '#b91c1c'
                        }}
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                  {filteredChapters.map(({ ch, originalIdx }) => {
                    const isActive = bIdx === bookIndex && originalIdx === selected;
                    return (
                      <div key={originalIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '36px', marginLeft: '-15px' }}>
                        <div style={{ width: '25px', height: '2px', backgroundColor: '#dbeafe', flexShrink: 0 }} />
                        <button className={isActive ? 'chapter active' : 'chapter'} onClick={() => {
                          selectBook(bIdx);
                          setSelected(originalIdx);
                        }} style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto', border: '1px solid #dbeafe', textAlign: 'left', padding: '6px 10px', height: '32px', minWidth: 0, overflow: 'hidden' }}>
                          <input 
                            type="checkbox" 
                            checked={ch.selectedForExport === true} 
                            onClick={e => e.stopPropagation()} 
                            onChange={e => {
                              setBooks(prev => prev.map((x, bookI) => {
                                if (bookI === bIdx) {
                                  return {
                                    ...x,
                                    chapters: x.chapters.map((c, chI) => chI === originalIdx ? { ...c, selectedForExport: e.target.checked } : c)
                                  };
                                }
                                  return x;
                              }));
                            }} 
                            style={{ width: '14px', height: '14px', margin: 0, flexShrink: 0, cursor: 'pointer' }} 
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 800, fontSize: '13px', whiteSpace: 'nowrap' }}>
                              <span>Chương {ch.number !== undefined && ch.number !== null ? ch.number : (originalIdx + 1)}</span>
                              <span style={{ color: '#94a3b8', fontSize: '10.5px', fontWeight: 'normal', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                ({formatCharCount(ch)} ký tự)
                              </span>
                            </span>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <main className="main">
        <section className="topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'nowrap' }}>
          <div className="tabs" style={{ display: 'flex', gap: '6px', alignItems: 'center', margin: 0, flexWrap: 'nowrap' }}>
            <button className={tab === 'editor' ? 'on' : ''} onClick={() => setTab('editor')} style={{ height: '34px', padding: '6px 12px', borderRadius: '8px', fontSize: '13px' }}>Biên tập</button>
            <button className={tab === 'filters' ? 'on' : ''} onClick={() => setTab('filters')} style={{ height: '34px', padding: '6px 12px', borderRadius: '8px', fontSize: '13px' }}><ShieldCheck size={14} /> Bộ lọc từ</button>
            <button className={tab === 'ai' ? 'on' : ''} onClick={() => setTab('ai')} style={{ height: '34px', padding: '6px 12px', borderRadius: '8px', fontSize: '13px' }}><Sparkles size={14} /> Gemini AI</button>
            <button className={tab === 'prompts' ? 'on' : ''} onClick={() => setTab('prompts')} style={{ height: '34px', padding: '6px 12px', borderRadius: '8px', fontSize: '13px' }}><Sliders size={14} /> AI Prompt Manager</button>
            <button className="reportTabBtn" onClick={() => setShowAiReport(true)} style={{ height: '34px', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}><FileText size={14} /> Báo cáo AI</button>
          </div>
          <div className="actions" style={{ display: 'flex', gap: '6px', alignItems: 'center', margin: 0, flexWrap: 'nowrap', flexShrink: 0 }}>
            <input ref={projectInputRef} type="file" accept=".json" hidden onChange={e => importProject(e.target.files?.[0])} />
            <button onClick={() => projectInputRef.current?.click()} style={{ height: '34px', padding: '6px 10px', borderRadius: '8px', fontSize: '13px', whiteSpace: 'nowrap' }}><Upload size={14} /> Import cache</button>
            <button onClick={saveProject} style={{ height: '34px', padding: '6px 10px', borderRadius: '8px', fontSize: '13px', whiteSpace: 'nowrap' }}><Save size={14} /> Export backup</button>
            
            <div style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
              <button className="primary" onClick={() => setShowDocxDropdown(!showDocxDropdown)} style={{ height: '34px', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', whiteSpace: 'nowrap' }}>
                DOCX <span style={{ fontSize: '10px' }}>▼</span>
              </button>
              {showDocxDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '4px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                  zIndex: 1000,
                  minWidth: '180px',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '6px 0'
                }}>
                  <button style={{ border: 0, borderRadius: 0, justifyContent: 'flex-start', padding: '10px 16px', background: 'transparent', width: '100%' }} onClick={() => { setShowDocxDropdown(false); exportDocx(false); }}>DOCX Thường</button>
                  <button style={{ border: 0, borderRadius: 0, justifyContent: 'flex-start', padding: '10px 16px', background: 'transparent', width: '100%' }} onClick={() => { setShowDocxDropdown(false); exportDocx(true); }}>DOCX Siri</button>
                  <button style={{ border: 0, borderRadius: 0, justifyContent: 'flex-start', padding: '10px 16px', background: 'transparent', width: '100%' }} onClick={() => { setShowDocxDropdown(false); setExportIsSiri(false); setExportStartCh(1); setExportEndCh(Math.min(10, chapters.length)); updateDefaultFilename(1, Math.min(10, chapters.length)); setShowBatchExportModal(true); }}>DOCX Theo Tập</button>
                  <button style={{ border: 0, borderRadius: 0, justifyContent: 'flex-start', padding: '10px 16px', background: 'transparent', width: '100%' }} onClick={() => { setShowDocxDropdown(false); setExportIsSiri(true); setExportStartCh(1); setExportEndCh(Math.min(10, chapters.length)); updateDefaultFilename(1, Math.min(10, chapters.length)); setShowBatchExportModal(true); }}>DOCX Theo Tập Siri</button>
                </div>
              )}
            </div>
          </div>
        </section>

        {status.message && (
          <div className={`status ${status.type}`} style={{ padding: '8px 12px', minHeight: '34px', borderRadius: '10px', fontSize: '13px', margin: '4px 0' }}>
            {status.type === 'ok' ? <CheckCircle2 size={16} /> : status.type === 'error' ? <AlertTriangle size={16} /> : <RefreshCcw size={16} className={(aiRunning || fetching) ? 'spin' : ''} />}
            <div style={{ flex: 1 }}>{status.message}</div>
          </div>
        )}

        {(aiRunning || fetching) && (
          <div className="progressBox" style={{ padding: '8px 12px', borderRadius: '10px', margin: '4px 0' }}>
            <div className="progressHeader" style={{ fontSize: '13px' }}>
              <b>{aiProgress.message}</b>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span>{aiProgress.done}/{aiProgress.total}</span>
                <button onClick={handleStop} className="dangerSoft stopBtn" style={{ padding: '4px 8px', fontSize: '11px', color: '#b91c1c', backgroundColor: '#fef2f2', borderColor: '#fecaca', borderRadius: '6px', cursor: 'pointer', height: 'auto', minHeight: '0', display: 'inline-flex', alignItems: 'center', fontWeight: 'bold' }} disabled={cancelRequested}>{cancelRequested ? 'Đang dừng...' : 'Dừng'}</button>
              </div>
            </div>
            <div className="progressTrack" style={{ height: '6px', marginTop: '6px' }}>
              <div style={{ width: aiProgress.total ? `${Math.round(aiProgress.done / aiProgress.total * 100)}%` : '8%' }} />
            </div>
          </div>
        )}

        {tab === 'editor' && (
          <div className="chapterTools compactTools" style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', padding: '6px 10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'visible', margin: '4px 0' }}>
            
            {/* Lấy nội dung hàng loạt */}
            <button 
              onClick={openBatchFetchModal}
              disabled={fetching || aiRunning} 
              className="softPrimary" 
              style={{ height: '34px', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}
            >
              {fetching ? <RefreshCcw className="spin" size={14} /> : <LinkIcon size={14} />} 
              Lấy nội dung hàng loạt
            </button>
            {/* AI hàng loạt */}
            <button 
              onClick={openBatchAiModal}
              disabled={aiRunning || fetching} 
              className="primary" 
              style={{ height: '34px', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}
            >
              {aiRunning ? <RefreshCcw className="spin" size={14} /> : <Sparkles size={14} />} 
              AI hàng loạt
            </button>

            {/* AI chương đã chọn */}
            <button onClick={humanizeSelectedChapters} disabled={aiRunning || fetching} className="softPrimary" style={{ height: '34px', padding: '6px 10px', fontSize: '12.5px', borderRadius: '8px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #cbd5e1' }}>
              {aiRunning ? <RefreshCcw className="spin" size={13} /> : <Sparkles size={13} />} AI đã chọn
            </button>

            {/* AI chương hiện tại */}
            <button onClick={() => humanizeChapter(selected, false, false)} className="softPrimary" disabled={aiRunning || fetching} style={{ height: '34px', padding: '6px 10px', fontSize: '12.5px', borderRadius: '8px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #cbd5e1' }}>
              {aiRunning ? <RefreshCcw className="spin" size={13} /> : <Sparkles size={13} />} AI hiện tại
            </button>

            {/* Re-AI chương */}
            {current && current.cleaned && (
              <button onClick={() => humanizeChapter(selected, false, true)} className="dangerSoft" disabled={aiRunning || fetching} style={{ height: '34px', padding: '6px 10px', fontSize: '12.5px', borderRadius: '8px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #cbd5e1' }}>
                <RefreshCcw size={13} /> Re-AI chương
              </button>
            )}

          </div>
        )}

        {/* Fix cứng Block Tên truyện (fixed/non-scrollable) */}
        <section className="bookInfo card" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ margin: 0 }}>Tên truyện</label>
            <input value={bookTitle} onChange={e => setBookTitle(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ margin: 0 }}>Tác giả</label>
            <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Không bắt buộc" />
          </div>
          <div style={{ flex: 2, minWidth: '250px' }}>
            <label style={{ margin: 0 }}>Link tổng (Table of Contents)</label>
            <div className="urlRow">
              <input value={currentBook.url || ''} onChange={e => updateBook({ url: e.target.value })} placeholder="https://..." />
              <button onClick={loadChapterList} disabled={fetching} className="softPrimary">
                {fetching ? <RefreshCcw className="spin" size={15} /> : null} Load List
              </button>
            </div>
          </div>
          <button className="dangerSoft equalBtn" onClick={() => deleteBook(bookIndex)} style={{ height: '42px', alignSelf: 'flex-end' }}><Trash2 size={16} /> Xóa truyện</button>
        </section>

        <div className="scrollContent" style={{ overflowY: tab === 'editor' ? 'hidden' : 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {tab === 'editor' && (
            <section className="chapterWorkspace card" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, paddingBottom: '14px', gap: '6px' }}>
              {/* Fix cứng Header Chương đang sửa */}
              <div className="chapterWorkspaceHead" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '4px', gap: '12px', flexWrap: 'nowrap' }}>
                <h2 style={{ fontSize: '18px', margin: 0, whiteSpace: 'nowrap' }}>Chương đang sửa (Chương {selected + 1})</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
                  <button onClick={() => moveChapter(selected, -1)} title="Lên">↑</button>
                  <button onClick={() => moveChapter(selected, 1)} title="Xuống">↓</button>
                  <button onClick={() => setSelected(0)} disabled={selected === 0}>Chương 1</button>
                  <button onClick={() => setSelected(chapters.length - 1)} disabled={selected === chapters.length - 1}>Chương cuối</button>
                  <input type="number" min="1" max={chapters.length} value={selected + 1} onChange={e => {
                    const val = parseInt(e.target.value) - 1;
                    if (val >= 0 && val < chapters.length) {
                      setSelected(val);
                    }
                  }} style={{ width: '70px', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '8px' }} />
                  <button className="dangerSoft" onClick={() => removeChapter(selected)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Trash2 size={16} /> Xóa</button>
                </div>
              </div>

              {/* Chỉ cuộn phần nội dung chương từ Tiêu đề/Link chương trở xuống */}
              <div className="chapterWorkspaceBody" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
                {/* Đưa 2 dòng Tiêu đề chương và Link chương lên cùng 1 hàng */}
                <div className="chapterMeta" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '16px', alignItems: 'end' }}>
                  <label style={{ margin: 0 }}>Tiêu đề chương
                    <input 
                      value={current.title} 
                      onChange={e => updateChapter(selected, { title: e.target.value })} 
                      onBlur={e => updateChapter(selected, { title: formatChapterTitleForExport(e.target.value, selected, bookTitle) })} 
                    />
                  </label>
                  <label style={{ margin: 0 }}>Link chương
                    <div className="urlRow">
                      <input value={current.url} onChange={e => updateChapter(selected, { url: e.target.value })} placeholder="https://..." />
                      <button onClick={() => fetchCurrentUrl(false)} disabled={fetching}>
                        {fetching ? <RefreshCcw className="spin" size={15} /> : <LinkIcon size={17} />}
                        {fetching ? 'Đang lấy...' : 'Lấy nội dung'}
                      </button>
                    </div>
                  </label>
                </div>

                <div className="chapterTools" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => cleanOne(selected)}><Wand2 size={17} /> Dọn + chia đoạn</button>
                  <button onClick={() => layoutOne(selected)}><AlignLeft size={17} /> Chỉ chia bố cục</button>
                  <button onClick={cleanAll}><Wand2 size={17} /> Dọn tất cả</button>
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <button onClick={() => setShowOptionsPopup(!showOptionsPopup)} className="softPrimary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Sliders size={17} /> Tùy chọn dọn text <span style={{ fontSize: '10px' }}>▼</span>
                    </button>
                    {showOptionsPopup && (
                      <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: 0,
                        marginBottom: '4px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '12px',
                        boxShadow: '0 -4px 16px rgba(0,0,0,0.12), 0 10px 25px rgba(0,0,0,0.15)',
                        zIndex: 1000,
                        minWidth: '280px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '4px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', color: '#172033' }}>
                          Tùy chọn dọn text
                        </div>
                        {[
                          ['normalizeSpaces', 'Xóa khoảng trắng/dòng trống thừa'],
                          ['mergeBrokenLines', 'Gộp dòng bị ngắt sai'],
                          ['reflowLayout', 'Chia lại bố cục đoạn văn'],
                          ['removeWatermark', 'Xóa watermark/câu rác'],
                          ['restoreFilteredWords', 'Khôi phục từ bị lọc'],
                          ['autoReplace', 'Thay từ convert theo bộ lọc']
                        ].map(([k, t]) => (
                          <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 'normal', margin: 0, userSelect: 'none', flexDirection: 'row', width: '100%', color: '#172033' }}>
                            <input 
                              type="checkbox" 
                              checked={options[k]} 
                              onChange={e => setOptions({ ...options, [k]: e.target.checked })} 
                              style={{ width: '15px', height: '15px', margin: 0, flexShrink: 0 }}
                            />
                            <span>{t}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="compareGrid">
                  <label>Nội dung gốc<textarea ref={rawTextRef} value={current.raw} onScroll={() => handleCompareScroll('raw')} onChange={e => updateChapter(selected, { raw: e.target.value })} placeholder="Dán truyện convert / bản dịch thô / text lỗi vào đây..." style={{ height: 'calc(100vh - 350px)', minHeight: '260px', resize: 'none' }} /></label>
                  <label>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Bản đã clean</span>
                      <button onClick={copyCleanText} className="softPrimary" style={{ padding: '3px 8px', fontSize: '12px', minHeight: 0, height: 'auto', borderRadius: '6px' }}>{copiedClean ? 'Đã Copy' : 'Copy'}</button>
                    </div>
                    <textarea ref={cleanTextRef} value={current.cleaned} onScroll={() => handleCompareScroll('clean')} onChange={e => updateChapter(selected, { cleaned: e.target.value })} placeholder="Kết quả sau khi dọn / bản AI sửa sẽ đặt ở đây." style={{ height: 'calc(100vh - 350px)', minHeight: '260px', resize: 'none' }} />
                  </label>
                </div>
              </div>
            </section>
          )}

          {tab === 'filters' && (
            <section className="filters card">
              <h2>Bộ lọc từ</h2>
              <div className="filterGrid">
                <label>Giữ nguyên / Preserve<textarea value={filters.preserveTerms} onChange={e => setFilters({ ...filters, preserveTerms: e.target.value })} /></label>
                <label>Thay thế convert<textarea value={filters.replaceRules} onChange={e => setFilters({ ...filters, replaceRules: e.target.value })} /></label>
                <label>Watermark / câu rác<textarea value={filters.watermarks} onChange={e => setFilters({ ...filters, watermarks: e.target.value })} /></label>
                <label>Từ bị lọc cần khôi phục<textarea value={filters.restoreRules} onChange={e => setFilters({ ...filters, restoreRules: e.target.value })} /></label>
              </div>
            </section>
          )}

          {tab === 'ai' && (
            <section className="ai card compactAi">
              <div className="aiHeader">
                <div><h2>Gemini AI Pool</h2></div>
                <div className="poolStats managerStats">
                  <span>Tổng key <b>{keySummary.totalKeys}</b></span>
                  <span>Đang bật <b>{keySummary.activeKeys}</b></span>
                  <span>Limited <b>{keySummary.limitedKeys}</b></span>
                  <span>Lỗi <b>{keySummary.errorKeys}</b></span>
                  <span>OK/Fail <b>{keySummary.totalSuccess}/{keySummary.totalFail}</b></span>
                </div>
              </div>
              <div className="managerTabs">
                <button className="on"><ShieldCheck size={16} /> Keys</button>
                <button><Sparkles size={16} /> Prompt Preset</button>
                <button onClick={() => setStatus({ type: 'ok', message: `Session: auto-cache đang bật. Key đã dùng: ${apiPool.filter(k => k.lastUsedAt).map(k => k.label).join(', ') || 'chưa có'}.` })}><Database size={16} /> Session</button>
              </div>
              <div className="keyManagerLayout">
                <div className="keyImportPanel">
                  <div className="panelTitle"><FileText size={16} /><b>Import Gemini Keys</b></div>
                  <label>Nhập key <span className="hint">mỗi dòng một key, hoặc GEMINI_045=AIza...</span>
                    <textarea className="keyBox" value={importKeyText} onChange={e => setImportKeyText(e.target.value)} placeholder={`GEMINI_001=AIza...\nGEMINI_002=AIza...\nAIza...`} />
                  </label>
                  <div className="miniActions left">
                    <button className="softPrimary" onClick={importKeys}><Upload size={16} /> Import</button>
                    <button onClick={testAllGeminiKeys} disabled={aiRunning}><Sparkles size={16} /> Test all</button>
                    <button onClick={loadGeminiModels} disabled={aiRunning}><RefreshCcw size={16} /> Lấy model</button>
                  </div>
                </div>
                <div className="keyTablePanel">
                  <div className="tableToolbar" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="searchBox" style={{ width: '130px', flex: 'none' }}>
                      <Search size={15} />
                      <input value={keySearch} onChange={e => setKeySearch(e.target.value)} placeholder="Tìm..." />
                    </div>
                    <select value={keyStatusFilter} style={{ width: '110px' }} onChange={e => setKeyStatusFilter(e.target.value)}>
                      <option value="all">Tất cả</option>
                      <option value="enabled">Đang bật</option>
                      <option value="active">Active</option>
                      <option value="limited">Limited</option>
                      <option value="error">Error</option>
                      <option value="unknown">Unknown</option>
                    </select>
                    <select value={keysPerPage} style={{ width: '110px' }} onChange={e => { setKeysPerPage(e.target.value); setKeyPage(1); }}>
                      <option value="10">10 Key/trang</option>
                      <option value="20">20 / trang</option>
                      <option value="50">50 / trang</option>
                      <option value="all">Tất cả</option>
                    </select>
                    <button onClick={() => setApiPool(prev => prev.map(k => ({ ...k, enabled: true })))}><ToggleRight size={15} /> Bật all</button>
                    <button onClick={() => setApiPool(prev => prev.map(k => ({ ...k, enabled: false })))}><ToggleLeft size={15} /> Tắt all</button>
                    <button onClick={() => setApiPool([])}><Trash2 size={15} /> Xóa pool</button>
                  </div>
                  <div className="keyTable">
                    <div className="keyRow head">
                      <span>Key</span>
                      <span>Masked</span>
                      <span>Status</span>
                      <span>OK/Fail</span>
                      <span>Chars</span>
                      <span>Last used</span>
                      <span></span>
                    </div>
                    {paginatedKeys.length ? paginatedKeys.map((item, idx) => (
                      <div key={item.id || idx} className={`keyRow ${item.lastStatus || 'unknown'}`}>
                        <label className="check slim">
                          <input type="checkbox" checked={item.enabled !== false} onChange={e => setApiPool(prev => prev.map(k => k.id === item.id ? { ...k, enabled: e.target.checked } : k))} />
                          <b>{item.label}</b>
                        </label>
                        <code>{maskKey(item.key)}</code>
                        <span className={`badge ${item.lastStatus || 'unknown'}`}>{item.lastStatus || 'unknown'}</span>
                        <span>{item.totalSuccess || 0}/{item.totalFail || 0}</span>
                        <span>{(item.totalChars || 0).toLocaleString()}</span>
                        <span className="lastUsed">{item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleTimeString() : '-'}</span>
                        <button onClick={() => setApiPool(prev => prev.filter(k => k.id !== item.id))}><Trash2 size={14} /></button>
                        {item.lastError && <small className="keyError">{item.lastError}</small>}
                      </div>
                    )) : <p className="note emptyKey">Chưa có key hoặc không có key khớp bộ lọc.</p>}
                  </div>
                  {visibleKeys.length > 0 && (
                    <div className="pagination" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                      <button onClick={() => setKeyPage(p => Math.max(1, p - 1))} disabled={keyPage <= 1}>Trang trước</button>
                      <span>Trang {keyPage} / {totalPages}</span>
                      <button onClick={() => setKeyPage(p => Math.min(totalPages, p + 1))} disabled={keyPage >= totalPages}>Trang sau</button>
                      <span className="totalKeys" style={{ marginLeft: 'auto' }}>Tổng số key: {visibleKeys.length}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="promptPanel">
                <div className="panelTitle"><Sparkles size={16} /><b>Prompt Engine / Context xưng hô</b></div>
                <div className="promptGrid">
                  <label>Model<select value={apiSettings.model} onChange={e => updateApi({ model: e.target.value })}>{modelOptions.map(m => <option key={m.name} value={m.name}>{m.displayName || m.name}</option>)}</select></label>
                  <label>Mode xử lý<select value={aiMode} onChange={e => setAiMode(e.target.value)}><option value="humanize">Natural VN Audio — Việt hóa để nghe</option><option value="structure">Sửa bố cục + câu chữ</option><option value="proofread">Check/sửa nhẹ text</option></select></label>
                  <label>Mức biên tập<select value={promptSettings.humanizeStrength} onChange={e => setPromptSettings({ ...promptSettings, humanizeStrength: e.target.value })}><option value="cleanup">Cleanup — ít sửa nhất</option><option value="naturalAudio">Natural VN Audio — khuyên dùng</option><option value="light">Light — giữ gần văn gốc</option><option value="balanced">Balanced — mượt vừa phải</option><option value="strong">Strong — mượt hơn</option></select></label>
                  <label>Xưng hô<select value={promptSettings.pronounStyle} onChange={e => setPromptSettings({ ...promptSettings, pronounStyle: e.target.value })}><option value="preserve">Preserve — giữ ta/ngươi</option><option value="balanced">Balanced — theo ngữ cảnh</option><option value="modern">Modern VN — mềm hóa mạnh hơn</option></select></label>
                  <label>Chunk<input type="number" value={apiSettings.chunkSize} onChange={e => updateApi({ chunkSize: Number(e.target.value) })} /></label>
                  <label>Delay ms<input type="number" value={apiSettings.delayMs} onChange={e => updateApi({ delayMs: Number(e.target.value) })} /></label>
                  <label>Cooldown ms<input type="number" value={apiSettings.cooldownMs} onChange={e => updateApi({ cooldownMs: Number(e.target.value) })} /></label>
                  <label>Retry<input type="number" value={apiSettings.maxRetries} onChange={e => updateApi({ maxRetries: Number(e.target.value) })} /></label>
                </div>
                <div className="memoryGrid">
                  <label>Novel Memory <span className="hint">chỉ áp dụng cho bộ truyện hiện tại</span><textarea value={promptSettings.novelMemory} onChange={e => setPromptSettings({ ...promptSettings, novelMemory: e.target.value })} /></label>
                  <label>Ghi chú thêm <span className="hint">không bắt buộc</span><textarea value={promptSettings.additionalInstructions} onChange={e => setPromptSettings({ ...promptSettings, additionalInstructions: e.target.value })} placeholder="Ví dụ: Giữ nguyên xưng hô sư phụ/đệ tử. Không đổi Lâm Thiếu thành cậu Lâm..." /></label>
                </div>
              </div>
              <div className="aiControls compactControls">
                <button onClick={() => humanizeChapter(selected, false, false)} disabled={aiRunning}><Sparkles size={17} /> AI chương hiện tại</button>
                <button onClick={humanizeAll} disabled={aiRunning}><Sparkles size={17} /> AI tất cả chương</button>
                <button onClick={makePrompt}><Copy size={17} /> Tạo prompt thủ công</button>
                <button onClick={saveProject}><Save size={17} /> Export project backup</button>
                <button onClick={clearCache}><Trash2 size={17} /> Xóa auto-cache</button>
              </div>
              <details className="promptDetails">
                <summary>Prompt thủ công / nâng cao</summary>
                <div className="aiControls">
                  <button onClick={copyPrompt} disabled={!aiPrompt}><Copy size={17} /> Copy prompt</button>
                </div>
                <textarea className="promptBox" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Prompt thủ công sẽ hiện ở đây nếu bạn bấm Tạo prompt thủ công..." />
              </details>
              <div className="sessionLog">
                <b>Session log</b>
                <div>
                  {apiPool.filter(k => k.lastUsedAt).length ? apiPool.filter(k => k.lastUsedAt).slice(0, 8).map(k => <span key={k.id}>{k.label}: {k.lastStatus || 'unknown'} · {new Date(k.lastUsedAt).toLocaleTimeString()}</span>) : <span>Chưa có key nào được dùng trong phiên này.</span>}
                </div>
              </div>
            </section>
          )}

          {tab === 'prompts' && (
            <div className="tabContent" style={{ padding: '16px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>AI Prompt Manager</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="file" id="import-prompts-input" accept=".json" style={{ display: 'none' }} onChange={handleImportPrompts} />
                  <button className="softPrimary" onClick={() => document.getElementById('import-prompts-input').click()} style={{ height: '34px', padding: '6px 12px', borderRadius: '8px', fontSize: '13px' }}>Import Prompt Pack</button>
                  <button className="softPrimary" onClick={handleExportPrompts} style={{ height: '34px', padding: '6px 12px', borderRadius: '8px', fontSize: '13px' }}>Export Prompt Pack</button>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <label style={{ fontWeight: 'bold', fontSize: '14px', color: '#475569' }}>Chọn Prompt chỉnh sửa:</label>
                <select 
                  className="prompt-manager-select"
                  value={editingPromptKey} 
                  onChange={e => {
                    setEditingPromptKey(e.target.value);
                  }}
                >
                  <option value="aiNaturalVn">AI Natural VN (Việt hóa chính)</option>
                  <option value="storyCleaner">Story Cleaner (Xử lý convert)</option>
                  <option value="reAi">Re-AI (Chạy lại chương đã AI)</option>
                </select>
                
                <label style={{ fontWeight: 'bold', fontSize: '14px', color: '#475569', marginLeft: '24px' }}>Preset nhanh:</label>
                <select 
                  className="prompt-manager-select"
                  value={selectedPresetKey}
                  onChange={e => {
                    setSelectedPresetKey(e.target.value);
                    handleApplyPreset(e.target.value);
                  }}
                >
                  <option value="">-- Chọn Preset --</option>
                  <option value="default">Default (Nguyên bản)</option>
                  <option value="naturalVn">Natural VN (Ưu tiên V2)</option>
                  <option value="strictOriginal">Strict Original (Dịch sát gốc)</option>
                </select>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                  * Bạn có thể sử dụng các biến placeholder tự động điền giá trị từ các cài đặt của truyện: 
                  <code style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px', margin: '0 4px', color: '#0f172a', fontFamily: 'monospace' }}>{"{{preserveTerms}}"}</code>, 
                  <code style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px', margin: '0 4px', color: '#0f172a', fontFamily: 'monospace' }}>{"{{novelMemory}}"}</code>, 
                  <code style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px', margin: '0 4px', color: '#0f172a', fontFamily: 'monospace' }}>{"{{pronounStyle}}"}</code>, 
                  <code style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px', margin: '0 4px', color: '#0f172a', fontFamily: 'monospace' }}>{"{{humanizeStrength}}"}</code>, 
                  <code style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px', margin: '0 4px', color: '#0f172a', fontFamily: 'monospace' }}>{"{{extraInstructions}}"}</code>
                </span>
                <textarea 
                  className="prompt-manager-textarea"
                  value={editingPromptText} 
                  onChange={e => setEditingPromptText(e.target.value)} 
                />
              </div>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button 
                  className="softPrimary" 
                  onClick={() => {
                    if (confirm('Bạn muốn khôi phục prompt này về mặc định?')) {
                      const defaults = PROMPT_PRESETS.naturalVn;
                      setEditingPromptText(defaults[editingPromptKey]);
                    }
                  }}
                  style={{ height: '36px', padding: '6px 16px', borderRadius: '8px', fontSize: '13px' }}
                >
                  Khôi phục mặc định
                </button>
                <button 
                  className="primary" 
                  onClick={() => {
                    const updated = { ...promptTemplates, [editingPromptKey]: editingPromptText };
                    savePrompts(updated);
                  }}
                  style={{ height: '36px', padding: '6px 16px', borderRadius: '8px', fontSize: '13px' }}
                >
                  Lưu Prompt
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {showAiReport && (
        <div className="modalOverlay" onMouseDown={(e) => { overlayMouseDownTargetRef.current = e.target; }} onClick={(e) => { if (e.target === e.currentTarget && overlayMouseDownTargetRef.current === e.currentTarget) setShowAiReport(false); }}>
          <div className="modalContent reportModal" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onKeyDown={e => { if (e.key !== 'Escape') e.stopPropagation(); }} style={{ maxWidth: '540px' }}>
            <div className="modalHeader">
              <h3><FileText size={20} /> Báo cáo AI Natural</h3>
              <button className="closeBtn" onClick={() => setShowAiReport(false)}>×</button>
            </div>
            <div className="modalBody" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ margin: 0, color: '#4b5563', fontSize: '13px', textAlign: 'center' }}>
                Bấm vào một danh mục bên dưới để lọc danh sách chương ở Menu bên trái:
              </p>
              <div className="reportStatsGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '8px' }}>
                <div 
                  className="statBox success"
                  onClick={() => { setChapterFilter('success'); setShowAiReport(false); }}
                  style={{ cursor: 'pointer', border: '1px solid #10b981', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', backgroundColor: '#ecfdf5', transition: 'all 0.2s' }}
                >
                  <span style={{ fontSize: '13px', color: '#065f46', fontWeight: 'bold' }}>AI Thành Công</span>
                  <b style={{ fontSize: '24px', color: '#047857' }}>{aiReportData.successList.length}</b>
                  <span style={{ fontSize: '11px', color: '#059669' }}>Click để lọc trong menu</span>
                </div>
                <div 
                  className="statBox danger"
                  onClick={() => { setChapterFilter('error'); setShowAiReport(false); }}
                  style={{ cursor: 'pointer', border: '1px solid #ef4444', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', backgroundColor: '#fef2f2', transition: 'all 0.2s' }}
                >
                  <span style={{ fontSize: '13px', color: '#991b1b', fontWeight: 'bold' }}>AI Lỗi</span>
                  <b style={{ fontSize: '24px', color: '#dc2626' }}>{aiReportData.errorList.length}</b>
                  <span style={{ fontSize: '11px', color: '#dc2626' }}>Click để lọc trong menu</span>
                </div>
                <div 
                  className="statBox warning"
                  onClick={() => { setChapterFilter('pending'); setShowAiReport(false); }}
                  style={{ cursor: 'pointer', border: '1px solid #f59e0b', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', backgroundColor: '#fffbeb', transition: 'all 0.2s' }}
                >
                  <span style={{ fontSize: '13px', color: '#92400e', fontWeight: 'bold' }}>Chưa xử lý (Chưa AI)</span>
                  <b style={{ fontSize: '24px', color: '#d97706' }}>{aiReportData.pendingList.length}</b>
                  <span style={{ fontSize: '11px', color: '#d97706' }}>Click để lọc trong menu</span>
                </div>
                <div 
                  className="statBox warning"
                  onClick={() => { setChapterFilter('warning'); setShowAiReport(false); }}
                  style={{ cursor: 'pointer', border: '1px solid #d97706', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', backgroundColor: '#fffbeb', transition: 'all 0.2s' }}
                >
                  <span style={{ fontSize: '13px', color: '#92400e', fontWeight: 'bold' }}>Có Cảnh Báo</span>
                  <b style={{ fontSize: '24px', color: '#b45309' }}>{aiReportData.warningList.length}</b>
                  <span style={{ fontSize: '11px', color: '#b45309' }}>Click để lọc trong menu</span>
                </div>
              </div>
              
              <button 
                className="softPrimary"
                onClick={() => { setChapterFilter('all'); setShowAiReport(false); }}
                style={{ width: '100%', height: '38px', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px' }}
              >
                Hiển thị tất cả chương (Bỏ lọc)
              </button>
            </div>
            <div className="modalFooter">
              <button className="softPrimary" onClick={() => {
                const text = getReportText('txt');
                navigator.clipboard.writeText(text);
                setStatus({ type: 'ok', message: 'Đã copy báo cáo dạng text.' });
              }}><Copy size={16} /> Copy Text</button>
              <button className="softPrimary" onClick={() => {
                const text = getReportText('md');
                navigator.clipboard.writeText(text);
                setStatus({ type: 'ok', message: 'Đã copy báo cáo dạng Markdown.' });
              }}><Copy size={16} /> Copy MD</button>
              <button onClick={() => setShowAiReport(false)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {showBulkDeleteModal && (
        <div className="modalOverlay" onMouseDown={(e) => { overlayMouseDownTargetRef.current = e.target; }} onClick={(e) => { if (e.target === e.currentTarget && overlayMouseDownTargetRef.current === e.currentTarget) setShowBulkDeleteModal(false); }}>
          <div className="modalContent" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onKeyDown={e => { if (e.key !== 'Escape') e.stopPropagation(); }} style={{ maxWidth: '360px' }}>
            <div className="modalHeader">
              <h3 style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}><Trash2 size={20} /> Xác nhận xóa</h3>
              <button className="closeBtn" onClick={() => setShowBulkDeleteModal(false)}>×</button>
            </div>
            <div className="modalBody" style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'center', padding: '16px 0' }}>
              <p style={{ fontSize: '15px', color: '#1f2937', margin: 0, fontWeight: 'bold' }}>
                Bạn sắp xóa {chapters.filter(c => c.selectedForExport === true).length} chương.
              </p>
              <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Hành động này không thể hoàn tác.</p>
            </div>
            <div className="modalFooter" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="softPrimary" onClick={() => setShowBulkDeleteModal(false)} style={{ height: '36px', padding: '6px 16px', borderRadius: '8px', fontSize: '13px' }}>Hủy</button>
              <button className="danger" onClick={() => {
                const nextChs = chapters.filter(c => !c.selectedForExport);
                setChapters(nextChs.length ? nextChs : [{title: 'Chương 1', url: '', raw: '', cleaned: '', selectedForExport: false}]);
                setSelected(0);
                setShowBulkDeleteModal(false);
                setStatus({type: 'ok', message: `Đã xóa các chương được chọn.`});
              }} style={{ height: '36px', padding: '6px 16px', borderRadius: '8px', fontSize: '13px', background: '#dc2626', color: '#fff', border: 'none', fontWeight: 'bold' }}>Xóa</button>
            </div>
          </div>
        </div>
      )}

      {showBatchFetchModal && (
        <div className="modalOverlay" onMouseDown={(e) => { overlayMouseDownTargetRef.current = e.target; }} onClick={(e) => { if (e.target === e.currentTarget && overlayMouseDownTargetRef.current === e.currentTarget) setShowBatchFetchModal(false); }}>
          <div className="modalContent" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onKeyDown={e => { if (e.key !== 'Escape') e.stopPropagation(); }} style={{ maxWidth: '360px' }}>
            <div className="modalHeader">
              <h3><LinkIcon size={20} /> Lấy nội dung hàng loạt</h3>
              <button className="closeBtn" onClick={() => setShowBatchFetchModal(false)}>×</button>
            </div>
            <div className="modalBody" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#475569', fontWeight: 'bold' }}>Từ chương:
                  <input type="number" min="1" max={chapters.length} value={batchFetchStart} onChange={e => setBatchFetchStart(Math.max(1, parseInt(e.target.value) || 1))} style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                </label>
                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#475569', fontWeight: 'bold' }}>Đến chương:
                  <input type="number" min="1" max={chapters.length} value={batchFetchEnd} onChange={e => setBatchFetchEnd(Math.max(1, parseInt(e.target.value) || 1))} style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                </label>
              </div>
            </div>
            <div className="modalFooter">
              <button className="softPrimary" onClick={() => setShowBatchFetchModal(false)}>Hủy</button>
              <button className="primary" onClick={() => { fetchBatchChapters(batchFetchStart, batchFetchEnd); setShowBatchFetchModal(false); }}>Bắt đầu</button>
            </div>
          </div>
        </div>
      )}

      {showBatchAiModal && (
        <div className="modalOverlay" onMouseDown={(e) => { overlayMouseDownTargetRef.current = e.target; }} onClick={(e) => { if (e.target === e.currentTarget && overlayMouseDownTargetRef.current === e.currentTarget) setShowBatchAiModal(false); }}>
          <div className="modalContent" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onKeyDown={e => { if (e.key !== 'Escape') e.stopPropagation(); }} style={{ maxWidth: '360px' }}>
            <div className="modalHeader">
              <h3><Sparkles size={20} /> AI hàng loạt</h3>
              <button className="closeBtn" onClick={() => setShowBatchAiModal(false)}>×</button>
            </div>
            <div className="modalBody" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#475569', fontWeight: 'bold' }}>Từ chương:
                  <input type="number" min="1" max={chapters.length} value={batchAiStart} onChange={e => setBatchAiStart(Math.max(1, parseInt(e.target.value) || 1))} style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                </label>
                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#475569', fontWeight: 'bold' }}>Đến chương:
                  <input type="number" min="1" max={chapters.length} value={batchAiEnd} onChange={e => setBatchAiEnd(Math.max(1, parseInt(e.target.value) || 1))} style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
                </label>
              </div>
            </div>
            <div className="modalFooter">
              <button className="softPrimary" onClick={() => setShowBatchAiModal(false)}>Hủy</button>
              <button className="primary" onClick={() => { humanizeBatch(batchAiStart, batchAiEnd); setShowBatchAiModal(false); }}>Bắt đầu AI</button>
            </div>
          </div>
        </div>
      )}

      {overwriteModal.show && (
        <div className="modalOverlay" onMouseDown={(e) => { overlayMouseDownTargetRef.current = e.target; }} onClick={(e) => { if (e.target === e.currentTarget && overlayMouseDownTargetRef.current === e.currentTarget) setOverwriteModal({ show: false }); }}>
          <div className="modalContent" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onKeyDown={e => { if (e.key !== 'Escape') e.stopPropagation(); }} style={{ maxWidth: '400px' }}>
            <div className="modalHeader">
              <h3 style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={20} /> {overwriteModal.title || 'Cảnh báo ghi đè'}</h3>
              <button className="closeBtn" onClick={() => setOverwriteModal({ show: false })}>×</button>
            </div>
            <div className="modalBody" style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
              {overwriteModal.message.split('\n').map((m, idx) => (
                <p key={idx} style={{ fontSize: '14.5px', color: '#1f2937', margin: 0, fontWeight: idx === 0 ? 'bold' : 'normal' }}>{m}</p>
              ))}
            </div>
            <div className="modalFooter" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              <button className="danger" onClick={() => { overwriteModal.onConfirm(); setOverwriteModal({ show: false }); }} style={{ width: '100%', height: '38px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer' }}>{overwriteModal.confirmText || 'Vẫn lấy lại nội dung'}</button>
              <button className="softPrimary" onClick={() => setOverwriteModal({ show: false })} style={{ width: '100%', height: '38px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', border: '1px solid #cbd5e1', cursor: 'pointer' }}>{overwriteModal.cancelText || 'Hủy'}</button>
            </div>
          </div>
        </div>
      )}

      {batchOverwriteModal.show && (
        <div className="modalOverlay" onMouseDown={(e) => { overlayMouseDownTargetRef.current = e.target; }} onClick={(e) => { if (e.target === e.currentTarget && overlayMouseDownTargetRef.current === e.currentTarget) setBatchOverwriteModal({ show: false, cleanedChapters: [] }); }}>
          <div className="modalContent" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onKeyDown={e => { if (e.key !== 'Escape') e.stopPropagation(); }} style={{ maxWidth: '420px' }}>
            <div className="modalHeader">
              <h3 style={{ color: '#d97706', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={20} /> Phát hiện chương đã Clean</h3>
              <button className="closeBtn" onClick={() => setBatchOverwriteModal({ show: false, cleanedChapters: [] })}>×</button>
            </div>
            <div className="modalBody" style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
              <p style={{ fontSize: '14px', color: '#1f2937', margin: 0, fontWeight: 'bold' }}>
                Danh sách chương:
              </p>
              <div style={{ maxHeight: '120px', overflowY: 'auto', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {batchOverwriteModal.cleanedChapters.map((chTitle, idx) => (
                  <span key={idx} style={{ fontSize: '13px', color: '#475569', fontWeight: '500' }}>• {chTitle}</span>
                ))}
              </div>
              <p style={{ fontSize: '14.5px', color: '#1f2937', margin: 0, fontWeight: 'bold' }}>đã được Clean.</p>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Việc lấy lại nội dung có thể làm mất dữ liệu đã được AI xử lý. Bạn muốn xử lý thế nào?</p>
            </div>
            <div className="modalFooter" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              <button className="primary" onClick={() => { fetchBatchChapters(batchOverwriteModal.startCh, batchOverwriteModal.endCh, 'skipCleaned'); setBatchOverwriteModal({ show: false, cleanedChapters: [] }); }} style={{ width: '100%', height: '38px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', border: 'none', color: '#fff', cursor: 'pointer' }}>Bỏ qua các chương đã Clean (Khuyên dùng)</button>
              <button className="danger" onClick={() => { fetchBatchChapters(batchOverwriteModal.startCh, batchOverwriteModal.endCh, 'overwriteAll'); setBatchOverwriteModal({ show: false, cleanedChapters: [] }); }} style={{ width: '100%', height: '38px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer' }}>Vẫn ghi đè tất cả</button>
              <button className="softPrimary" onClick={() => setBatchOverwriteModal({ show: false, cleanedChapters: [] })} style={{ width: '100%', height: '38px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', border: '1px solid #cbd5e1', cursor: 'pointer' }}>Hủy</button>
            </div>
          </div>
        </div>
      )}
      {showBatchExportModal && (
        <div className="modalOverlay" onMouseDown={(e) => { overlayMouseDownTargetRef.current = e.target; }} onClick={(e) => { if (e.target === e.currentTarget && overlayMouseDownTargetRef.current === e.currentTarget) setShowBatchExportModal(false); }}>
          <div className="modalContent" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onKeyDown={e => { if (e.key !== 'Escape') e.stopPropagation(); }} style={{ maxWidth: '400px' }}>
            <div className="modalHeader">
              <h3><Download size={20} /> {exportIsSiri ? 'Xuất DOCX Theo Tập Siri' : 'Xuất DOCX Theo Tập'}</h3>
              <button className="closeBtn" onClick={() => setShowBatchExportModal(false)}>×</button>
            </div>
            <div className="modalBody" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <label style={{ flex: 1, gap: '6px' }}>Từ chương
                  <input type="number" min="1" max={chapters.length} value={exportStartCh} onChange={e => {
                    const start = Math.max(1, parseInt(e.target.value) || 1);
                    setExportStartCh(start);
                    updateDefaultFilename(start, exportEndCh);
                  }} />
                </label>
                <label style={{ flex: 1, gap: '6px' }}>Đến chương
                  <input type="number" min="1" max={chapters.length} value={exportEndCh} onChange={e => {
                    const end = Math.max(1, parseInt(e.target.value) || 1);
                    setExportEndCh(end);
                    updateDefaultFilename(exportStartCh, end);
                  }} />
                </label>
              </div>
              <label style={{ gap: '6px' }}>Tên file mặc định
                <input type="text" value={exportFilename} onChange={e => setExportFilename(e.target.value)} />
              </label>
            </div>
            <div className="modalFooter">
              <button className="softPrimary" onClick={() => setShowBatchExportModal(false)}>Hủy</button>
              <button className="primary" onClick={() => exportBatchDocx(exportStartCh, exportEndCh, exportFilename, exportIsSiri)}>Xuất file</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById('root')).render(<App />);
