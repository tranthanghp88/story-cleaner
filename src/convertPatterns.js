export const CONVERT_PATTERNS = {
  protectedTitles: [
    { key: "thiếu chủ", description: "Bắt buộc giữ nguyên. Không lược bỏ, không đổi thành công tử/thiếu gia." },
    { key: "đại trưởng lão", description: "Bắt buộc giữ nguyên. Tuyệt đối không thay đổi hay hạ thấp cấp bậc nhân vật thành tộc lão hay trưởng lão thông thường (Đại trưởng lão ≠ tộc lão)." },
    { key: "gia chủ", description: "Giữ nguyên. Không đổi thành chủ nhà/chủ gia đình." },
    { key: "trưởng lão", description: "Giữ nguyên." },
    { key: "tộc trưởng", description: "Giữ nguyên." },
    { key: "điện chủ", description: "Giữ nguyên." },
    { key: "đường chủ", description: "Giữ nguyên." }
  ],
  greeting: [],
  emotion: [
    { pattern: "khóc không ra nước mắt", replacement: "dở khóc dở cười hoặc bất lực muốn khóc" },
    { pattern: "tâm tình", replacement: "tâm trạng, lòng, cảm xúc" },
    { pattern: "tê cả da đầu", replacement: "da đầu tê rần, rùng mình, nổi da gà" },
    { pattern: "tâm động", replacement: "rung động, xao xuyến" },
    { pattern: "thổ tào", replacement: "bóc phốt, châm chọc, than thở" }
  ],
  action: [
    { pattern: "hút khí / hút một hơi khí lạnh", replacement: "hít một hơi khí lạnh" },
    { pattern: "ngốc trệ / ngốc lập", replacement: "sững sờ, ngây người" }
  ],
  sentence: [
    { pattern: "Nói đến...", replacement: "Vừa dứt lời, Trong lúc nói chuyện..." },
    { pattern: "Đang khi nói chuyện...", replacement: "Trong lúc đang nói chuyện..." },
    { pattern: "Nói rồi...", replacement: "Nói xong..." },
    { pattern: "Ngươi bị bỏ", replacement: "Ngươi đi đi, Mau rời đi" }
  ],
  vocabulary: [
    { pattern: "lạp phong", replacement: "ngầu, chảnh, nổi bật" },
    { pattern: "hảo hảo", replacement: "tốt, chu đáo" },
    { pattern: "gặp quỷ", replacement: "quái lạ, xui xẻo" },
    { pattern: "thượng vị", replacement: "lên nắm quyền, thay thế, chiếm vị trí" }
  ],
  factPreservation: [
    { rule: "BẮT BUỘC BẢO VỆ DANH XƯNG VÀ PHẨM HÀM (Never remove or replace)", detail: "Không được xóa hoặc thay đổi: thiếu chủ, đại trưởng lão, gia chủ, trưởng lão, tộc trưởng, điện chủ, đường chủ. Ví dụ: cấm đổi 'đại trưởng lão' thành 'tộc lão' hay tên riêng 'Triệu Uyên'; cấm đổi 'thiếu chủ' hay 'thiếu chủ vị' thành 'vị trí đó'." },
    { rule: "CẤM TỰ Ý THÊM CHỦ NGỮ/CHI TIẾT MƠ HỒ", detail: "Không tự ý thêm các từ xưng hô hay bối cảnh phụ nằm ngoài bản gốc." }
  ]
};

export function formatConvertPatternsForPrompt(patterns) {
  let output = "";
  
  if (patterns.factPreservation && patterns.factPreservation.length > 0) {
    output += "BẢO TOÀN DỮ KIỆN VÀ SỰ THẬT (CRITICAL FACT PRESERVATION RULES - ƯU TIÊN CAO NHẤT):\n";
    patterns.factPreservation.forEach(f => {
      output += `- Quy tắc: ${f.rule}\n  Chi tiết: ${f.detail}\n`;
    });
    output += "\n";
  }

  if (patterns.protectedTitles && patterns.protectedTitles.length > 0) {
    output += "BẮT BUỘC BẢO VỆ DANH XƯNG CHÂN DUNG (Không được lược bỏ, thay thế, đổi thứ bậc):\n";
    patterns.protectedTitles.forEach(t => {
      output += `- "${t.key}" (${t.description || "Giữ nguyên"})\n`;
    });
    output += "\n";
  }
  
  if (patterns.greeting && patterns.greeting.length > 0) {
    output += "QUY TẮC DỊCH HÀNH LỄ / CHÀO HỎI (GREETING PATTERNS):\n";
    patterns.greeting.forEach(g => {
      output += `- Bản gốc: "${g.pattern}" -> Dịch tự nhiên: "${g.replacement}". ${g.note || ""}\n`;
    });
    output += "\n";
  }

  if (patterns.emotion && patterns.emotion.length > 0) {
    output += "QUY TẮC DỊCH BIỂU THỊ CẢM XÚC (EMOTION PATTERNS):\n";
    patterns.emotion.forEach(e => {
      output += `- Bản gốc: "${e.pattern}" -> Dịch tự nhiên: "${e.replacement}"\n`;
    });
    output += "\n";
  }

  if (patterns.action && patterns.action.length > 0) {
    output += "QUY TẮC DỊCH HÀNH ĐỘNG THƯỜNG GẶP (ACTION PATTERNS):\n";
    patterns.action.forEach(a => {
      output += `- Bản gốc: "${a.pattern}" -> Dịch tự nhiên: "${a.replacement}"\n`;
    });
    output += "\n";
  }

  if (patterns.sentence && patterns.sentence.length > 0) {
    output += "CẤU TRÚC CÂU CẦN TRÁNH VÀ VIẾT LẠI DỰA TRÊN NGỮ CẢNH (SENTENCE STRUCTURES):\n";
    patterns.sentence.forEach(s => {
      output += `- Bản gốc: "${s.pattern}" -> Viết lại mượt mà: "${s.replacement}" (Ưu tiên ý nghĩa, viết lại thoát ý tự nhiên, không dịch sát cấu trúc Hán Việt)\n`;
    });
    output += "\n";
  }

  if (patterns.vocabulary && patterns.vocabulary.length > 0) {
    output += "BẢNG DỊCH THUẬT NGỮ CONVERT ĐẶC THÙ (CONVERT VOCABULARY):\n";
    patterns.vocabulary.forEach(v => {
      output += `- "${v.pattern}" -> Dịch tự nhiên: "${v.replacement}"\n`;
    });
    output += "\n";
  }
  
  return output.trim();
}
