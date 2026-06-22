
// Intercept console.log to filter out old debug logs
const originalConsoleLog = console.log;
console.log = (...args) => {
  const msg = args.map(arg => {
    try {
      return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
    } catch {
      return String(arg);
    }
  }).join(' ');
  const blacklist = [
    '[Title Candidates]', '[Title Ranking]', '[Ranking Decision]', '[Metadata Extract]',
    '[Title Write]', '[Title Final]', '[Parser Input]', '[Parser Step 1]',
    '[Parser Step 2]', '[Parser Step 3]', '[Parser Step 4]', '[Parser Step 5]',
    '[Parser Final]', '[Title Decision]', '[Title Source]', '[Volume Header]',
    '[Title Cleanup]', '[Pipeline Trace]', '[IPC Send]', '[IPC Receive]',
    '[Chapter HTML]', '[Removed Nodes]', '[After DOM Extract]', '[Paragraph Before Extraction]',
    '[Paragraph After Extraction]', '[Paragraph After Normalize]', '[Paragraph Before UI]',
    '[Final Text]', '[Paragraph Stage', '[Reflow Call]', '[Sanitizer Removed]',
    '[Sanitizer Summary]'
  ];
  if (blacklist.some(prefix => msg.includes(prefix))) {
    return;
  }
  originalConsoleLog(...args);
};

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import JSZip from 'jszip';
import {  FileText, Wand2, FolderOpen, Trash2,
  ShieldCheck, Copy, Plus, Link as LinkIcon, Sparkles,
  AlignLeft, RefreshCcw, CheckCircle2, AlertTriangle, Upload, Save, Database, Search, ToggleLeft, ToggleRight, Sliders
} from 'lucide-react';
import './styles.css';
import { CONVERT_PATTERNS, formatConvertPatternsForPrompt } from './convertPatterns';

const DEBUG_TITLE = false;
const DEBUG_TEXT = true;


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
1. NGUYÊN TẮC TỐI GIẢN (STOP OVER-REWRITING)
==================================================
- Chỉ thực hiện sửa đổi (rewrite) khi gặp: từ ngữ convert, ngữ pháp bị lỗi, xưng hô bị sai hoặc câu quá lủng củng/không tự nhiên.
- Nếu một câu/văn bản đã đọc tự nhiên, trôi chảy bằng tiếng Việt: GIỮ NGUYÊN. Tuyệt đối KHÔNG viết lại, KHÔNG thay thế, KHÔNG paraphrase câu văn gốc.
- Ví dụ:
  + Câu gốc tự nhiên -> Giữ nguyên.
  + Đối thoại tự nhiên -> Giữ nguyên.
  + Kể chuyện tự nhiên -> Giữ nguyên.
- Chỉ sửa những lỗi thực tế xuất hiện trong văn bản.

==================================================
2. CẤM SÁNG TÁC THÊM (NO INFORMATION ADDITION)
==================================================
- Tuyệt đối KHÔNG tự ý suy diễn, thêm thắt các chi tiết miêu tả cảm xúc, động cơ, ý định hoặc hành động của nhân vật nằm ngoài bản gốc.
- KHÔNG thêm từ đệm miêu tả bối cảnh hoặc cảm xúc tự phát.
- Danh sách từ cấm tự ý thêm (nếu bản gốc không có): "khẽ", "bất giác", "theo bản năng", "không khỏi", "dường như", "tựa như", "tự nhiên", "thoáng", "chợt".
- Tuyệt đối cấm đổi tên riêng hay xáo trộn danh xưng (Ví dụ: "Triệu gia Đại trưởng lão" giữ nguyên vai trò/danh xưng là "Triệu gia Đại trưởng lão" hoặc "Đại trưởng lão Triệu gia", KHÔNG tự ý đổi thành tên riêng "Triệu Uyên". "Thiếu chủ vị" giữ nguyên nghĩa là "vị trí thiếu chủ", KHÔNG đổi thành "vị trí đó").

==================================================
3. BẢN ĐỒ QUAN HỆ NHÂN VẬT & KHÓA XƯNG HÔ
==================================================
- Suy luận kỹ ngữ cảnh để xác định mối quan hệ giữa các nhân vật và KHÓA xưng hô thống nhất trong toàn bộ chương/đoạn văn. Tuyệt đối không thay đổi xưng hô vô lý trong cùng một cuộc đối thoại.

==================================================
4. PHÂN ĐỊNH CHỦ THỂ THOẠI & HÀNH ĐỘNG
==================================================
- Tuyệt đối KHÔNG để câu thoại của nhân vật A liền kề với hành động của nhân vật B trong cùng một dòng/đoạn văn, tránh gây hiểu lầm về người đang nói.

==================================================
5. VĂN PHONG TỰ NHIÊN HÓA, BỎ GIẢI THÍCH
==================================================
- Loại bỏ hoàn toàn các cụm từ giải thích mang phong cách thuyết minh học thuật của AI (Ví dụ: "Phải biết rằng...", "Điều này cho thấy...", "Dù là ai...", "Hoàn toàn là hai chuyện khác nhau...").
- Diễn đạt trôi chảy trong dòng chảy tự sự mà không làm mất đi thông tin ban đầu.

==================================================
6. NHẤT QUÁN THUẬT NGỮ CỐT TRUYỆN
==================================================
- Giữ nguyên các thuật ngữ chuyên môn, huyền học hoặc từ ngữ đặc trưng cốt truyện: {{preserveTerms}}

==================================================
7. KHÔNG SÁNG TÁC TIÊU ĐỀ/NỘI DUNG PHỤ
==================================================
- Tuyệt đối KHÔNG tự ý thêm tiêu đề phụ, tiêu đề chương mới tự nghĩ, tiêu đề giới thiệu truyện/chương, dòng mô tả ở đầu hoặc cuối kết quả.

==================================================
QUY TẮC DỊCH VÀ CHUYỂN ĐỔI BIÊN TẬP (CONVERT PATTERNS)
==================================================
{{convertPatterns}}

==================================================
CÁC CÀI ĐẶT BỔ SUNG
==================================================
- Ghi nhớ riêng bộ truyện: {{novelMemory}}
- Yêu cầu xưng hô cụ thể: {{pronounStyle}}
- Mức biên tập: {{humanizeStrength}}
- Ghi chú thêm của người dùng: {{extraInstructions}}

==================================================
8. CỔNG KIỂM SOÁT CHẤT LƯỢNG - QUALITY GATE
==================================================
Sau khi biên tập xong, bạn bắt buộc phải tự rà soát và đánh giá kết quả theo checklist dưới đây trước khi trả về đầu ra:
1. Fact Preservation: Tất cả các danh xưng chức vụ bảo vệ (thiếu chủ, đại trưởng lão, gia chủ...) đã được giữ nguyên chính xác chưa? Có bị tự ý đổi thành tên riêng hay hạ cấp bậc không?
2. Character Preservation: Xưng hô giữa các nhân vật đã nhất quán từ đầu đến cuối chưa?
3. Pronoun Consistency: Mối quan hệ xưng hô đã phù hợp ngữ cảnh chưa?
4. Dialogue Attribution: Có câu thoại nào bị nhầm lẫn chủ thể hoặc xếp liền hành động nhân vật khác không?
5. Minimal Rewrite: Có câu nào vốn dĩ đã tự nhiên mà bị rewrite vô ích không? (Nếu có, khôi phục lại câu gốc).
6. No Information Addition: Có từ cấm nào (khẽ, bất giác, không khỏi, theo bản năng...) bị tự ý thêm vào không?
7. Natural Vietnamese: Các cấu trúc câu convert lộn xộn đã được sửa mượt mà chưa?
* Nếu phát hiện lỗi, bạn PHẢI tự viết lại đoạn lỗi đó cho chuẩn xác trước khi xuất ra kết quả cuối cùng.

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

VĂN BẢN CẦN XỬ LÝ:`
  },
  naturalVn: {
    aiNaturalVn: `Bạn là biên tập viên truyện chuyên nghiệp kiêm chuyên gia Việt hóa tiểu thuyết.

Nhiệm vụ của bạn là chuyển đổi nội dung chương truyện dưới đây sang tiếng Việt tự nhiên, mượt mà, đậm chất văn học như truyện dịch xuất bản, đồng thời loại bỏ các lỗi dịch máy và từ ngữ convert.

BẮT BUỘC TUÂN THỦ CÁC QUY TẮC VÀ HẠN CHẾ SAU (MỤC TIÊU VÀNG LÀ GIỮ NGUYÊN BẢN SẮC TRUYỆN GỐC):

==================================================
1. NGUYÊN TẮC TỐI GIẢN (STOP OVER-REWRITING)
==================================================
- Chỉ thực hiện sửa đổi (rewrite) khi gặp: từ ngữ convert, ngữ pháp bị lỗi, xưng hô bị sai hoặc câu quá lủng củng/không tự nhiên.
- Nếu một câu/văn bản đã đọc tự nhiên, trôi chảy bằng tiếng Việt: GIỮ NGUYÊN. Tuyệt đối KHÔNG viết lại, KHÔNG thay thế, KHÔNG paraphrase câu văn gốc.
- Ví dụ:
  + Câu gốc tự nhiên -> Giữ nguyên.
  + Đối thoại tự nhiên -> Giữ nguyên.
  + Kể chuyện tự nhiên -> Giữ nguyên.
- Chỉ sửa những lỗi thực tế xuất hiện trong văn bản.

==================================================
2. CẤM SÁNG TÁC THÊM (NO INFORMATION ADDITION)
==================================================
- Tuyệt đối KHÔNG tự ý suy diễn, thêm thắt các chi tiết miêu tả cảm xúc, động cơ, ý định hoặc hành động của nhân vật nằm ngoài bản gốc.
- KHÔNG thêm từ đệm miêu tả bối cảnh hoặc cảm xúc tự phát.
- Danh sách từ cấm tự ý thêm (nếu bản gốc không có): "khẽ", "bất giác", "theo bản năng", "không khỏi", "dường như", "tựa như", "tự nhiên", "thoáng", "chợt".
- Tuyệt đối cấm đổi tên riêng hay xáo trộn danh xưng (Ví dụ: "Triệu gia Đại trưởng lão" giữ nguyên vai trò/danh xưng là "Triệu gia Đại trưởng lão" hoặc "Đại trưởng lão Triệu gia", KHÔNG tự ý đổi thành tên riêng "Triệu Uyên". "Thiếu chủ vị" giữ nguyên nghĩa là "vị trí thiếu chủ", KHÔNG đổi thành "vị trí đó").

==================================================
3. BẢN ĐỒ QUAN HỆ NHÂN VẬT & KHÓA XƯNG HÔ
==================================================
- Suy luận kỹ ngữ cảnh để xác định mối quan hệ giữa các nhân vật và KHÓA xưng hô thống nhất trong toàn bộ chương/đoạn văn. Tuyệt đối không thay đổi xưng hô vô lý trong cùng một cuộc đối thoại.

==================================================
4. PHÂN ĐỊNH CHỦ THỂ THOẠI & HÀNH ĐỘNG
==================================================
- Tuyệt đối KHÔNG để câu thoại của nhân vật A liền kề với hành động của nhân vật B trong cùng một dòng/đoạn văn, tránh gây hiểu lầm về người đang nói.

==================================================
5. VĂN PHONG TỰ NHIÊN HÓA, BỎ GIẢI THÍCH
==================================================
- Loại bỏ hoàn toàn các cụm từ giải thích mang phong cách thuyết minh học thuật của AI (Ví dụ: "Phải biết rằng...", "Điều này cho thấy...", "Dù là ai...", "Hoàn toàn là hai chuyện khác nhau...").
- Diễn đạt trôi chảy trong dòng chảy tự sự mà không làm mất đi thông tin ban đầu.

==================================================
6. NHẤT QUÁN THUẬT NGỮ CỐT TRUYỆN
==================================================
- Giữ nguyên các thuật ngữ chuyên môn, huyền học hoặc từ ngữ đặc trưng cốt truyện: {{preserveTerms}}

==================================================
7. KHÔNG SÁNG TÁC TIÊU ĐỀ/NỘI DUNG PHỤ
==================================================
- Tuyệt đối KHÔNG tự ý thêm tiêu đề phụ, tiêu đề chương mới tự nghĩ, tiêu đề giới thiệu truyện/chương, dòng mô tả ở đầu hoặc cuối kết quả.

==================================================
QUY TẮC DỊCH VÀ CHUYỂN ĐỔI BIÊN TẬP (CONVERT PATTERNS)
==================================================
{{convertPatterns}}

==================================================
CÁC CÀI ĐẶT BỔ SUNG
==================================================
- Ghi nhớ riêng bộ truyện: {{novelMemory}}
- Yêu cầu xưng hô cụ thể: {{pronounStyle}}
- Mức biên tập: {{humanizeStrength}}
- Ghi chú thêm của người dùng: {{extraInstructions}}

==================================================
8. CỔNG KIỂM SOÁT CHẤT LƯỢNG - QUALITY GATE
==================================================
Sau khi biên tập xong, bạn bắt buộc phải tự rà soát và đánh giá kết quả theo checklist dưới đây trước khi trả về đầu ra:
1. Fact Preservation: Tất cả các danh xưng chức vụ bảo vệ (thiếu chủ, đại trưởng lão, gia chủ...) đã được giữ nguyên chính xác chưa? Có bị tự ý đổi thành tên riêng hay hạ cấp bậc không?
2. Character Preservation: Xưng hô giữa các nhân vật đã nhất quán từ đầu đến cuối chưa?
3. Pronoun Consistency: Mối quan hệ xưng hô đã phù hợp ngữ cảnh chưa?
4. Dialogue Attribution: Có câu thoại nào bị nhầm lẫn chủ thể hoặc xếp liền hành động nhân vật khác không?
5. Minimal Rewrite: Có câu nào vốn dĩ đã tự nhiên mà bị rewrite vô ích không? (Nếu có, khôi phục lại câu gốc).
6. No Information Addition: Có từ cấm nào (khẽ, bất giác, không khỏi, theo bản năng...) bị tự ý thêm vào không?
7. Natural Vietnamese: Các cấu trúc câu convert lộn xộn đã được sửa mượt mà chưa?
* Nếu phát hiện lỗi, bạn PHẢI tự viết lại đoạn lỗi đó cho chuẩn xác trước khi xuất ra kết quả cuối cùng.

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

function logVietnameseTextPipeline(rawHtmlSnippet, decodedText, afterCleanupText) {
  const extractSnippet = (txt) => {
    if (!txt) return '';
    let idx = txt.toLowerCase().indexOf('uốn');
    if (idx === -1) idx = txt.toLowerCase().indexOf('áuố');
    if (idx === -1) return '...(no wanted/corrupted word found)...';
    const start = Math.max(0, idx - 45);
    const end = Math.min(txt.length, idx + 45);
    return '...' + txt.substring(start, end).replace(/\s+/g, ' ') + '...';
  };

  const decodedSnippet = extractSnippet(decodedText);
  const cleanupSnippet = extractSnippet(afterCleanupText);
  
  // Unicode Normalize stage (NFC)
  const normalizedText = afterCleanupText.normalize('NFC');
  const normalizedSnippet = extractSnippet(normalizedText);

  const finalSnippet = extractSnippet(normalizedText);

  let pipeLog = '\n==================================================\n';
  pipeLog += 'VIETNAMESE TEXT CORRUPTION PIPELINE AUDIT\n';
  pipeLog += '==================================================\n';
  pipeLog += `[Raw HTML Snippet]\n${rawHtmlSnippet || '...(not found in HTML)...'}\n\n`;
  pipeLog += `[Decoded Text]\n${decodedSnippet}\n\n`;
  pipeLog += `[After Cleanup]\n${cleanupSnippet}\n\n`;
  pipeLog += `[After Unicode Normalize]\n${normalizedSnippet}\n\n`;
  pipeLog += `[Final Text]\n${finalSnippet}\n`;
  pipeLog += '==================================================\n';
  
  console.log(pipeLog);
  if (window.storyAPI?.appendTitleDebugLog) {
    window.storyAPI.appendTitleDebugLog(pipeLog);
  }
}

