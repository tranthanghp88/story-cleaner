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

export const CONVERT_PATTERNS_V2 = [
  // Nhóm Ngữ Pháp
  { pattern: "\\bthiên chi kiều nữ\\b", replacement: "con cưng của trời", type: "idiom", safety: "high" },
  { pattern: "\\bmắt mù tân nương\\b", replacement: "tân nương mù", type: "description", safety: "high" },
  { pattern: "\\bcó phần là\\b", replacement: "khá", type: "grammar", safety: "high" },
  { pattern: "\\bsớm đã\\b", replacement: "đã sớm", type: "grammar", safety: "high" },
  { pattern: "\\bnhất cái\\b", replacement: "một", type: "grammar", safety: "high" },
  { pattern: "\\bcái kia phút chốc\\b", replacement: "khoảnh khắc ấy", type: "grammar", safety: "high" },
  { pattern: "\\bchú rể quần áo\\b", replacement: "áo chú rể", type: "grammar", safety: "high" },
  { pattern: "\\bngười đi đường\\b", replacement: "người qua đường", type: "grammar", safety: "high" },
  { pattern: "\\blúc này mới\\b", replacement: "lúc ấy mới", type: "grammar", safety: "high" },
  { pattern: "\\btự mình biết rõ\\b", replacement: "tự biết lượng sức", type: "idiom", safety: "high" },
  { pattern: "\\bkhông dám ngôn ngữ\\b", replacement: "không dám lên tiếng", type: "idiom", safety: "high" },
  { pattern: "\\bnhịn không được\\b", replacement: "không kìm được", type: "idiom", safety: "high" },
  { pattern: "\\bnhìn xem\\b", replacement: "nhìn", type: "grammar", safety: "high" },
  { pattern: "\\bnhiều ít\\b", replacement: "bao nhiêu", type: "grammar", safety: "high" },
  { pattern: "\\bnguyên nhân chính là\\b", replacement: "chính vì", type: "grammar", safety: "high" },
  { pattern: "\\bhồi đáp vấn đề\\b", replacement: "trả lời câu hỏi", type: "grammar", safety: "high" },
  { pattern: "\\btrong mắt nước mắt\\b", replacement: "mắt nhoè lệ", type: "grammar", safety: "high" },
  { pattern: "\\bsớm đi\\b", replacement: "sớm", type: "grammar", safety: "high" },
  { pattern: "\\bbằng không thì\\b", replacement: "nếu không", type: "grammar", safety: "high" },
  { pattern: "\\bđích xác\\b", replacement: "quả thực", type: "grammar", safety: "high" },
  { pattern: "\\bđang khi nói chuyện\\b", replacement: "vừa nói chuyện", type: "grammar", safety: "high" },
  { pattern: "\\bnhìn tốt bọn họ\\b", replacement: "xem trọng họ", type: "grammar", safety: "high" },
  { pattern: "\\bsay rượu sau\\b", replacement: "sau khi say rượu", type: "grammar", safety: "high" },
  { pattern: "\\btự hài đồng lúc\\b", replacement: "từ thuở nhỏ", type: "grammar", safety: "high" },
  { pattern: "\\bchuẩn bị chịu\\b", replacement: "chịu đủ", type: "grammar", safety: "high" },
  { pattern: "\\btoàn bộ có hắn định\\b", replacement: "đều do hắn quyết định", type: "grammar", safety: "high" },
  { pattern: "\\bvẻ mặt tràn đầy nước mắt\\b", replacement: "khuôn mặt đầy nước mắt", type: "grammar", safety: "high" },
  { pattern: "\\bdần dần từng bước\\b", replacement: "từng bước một", type: "grammar", safety: "high" },
  
  // Nhóm Thành Ngữ
  { pattern: "\\bngươi đẩy ta táng\\b", replacement: "chen lấn xô đẩy", type: "idiom", safety: "high" },
  { pattern: "\\bchàng chàng thiếp thiếp\\b", replacement: "mặn nồng âu yếm", type: "idiom", safety: "high" },
  { pattern: "\\bcon cóc ăn thịt thiên nga\\b", replacement: "đũa mốc đòi mâm son", type: "idiom", safety: "high" },
  { pattern: "\\bkhinh người quá đáng\\b", replacement: "khinh người quá mức", type: "idiom", safety: "high" },
  { pattern: "\\btê tâm liệt phế\\b", replacement: "đau đớn xé lòng", type: "idiom", safety: "high" },
  { pattern: "\\bmọi âm thanh đều yên tĩnh\\b", replacement: "vạn vật tĩnh mịch", type: "idiom", safety: "high" },
  { pattern: "\\bcái xác không hồn\\b", replacement: "cái xác không hồn", type: "idiom", safety: "high" },
  { pattern: "\\bmơ mơ màng màng\\b", replacement: "mơ mơ hồ hồ", type: "idiom", safety: "high" },
  { pattern: "\\bbuồn bực sầu não mà chết\\b", replacement: "u uất sầu muộn mà chết", type: "idiom", safety: "high" },
  { pattern: "\\bchí tử\\b", replacement: "cho đến chết", type: "idiom", safety: "high" },
  
  // Nhóm Mô Tả Nhân Vật
  { pattern: "\\bsát khí quấn thân\\b", replacement: "sát khí quanh người", type: "description", safety: "high" },
  { pattern: "\\bmang mấy phần dữ tợn\\b", replacement: "lộ vẻ dữ tợn", type: "description", safety: "high" },
  { pattern: "\\bchất phác trống rỗng\\b", replacement: "đờ đẫn trống rỗng", type: "description", safety: "high" },
  { pattern: "\\bhơi lạnh cùng cao ngạo\\b", replacement: "vẻ lạnh lùng cao ngạo", type: "description", safety: "high" },
  { pattern: "\\bmặt sắc mặt xanh mét\\b", replacement: "sắc mặt mét xanh", type: "description", safety: "high" },
  { pattern: "\\bkhói mù lung chiều\\b", replacement: "ủ rũ âm u bao phủ", type: "description", safety: "high" },
  { pattern: "\\blẳng lặng đứng lặng\\b", replacement: "lặng lẽ đứng đó", type: "description", safety: "high" },
  { pattern: "\\bchảy tràn huyết\\b", replacement: "máu chảy ròng ròng", type: "description", safety: "high" },
  { pattern: "\\bhàn mang vội hiện\\b", replacement: "tia lạnh chợt lóe", type: "description", safety: "high" },
  { pattern: "\\btriển lộ không bỏ sót\\b", replacement: "bộc lộ hết thảy", type: "description", safety: "high" },
  { pattern: "\\bbị cưỡng chế một đầu\\b", replacement: "bị chèn ép đè đầu", type: "description", safety: "high" },
  { pattern: "\\bđối chọi gay gắt\\b", replacement: "đối đầu gay gắt", type: "description", safety: "high" },
  { pattern: "\\bgiương cung bạt kiếm\\b", replacement: "căng thẳng tột độ", type: "description", safety: "high" },
  { pattern: "\\byên ổn dọa người\\b", replacement: "yên lặng đáng sợ", type: "description", safety: "high" },
  
  // Phase 3 - Small targeted patch
  { pattern: "\\bchui tròng mắt\\b", replacement: "cụp mắt", type: "action", safety: "high" },
  { pattern: "\\bthân thể lạnh run\\b", replacement: "người run lẩy bẩy", type: "description", safety: "high" },
  { pattern: "\\bhạng gì thiên phú\\b", replacement: "thiên phú cỡ nào", type: "grammar", safety: "high" },
  { pattern: "\\bvẫn là mang\\b", replacement: "vẫn mang", type: "grammar", safety: "high" },
  { pattern: "\\btịch đoạn mạch phế thể\\b", replacement: "phế thể đứt gãy kinh mạch", type: "description", safety: "high" },
  { pattern: "\\bcũng như cái kia giống như\\b", replacement: "cũng giống như thế", type: "grammar", safety: "high" },
  { pattern: "\\bsắt đá trên\\b", replacement: "trên sắt đá", type: "grammar", safety: "high" },
  { pattern: "\\bnguyên là\\b", replacement: "vốn là", type: "grammar", safety: "high" },
  { pattern: "\\bchúng nhân\\b", replacement: "mọi người", type: "vocabulary", safety: "high" },
  { pattern: "\\bthưởng cùng\\b", replacement: "ban cho", type: "action", safety: "high" },
  { pattern: "\\bngươi hai nhà sự tình\\b", replacement: "chuyện của hai nhà các ngươi", type: "grammar", safety: "high" },
  { pattern: "\\bphế vật này nhi\\b", replacement: "đứa con phế vật này", type: "vocabulary", safety: "high" },
  { pattern: "\\bném qua nhân\\b", replacement: "mất mặt", type: "idiom", safety: "high" },
  { pattern: "\\bnhất tên ăn mày\\b", replacement: "một tên ăn mày", type: "grammar", safety: "high" },
  { pattern: "\\bdò mà đến\\b", replacement: "dò dẫm bước tới", type: "action", safety: "high" },
  { pattern: "sờ đến ([a-zA-Zà-ỹÀ-Ỹ\\s]{1,15}?) thân thể", replacement: "chạm vào người $1", type: "action", safety: "high" },
  { pattern: "\\blấy xuống cái cổ treo một cái sợi dây chuyền\\b", replacement: "tháo sợi dây chuyền đang đeo trên cổ", type: "action", safety: "high" },
  { pattern: "\\bsự tình\\b", replacement: "chuyện", type: "vocabulary", safety: "high" },
  { pattern: "\\bkhó trách\\b", replacement: "thảo nào", type: "grammar", safety: "high" }
];