function generateVolumeHeader(bookTitle, author, filenameOrTitle, chapterCount = 0, crawlerVolume = '', crawlerVolumeSource = '') {
  const cleanBookTitle = (bookTitle || 'Truyện đã dọn').trim();
  const cleanAuthor = (author || '').trim();
  let volumeName = 'Tập 1';
  let source = 'auto calculation';

  if (filenameOrTitle) {
    const match = filenameOrTitle.match(/(?:Tập|Vol|Volume|T[ậ]p|Quyển)\s*\d+/i);
    if (match) {
      volumeName = match[0];
      if (filenameOrTitle !== bookTitle) {
        source = 'export settings';
      } else {
        source = 'filename';
      }
    } else {
      const numMatch = filenameOrTitle.match(/\b\d+\b/);
      if (numMatch) {
        volumeName = `Tập ${numMatch[0]}`;
        if (filenameOrTitle !== bookTitle) {
          source = 'export settings';
        } else {
          source = 'filename';
        }
      }
    }
  }

  if (source === 'auto calculation' && crawlerVolume) {
    const match = crawlerVolume.match(/(?:Tập|Vol|Volume|T[ậ]p|Quyển)\s*\d+/i);
    if (match) {
      volumeName = match[0];
      source = crawlerVolumeSource || 'metadata';
    } else {
      volumeName = crawlerVolume;
      source = crawlerVolumeSource || 'metadata';
    }
  }

  const firstLine = cleanAuthor 
    ? `${cleanBookTitle} - Tác giả: ${cleanAuthor}`
    : cleanBookTitle;
  
  console.log('[Volume Header]');
  console.log(`bookTitle: ${cleanBookTitle}`);
  console.log(`author: ${cleanAuthor}`);
  console.log(`volume: ${volumeName}`);
  console.log(`chapterCount: ${chapterCount}`);
  console.log(`source: ${source}`);

  return {
    firstLine,
    volumeLine: volumeName,
    source
  };
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
    .replace(/[‘’]/g, "'")
    .replace(/[ \t]+([,.!?;:…])/g, '$1')
    .replace(/([,.!?;:…])(?=[^\s\n"'“”‘’])/g, '$1 ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n');
}

function localReflow(text='') {
  const logMsg = `[Reflow Call] Running localReflow()`;
  console.log(logMsg);
  if (window.storyAPI?.appendTitleDebugLog) {
    window.storyAPI.appendTitleDebugLog(logMsg + '\n--------------------------------------------------');
  }

  let t = text.trim();
  if (!t) return '';

  // Just return the original layout with normalized empty lines (using \n\n)
  // split by \n, trim each line, and join with double newlines
  const paragraphs = t.split('\n').map(line => line.trim()).filter(Boolean);
  return paragraphs.join('\n\n');
}

function logPipelineStage(stageName, text) {
  if (!DEBUG_TEXT) return;
  const snippetFirst = text ? text.slice(0, 1000) : '';
  const snippetLast = text ? text.slice(-1000) : '';
  const len = text ? text.length : 0;
  const logMsg = `[${stageName}]\nlength: ${len}\nfirst 1000 chars:\n${snippetFirst}\nlast 1000 chars:\n${snippetLast}\n--------------------------------------------------`;
  console.log(logMsg);
  if (window.storyAPI?.appendTitleDebugLog) {
    window.storyAPI.appendTitleDebugLog(logMsg);
  }
}

function logParagraphStageText(stageNum, text) {
  if (!DEBUG_TEXT) return;
  const len = text ? text.length : 0;
  const snippetFirst = text ? text.slice(0, 1000) : '';
  const snippetLast = text ? text.slice(-1000) : '';
  const logMsg = `[Paragraph Stage ${stageNum}]\nlength: ${len}\nfirst 1000 chars:\n${snippetFirst}\nlast 1000 chars:\n${snippetLast}\n--------------------------------------------------`;
  console.log(logMsg);
  if (window.storyAPI?.appendTitleDebugLog) {
    window.storyAPI.appendTitleDebugLog(logMsg);
  }
}

function logParagraphStage(rawInput, cleanedOutput) {
  if (!DEBUG_TITLE) return;
  const rawParagraphs = rawInput.split('\n').map(p => p.trim()).filter(Boolean);
  const cleanedParagraphs = cleanedOutput.split('\n').map(p => p.trim()).filter(Boolean);
  
  let logMsg = `[Paragraph Stage]\n`;
  logMsg += `paragraphCount: ${cleanedParagraphs.length}\n`;
  logMsg += `paragraphLengths: ${cleanedParagraphs.map(p => p.length).join(', ')}\n`;
  logMsg += `\n---\n[Paragraph Before Cleanup]\n`;
  rawParagraphs.slice(0, 10).forEach((p, idx) => {
    logMsg += `paragraph ${idx + 1}:\n${p}\n`;
  });
  logMsg += `\n---\n[Paragraph After Cleanup]\n`;
  cleanedParagraphs.slice(0, 10).forEach((p, idx) => {
    logMsg += `paragraph ${idx + 1}:\n${p}\n`;
  });
  logMsg += `\n---\n[Final Text]\n`;
  logMsg += `${cleanedOutput.slice(0, 2000)}\n`;
  logMsg += `--------------------------------------------------`;
  
  console.log(logMsg);
  if (window.storyAPI?.appendTitleDebugLog) {
    window.storyAPI.appendTitleDebugLog(logMsg);
  }
}

const ctaRegexes = [
  /Bạn đang đọc truyện mới tại/i,
  /Bạn đang đọc truyện tại/i,
  /Bạn đang đọc tại/i,
  /Truyện được cập nhật liên tục/i,
  /Truyện được dịch trực tiếp tại/i,
  /Truyện dịch trực tiếp tại/i,
  /Hãy nhớ hàng ngày vào đọc bạn nhé/i,
  /Bên khác copy sẽ thiếu nội dung/i,
  /Rất xin lỗi mọi người vì hiện quảng cáo/i,
  /Mong các bạn tiếp tục ủng hộ/i,
  /ủng hộ chúng mình/i,
  /ủng hộ team/i,
  /Chúc bạn đọc truyện vui vẻ/i,
  /dịch giả:/i,
  /editor:/i,
  /truyện được đăng tải duy nhất tại/i,
  /đọc truyện vui vẻ/i,
  /vào đọc bạn nhé/i,
  /thiếu nội dung chương đó/i,
  /vui lòng đọc tại/i
];

const footerRegexes = [
  /^(?:Nguồn|Nguon|Website|Website chính thức|Website chinh thuc|Theo dõi chúng tôi|Theo doi chung toi|Fanpage|Telegram|Discord|Facebook|Group|Group Facebook|Kênh|Kênh chính thức|Kenh chinh thuc)[:\-\s]/i,
  /^(?:Nguồn|Nguon|Website|Website chính thức|Website chinh thuc|Theo dõi chúng tôi|Theo doi chung toi|Fanpage|Telegram|Discord|Facebook|Group|Group Facebook)[:\s]/i,
  /^(?:Đọc truyện online tại|Doc truyen online tai|Truy cập để đọc|Truy cap de doc|Ghé thăm|Ghe tham|Truyện được cập nhật sớm nhất tại)[:\s]/i
];

function logSanitizerAction(reason, text) {
  const cleanText = text.trim();
  const logMsg = `\n[Sanitizer Removed]\n\nreason:\n${reason}\n\nremoved:\n${cleanText}\n`;
  console.log(logMsg);
  if (window.storyAPI?.appendTitleDebugLog) {
    window.storyAPI.appendTitleDebugLog(logMsg);
  }
}

function normalizeForComparison(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function getChapterInfo(line) {
  const numMatch = line.match(/(?:Chương|chuong|Chap|chap|Chapter|chapter|Tập|tap|Quyển|quyển)\s*(\d+(?:\.\d+)?)/i);
  if (!numMatch) return null;
  const num = parseFloat(numMatch[1]);
  
  const index = line.toLowerCase().indexOf(numMatch[0].toLowerCase());
  let titlePart = '';
  if (index !== -1) {
    titlePart = line.slice(index + numMatch[0].length).replace(/^[:\s\-–—\._]+/, '').trim();
  }
  return { num, titlePart };
}

function checkDuplicateTitles(lineA, lineB) {
  const infoA = getChapterInfo(lineA);
  const infoB = getChapterInfo(lineB);
  
  if (infoA && infoB && infoA.num === infoB.num) {
    const normA = normalizeForComparison(infoA.titlePart);
    const normB = normalizeForComparison(infoB.titlePart);
    
    if (normA === normB || (normA && normB && (normA.includes(normB) || normB.includes(normA)))) {
      const isANav = /home|trang chủ|trang chu|danh mục|danh muc/i.test(lineA);
      const isBNav = /home|trang chủ|trang chu|danh mục|danh muc/i.test(lineB);
      
      if (isANav && !isBNav) {
        return { keep: lineB, remove: lineA };
      } else if (isBNav && !isANav) {
        return { keep: lineA, remove: lineB };
      } else {
        if (lineA.length > lineB.length) {
          return { keep: lineB, remove: lineA };
        } else {
          return { keep: lineA, remove: lineB };
        }
      }
    }
  }
  return null;
}

function isNavigation(trimmed, bookTitle = '') {
  const lower = trimmed.toLowerCase();
  
  const shortNavTerms = [
    'danh mục', 'danh mục truyện', 'đọc truyện', 'đọc truyện online', 
    'chương trước', 'chương tiếp', 'chương sau', 'trở lại', 'mục lục',
    'báo lỗi', 'cài đặt', 'góp ý'
  ];
  if (shortNavTerms.includes(lower)) {
    return true;
  }
  
  if (
    (lower.includes('chương trước') || lower.includes('chương tiếp') || lower.includes('chương sau') || lower.includes('mục lục') || lower.includes('trang chủ') || lower.includes('danh mục')) &&
    (lower.includes('|') || lower.includes('-') || lower.includes('•') || lower.includes('·') || lower.includes('>') || lower.includes('<') || lower.includes('/') || lower.includes('\\') || lower.includes('»') || lower.includes('«'))
  ) {
    return true;
  }

  const breadcrumbKeywords = ['home', 'trang chủ', 'danh mục', 'đọc truyện', 'chương trước', 'chương tiếp', 'chương sau'];
  const hasKeyword = breadcrumbKeywords.some(kw => lower.includes(kw));
  const hasSeparator = />|»|«|<|\/|\||\\|•|·/.test(trimmed);
  if (hasKeyword && hasSeparator) {
    if (trimmed.length < 250) {
      return true;
    }
  }
  
  if (/^(home|trang chủ)\b/i.test(trimmed)) {
    if (lower.includes('chương') || lower.includes('tập') || lower.includes('quyển') || (bookTitle && lower.includes(bookTitle.toLowerCase()))) {
      if (trimmed.length < 250) {
        return true;
      }
    }
  }

  if (/^[><»«\s\-|\/\\•·]+$/.test(trimmed)) {
    return true;
  }

  return false;
}

function isProductAd(trimmed) {
  const normalized = trimmed.toLowerCase();
  
  const specificPhrases = [
    'áo thun',
    'form oversize',
    'nam nữ mặc đều được',
    'đi học, đi làm, đi chơi',
    'mọi người ủng hộ nhé'
  ];
  
  if (specificPhrases.some(phrase => normalized.includes(phrase))) {
    return true;
  }
  
  if (normalized.includes('cám ơn') || normalized.includes('cảm ơn')) {
    if (normalized.includes('áo') || normalized.includes('thun') || normalized.includes('oversize') || normalized.includes('form') || normalized.includes('shop') || normalized.includes('sản phẩm') || normalized.includes('basic')) {
      return true;
    }
  }
  
  return false;
}

function sanitizeContent(text, bookTitle = '') {
  if (!text) return '';
  const lines = text.split('\n');
  
  let removedBreadcrumbs = 0;
  let removedCTA = 0;
  let removedDuplicateTitles = 0;
  let removedFooterBlocks = 0;

  const lineObjects = lines.map(line => ({
    text: line,
    trimmed: line.trim(),
    removed: false,
    reason: ''
  }));

  // Pass 1: Duplicate Chapter Titles on consecutive non-empty lines
  for (let i = 0; i < lineObjects.length - 1; i++) {
    if (lineObjects[i].removed || !lineObjects[i].trimmed) {
      continue;
    }
    
    let nextIdx = -1;
    for (let j = i + 1; j < lineObjects.length; j++) {
      if (lineObjects[j].trimmed && !lineObjects[j].removed) {
        nextIdx = j;
        break;
      }
    }
    
    if (nextIdx === -1) {
      break;
    }
    
    const dupResult = checkDuplicateTitles(lineObjects[i].text, lineObjects[nextIdx].text);
    if (dupResult) {
      removedDuplicateTitles++;
      const removeIdx = (dupResult.remove === lineObjects[i].text) ? i : nextIdx;
      lineObjects[removeIdx].removed = true;
      lineObjects[removeIdx].reason = 'duplicate-title';
      logSanitizerAction('duplicate-title', dupResult.remove);
    }
  }

  // Pass 2: Navigation, CTA, and Footer on remaining non-empty lines
  for (let i = 0; i < lineObjects.length; i++) {
    const obj = lineObjects[i];
    if (obj.removed || !obj.trimmed) {
      continue;
    }

    if (isNavigation(obj.trimmed, bookTitle)) {
      removedBreadcrumbs++;
      obj.removed = true;
      obj.reason = 'breadcrumb';
      logSanitizerAction('breadcrumb', obj.text);
      continue;
    }

    if (isProductAd(obj.trimmed)) {
      obj.removed = true;
      obj.reason = 'product-ad';
      logSanitizerAction('product-ad', obj.text);
      continue;
    }

    if (ctaRegexes.some(rx => rx.test(obj.trimmed))) {
      removedCTA++;
      obj.removed = true;
      obj.reason = 'cta';
      logSanitizerAction('cta', obj.text);
      continue;
    }

    if (footerRegexes.some(rx => rx.test(obj.trimmed))) {
      removedFooterBlocks++;
      obj.removed = true;
      obj.reason = 'footer-block';
      logSanitizerAction('footer-block', obj.text);
      continue;
    }
  }

  const finalLines = [];
  for (const obj of lineObjects) {
    if (obj.removed) {
      continue;
    }
    finalLines.push(obj.text);
  }

  const finalParagraphCount = finalLines.filter(line => line.trim() !== '').length;
  
  const summaryMsg = `\n[Sanitizer Summary]\n\nremovedBreadcrumbs:\n${removedBreadcrumbs}\n\nremovedCTA:\n${removedCTA}\n\nremovedDuplicateTitles:\n${removedDuplicateTitles}\n\nremovedFooterBlocks:\n${removedFooterBlocks}\n\nfinalParagraphCount:\n${finalParagraphCount}\n`;
  console.log(summaryMsg);
  if (window.storyAPI?.appendTitleDebugLog) {
    window.storyAPI.appendTitleDebugLog(summaryMsg);
  }

  return finalLines.join('\n');
}

function cleanStoryText(input, options, filters, bookTitle = '') {
  let text = input || '';
  text = sanitizeContent(text, bookTitle);
  logPipelineStage('Paragraph Before Extraction', text);
  logParagraphStageText(1, text);

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
  logParagraphStageText(2, text);

  if (options.restoreFilteredWords) {
    parseRules(filters.restoreRules).forEach(r => {
      // Space removed from pattern character class [\\*\\.·…_-]
      const pattern = escapeRegExp(r.from).replace(/\\\*/g, '[\\*\\.·…_-]+');
      text = text.replace(new RegExp(pattern, 'gi'), r.to);
    });
    logPipelineStage('Paragraph After Extraction', text);
  }
  logParagraphStageText(3, text);

  if (options.autoReplace) {
    parseRules(filters.replaceRules).forEach(r => {
      text = text.replace(new RegExp(escapeRegExp(r.from), 'gi'), r.to);
    });
  }
  logParagraphStageText(4, text);

  // Terminology Consistency
  text = text.replace(/Ba hồn bảy vía/g, 'Tam hồn thất phách');
  text = text.replace(/ba hồn bảy vía/gi, 'tam hồn thất phách');
  text = text.replace(/Ba hồn thất phách/g, 'Tam hồn thất phách');
  text = text.replace(/ba hồn thất phách/gi, 'tam hồn thất phách');
  text = text.replace(/Bảy vía/g, 'Thất phách');
  text = text.replace(/bảy vía/gi, 'thất phách');

  // Convert Polish Cleanups
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
  logParagraphStageText(5, text);

  if (options.normalizeSpaces) {
    text = normalizePunctuation(text);
    text = text.split('\n').map(line => line.trim()).join('\n').replace(/\n{3,}/g, '\n\n');
    logPipelineStage('Paragraph After Normalize', text);
  }
  logParagraphStageText(6, text);

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
  logParagraphStageText(7, text);

  if (options.reflowLayout) {
    text = localReflow(text);
    logPipelineStage('Paragraph Before UI', text);
  }
  logParagraphStageText(8, text);

  const finalResult = protector.restore(text).trim();
  logPipelineStage('Final Text', finalResult);
  logParagraphStageText(9, finalResult);
  logParagraphStage(input, finalResult);
  return finalResult;
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
  
  let crawlerVolume = '';
  let crawlerVolumeSource = '';
  for (const ch of chapters) {
    if (ch.volume) {
      crawlerVolume = ch.volume;
      crawlerVolumeSource = ch.volumeSource || 'metadata';
      break;
    }
  }
  const headerInfo = generateVolumeHeader(title, author, '', chapters.length, crawlerVolume, crawlerVolumeSource);
  const introHtml = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="vi">
<head>
  <title>Introduction</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
  <style type="text/css">
    .intro-container { text-align: center; margin-top: 25%; }
    .intro-title { font-size: 1.8em; font-weight: bold; margin-bottom: 0.5em; }
    .intro-volume { font-size: 1.4em; font-weight: bold; color: #555; }
  </style>
</head>
<body>
  <div class="intro-container">
    <div class="intro-title">${escapeHtml(headerInfo.firstLine)}</div>
    <div class="intro-volume">${escapeHtml(headerInfo.volumeLine)}</div>
  </div>
</body>
</html>`;
  oebps.file('intro.xhtml', introHtml);

  chapters.forEach((ch,i)=>oebps.file(`chapter-${i+1}.xhtml`, makeChapterXhtml(ch,i,title)));
  const manifest = `<item id="intro" href="intro.xhtml" media-type="application/xhtml+xml"/>\n` + chapters.map((_,i)=>`<item id="ch${i+1}" href="chapter-${i+1}.xhtml" media-type="application/xhtml+xml"/>`).join('\n');
  const spine = `<itemref idref="intro"/>\n` + chapters.map((_,i)=>`<itemref idref="ch${i+1}"/>`).join('\n');
  oebps.file('content.opf',`<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">${Date.now()}</dc:identifier><dc:title>${escapeHtml(title||'Truyện đã dọn')}</dc:title><dc:creator>${escapeHtml(author||'Unknown')}</dc:creator><dc:language>vi</dc:language></metadata><manifest><item id="style" href="style.css" media-type="text/css"/>${manifest}</manifest><spine>${spine}</spine></package>`);
  return zip.generateAsync({ type:'blob', mimeType:'application/epub+zip' });
}

async function buildDocx({ title, author, chapters, isTTS = false, bookTitle = '', exportMode = 'single' }) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak } = await import('docx');
  const children = [];
  
  let crawlerVolume = '';
  let crawlerVolumeSource = '';
  for (const ch of chapters) {
    if (ch.volume) {
      crawlerVolume = ch.volume;
      crawlerVolumeSource = ch.volumeSource || 'metadata';
      break;
    }
  }
  const headerInfo = generateVolumeHeader(bookTitle || title, author, title, chapters.length, crawlerVolume, crawlerVolumeSource);
  
  children.push(new Paragraph({
    text: headerInfo.firstLine,
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { after: exportMode === 'volume' ? 240 : 480 }
  }));

  if (exportMode === 'volume') {
    children.push(new Paragraph({
      text: headerInfo.volumeLine,
      heading: HeadingLevel.HEADING_2,
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 }
    }));
  }

  chapters.forEach((chapter, index) => {
    if (index > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    const cleanTitle = formatChapterTitleForExport(chapter.title || '', index, bookTitle || title);
    children.push(new Paragraph({
      text: cleanTitle,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
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
        spacing: isTTS ? { before: 0, after: 0, line: 360 } : { before: 120, after: 180, line: 420 },
        indent: isTTS ? { firstLine: 0 } : { firstLine: 420 }
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
  const contentFiles = entries.filter(f=>!/nav|toc|cover|intro/i.test(f.name));
  const files = (contentFiles.length ? contentFiles : entries).sort((a,b)=>a.name.localeCompare(b.name, undefined, {numeric:true}));
  const chapters = [];
  for (let i=0;i<files.length;i++) {
    const html = await files[i].async('string');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rawTitle = (doc.querySelector('h1,h2,title')?.textContent || `Chương ${i+1}`).trim();
    const cleanTitle = normalizeChapterTitle(rawTitle, i + 1);
    const docTitle = formatChapterTitleForExport(cleanTitle, i, bookTitleStr);
    const volMatch = rawTitle.match(/(?:Tập|Vol|Volume|Quyển|T[ậ]p)\s*(\d+)/i);
    const chVolume = volMatch ? `Tập ${volMatch[1]}` : '';
    const chVolumeSource = volMatch ? 'import source' : '';
    doc.querySelectorAll('script,style,nav').forEach(n=>n.remove());
    const paragraphs = [...doc.body.querySelectorAll('p,div')].map(n=>n.textContent.trim()).filter(t=>t && t.length>1);
    let text = paragraphs.length ? paragraphs.join('\n\n') : (doc.body?.textContent || '').replace(/\n{3,}/g,'\n\n').trim();
    text = stripTitleFromText(text, docTitle, bookTitleStr);
    text = stripTitleFromText(text, rawTitle, bookTitleStr);
    text = stripTitleFromText(text, cleanTitle, bookTitleStr);
    const sanitizedText = sanitizeContent(text, bookTitleStr);
    if (sanitizedText) chapters.push({title: cleanTitle, number: i + 1, url:'', raw:sanitizedText, cleaned:sanitizedText, volume: chVolume, volumeSource: chVolumeSource});
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

function enforceRulesPostAI(text) {
  let processed = text || '';

  // Convert vocabulary - safe deterministic replacements
  processed = processed.replace(/trọng sát khí/gi, 'sát khí nặng nề');

  processed = processed.replace(/Hiểu,\s*ta\s*sớm\s*nên\s*hiểu\.?/gi, 'Ta hiểu rồi, lẽ ra ta nên hiểu từ sớm.');

  processed = processed.replace(/Đã\s+bái\s+kiến\s+(.+?)([.!?。！？…\n])/gi, 'Bái kiến $1$2');
  processed = processed.replace(/Đã\s+gặp\s+(.+?)([.!?。！？…\n])/gi, 'Bái kiến $1$2');
  processed = processed.replace(/Gặp\s+qua\s+(.+?)([.!?。！？…\n])/gi, 'Bái kiến $1$2');

  processed = processed.replace(/Lại\s+mở\s+mắt\s+ra/gi, 'Khi mở mắt ra lần nữa');

  processed = processed.replace(/trong\s+mắt\s+đã\s+thấy\s+tơ\s+máu/gi, 'đôi mắt nổi đầy tơ máu');
  processed = processed.replace(/mắt\s+đã\s+thấy\s+tơ\s+máu/gi, 'đôi mắt nổi đầy tơ máu');

  // User preference: use "gia", not "nhà họ"
  processed = processed.replace(/\b(Triệu|Liễu|Vương|Trần|Diệp)\s+Gia\s+bọn\s+họ\b/gi, '$1 gia');
  processed = processed.replace(/\b(Triệu|Liễu|Vương|Trần|Diệp)\s+gia\s+bọn\s+họ\b/gi, '$1 gia');

  // Title placement style preference: e.g. "Triệu gia thiếu chủ" -> "thiếu chủ Triệu gia"
  const clans = ['Triệu', 'Liễu', 'Vương', 'Trần', 'Diệp'];
  const titles = ['thiếu chủ', 'Đại trưởng lão', 'gia chủ', 'tộc trưởng', 'trưởng lão', 'đường chủ', 'điện chủ', 'công tử', 'thiếu gia', 'tứ thiếu gia', 'các chủ'];

  for (const clan of clans) {
    for (const title of titles) {
      const patternStr = `\\b${clan}\\s+[gG]ia\\s+${title}\\b`;
      const regex = new RegExp(patternStr, 'gi');
      processed = processed.replace(regex, (match, offset, fullText) => {
        const before = fullText.slice(0, offset).trim();
        const lastChar = before.slice(-1);
        const isStartOfSentence = before.length === 0 || 
                                  /[\.\n\?!“"']/.test(lastChar) ||
                                  (lastChar === '»' && /[\.\?!]/.test(before.slice(-2, -1)));
        
        let resultTitle = title;
        if (isStartOfSentence) {
          resultTitle = title.charAt(0).toUpperCase() + title.slice(1);
        } else {
          resultTitle = title.charAt(0).toLowerCase() + title.slice(1);
        }
        return `${resultTitle} ${clan} gia`;
      });
    }
  }

  // Style Preference Rules (Keep separate from fact rules)
  processed = processed.replace(/(?<=[.!?。！？…\n]|^|“|")\s*Triệu\s+Gia\s+thiếu\s+chủ\b/g, 'Thiếu chủ Triệu gia');
  processed = processed.replace(/Triệu\s+Gia\s+thiếu\s+chủ\b/g, 'thiếu chủ Triệu gia');
  processed = processed.replace(/(?<=[.!?。！？…\n]|^|“|")\s*Triệu\s+Gia\s+Đại\s+trưởng\s+lão\b/g, 'Đại trưởng lão Triệu gia');
  processed = processed.replace(/Triệu\s+Gia\s+Đại\s+trưởng\s+lão\b/g, 'đại trưởng lão Triệu gia');
  processed = processed.replace(/Sát\s+khí\s+nặng\s+nề\s+như\s+vậy,\s+ai\s+mà\s+chọc\s+vào\s+hắn/gi, 'Sát khí nặng nề như vậy, ai lại chọc hắn vậy?');

  // Convert vocabulary & dialogue naturalization
  processed = processed.replace(/ai dám chọc (vào )?hắn([.!?。！？…\s]*)(["”']?)/gi, 'ai lại chọc hắn vậy?$2');
  processed = processed.replace(/đối xử tốt với muội muội ta([.!?。！？…\s]*)(["”']?)/gi, 'đối xử tốt với muội muội ta là được$1$2');

  return processed;
}

function validateChunkFactIssues(origChunkText, rawAiChunkText, finalChunkText, chunkIndex, flowLabel) {
  const issues = [];

  const protectedTerms = [
    'Đại trưởng lão',
    'thiếu chủ',
    'gia chủ',
    'tộc trưởng',
    'trưởng lão',
    'đường chủ',
    'điện chủ'
  ];

  const origLower = (origChunkText || '').toLowerCase();
  const finalLower = (finalChunkText || '').toLowerCase();

  for (const term of protectedTerms) {
    const termLower = term.toLowerCase();
    if (origLower.includes(termLower) && !finalLower.includes(termLower)) {
      // Split chunk into paragraphs
      const origParagraphs = (origChunkText || '').split('\n').map(p => p.trim()).filter(Boolean);
      const rawParagraphs = (rawAiChunkText || '').split('\n').map(p => p.trim()).filter(Boolean);
      const finalParagraphs = (finalChunkText || '').split('\n').map(p => p.trim()).filter(Boolean);

      let origParagraph = '';
      let rawParagraph = '';
      let finalParagraph = '';
      let pIdx = -1;

      for (let i = 0; i < origParagraphs.length; i++) {
        if (origParagraphs[i].toLowerCase().includes(termLower)) {
          origParagraph = origParagraphs[i];
          pIdx = i;
          break;
        }
      }

      if (pIdx !== -1) {
        if (rawParagraphs[pIdx]) {
          rawParagraph = rawParagraphs[pIdx];
        } else {
          const ratio = pIdx / Math.max(1, origParagraphs.length);
          const targetIndex = Math.min(Math.floor(ratio * rawParagraphs.length), rawParagraphs.length - 1);
          rawParagraph = rawParagraphs[targetIndex] || '';
        }

        if (finalParagraphs[pIdx]) {
          finalParagraph = finalParagraphs[pIdx];
        } else {
          const ratio = pIdx / Math.max(1, origParagraphs.length);
          const targetIndex = Math.min(Math.floor(ratio * finalParagraphs.length), finalParagraphs.length - 1);
          finalParagraph = finalParagraphs[targetIndex] || '';
        }

        const splitSentences = (text) => {
          if (!text) return [];
          return text.split(/(?<=[.!?。！？…\n])\s+/).map(s => s.trim()).filter(Boolean);
        };

        const origSents = splitSentences(origParagraph);
        const rawSents = splitSentences(rawParagraph);
        const finalSents = splitSentences(finalParagraph);

        let sIdx = -1;
        let origSnippet = '';
        for (let j = 0; j < origSents.length; j++) {
          if (origSents[j].toLowerCase().includes(termLower)) {
            origSnippet = origSents[j];
            sIdx = j;
            break;
          }
        }

        if (sIdx === -1) {
          origSnippet = origParagraph;
          sIdx = 0;
        }

        let rawSnippet = '';
        if (rawSents[sIdx]) {
          rawSnippet = rawSents[sIdx];
        } else {
          rawSnippet = rawSents[rawSents.length - 1] || rawParagraph;
        }

        let finalSnippet = '';
        if (finalSents[sIdx]) {
          finalSnippet = finalSents[sIdx];
        } else {
          finalSnippet = finalSents[finalSents.length - 1] || finalParagraph;
        }

        // Determine error source
        let errorSource = '';
        const rawLower = rawSnippet.toLowerCase();
        const finalLower = finalSnippet.toLowerCase();

        if (!rawLower.includes(termLower)) {
          errorSource = 'AI_RAW_OUTPUT';
        } else if (rawLower.includes(termLower) && !finalLower.includes(termLower)) {
          errorSource = 'POST_PROCESSING_OR_SAVE';
        } else {
          // Fallback checking in entire chunk
          const entireRawLower = rawAiChunkText.toLowerCase();
          const entireFinalLower = finalChunkText.toLowerCase();
          if (!entireRawLower.includes(termLower)) {
            errorSource = 'AI_RAW_OUTPUT';
          } else if (entireRawLower.includes(termLower) && !entireFinalLower.includes(termLower)) {
            errorSource = 'POST_PROCESSING_OR_SAVE';
          } else {
            errorSource = 'AI_RAW_OUTPUT';
          }
        }

        issues.push({
          type: 'missing-protected-title',
          term,
          message: `Thiếu danh xưng/chức vụ: ${term}`,
          origSnippet,
          rawSnippet,
          finalSnippet,
          errorSource,
          flow: flowLabel,
          chunkIndex
        });
      } else {
        issues.push({
          type: 'missing-protected-title',
          term,
          message: `Thiếu danh xưng/chức vụ: ${term}`,
          origSnippet: `(Không tìm thấy trong đoạn văn của chunk ${chunkIndex})`,
          rawSnippet: rawAiChunkText.slice(0, 200),
          finalSnippet: finalChunkText.slice(0, 200),
          errorSource: 'ORIGINAL_SNIPPET_NOT_FOUND',
          flow: flowLabel,
          chunkIndex
        });
      }
    }
  }

  return issues;
}

function replacePlaceholders(templateText, filters, promptSettings, mode) {
  const preserve = splitTerms(filters.preserveTerms).join(', ');
  const strength = HUMANIZE_PRESETS[promptSettings.humanizeStrength] || HUMANIZE_PRESETS.naturalAudio;
  const pronoun = PRONOUN_PRESETS[promptSettings.pronounStyle] || PRONOUN_PRESETS.balanced;
  const memory = (promptSettings.novelMemory || '').trim();
  const extra = (promptSettings.additionalInstructions || '').trim();
  const formattedPatterns = formatConvertPatternsForPrompt(CONVERT_PATTERNS);

  let text = templateText || '';
  if (mode !== 'story_cleaner' && !text.includes('{{convertPatterns}}')) {
    text = text + "\n\n==================================================\nQUY TẮC DỊCH VÀ CHUYỂN ĐỔI BIÊN TẬP (CONVERT PATTERNS)\n==================================================\n{{convertPatterns}}";
  }

  text = text.replace(/\{\{preserveTerms\}\}/g, preserve || 'không có');
  text = text.replace(/\{\{novelMemory\}\}/g, memory || 'Không có.');
  text = text.replace(/\{\{pronounStyle\}\}/g, pronoun || 'Không có.');
  text = text.replace(/\{\{humanizeStrength\}\}/g, strength || 'Không có.');
  text = text.replace(/\{\{extraInstructions\}\}/g, extra || 'Không có.');
  text = text.replace(/\{\{convertPatterns\}\}/g, formattedPatterns || 'Không có.');
  
  return text;
}

function buildCustomPrompt(mode, chunk, filters, index, total, previousTail='', promptSettings={}, templates) {
  let template = templates.aiNaturalVn;
  if (mode === 'story_cleaner') {
    template = templates.storyCleaner;
  }

  const systemPrompt = replacePlaceholders(template, filters, promptSettings, mode);
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
    chapters: [{title:'',number:1,url:'',raw:'',cleaned:''}],
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
  const appendTitleDebugLog = (message) => {
    if (!DEBUG_TITLE) {
      const titleHeaders = [
        '[Parser Input]', '[Parser Step 1]', '[Parser Step 2]', '[Parser Step 3]',
        '[Parser Step 4]', '[Parser Step 5]', '[Parser Final]', '[Title Candidates]',
        '[Title Ranking]', '[Ranking Decision]', '[Title Decision]', '[Metadata Extract]',
        '[Title Write]', '[Title Final]', '[IPC Send]', '[IPC Receive]', '[BookTitle Write]',
        '[Content Source]'
      ];
      if (titleHeaders.some(h => message.trim().startsWith(h))) {
        return;
      }
    }
    if (!DEBUG_TEXT) {
      const textHeaders = [
        '[Chapter HTML]', '[Removed Nodes]', '[After DOM Extract]',
        '[Paragraph Before Extraction]', '[Paragraph After Extraction]',
        '[Paragraph After Normalize]', '[Paragraph Before UI]', '[Final Text]', '[Paragraph Stage',
        '[Reflow Call]', '[Sanitizer Removed]', '[Sanitizer Summary]'
      ];
      if (textHeaders.some(h => message.trim().startsWith(h))) {
        return;
      }
    }
    if (window.storyAPI?.appendTitleDebugLog) {
      window.storyAPI.appendTitleDebugLog(message);
    }
  };
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
  const [showCacheDropdown, setShowCacheDropdown] = useState(false);
  const [showBatchExportModal, setShowBatchExportModal] = useState(false);
  const [exportStartCh, setExportStartCh] = useState(1);
  const [exportEndCh, setExportEndCh] = useState(10);
  const [exportFilename, setExportFilename] = useState('Tập 01');
  const [exportIsTTS, setExportIsTTS] = useState(false);


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
  const [aiSubTab, setAiSubTab] = useState('settings');
  const [activeReportTab, setActiveReportTab] = useState('success');
  const [expandedIssues, setExpandedIssues] = useState({});
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
  const [copyStatus, setCopyStatus] = useState('');

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
  const [options,setOptions]=useState({normalizeSpaces:true,mergeBrokenLines:true,reflowLayout:true,removeWatermark:true,restoreFilteredWords:true,autoReplace:true,ttsReadingMode:true,mergeSingleLines:true,reduceDocxBreaks:true,safeRegexPolish:true});
  const currentBook = books[bookIndex] || books[0] || createEmptyBook(1);
  const bookTitle = currentBook.title || 'Truyện đã dọn';
  const author = currentBook.author || '';
  const chapters = currentBook.chapters?.length ? currentBook.chapters : [{title:'',number:1,url:'',raw:'',cleaned:''}];
  const updateBook = (patchOrFn)=>setBooks(prev=>prev.map((book,idx)=>{
    if(idx!==bookIndex) return book;
    const patch = typeof patchOrFn === 'function' ? patchOrFn(book) : patchOrFn;
    
    if (patch && patch.title !== undefined && patch.title !== book.title) {
      const err = new Error();
      const stack = err.stack || '';
      let sourceName = 'unknown';
      if (stack.includes('loadChapterList')) sourceName = 'loadChapterList';
      else if (stack.includes('fetchCurrentUrl')) sourceName = 'fetchCurrentUrl';
      else if (stack.includes('fetchSelectedChapters')) sourceName = 'fetchSelectedChapters';
      else if (stack.includes('fetchBatchChapters')) sourceName = 'fetchBatchChapters';
      else if (stack.includes('import')) sourceName = 'import';
      else {
        const lines = stack.split('\n');
        if (lines.length > 2) {
          sourceName = lines[2].trim();
        }
      }
      const callerLines = stack.split('\n').slice(1, 5).map(line => line.trim()).filter(Boolean);
      const callerTrace = callerLines.join(' -> ');

      let logMsg = '[BookTitle Write]\n\n';
      logMsg += `before:\n${book.title || ''}\n\n`;
      logMsg += `after:\n${patch.title || ''}\n\n`;
      logMsg += `source:\n${sourceName}\n\n`;
      logMsg += `stack:\n${callerTrace}`;
      console.log(logMsg);
      appendTitleDebugLog(logMsg);
    }

    return {...book, ...patch, updatedAt:new Date().toISOString()};
  }));
  const setBookTitle = (title)=>updateBook({title});
  const setAuthor = (author)=>updateBook({author});
  const setChapters = (next) => {
    const err = new Error();
    const syncStack = err.stack || '';
    updateBook(book => {
      const oldChs = book.chapters || [];
      const newChsTemp = typeof next === 'function' ? next(oldChs) : next;
      const newChs = newChsTemp.map((ch, idx) => {
        if (!ch) return ch;
        const oldCh = oldChs[idx];
        const oldTitle = oldCh ? oldCh.title : undefined;
        const newTitle = ch.title;
        if (oldTitle !== newTitle) {
          let reason = 'unknown';
          if (syncStack.includes('loadChapterList')) reason = 'loadChapterList';
          else if (syncStack.includes('fetchCurrentUrl')) reason = 'fetchCurrentUrl';
          else if (syncStack.includes('fetchSelectedChapters')) reason = 'fetchSelectedChapters';
          else if (syncStack.includes('fetchBatchChapters')) reason = 'fetchBatchChapters';
          else if (syncStack.includes('addChapter')) reason = 'addChapter';
          else if (syncStack.includes('updateChapter')) {
            const lines = syncStack.split('\n');
            let caller = 'updateChapter';
            for (let l = 3; l < lines.length; l++) {
              const line = lines[l].trim();
              if (line && !line.includes('react') && !line.includes('node_modules')) {
                caller = `updateChapter -> ${line}`;
                break;
              }
            }
            reason = caller;
          }
          else if (syncStack.includes('removeChapter')) reason = 'removeChapter';
          else if (syncStack.includes('moveChapter')) reason = 'moveChapter';
          else if (syncStack.includes('import')) reason = 'import';
          else {
            const lines = syncStack.split('\n');
            for (let l = 2; l < lines.length; l++) {
              const line = lines[l].trim();
              if (line && !line.includes('react') && !line.includes('node_modules')) {
                reason = line;
                break;
              }
            }
          }
          let writeLog = '\n[Title Write]\n';
          writeLog += `before: ${oldTitle !== undefined ? oldTitle : ''}\n`;
          writeLog += `after: ${newTitle !== undefined ? newTitle : ''}\n`;
          writeLog += `chapterId: ${ch.id || idx}\n`;
          writeLog += `source: ${reason}\n`;
          writeLog += `stack:\n${syncStack}\n`;
          console.log(writeLog);
          appendTitleDebugLog(writeLog);
          return { ...ch, _lastWriter: reason };
        }
        return ch;
      });
      return { chapters: newChs };
    });
  };

  useEffect(() => {
    if (chapters && chapters[selected]) {
      const ch = chapters[selected];
      let finalLog = '\n[Title Final]\n';
      finalLog += `chapterTitle: ${ch.title || ''}\n`;
      console.log(finalLog);
      appendTitleDebugLog(finalLog);
    }
  }, [chapters, selected, bookTitle, author]);

  const addBook = ()=>{
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
            chapters: Array.isArray(b.chapters) && b.chapters.length ? b.chapters : [{title:'',number:1,url:'',raw:'',cleaned:''}]
          })));
          if (Number.isInteger(saved.bookIndex)) setBookIndex(Math.max(0, Math.min(saved.bookIndex, saved.books.length-1)));
        } else {
          setBooks([{...createEmptyBook(1), title:saved.bookTitle || 'Truyện đã dọn', author:typeof saved.author === 'string' ? saved.author : '', chapters:Array.isArray(saved.chapters) && saved.chapters.length ? saved.chapters : [{title:'',number:1,url:'',raw:'',cleaned:''}]}]);
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
          if (parsed.aiNaturalVn || parsed.storyCleaner) {
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

  const removeVietnameseTones = (str) => {
    if (typeof str !== 'string') return '';
    let s = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    s = s.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    s = s.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    s = s.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    s = s.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    s = s.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    s = s.replace(/đ/g, "d");
    s = s.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    s = s.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    s = s.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    s = s.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    s = s.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    s = s.replace(/Ỳ|Ý|Y|Ỷ|Ỹ/g, "Y");
    s = s.replace(/Đ/g, "D");
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const normalizeMetadataCompare = (str) => {
    if (!str) return '';
    let clean = str.replace(/[\*_`~]/g, '');
    clean = clean.toLowerCase();
    clean = removeVietnameseTones(clean);
    clean = clean.replace(/[^a-z0-9\s]/g, ' ');
    clean = clean.replace(/\s+/g, ' ').trim();
    return clean;
  };

  const isInvalidChapterTitle = (chapterTitle, bookTitleStr, authorStr) => {
    const logInvalid = (reason) => {
      let invalidLog = `\n[isInvalidChapterTitle = true]\n`;
      invalidLog += `chapterTitle: "${chapterTitle || ''}"\n`;
      invalidLog += `bookTitle: "${bookTitleStr || ''}"\n`;
      invalidLog += `author: "${authorStr || ''}"\n`;
      invalidLog += `reason: ${reason}\n`;
      console.log(invalidLog);
      appendTitleDebugLog(invalidLog);
    };

    if (!chapterTitle) {
      logInvalid('chapterTitle is empty/falsy');
      return true;
    }
    const normTitle = normalizeMetadataCompare(chapterTitle);
    if (!normTitle) {
      logInvalid('normalized title is empty');
      return true;
    }

    if (/^\d+$/.test(normTitle.replace(/\s+/g, ''))) {
      logInvalid('title is digits only');
      return true;
    }

    if (/(?:chuong|chap|chapter|tap|vol|volume|quyen|c)\s*(?:\d+|[ivxlcm]+)\b/i.test(normTitle)) {
      logInvalid('title contains chapter pattern only');
      return true;
    }

    const cleanedTitleWithoutChapter = normTitle
      .replace(/^(chuong|chapter|chap|tap|vol|volume|quyen|c)\s*(?:\d+|[ivxlcm]+)/gi, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
    if (cleanedTitleWithoutChapter === '') {
      logInvalid('cleaned title without chapter prefix is empty');
      return true;
    }

    if (bookTitleStr && bookTitleStr !== 'Truyện đã dọn') {
      const normBook = normalizeMetadataCompare(bookTitleStr);
      if (normBook && normTitle.includes(normBook)) {
        logInvalid(`normalized title "${normTitle}" contains normalized bookTitle "${normBook}"`);
        return true;
      }
    }

    if (authorStr) {
      const normAuthor = normalizeMetadataCompare(authorStr);
      if (normAuthor && normTitle.includes(normAuthor)) {
        logInvalid(`normalized title "${normTitle}" contains normalized author "${normAuthor}"`);
        return true;
      }
    }

    return false;
  };

  function normalizeChapterTitle(title, chapterNumber) {
    const res = _normalizeChapterTitle(title, chapterNumber);
    if (res !== title) {
      const err = new Error();
      const stack = err.stack || '';
      let writeLog = '\n[Title Write]\n';
      writeLog += `before: ${title || ''}\n`;
      writeLog += `after: ${res || ''}\n`;
      writeLog += `source: normalizeChapterTitle\n`;
      writeLog += `stack:\n${stack}\n`;
      console.log(writeLog);
      appendTitleDebugLog(writeLog);
    }
    return res;
  }

  function _normalizeChapterTitle(title, chapterNumber) {
    if (!title) return '';
    let t = String(title).trim();

    // Strip book title if available
    if (typeof bookTitle === 'string' && bookTitle && bookTitle !== 'Truyện đã dọn') {
      const escaped = bookTitle.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(?:của\\s+)?(?:truyện\\s+)?${escaped}\\s*[-_:]*\\s*`, 'gi');
      t = t.replace(regex, '');
    }

    // Strip author if available
    if (typeof author === 'string' && author) {
      const escaped = author.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b\\s*[-_:]*\\s*`, 'gi');
      t = t.replace(regex, '');
    }

    // 1. Find the last occurrence of chapter prefix
    let numPattern = '(?:\\d+(?:\\.\\d+)?|[ivxlcm]+)';
    if (chapterNumber !== undefined && chapterNumber !== null && String(chapterNumber).trim() !== '') {
      const escapedNum = String(chapterNumber).trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      numPattern = `(?:${escapedNum}|[ivxlcm]+|\\d+(?:\\.\\d+)?)`;
    }

    const regex = new RegExp(`(?:Chương|chuong|Chap|chap|Chapter|chapter|Tập|tap|Quyển|quyen)\\s*${numPattern}`, 'gi');

    let match;
    let lastMatchIndex = -1;
    let lastMatchLength = 0;

    while ((match = regex.exec(t)) !== null) {
      lastMatchIndex = match.index;
      lastMatchLength = match[0].length;
    }

    if (lastMatchIndex !== -1) {
      let remaining = t.substring(lastMatchIndex + lastMatchLength).trim();
      remaining = remaining.replace(/^[:\-\–\—\._\s]+/, '').trim();
      if (!remaining) {
        return '';
      }
      remaining = remaining.replace(/\s*[-_:]*\s*(truyenfull|sstruyen|tangthuvien|truyenyyeu|dtruyen|metruyenchu|wikidich|bachngocsach)\b.*$/i, '');
      remaining = remaining.replace(/[-_:\s\.\/\(\{\[]+$/, '').trim();
      return remaining;
    }

    // Fallback 1: Starts with chapter number
    const numRegex = new RegExp(`^\\s*${numPattern}\\s*[:\\-\\–\\—\\.\\s]\\s*(.*)$`, 'i');
    const numMatch = t.match(numRegex);
    if (numMatch) {
      let remaining = numMatch[1].trim();
      remaining = remaining.replace(/^[:\-\–\—\._\s]+/, '').trim();
      return remaining;
    }

    // Fallback 2: No chapter prefix found, but might have separators (SEO title format)
    const parts = t.split(/\s*[\-\|\_\–\—•/\\\u2013\u2014]\s*/);
    if (parts.length > 1) {
      const lastSeg = parts[parts.length - 1].trim();
      if (lastSeg) {
        let normLast = lastSeg.toLowerCase();
        let normBook = typeof bookTitle === 'string' ? bookTitle.toLowerCase() : '';
        let normAuthor = typeof author === 'string' ? author.toLowerCase() : '';
        if (normLast !== normBook && normLast !== normAuthor) {
          return lastSeg;
        }
      }
    }

    t = t.replace(/\s*[-_:]*\s*(truyenfull|sstruyen|tangthuvien|truyenyyeu|dtruyen|metruyenchu|wikidich|bachngocsach)\b.*$/i, '');
    return t;
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
      title: '',
      number: newChNum,
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
                const chapNum = extractChapterNumber({ title: text, url: absUrl }) !== 999999 ? extractChapterNumber({ title: text, url: absUrl }) : (chapterLinks.length + 1);
                const normTitle = normalizeChapterTitle(text || `Chương ${chapterLinks.length + 1}`, chapNum);
                if (normTitle !== text) {
                  const err = new Error();
                  const stack = err.stack || '';
                  let writeLog = '\n[Title Write]\n';
                  writeLog += `before: ${text || ''}\n`;
                  writeLog += `after: ${normTitle || ''}\n`;
                  writeLog += `source: loadChapterList\n`;
                  writeLog += `stack:\n${stack}\n`;
                  console.log(writeLog);
                  appendTitleDebugLog(writeLog);
                }
                console.log('[Title Source]');
                console.log('stage: chapter-list');
                console.log(`number: ${chapNum}`);
                console.log(`title: ${normTitle}`);
                chapterLinks.push({
                  title: normTitle,
                  number: chapNum,
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
        const res = await window.storyAPI.fetchChapter(ch.url, bookTitle);
        let ipcRecvLog = '\n[IPC Receive]\n';
        ipcRecvLog += `chapterTitle: ${res.chapterTitle || ''}\n`;
        console.log(ipcRecvLog);
        appendTitleDebugLog(ipcRecvLog);
        if (res.ok) {
          successCount++;
          if (res.bookTitle && (!bookTitle || bookTitle === 'Truyện đã dọn')) {
            setBookTitle(res.bookTitle);
          }
          if (res.author && (!author || author.trim() === '')) {
            setAuthor(res.author);
          }
          const chapNum = res.chapterNumber !== undefined && res.chapterNumber !== null ? res.chapterNumber : (idx + 1);
          
          let crawledTitle = '';
          if (res.chapterTitle && !isInvalidChapterTitle(res.chapterTitle, bookTitle || res.bookTitle, author || res.author)) {
            crawledTitle = res.chapterTitle;
          } else {
            crawledTitle = normalizeChapterTitle(res.title || ch.title, chapNum);
          }
          if (isInvalidChapterTitle(crawledTitle, bookTitle || res.bookTitle, author || res.author)) {
            crawledTitle = '';
          }
          const existingTitle = ch.title || '';
          if (existingTitle && !isInvalidChapterTitle(existingTitle, bookTitle, author)) {
            if (!crawledTitle || isInvalidChapterTitle(crawledTitle, bookTitle, author)) {
              crawledTitle = existingTitle;
            }
          }
          
          const strippedText = stripTitleFromText(res.text || '', crawledTitle, bookTitle);
          
          console.log(`[Pipeline Trace][Crawler Fetch] fetchSelectedChapters - Chapter ${idx + 1}:`, {
            originalTitle: res.title,
            normalizedTitle: crawledTitle,
            textLengthBeforeStrip: (res.text || '').length,
            textLengthAfterStrip: strippedText.length
          });

          console.log('[Title Source]');
          console.log('stage: fetch-selected');
          console.log(`res.title: ${res.title}`);
          console.log(`res.chapterTitle: ${res.chapterTitle}`);
          console.log(`chapter.title.before: ${ch.title}`);
          console.log(`chapter.title.after: ${crawledTitle}`);

          if (ch.title !== crawledTitle) {
            const err = new Error();
            const stack = err.stack || '';
            let writeLog = '\n[Title Write]\n';
            writeLog += `before: ${ch.title || ''}\n`;
            writeLog += `after: ${crawledTitle || ''}\n`;
            writeLog += `source: fetchSelectedChapters\n`;
            writeLog += `stack:\n${stack}\n`;
            console.log(writeLog);
            appendTitleDebugLog(writeLog);
          }

          updateChapter(idx, {
            title: crawledTitle,
            number: chapNum,
            volume: res.volume || '',
            volumeSource: res.volume ? 'metadata' : '',
            raw: strippedText,
            cleaned: cleanStoryText(strippedText, options, filters, bookTitle)
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
        const res = await window.storyAPI.fetchChapter(ch.url, bookTitle);
        let ipcRecvLog = '\n[IPC Receive]\n';
        ipcRecvLog += `chapterTitle: ${res.chapterTitle || ''}\n`;
        console.log(ipcRecvLog);
        appendTitleDebugLog(ipcRecvLog);
        if (res.ok) {
          successCount++;
          if (res.bookTitle && (!bookTitle || bookTitle === 'Truyện đã dọn')) {
            setBookTitle(res.bookTitle);
          }
          if (res.author && (!author || author.trim() === '')) {
            setAuthor(res.author);
          }
          const chapNum = res.chapterNumber !== undefined && res.chapterNumber !== null ? res.chapterNumber : (idx + 1);
          
          let crawledTitle = '';
          if (res.chapterTitle && !isInvalidChapterTitle(res.chapterTitle, bookTitle || res.bookTitle, author || res.author)) {
            crawledTitle = res.chapterTitle;
          } else {
            crawledTitle = normalizeChapterTitle(res.title || ch.title, chapNum);
          }
          if (isInvalidChapterTitle(crawledTitle, bookTitle || res.bookTitle, author || res.author)) {
            crawledTitle = '';
          }
          const existingTitle = ch.title || '';
          if (existingTitle && !isInvalidChapterTitle(existingTitle, bookTitle, author)) {
            if (!crawledTitle || isInvalidChapterTitle(crawledTitle, bookTitle, author)) {
              crawledTitle = existingTitle;
            }
          }
          
          const strippedText = stripTitleFromText(res.text || '', crawledTitle, bookTitle);
          
          console.log(`[Pipeline Trace][Crawler Fetch] fetchBatchChapters - Chapter ${idx + 1}:`, {
            originalTitle: res.title,
            normalizedTitle: crawledTitle,
            textLengthBeforeStrip: (res.text || '').length,
            textLengthAfterStrip: strippedText.length
          });

          console.log('[Title Source]');
          console.log('stage: fetch-batch');
          console.log(`res.title: ${res.title}`);
          console.log(`res.chapterTitle: ${res.chapterTitle}`);
          console.log(`chapter.title.before: ${ch.title}`);
          console.log(`chapter.title.after: ${crawledTitle}`);

          if (ch.title !== crawledTitle) {
            const err = new Error();
            const stack = err.stack || '';
            let writeLog = '\n[Title Write]\n';
            writeLog += `before: ${ch.title || ''}\n`;
            writeLog += `after: ${crawledTitle || ''}\n`;
            writeLog += `source: fetchBatchChapters\n`;
            writeLog += `stack:\n${stack}\n`;
            console.log(writeLog);
            appendTitleDebugLog(writeLog);
          }

          const cleanedText = cleanStoryText(strippedText, options, filters, bookTitle);
          logVietnameseTextPipeline(res.rawHtmlSnippet, strippedText, cleanedText);

          updateChapter(idx, {
            title: crawledTitle,
            number: chapNum,
            volume: res.volume || '',
            volumeSource: res.volume ? 'metadata' : '',
            raw: strippedText,
            cleaned: cleanedText
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

  const exportBatchDocx = async (start, end, filename, isTTS) => {
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
      const blob = await buildDocx({ title: filename, author, chapters: ready, isTTS, bookTitle, exportMode: 'volume' });
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
        const success = await humanizeChapter(idx, 'selected_chapters');
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
        const success = await humanizeChapter(idx, 'batch_ai');
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
    if (patch.title !== undefined) {
      const before = chapters[i] ? chapters[i].title : '';
      const after = patch.title;
      const err = new Error();
      const stack = err.stack || '';
      let writeLog = '\n[Title Write]\n';
      writeLog += `before: ${before || ''}\n`;
      writeLog += `after: ${after || ''}\n`;
      writeLog += `source: updateChapter\n`;
      writeLog += `stack:\n${stack}\n`;
      console.log(writeLog);
      appendTitleDebugLog(writeLog);
    }
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
    updateChapter(i,{cleaned:cleanStoryText(stripped,options,filters,bookTitle)});
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
        return {...ch, cleaned: cleanStoryText(stripped, options, filters, bookTitle)};
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
      if (currentCh.number !== undefined && currentCh.number !== null) {
        nextNum = currentCh.number + 1;
      } else {
        nextNum = selected + 2;
      }
    }
    const newCh = {
      title: '',
      number: nextNum,
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
  const removeChapter=(i)=>{const next=chapters.filter((_,idx)=>idx!==i);setChapters(next.length?next:[{title:'',number:1,url:'',raw:'',cleaned:''}]);setSelected(Math.max(0,i-1));};
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
    const res = await window.storyAPI.fetchChapter(url, bookTitle);
    setFetching(false);
    let ipcRecvLog = '\n[IPC Receive]\n';
    ipcRecvLog += `chapterTitle: ${res.chapterTitle || ''}\n`;
    console.log(ipcRecvLog);
    appendTitleDebugLog(ipcRecvLog);
    if(!res.ok) return setStatus({type:'error',message:res.error || 'Không lấy được chương.'});
    
    if (res.bookTitle && (!bookTitle || bookTitle === 'Truyện đã dọn')) {
      setBookTitle(res.bookTitle);
    }
    if (res.author && (!author || author.trim() === '')) {
      setAuthor(res.author);
    }
    const chapNum = res.chapterNumber !== undefined && res.chapterNumber !== null ? res.chapterNumber : (selected + 1);
    
    let crawledTitle = '';
    if (res.chapterTitle && !isInvalidChapterTitle(res.chapterTitle, bookTitle || res.bookTitle, author || res.author)) {
      crawledTitle = res.chapterTitle;
    } else {
      crawledTitle = normalizeChapterTitle(res.title || current.title, chapNum);
    }
    if (isInvalidChapterTitle(crawledTitle, bookTitle || res.bookTitle, author || res.author)) {
      crawledTitle = '';
    }
    const existingTitle = current.title || '';
    if (existingTitle && !isInvalidChapterTitle(existingTitle, bookTitle, author)) {
      if (!crawledTitle || isInvalidChapterTitle(crawledTitle, bookTitle, author)) {
        crawledTitle = existingTitle;
      }
    }
    
    const strippedText = stripTitleFromText(res.text || '', crawledTitle, bookTitle);
    
    console.log(`[Pipeline Trace][Crawler Fetch] fetchCurrentUrl:`, {
      originalTitle: res.title,
      normalizedTitle: crawledTitle,
      textLengthBeforeStrip: (res.text || '').length,
      textLengthAfterStrip: strippedText.length
    });

    console.log('[Title Source]');
    console.log('stage: fetch-current');
    console.log(`res.title: ${res.title}`);
    console.log(`res.chapterTitle: ${res.chapterTitle}`);
    console.log(`current.title: ${current.title}`);

    if (current.title !== crawledTitle) {
      const err = new Error();
      const stack = err.stack || '';
      let writeLog = '\n[Title Write]\n';
      writeLog += `before: ${current.title || ''}\n`;
      writeLog += `after: ${crawledTitle || ''}\n`;
      writeLog += `source: fetchCurrentUrl\n`;
      writeLog += `stack:\n${stack}\n`;
      console.log(writeLog);
      appendTitleDebugLog(writeLog);
    }

    const cleanedText = cleanStoryText(strippedText, options, filters, bookTitle);
    logVietnameseTextPipeline(res.rawHtmlSnippet, strippedText, cleanedText);

    updateChapter(selected,{
      title: crawledTitle,
      number: chapNum,
      volume: res.volume || '',
      volumeSource: res.volume ? 'metadata' : '',
      raw: strippedText,
      cleaned: cleanedText
    });
    setStatus({type:'ok',message:`Đã lấy nội dung chương. Bộ nhận diện: ${res.selector || 'auto'}.`});
  };
  const exportTxt=()=>{
    let crawlerVolume = '';
    let crawlerVolumeSource = '';
    for (const ch of chapters) {
      if (ch.volume) {
        crawlerVolume = ch.volume;
        crawlerVolumeSource = ch.volumeSource || 'metadata';
        break;
      }
    }
    const headerInfo = generateVolumeHeader(bookTitle, author, '', chapters.length, crawlerVolume, crawlerVolumeSource);
    const headerStr = `${headerInfo.firstLine}\n${headerInfo.volumeLine}\n\n====================\n\n`;
    const text = headerStr + chapters.map((ch,i)=>{
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
  const exportDocx=async(isTTS=false)=>{
    const ready=chapters.filter(ch=>(ch.cleaned||ch.raw||'').trim());
    if(!ready.length)return alert('Chưa có nội dung chương.');
    try{
      const blob=await buildDocx({title:bookTitle,author,chapters:ready,isTTS,bookTitle,exportMode:'single'});
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download=`${slugify(bookTitle)}${isTTS?'-tts':''}.docx`;
      a.click();
      URL.revokeObjectURL(a.href);
      setStatus({type:'ok',message:`Đã xuất DOCX ${isTTS?'TTS':'Thường'}. Bạn có thể upload lên Drive rồi mở bằng Edge/Safari/Google Docs để nghe.`});
    }catch(err){
      setStatus({type:'error',message:err?.message||'Xuất DOCX thất bại. Hãy chạy npm install lại để cài package docx.'});
    }
  };
  const openDownloadsFolder = async () => {
    if (window.storyAPI?.openDownloadsFolder) {
      const res = await window.storyAPI.openDownloadsFolder();
      if (!res.ok) {
        setStatus({ type: 'error', message: `Không thể mở thư mục: ${res.error || 'Lỗi không xác định'}` });
      }
    } else {
      setStatus({ type: 'error', message: 'Tính năng này chỉ hỗ trợ trên ứng dụng Desktop.' });
    }
  };
  const makePrompt=()=>{const text=(current.cleaned||current.raw||'').trim(); if(!text) return alert('Chưa có nội dung chương.'); setAiPrompt(buildCustomPrompt(aiMode,text,filters,1,1,'',promptSettings,promptTemplates)); setTab('ai'); setAiSubTab('prompts');};
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

  const humanizeChapter = async(i, flowParam = 'current_chapter')=>{
    let currentFlow = flowParam;
    if (currentFlow === false) currentFlow = 'current_chapter';
    else if (currentFlow === true) currentFlow = 'batch_ai';

    const isBatch = currentFlow !== 'current_chapter';

    let source = (chapters[i].cleaned || chapters[i].raw || '').trim();
    if(!source) {
      setStatus({type:'warn',message:`Chương ${i+1} chưa có nội dung.`});
      return false;
    }
    const ch = chapters[i];
    const cleanTitle = formatChapterTitleForExport(ch.title || '', i, bookTitle);
    source = stripTitleFromText(stripTitleFromText(source, cleanTitle, bookTitle), ch.title, bookTitle);
    if(aiRunning && !isBatch) return false;
    let localCleaned = cleanStoryText(source, options, filters, bookTitle);
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
      let promptLengths=[];
      let factIssues=[];
      for (let c=0;c<chunks.length;c++) {
        if (cancelRef.current) throw new Error('USER_CANCELLED');
        const prompt = buildCustomPrompt(aiMode, chunks[c], filters, c+1, chunks.length, previousTail, promptSettings, promptTemplates);
        promptLengths.push(prompt.length);
        
        const containsFactRule = prompt.includes("BẢO TOÀN DỮ KIỆN") || prompt.includes("FACT PRESERVATION");
        const containsConvertPatternRule = prompt.includes("BẢNG DỊCH THUẬT NGỮ CONVERT") || prompt.includes("CONVERT VOCABULARY");
        const containsGreetingPattern = prompt.includes("QUY TẮC DỊCH HÀNH LỄ") || prompt.includes("GREETING PATTERNS");
        const containsProtectedTitles = prompt.includes("BẮT BUỘC BẢO VỆ DANH XƯNG CHÂN DUNG");

        console.log(`[AI Natural Prompt Debug]

chapterId: ${ch.id || (i + 1)}
chunkIndex: ${c + 1}
flow: ${currentFlow}
preset: ${aiMode || 'humanize'}
model: ${apiSettings.model}
promptLength: ${prompt.length}
containsFactRule: ${containsFactRule}
containsConvertPatternRule: ${containsConvertPatternRule}
containsGreetingPattern: ${containsGreetingPattern}
containsProtectedTitles: ${containsProtectedTitles}

promptFirst1500:
${prompt.slice(0, 1500)}
...

promptLast1500:
${prompt.slice(-1500)}
...`);

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

        // Run fact warnings validation strictly within the current chunk
        const origChunkText = protector.restore(chunks[c]);
        const rawAiChunkText = fixed;
        const finalChunkText = enforceRulesPostAI(protector.restore(fixed));
        let flowLabel = 'current chapter AI';
        if (currentFlow === 'selected_chapters' || currentFlow === 'selected') {
          flowLabel = 'selected chapter AI';
        } else if (currentFlow === 'batch_ai' || currentFlow === 'batch' || currentFlow === 'all_chapters') {
          flowLabel = 'batch AI';
        }
        const chunkIssues = validateChunkFactIssues(origChunkText, rawAiChunkText, finalChunkText, c + 1, flowLabel);
        factIssues = factIssues.concat(chunkIssues);

        setAiProgress({done:c+1,total:chunks.length,message:`Chương ${i+1}: Đã xong ${c+1}/${chunks.length} chunk`});
        if (c < chunks.length-1) await sleep(Number(apiSettings.delayMs || 4500));
      }
      const merged = protector.restore(outputs.join('\n\n')).replace(/\n{3,}/g,'\n\n').trim();
      console.log(`[Pipeline Trace][AI Cleaner Merged] Chapter ${i+1}:`, {
        title: chapters[i].title,
        cleanedContent: merged.slice(0, 300)
      });
      
      const finalCleaned = enforceRulesPostAI(merged);
      
      updateChapter(i, {
        cleaned: finalCleaned,
        aiNaturalAt: new Date().toISOString(),
        aiProcessed: true,
        aiError: null,
        aiErrorType: null,
        aiErrorAt: null,
        aiFactIssues: factIssues
      });
      setStatus({type:'ok',message:`AI đã xử lý Natural VN xong chương ${i+1}.${factIssues.length > 0 ? ' (Có cảnh báo dữ kiện)' : ''}`});
      return true;
    } catch(err) {
      updateChapter(i,{aiError: err?.message || 'AI xử lý thất bại.', aiErrorType: err?.name || 'Error', aiErrorAt: new Date().toISOString()});
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
      await humanizeChapter(i, 'all_chapters');
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
        if (parsed.aiNaturalVn || parsed.storyCleaner) {
          savePrompts({
            aiNaturalVn: parsed.aiNaturalVn || promptTemplates.aiNaturalVn,
            storyCleaner: parsed.storyCleaner || promptTemplates.storyCleaner
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
    const total = Array.isArray(chapters) ? chapters.length : 0;
    const successList = [];
    const errorList = [];
    const emptyList = [];
    const skippedList = [];
    const pendingList = [];
    const processedList = [];
    const warningList = [];
    const factWarningList = [];
    const factTermCounts = {};
    const factErrorSourceCounts = {};
    
    const isAiSuccess = (ch) => !!(ch?.aiNaturalAt || ch?.aiProcessed) && !ch?.aiError;
    const isAiError = (ch) => !!ch?.aiError;
    const hasWarning = (ch) => {
      if (ch?.aiFactIssues && ch.aiFactIssues.length > 0) return true;
      const text = ch?.cleaned || ch?.raw || '';
      if (!text) return false;
      if (/[\u4e00-\u9fa5]/.test(text)) return true;
      if (/\?{2,}/.test(text) || /!{2,}/.test(text) || /[!?]{2,}/.test(text)) return true;
      return false;
    };
    
    if (Array.isArray(chapters)) {
      chapters.forEach((ch, idx) => {
        if (!ch) return;
        const item = {
          idx,
          title: ch.title || `Chương ${idx + 1}`,
          number: ch.number !== undefined && ch.number !== null ? ch.number : (idx + 1),
          rawLen: (ch.raw || '').length,
          aiLen: (ch.cleaned || '').length,
          error: ch.aiError || '',
          errorType: ch.aiErrorType || 'Lỗi không xác định',
          errorAt: ch.aiErrorAt || '',
          skipped: !!ch.skipped,
          aiProcessed: !!ch.aiProcessed,
          aiFactIssues: ch.aiFactIssues || []
        };
        
        const isRawEmpty = !(ch.raw || '').trim();
        const isCleanEmpty = !(ch.cleaned || '').trim();
        
        if (isRawEmpty && isCleanEmpty) {
          emptyList.push(item);
        } else if (ch.skipped) {
          skippedList.push(item);
        } else {
          if (isAiSuccess(ch)) {
            if (hasWarning(ch)) {
              warningList.push(item);
            } else {
              successList.push(item);
            }
            processedList.push(item);
          } else if (isAiError(ch)) {
            errorList.push(item);
            processedList.push(item);
          } else {
            pendingList.push(item);
          }
        }

        if (ch.aiFactIssues && ch.aiFactIssues.length > 0) {
          factWarningList.push(item);
          ch.aiFactIssues.forEach(issue => {
            const term = issue.term || 'Khác';
            factTermCounts[term] = (factTermCounts[term] || 0) + 1;
            const src = issue.errorSource || 'AI_RAW_OUTPUT';
            factErrorSourceCounts[src] = (factErrorSourceCounts[src] || 0) + 1;
          });
        }
      });
    }
    
    return {
      total,
      successList,
      errorList,
      emptyList,
      skippedList,
      pendingList,
      processedList,
      warningList,
      factWarningList,
      factTermCounts,
      factErrorSourceCounts
    };
  }, [chapters]);

  const getReportText = (format = 'txt') => {
    const data = aiReportData;
    let output = '';
    const safeTitle = (bookTitle || '').toUpperCase();
    if (format === 'md') {
      output += `# BÁO CÁO TIẾN ĐỘ AI NATURAL - ${safeTitle}\n\n`;
      output += `*   **Tổng số chương:** ${data.total}\n`;
      output += `*   **AI Success:** ${data.successList.length}\n`;
      output += `*   **AI Success With Warning:** ${data.warningList.length}\n`;
      output += `*   **AI Failed:** ${data.errorList.length}\n`;
      output += `*   **Chương chưa AI:** ${data.pendingList.length}\n`;
      output += `*   **Cảnh báo dữ kiện:** ${data.factWarningList.length}\n`;
      Object.keys(data.factTermCounts).forEach(term => {
        output += `    *   - **${term}:** ${data.factTermCounts[term]}\n`;
      });
      output += `*   **Nguồn lỗi dữ kiện:**\n`;
      Object.keys(data.factErrorSourceCounts).forEach(src => {
        output += `    *   - **${src}:** ${data.factErrorSourceCounts[src]}\n`;
      });
      
      output += `## DANH SÁCH CHƯƠNG ĐÃ AI THÀNH CÔNG\n\n`;
      if (data.successList.length === 0) {
        output += `*(Chưa có chương nào)*\n`;
      } else {
        output += `| Số thứ tự | Tên chương | Ký tự sau AI |\n`;
        output += `| --- | --- | --- |\n`;
        data.successList.forEach((item) => {
          output += `| ${item.idx + 1} | ${item.title || `Chương ${item.idx + 1}`} | ${item.aiLen} |\n`;
        });
      }

      output += `\n## DANH SÁCH CHƯƠNG CÓ CẢNH BÁO\n\n`;
      if (data.warningList.length === 0) {
        output += `*(Không có chương nào có cảnh báo)*\n`;
      } else {
        output += `| Số thứ tự | Tên chương | Cảnh báo dữ kiện | Ký tự sau AI |\n`;
        output += `| --- | --- | --- | --- |\n`;
        data.warningList.forEach((item) => {
          const hasFact = item.aiFactIssues && item.aiFactIssues.length > 0;
          output += `| ${item.idx + 1} | ${item.title || `Chương ${item.idx + 1}`} | ${hasFact ? `⚠️ Có (${item.aiFactIssues.length})` : 'Không'} | ${item.aiLen} |\n`;
        });
      }
      
      output += `\n## DANH SÁCH CHƯƠNG LỖI AI\n\n`;
      if (data.errorList.length === 0) {
        output += `*(Không có chương nào bị lỗi)*\n`;
      } else {
        output += `| Số thứ tự | Tên chương | Loại lỗi | Chi tiết lỗi |\n`;
        output += `| --- | --- | --- | --- |\n`;
        data.errorList.forEach((item) => {
          output += `| ${item.idx + 1} | ${item.title || `Chương ${item.idx + 1}`} | ${item.errorType || 'Lỗi không xác định'} | ${item.error || 'Lỗi'} |\n`;
        });
      }

      output += `\n## CẢNH BÁO DỮ KIỆN\n\n`;
      if (data.factWarningList.length === 0) {
        output += `*(Không có chương nào cảnh báo)*\n`;
      } else {
        data.factWarningList.forEach((item) => {
          const ch = chapters[item.idx];
          output += `### Chương ${item.idx + 1}: ${item.title || `Chương ${item.idx + 1}`} (Cảnh báo: ${ch.aiFactIssues?.length || 0})\n\n`;
          if (ch.aiFactIssues && ch.aiFactIssues.length > 0) {
            ch.aiFactIssues.forEach((issue) => {
              output += `⚠️ **Thiếu danh xưng/chức vụ:** ${issue.term}\n\n`;
              output += `**Original:**\n`;
              output += `> ${issue.origSnippet || '(Không tìm thấy)'}\n\n`;
              output += `**AI raw:**\n`;
              output += `> ${issue.rawSnippet || '(Không có)'}\n\n`;
              output += `**Final saved:**\n`;
              output += `> ${issue.finalSnippet || '(Không có)'}\n\n`;
              output += `**Error source:**\n`;
              output += `\`${issue.errorSource}\`\n\n`;
              output += `---\n\n`;
            });
          }
        });
      }
    } else {
      output += `BÁO CÁO TIẾN ĐỘ AI NATURAL - ${safeTitle}\n`;
      output += `=========================================\n\n`;
      output += `Tổng số chương: ${data.total}\n`;
      output += `AI Success: ${data.successList.length}\n`;
      output += `AI Success With Warning: ${data.warningList.length}\n`;
      output += `AI Failed: ${data.errorList.length}\n`;
      output += `Chương chưa AI: ${data.pendingList.length}\n`;
      output += `Cảnh báo dữ kiện: ${data.factWarningList.length}\n`;
      Object.keys(data.factTermCounts).forEach(term => {
        output += `- ${term}: ${data.factTermCounts[term]}\n`;
      });
      output += `Error source:\n`;
      Object.keys(data.factErrorSourceCounts).forEach(src => {
        output += `- ${src}: ${data.factErrorSourceCounts[src]}\n`;
      });
      
      output += `DANH SÁCH CHƯƠNG ĐÃ AI THÀNH CÔNG:\n`;
      if (data.successList.length === 0) {
        output += `(Chưa có chương nào)\n`;
      } else {
        data.successList.forEach((item) => {
          output += `- Chương ${item.idx + 1}: ${item.title || `Chương ${item.idx + 1}`} (${item.aiLen} ký tự)\n`;
        });
      }

      output += `\nDANH SÁCH CHƯƠNG CÓ CẢNH BÁO:\n`;
      if (data.warningList.length === 0) {
        output += `(Không có chương nào có cảnh báo)\n`;
      } else {
        data.warningList.forEach((item) => {
          const hasFact = item.aiFactIssues && item.aiFactIssues.length > 0;
          output += `- Chương ${item.idx + 1}: ${item.title || `Chương ${item.idx + 1}`} (${hasFact ? `Cảnh báo dữ kiện: ${item.aiFactIssues.length}` : 'Cảnh báo định dạng'}, ${item.aiLen} ký tự)\n`;
        });
      }
      
      output += `\nDANH SÁCH CHƯƠNG LỖI AI:\n`;
      if (data.errorList.length === 0) {
        output += `(Không có chương nào bị lỗi)\n`;
      } else {
        data.errorList.forEach((item) => {
          output += `- Chương ${item.idx + 1}: ${item.title || `Chương ${item.idx + 1}`} - ${item.errorType || 'Lỗi không xác định'}: ${item.error || 'Lỗi'}\n`;
        });
      }

      output += `\nCẢNH BÁO DỮ KIỆN:\n`;
      output += `=========================================\n\n`;
      if (data.factWarningList.length === 0) {
        output += `(Không có chương nào cảnh báo)\n`;
      } else {
        data.factWarningList.forEach((item) => {
          const ch = chapters[item.idx];
          output += `Chương ${item.idx + 1}: ${item.title || `Chương ${item.idx + 1}`}\n`;
          if (ch.aiFactIssues && ch.aiFactIssues.length > 0) {
            ch.aiFactIssues.forEach((issue) => {
              output += `⚠️ Thiếu danh xưng/chức vụ: ${issue.term}\n\n`;
              output += `Original:\n`;
              output += `“${issue.origSnippet || '(Không tìm thấy)'}”\n\n`;
              output += `AI raw:\n`;
              output += `“${issue.rawSnippet || '(Không có)'}”\n\n`;
              output += `Final saved:\n`;
              output += `“${issue.finalSnippet || '(Không có)'}”\n\n`;
              output += `Error source:\n`;
              output += `${issue.errorSource}\n\n`;
              output += `-----------------------------------------\n`;
            });
          }
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
        if (showBulkDeleteModal) setShowBulkDeleteModal(false);
        else if (showBatchFetchModal) closeBatchFetchModal('escape');
        else if (showBatchAiModal) closeBatchAiModal('escape');
        else if (overwriteModal.show) setOverwriteModal({ show: false });
        else if (batchOverwriteModal.show) setBatchOverwriteModal({ show: false, cleanedChapters: [] });
        else if (showBatchExportModal) setShowBatchExportModal(false);
        else if (showOptionsPopup) setShowOptionsPopup(false);
        else if (showDocxDropdown) setShowDocxDropdown(false);
        else if (showCacheDropdown) setShowCacheDropdown(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showBulkDeleteModal, showBatchFetchModal, showBatchAiModal, overwriteModal, batchOverwriteModal, showBatchExportModal, showOptionsPopup, showDocxDropdown, showCacheDropdown]);


  const paginatedKeys = useMemo(() => {
    const limit = keysPerPage === 'all' ? visibleKeys.length : (parseInt(keysPerPage) || 10);
    if (limit <= 0) return [];
    const maxPage = Math.max(1, Math.ceil(visibleKeys.length / limit));
    const activePage = Math.min(keyPage, maxPage);
    const startIndex = (activePage - 1) * limit;
    return visibleKeys.slice(startIndex, startIndex + limit);
  }, [visibleKeys, keyPage, keysPerPage]);

  if (chapters && chapters[selected]) {
    const ch = chapters[selected];
    let finalLog = '\n[Title Final]\n';
    finalLog += `chapterTitle: ${ch.title || ''}\n`;
    console.log(finalLog);
    appendTitleDebugLog(finalLog);
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="/icon.png" alt="Story Cleaner" className="brandLogo" />
            <b style={{ fontSize: '20px' }}>Story Cleaner</b>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '11px', color: '#64748b', flexWrap: 'nowrap' }}>
            {lastAutoSaved && (
              <span className="autosave" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
                Auto saved {lastAutoSaved}
              </span>
            )}
            {lastAutoSaved && <span style={{ color: '#cbd5e1' }}>|</span>}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button 
                onClick={() => setShowCacheDropdown(!showCacheDropdown)} 
                className="cache-btn"
              >
                Cache <span style={{ fontSize: '8px', opacity: 0.7 }}>{showCacheDropdown ? '▲' : '▼'}</span>
              </button>
              {showCacheDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  zIndex: 1000,
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '4px 0',
                  minWidth: '150px'
                }}>
                  <button 
                    style={{ border: 0, borderRadius: 0, justifyContent: 'flex-start', padding: '6px 12px', background: 'transparent', width: '100%', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', color: '#1e293b' }} 
                    onClick={() => { setShowCacheDropdown(false); projectInputRef.current?.click(); }}
                  >
                    <Upload size={12} /> Nhập Project từ File
                  </button>
                  <button 
                    style={{ border: 0, borderRadius: 0, justifyContent: 'flex-start', padding: '6px 12px', background: 'transparent', width: '100%', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', color: '#1e293b' }} 
                    onClick={() => { setShowCacheDropdown(false); saveProject(); }}
                  >
                    <Save size={12} /> Xuất Project ra File
                  </button>
                </div>
              )}
            </div>
          </div>
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
                if (ch.aiFactIssues && ch.aiFactIssues.length > 0) return true;
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
                    const hasFactIssues = ch.aiFactIssues && ch.aiFactIssues.length > 0;
                    return (
                      <div key={originalIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '36px', marginLeft: '-15px' }}>
                        <div style={{ width: '25px', height: '2px', backgroundColor: '#dbeafe', flexShrink: 0 }} />
                        <button 
                          className={isActive ? 'chapter active' : 'chapter'} 
                          onClick={() => {
                            selectBook(bIdx);
                            setSelected(originalIdx);
                          }} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            flex: '1 1 auto', 
                            border: '1px solid',
                            borderColor: isActive ? '#2563eb' : (hasFactIssues ? '#fca5a5' : '#dbeafe'), 
                            backgroundColor: isActive ? '#eff6ff' : (hasFactIssues ? '#fff5f5' : '#ffffff'),
                            textAlign: 'left', 
                            padding: '6px 10px', 
                            height: '32px', 
                            minWidth: 0, 
                            overflow: 'hidden' 
                          }}
                        >
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
                              {ch.aiError && <span title={`Lỗi AI: ${ch.aiError}`} style={{ color: '#ef4444', fontSize: '11px', marginLeft: '2px', flexShrink: 0 }}>❌</span>}
                              {ch.aiFactIssues && ch.aiFactIssues.length > 0 && <span title={`Cảnh báo dữ kiện: ${ch.aiFactIssues.map(x => x.message).join(', ')}`} style={{ color: '#d97706', fontSize: '11px', marginLeft: '2px', flexShrink: 0 }}>⚠️</span>}
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
            <button className={tab === 'report' ? 'on' : ''} onClick={() => setTab('report')} style={{ height: '34px', padding: '6px 12px', borderRadius: '8px', fontSize: '13px' }}><FileText size={14} /> Báo cáo AI</button>
          </div>
          <div className="actions" style={{ display: 'flex', gap: '6px', alignItems: 'center', margin: 0, flexWrap: 'nowrap', flexShrink: 0 }}>
            <input ref={projectInputRef} type="file" accept=".json" hidden onChange={e => importProject(e.target.files?.[0])} />
            
            
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
                  minWidth: '150px',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '6px 0'
                }}>
                  <span style={{ padding: '4px 12px 4px 14px', fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #f1f5f9', display: 'block' }}>DOCX</span>
                  <button style={{ border: 0, borderRadius: 0, justifyContent: 'flex-start', padding: '8px 14px', background: 'transparent', width: '100%', fontSize: '12.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#334155' }} onClick={() => { setShowDocxDropdown(false); exportDocx(false); }}>
                    <span style={{ color: '#cbd5e1', fontWeight: 'normal' }}>├─</span> Thường
                  </button>
                  <button style={{ border: 0, borderRadius: 0, justifyContent: 'flex-start', padding: '8px 14px', background: 'transparent', width: '100%', fontSize: '12.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#334155' }} onClick={() => { setShowDocxDropdown(false); exportDocx(true); }}>
                    <span style={{ color: '#cbd5e1', fontWeight: 'normal' }}>├─</span> TTS
                  </button>
                  <button style={{ border: 0, borderRadius: 0, justifyContent: 'flex-start', padding: '8px 14px', background: 'transparent', width: '100%', fontSize: '12.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#334155' }} onClick={() => { setShowDocxDropdown(false); setExportIsTTS(false); setExportStartCh(1); setExportEndCh(Math.min(10, chapters.length)); updateDefaultFilename(1, Math.min(10, chapters.length)); setShowBatchExportModal(true); }}>
                    <span style={{ color: '#cbd5e1', fontWeight: 'normal' }}>├─</span> Theo tập
                  </button>
                  <button style={{ border: 0, borderRadius: 0, justifyContent: 'flex-start', padding: '8px 14px', background: 'transparent', width: '100%', fontSize: '12.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#334155' }} onClick={() => { setShowDocxDropdown(false); setExportIsTTS(true); setExportStartCh(1); setExportEndCh(Math.min(10, chapters.length)); updateDefaultFilename(1, Math.min(10, chapters.length)); setShowBatchExportModal(true); }}>
                    <span style={{ color: '#cbd5e1', fontWeight: 'normal' }}>└─</span> Theo tập TTS
                  </button>
                </div>
              )}
            </div>
            {window.storyAPI?.openDownloadsFolder && (
              <button
                onClick={openDownloadsFolder}
                title="Mở thư mục Downloads"
                style={{
                  height: '34px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#f8fafc',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  cursor: 'pointer'
                }}
              >
                <FolderOpen size={14} /> Mở thư mục
              </button>
            )}
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
          <div className="chapterTools compactTools" style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', padding: '6px 12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'visible', margin: '4px 0' }}>
            
            {/* Cào nội dung */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button 
                onClick={openBatchFetchModal}
                disabled={fetching || aiRunning} 
                className="softPrimary" 
                style={{ height: '34px', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}
              >
                {fetching ? <RefreshCcw className="spin" size={14} /> : <LinkIcon size={14} />} 
                Lấy nội dung hàng loạt
              </button>
            </div>

            {/* Divider line */}
            <div style={{ width: '1px', height: '24px', backgroundColor: '#e2e8f0' }} />

            {/* AI Hàng Loạt */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              
              {/* AI chương hiện tại */}
              <button 
                onClick={() => humanizeChapter(selected, 'current_chapter')} 
                className="softPrimary" 
                disabled={aiRunning || fetching} 
                style={{ height: '34px', padding: '6px 10px', fontSize: '12.5px', borderRadius: '8px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #cbd5e1' }}
              >
                {aiRunning ? <RefreshCcw className="spin" size={13} /> : <Sparkles size={13} />} AI chương hiện tại
              </button>

              {/* AI chương đã chọn */}
              <button 
                onClick={humanizeSelectedChapters} 
                disabled={aiRunning || fetching} 
                className="softPrimary" 
                style={{ height: '34px', padding: '6px 10px', fontSize: '12.5px', borderRadius: '8px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #cbd5e1' }}
              >
                {aiRunning ? <RefreshCcw className="spin" size={13} /> : <Sparkles size={13} />} AI chương đã chọn
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



            </div>

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

        <div className="scrollContent" style={{ overflowY: (tab === 'editor' || tab === 'report') ? 'hidden' : 'auto', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
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
                      onBlur={e => updateChapter(selected, { title: normalizeChapterTitle(e.target.value, (current.number || (selected + 1))) })} 
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
              <div className="aiHeader" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '12px' }}>
                <div><h2>Cấu hình Gemini AI</h2></div>
                <div className="poolStats managerStats" style={{ display: 'flex', gap: '12px', fontSize: '12.5px', color: '#475569' }}>
                  <span>Tổng key: <b>{keySummary.totalKeys}</b></span>
                  <span>Đang bật: <b>{keySummary.activeKeys}</b></span>
                  <span>Limited: <b>{keySummary.limitedKeys}</b></span>
                  <span>Lỗi: <b>{keySummary.errorKeys}</b></span>
                  <span>OK/Fail: <b>{keySummary.totalSuccess}/{keySummary.totalFail}</b></span>
                </div>
              </div>
              
              <div className="managerTabs" style={{ display: 'flex', gap: '6px', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', flexWrap: 'wrap' }}>
                <button className={aiSubTab === 'settings' ? 'on' : ''} onClick={() => setAiSubTab('settings')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Sliders size={16} /> Cài đặt AI</button>
                <button className={aiSubTab === 'presets' ? 'on' : ''} onClick={() => setAiSubTab('presets')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Sparkles size={16} /> Preset AI</button>
                <button className={aiSubTab === 'prompts' ? 'on' : ''} onClick={() => setAiSubTab('prompts')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Sliders size={16} /> Prompt</button>
                <button className={aiSubTab === 'pool' ? 'on' : ''} onClick={() => setAiSubTab('pool')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><ShieldCheck size={16} /> API/Gemini Pool</button>
                <button className={aiSubTab === 'advanced' ? 'on' : ''} onClick={() => setAiSubTab('advanced')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Database size={16} /> Nâng cao</button>
              </div>

              {aiSubTab === 'settings' && (
                <div className="apiConfigPanel" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px 0' }}>
                  <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', color: '#1e293b' }}>
                    <Sliders size={16} /> <span>Cấu hình tham số API</span>
                  </div>
                  <div className="promptGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                    <label>Model
                      <select value={apiSettings.model} onChange={e => updateApi({ model: e.target.value })}>
                        {modelOptions.map(m => <option key={m.name} value={m.name}>{m.displayName || m.name}</option>)}
                      </select>
                    </label>
                    <label>Chunk Size<input type="number" value={apiSettings.chunkSize} onChange={e => updateApi({ chunkSize: Number(e.target.value) })} /></label>
                    <label>Delay ms<input type="number" value={apiSettings.delayMs} onChange={e => updateApi({ delayMs: Number(e.target.value) })} /></label>
                    <label>Cooldown ms<input type="number" value={apiSettings.cooldownMs} onChange={e => updateApi({ cooldownMs: Number(e.target.value) })} /></label>
                    <label>Retry<input type="number" value={apiSettings.maxRetries} onChange={e => updateApi({ maxRetries: Number(e.target.value) })} /></label>
                  </div>
                </div>
              )}

              {aiSubTab === 'presets' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px 0' }}>
                  <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', color: '#1e293b' }}>
                    <Sparkles size={16} /> <span>Preset AI / Context xưng hô</span>
                  </div>
                  <div className="promptGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    <label>Mode xử lý
                      <select value={aiMode} onChange={e => setAiMode(e.target.value)}>
                        <option value="humanize">Natural VN Audio — Việt hóa để nghe</option>
                        <option value="structure">Sửa bố cục + câu chữ</option>
                        <option value="proofread">Check/sửa nhẹ text</option>
                        <option value="selective">AI Biên tập chọn lọc</option>
                      </select>
                    </label>
                    <label>Mức biên tập
                      <select value={promptSettings.humanizeStrength} onChange={e => setPromptSettings({ ...promptSettings, humanizeStrength: e.target.value })}>
                        <option value="cleanup">Cleanup — ít sửa nhất</option>
                        <option value="naturalAudio">Natural VN Audio — khuyên dùng</option>
                        <option value="light">Light — giữ gần văn gốc</option>
                        <option value="balanced">Balanced — mượt vừa phải</option>
                        <option value="strong">Strong — mượt hơn</option>
                      </select>
                    </label>
                    <label>Xưng hô
                      <select value={promptSettings.pronounStyle} onChange={e => setPromptSettings({ ...promptSettings, pronounStyle: e.target.value })}>
                        <option value="preserve">Preserve — giữ ta/ngươi</option>
                        <option value="balanced">Balanced — theo ngữ cảnh</option>
                        <option value="modern">Modern VN — mềm hóa mạnh hơn</option>
                      </select>
                    </label>
                  </div>
                  <div className="memoryGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
                    <label>Novel Memory <span className="hint">chỉ áp dụng cho bộ truyện hiện tại</span>
                      <textarea value={promptSettings.novelMemory} onChange={e => setPromptSettings({ ...promptSettings, novelMemory: e.target.value })} style={{ minHeight: '80px' }} />
                    </label>
                    <label>Ghi chú thêm <span className="hint">không bắt buộc</span>
                      <textarea value={promptSettings.additionalInstructions} onChange={e => setPromptSettings({ ...promptSettings, additionalInstructions: e.target.value })} placeholder="Ví dụ: Giữ nguyên xưng hô sư phụ/đệ tử. Không đổi Lâm Thiếu thành cậu Lâm..." style={{ minHeight: '80px' }} />
                    </label>
                  </div>
                </div>
              )}

              {aiSubTab === 'prompts' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <label style={{ fontWeight: 'bold', fontSize: '13px', color: '#475569', margin: 0 }}>Chọn Prompt:</label>
                      <select 
                        value={editingPromptKey} 
                        onChange={e => {
                          setEditingPromptKey(e.target.value);
                          setEditingPromptText(promptTemplates[e.target.value] || '');
                        }}
                        style={{ padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                      >
                        <option value="aiNaturalVn">AI Natural VN (Việt hóa chính)</option>
                        <option value="storyCleaner">Story Cleaner (Xử lý convert)</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type="file" id="import-prompts-input" accept=".json" style={{ display: 'none' }} onChange={handleImportPrompts} />
                      <button className="softPrimary" onClick={() => document.getElementById('import-prompts-input').click()} style={{ height: '30px', padding: '2px 10px', fontSize: '12px' }}>Import Pack</button>
                      <button className="softPrimary" onClick={handleExportPrompts} style={{ height: '30px', padding: '2px 10px', fontSize: '12px' }}>Export Pack</button>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ fontWeight: 'bold', fontSize: '13px', color: '#475569', margin: 0 }}>Preset nhanh:</label>
                    <select 
                      value={selectedPresetKey}
                      onChange={e => {
                        setSelectedPresetKey(e.target.value);
                        handleApplyPreset(e.target.value);
                      }}
                      style={{ padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                    >
                      <option value="">-- Chọn Preset --</option>
                      <option value="default">Default (Nguyên bản)</option>
                      <option value="naturalVn">Natural VN (Ưu tiên V2)</option>
                      <option value="strictOriginal">Strict Original (Dịch sát gốc)</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      * Bạn có thể sử dụng các biến placeholder tự động điền giá trị từ các cài đặt của truyện: 
                      <code style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px', margin: '0 4px', color: '#0f172a', fontFamily: 'monospace' }}>{"{{preserveTerms}}"}</code>, 
                      <code style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px', margin: '0 4px', color: '#0f172a', fontFamily: 'monospace' }}>{"{{novelMemory}}"}</code>, 
                      <code style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px', margin: '0 4px', color: '#0f172a', fontFamily: 'monospace' }}>{"{{pronounStyle}}"}</code>, 
                      <code style={{ background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px', margin: '0 4px', color: '#0f172a', fontFamily: 'monospace' }}>{"{{humanizeStrength}}"}</code>
                    </span>
                    <textarea 
                      value={editingPromptText} 
                      onChange={e => setEditingPromptText(e.target.value)} 
                      style={{ width: '100%', minHeight: '200px', fontFamily: 'monospace', fontSize: '12.5px', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px' }}
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
                      style={{ height: '34px', padding: '4px 12px', borderRadius: '8px', fontSize: '12.5px' }}
                    >
                      Khôi phục mặc định
                    </button>
                    <button 
                      className="primary" 
                      onClick={() => {
                        const updated = { ...promptTemplates, [editingPromptKey]: editingPromptText };
                        savePrompts(updated);
                      }}
                      style={{ height: '34px', padding: '4px 12px', borderRadius: '8px', fontSize: '12.5px' }}
                    >
                      Lưu Prompt
                    </button>
                  </div>

                  <hr style={{ border: 0, borderTop: '1px solid #e2e8f0', margin: '16px 0' }} />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', color: '#1e293b', fontSize: '14px' }}>
                      <FileText size={16} /> <span>Prompt thủ công / nâng cao</span>
                    </div>
                    <div className="aiControls" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button 
                        className="softPrimary" 
                        onClick={makePrompt}
                        style={{ height: '30px', padding: '2px 10px', fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Sliders size={14} /> Tạo prompt thủ công
                      </button>
                      <button 
                        className="softPrimary" 
                        onClick={copyPrompt} 
                        disabled={!aiPrompt} 
                        style={{ height: '30px', padding: '2px 10px', fontSize: '12.5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Copy size={14} /> Copy prompt
                      </button>
                    </div>
                    <textarea 
                      className="promptBox" 
                      value={aiPrompt} 
                      onChange={e => setAiPrompt(e.target.value)} 
                      placeholder="Prompt thủ công sẽ hiện ở đây nếu bạn bấm Tạo prompt thủ công..." 
                      style={{ width: '100%', minHeight: '120px', fontFamily: 'monospace', fontSize: '12.5px', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px' }} 
                    />
                  </div>
                </div>
              )}

              {aiSubTab === 'pool' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px 0' }}>
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
                </div>
              )}

              {aiSubTab === 'advanced' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '12px 0' }}>
                  <div className="promptPanel" style={{ border: 'none', padding: 0 }}>
                    <div className="panelTitle" style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', color: '#1e293b' }}>
                      <Database size={16} /> <span>Tùy chọn nâng cao & Session</span>
                    </div>
                    <div className="aiControls" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
                      <button className="softPrimary" onClick={clearCache} style={{ borderColor: '#fecdd3', color: '#be123c', background: '#fff1f2' }}><Trash2 size={17} /> Xóa auto-cache</button>
                    </div>
                  </div>
                  <div className="sessionLog" style={{ padding: '12px', background: '#fafafa', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <b>Session log (Key đã dùng trong phiên)</b>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px', maxHeight: '120px', overflowY: 'auto', fontSize: '12.5px', color: '#475569' }}>
                      {apiPool.filter(k => k.lastUsedAt).length ? apiPool.filter(k => k.lastUsedAt).slice(0, 8).map(k => <span key={k.id}>• {k.label}: {k.lastStatus || 'unknown'} · {new Date(k.lastUsedAt).toLocaleTimeString()}</span>) : <span>Chưa có key nào được dùng trong phiên này.</span>}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {tab === 'report' && (
            <div className="tabContent" style={{ padding: '16px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', color: '#1e293b', fontSize: '18px' }}>
                  <FileText size={20} /> <span>Báo cáo & Kiểm tra chất lượng AI</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button className="softPrimary" onClick={() => {
                    const text = getReportText('txt');
                    navigator.clipboard.writeText(text);
                    setCopyStatus('txt');
                    setTimeout(() => setCopyStatus(''), 1500);
                  }} style={{ minWidth: '130px', justifyContent: 'center' }}>
                    <Copy size={16} /> {copyStatus === 'txt' ? 'Đã sao chép ✓' : 'Copy văn bản'}
                  </button>
                  <button className="softPrimary" onClick={() => {
                    const text = getReportText('md');
                    navigator.clipboard.writeText(text);
                    setCopyStatus('md');
                    setTimeout(() => setCopyStatus(''), 1500);
                  }} style={{ minWidth: '140px', justifyContent: 'center' }}>
                    <Copy size={16} /> {copyStatus === 'md' ? 'Đã sao chép ✓' : 'Copy Markdown'}
                  </button>
                </div>
              </div>
              <p style={{ margin: 0, color: '#475569', fontSize: '13px' }}>
                Chọn nhóm bên dưới để xem chi tiết danh sách chương:
              </p>
              
              <div className="reportStatsGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '4px' }}>
                {[
                  { key: 'success', label: 'AI Success', count: aiReportData.successList.length, color: '#10b981', bgColor: '#ecfdf5', textColor: '#047857' },
                  { key: 'warning', label: 'AI Success With Warning', count: aiReportData.warningList.length, color: '#d97706', bgColor: '#fffbeb', textColor: '#b45309' },
                  { key: 'error', label: 'AI Failed', count: aiReportData.errorList.length, color: '#ef4444', bgColor: '#fef2f2', textColor: '#b91c1c' },
                  { key: 'empty', label: 'Rỗng', count: aiReportData.emptyList.length, color: '#6b7280', bgColor: '#f3f4f6', textColor: '#374151' },
                  { key: 'skipped', label: 'Bị bỏ qua', count: aiReportData.skippedList.length, color: '#f59e0b', bgColor: '#fffbeb', textColor: '#b45309' },
                  { key: 'pending', label: 'Chưa AI', count: aiReportData.pendingList.length, color: '#3b82f6', bgColor: '#eff6ff', textColor: '#1d4ed8' },
                  { key: 'processed', label: 'Đã AI', count: aiReportData.processedList.length, color: '#8b5cf6', bgColor: '#f5f3ff', textColor: '#5b21b6' },
                ].map(s => {
                  const isActive = activeReportTab === s.key;
                  return (
                    <div 
                      key={s.key}
                      onClick={() => setActiveReportTab(s.key)}
                      style={{ 
                        cursor: 'pointer', 
                        border: isActive ? `2px solid ${s.color}` : '1px solid #e2e8f0', 
                        padding: '12px 8px', 
                        borderRadius: '8px', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        gap: '4px', 
                        backgroundColor: isActive ? s.bgColor : '#ffffff', 
                        transition: 'all 0.2s',
                        boxShadow: isActive ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                      }}
                    >
                      <span style={{ fontSize: '11px', color: s.textColor, fontWeight: 'bold', textAlign: 'center' }}>{s.label}</span>
                      <b style={{ fontSize: '18px', color: s.textColor }}>{s.count}</b>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0 2px 0' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>
                  Danh sách chương: {
                    activeReportTab === 'success' ? 'Thành công' :
                    activeReportTab === 'error' ? 'Lỗi' :
                    activeReportTab === 'empty' ? 'Rỗng' :
                    activeReportTab === 'skipped' ? 'Bị bỏ qua' :
                    activeReportTab === 'pending' ? 'Chưa AI' :
                    activeReportTab === 'warning' ? 'Có cảnh báo' : 'Đã AI'
                  } ({
                    activeReportTab === 'success' ? aiReportData.successList.length :
                    activeReportTab === 'error' ? aiReportData.errorList.length :
                    activeReportTab === 'empty' ? aiReportData.emptyList.length :
                    activeReportTab === 'skipped' ? aiReportData.skippedList.length :
                    activeReportTab === 'pending' ? aiReportData.pendingList.length :
                    activeReportTab === 'warning' ? aiReportData.warningList.length : aiReportData.processedList.length
                  })
                </span>
              </div>

              {activeReportTab === 'warning' && aiReportData.factWarningList.length > 0 && (
                <div style={{ 
                  padding: '12px', 
                  backgroundColor: '#fffbeb', 
                  border: '1px solid #fed7aa', 
                  borderRadius: '8px', 
                  fontSize: '13px', 
                  color: '#7c2d12', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '6px'
                }}>
                  <div style={{ fontWeight: 'bold', color: '#c2410c' }}>Thống kê cảnh báo dữ kiện:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: '600' }}>Theo danh xưng:</span>
                      {Object.keys(aiReportData.factTermCounts).map(term => (
                        <span key={term}>• {term}: {aiReportData.factTermCounts[term]}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: '600' }}>Theo nguồn lỗi:</span>
                      {Object.keys(aiReportData.factErrorSourceCounts).map(src => (
                        <span key={src}>• {src}: {aiReportData.factErrorSourceCounts[src]}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ 
                border: '1px solid #e2e8f0', 
                borderRadius: '8px', 
                padding: '10px', 
                backgroundColor: '#f8fafc',
                flex: 1,
                overflowY: 'auto',
                minHeight: 0
              }}>
                {(() => {
                  const list = 
                    activeReportTab === 'success' ? aiReportData.successList :
                    activeReportTab === 'error' ? aiReportData.errorList :
                    activeReportTab === 'empty' ? aiReportData.emptyList :
                    activeReportTab === 'skipped' ? aiReportData.skippedList :
                    activeReportTab === 'pending' ? aiReportData.pendingList :
                    activeReportTab === 'warning' ? aiReportData.warningList :
                    aiReportData.processedList;

                  if (list.length === 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8', fontSize: '13px' }}>
                        Không có chương nào trong nhóm này.
                      </div>
                    );
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {list.map(item => {
                        let label = '';
                        let color = '#475569';
                        let bg = '#f1f5f9';
                        if (activeReportTab === 'success') {
                          label = 'AI Success';
                          color = '#047857';
                          bg = '#d1fae5';
                        } else if (activeReportTab === 'error') {
                          label = 'Lỗi'; color = '#b91c1c'; bg = '#fee2e2';
                        } else if (activeReportTab === 'empty') {
                          label = 'Rỗng'; color = '#374151'; bg = '#e5e7eb';
                        } else if (activeReportTab === 'skipped') {
                          label = 'Bỏ qua'; color = '#92400e'; bg = '#fef3c7';
                        } else if (activeReportTab === 'pending') {
                          label = 'Chưa AI'; color = '#1d4ed8'; bg = '#dbeafe';
                        } else if (activeReportTab === 'warning') {
                          const hasFact = chapters[item.idx]?.aiFactIssues?.length > 0;
                          label = hasFact ? 'AI Success With Fact Warning' : 'AI Success With Warning';
                          color = hasFact ? '#dc2626' : '#d97706';
                          bg = hasFact ? '#fef2f2' : '#fffbeb';
                        } else {
                          const isErr = !!chapters[item.idx]?.aiError;
                          const hasFact = chapters[item.idx]?.aiFactIssues?.length > 0;
                          const text = chapters[item.idx]?.cleaned || chapters[item.idx]?.raw || '';
                          const hasFormatWarn = text && (/[\u4e00-\u9fa5]/.test(text) || /\?{2,}/.test(text) || /!{2,}/.test(text) || /[!?]{2,}/.test(text));
                          if (isErr) {
                            label = 'Lỗi'; color = '#b91c1c'; bg = '#fee2e2';
                          } else if (hasFact) {
                            label = 'AI Success With Fact Warning'; color = '#dc2626'; bg = '#fef2f2';
                          } else if (hasFormatWarn) {
                            label = 'AI Success With Warning'; color = '#d97706'; bg = '#fffbeb';
                          } else {
                            label = 'AI Success'; color = '#047857'; bg = '#d1fae5';
                          }
                        }

                        const hasSelectiveDetails = chapters[item.idx]?.aiSelectiveDetails?.length > 0;
                        return (
                          <div 
                            key={item.idx} 
                            style={{ 
                              display: 'flex', 
                              flexDirection: 'column',
                              padding: '10px 16px', 
                              backgroundColor: '#ffffff', 
                              border: '1px solid #e2e8f0', 
                              borderRadius: '8px',
                              gap: '8px',
                              alignItems: 'stretch'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', width: '100%' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#1e293b' }}>
                                    Chương {item.number}
                                  </span>
                                  <span style={{ 
                                    fontSize: '11px', 
                                    padding: '1px 6px', 
                                    borderRadius: '4px', 
                                    fontWeight: '600',
                                    color,
                                    backgroundColor: bg
                                  }}>
                                    {label}
                                  </span>
                                  {item.aiFactIssues && item.aiFactIssues.length > 0 && (
                                    <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 'bold', backgroundColor: '#fffbeb', padding: '1px 5px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                                      Fact Warnings: {item.aiFactIssues.length}
                                    </span>
                                  )}
                                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                                    ({item.rawLen} → {item.aiLen} ký tự)
                                  </span>
                                </div>
                                <div style={{ fontSize: '12.5px', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title}>
                                  {item.title}
                                </div>
                                {chapters[item.idx]?.aiSelectiveStats && (
                                  <div style={{ fontSize: '11.5px', color: '#047857', marginTop: '2px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <span style={{ backgroundColor: '#d1fae5', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold' }}>Biên tập chọn lọc</span>
                                    <span>Tổng câu: {chapters[item.idx].aiSelectiveStats.total}</span>
                                    <span>•</span>
                                    <span>Nghi ngờ: {chapters[item.idx].aiSelectiveStats.flagged}</span>
                                    <span>•</span>
                                    <span>Đã sửa: {chapters[item.idx].aiSelectiveStats.edited}</span>
                                    <span>•</span>
                                    <span>Giữ nguyên: {chapters[item.idx].aiSelectiveStats.preserved}</span>
                                    {hasSelectiveDetails && (
                                      <>
                                        <span>•</span>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const isSelExpanded = !!expandedIssues['selective-' + item.idx];
                                            setExpandedIssues(prev => ({ ...prev, ['selective-' + item.idx]: !isSelExpanded }));
                                          }}
                                          style={{ 
                                            background: 'none', 
                                            border: 'none', 
                                            color: '#2563eb', 
                                            cursor: 'pointer', 
                                            fontSize: '11.5px', 
                                            fontWeight: 'bold', 
                                            padding: 0,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '2px'
                                          }}
                                        >
                                          {expandedIssues['selective-' + item.idx] ? '▼ Ẩn chi tiết câu' : '▶ Xem chi tiết câu'}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                                {item.error && (
                                  <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '2px', wordBreak: 'break-all' }}>
                                    Lỗi: {item.errorType ? `[${item.errorType}] ` : ''}{item.error}
                                  </div>
                                )}
                              </div>
                              
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                <button 
                                  onClick={() => updateChapter(item.idx, { skipped: !item.skipped })}
                                  className="softPrimary"
                                  style={{ 
                                    fontSize: '11.5px', 
                                    padding: '4px 10px', 
                                    height: '30px',
                                    borderRadius: '6px',
                                    backgroundColor: item.skipped ? '#fef3c7' : '#f1f5f9',
                                    color: item.skipped ? '#b45309' : '#475569',
                                    borderColor: item.skipped ? '#fde68a' : '#cbd5e1',
                                    cursor: 'pointer'
                                  }}
                                >
                                  {item.skipped ? 'Khôi phục' : 'Bỏ qua AI'}
                                </button>
                                <button 
                                  onClick={() => {
                                    selectBook(bookIndex);
                                    setSelected(item.idx);
                                    setTab('editor');
                                  }}
                                  className="softPrimary"
                                  style={{ 
                                    fontSize: '11.5px', 
                                    padding: '4px 10px', 
                                    height: '30px',
                                    borderRadius: '6px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Đi tới chương
                                </button>
                              </div>
                            </div>

                            {/* Fact Warnings Section */}
                            {item.aiFactIssues && item.aiFactIssues.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                                {item.aiFactIssues.map((issue, idxIssues) => {
                                  const issueKey = `${item.idx}-${idxIssues}`;
                                  const isExpanded = !!expandedIssues[issueKey];
                                  return (
                                    <div key={idxIssues} style={{ display: 'flex', flexDirection: 'column', border: '1px solid #fed7aa', borderRadius: '6px', backgroundColor: '#fffbeb', overflow: 'hidden' }}>
                                      <div 
                                        onClick={() => setExpandedIssues(prev => ({ ...prev, [issueKey]: !isExpanded }))}
                                        style={{ 
                                          padding: '6px 10px', 
                                          fontSize: '12.5px', 
                                          color: '#c2410c', 
                                          fontWeight: 'bold', 
                                          cursor: 'pointer', 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          justifyContent: 'space-between',
                                          userSelect: 'none',
                                          backgroundColor: '#ffedd5'
                                        }}
                                      >
                                        <span>⚠️ {issue.message}</span>
                                        <span style={{ fontSize: '11px' }}>{isExpanded ? '▼ Ẩn chi tiết' : '▶ Xem chi tiết'}</span>
                                      </div>
                                      {isExpanded && (
                                        <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px', color: '#431407', borderTop: '1px dashed #fed7aa' }}>
                                          <div>
                                            <strong style={{ color: '#ea580c' }}>Missing title:</strong> <code style={{ backgroundColor: '#ffedd5', padding: '2px 4px', borderRadius: '4px', fontWeight: 'bold' }}>{issue.term}</code>
                                          </div>
                                          <div>
                                            <strong style={{ color: '#ea580c' }}>Original sentence/paragraph:</strong>
                                            <div style={{ marginTop: '4px', padding: '6px', backgroundColor: '#fafaf9', borderLeft: '3px solid #f97316', fontStyle: 'italic', wordBreak: 'break-word', color: '#444' }}>
                                              {issue.origSnippet}
                                            </div>
                                          </div>
                                          <div>
                                            <strong style={{ color: '#ea580c' }}>AI output snippet:</strong>
                                            <div style={{ marginTop: '4px', padding: '6px', backgroundColor: '#fafaf9', borderLeft: '3px solid #ea580c', fontStyle: 'italic', wordBreak: 'break-word', color: '#444' }}>
                                              {issue.aiSnippet}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Selective Edit Details Table */}
                            {hasSelectiveDetails && expandedIssues['selective-' + item.idx] && (
                              <div style={{ 
                                maxHeight: '300px', 
                                overflowY: 'auto', 
                                border: '1px solid #cbd5e1', 
                                borderRadius: '6px', 
                                marginTop: '4px',
                                background: '#ffffff'
                              }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                                      <th style={{ position: 'sticky', top: 0, backgroundColor: '#f1f5f9', padding: '6px 8px', width: '50px', color: '#475569', fontWeight: 'bold', zIndex: 10 }}>ID</th>
                                      <th style={{ position: 'sticky', top: 0, backgroundColor: '#f1f5f9', padding: '6px 8px', width: '80px', color: '#475569', fontWeight: 'bold', zIndex: 10 }}>Changed</th>
                                      <th style={{ position: 'sticky', top: 0, backgroundColor: '#f1f5f9', padding: '6px 8px', color: '#475569', fontWeight: 'bold', zIndex: 10 }}>Original</th>
                                      <th style={{ position: 'sticky', top: 0, backgroundColor: '#f1f5f9', padding: '6px 8px', color: '#475569', fontWeight: 'bold', zIndex: 10 }}>Edited</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {chapters[item.idx].aiSelectiveDetails.map((detail, dIdx) => (
                                      <tr key={dIdx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: detail.changed ? '#fffbeb' : 'transparent' }}>
                                        <td style={{ padding: '6px 8px', color: '#64748b' }}>{detail.sentenceId || (dIdx + 1)}</td>
                                        <td style={{ padding: '6px 8px', color: detail.changed ? '#b45309' : '#64748b', fontWeight: detail.changed ? 'bold' : 'normal' }}>
                                          {detail.changed ? 'Yes' : 'No'}
                                        </td>
                                        <td style={{ padding: '6px 8px', color: '#475569', wordBreak: 'break-word' }}>{detail.original}</td>
                                        <td style={{ padding: '6px 8px', color: detail.changed ? '#0f172a' : '#64748b', fontWeight: detail.changed ? '500' : 'normal', wordBreak: 'break-word' }}>
                                          {detail.edited || '(Giữ nguyên)'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </main>

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
                setChapters(nextChs.length ? nextChs : [{title: '', number: 1, url: '', raw: '', cleaned: '', selectedForExport: false}]);
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
              <h3><Download size={20} /> {exportIsTTS ? 'Xuất DOCX Theo Tập TTS' : 'Xuất DOCX Theo Tập'}</h3>
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
              <button className="primary" onClick={() => exportBatchDocx(exportStartCh, exportEndCh, exportFilename, exportIsTTS)}>Xuất file</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById('root')).render(<App />);
