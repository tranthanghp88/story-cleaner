const fs = require('fs');
const path = require('path');

const cachePath = path.join(__dirname, 'app_cache_clean.json');
const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));

const CONVERT_PATTERNS = {
  protectedTitles: [
    { key: "thiếu chủ" },
    { key: "đại trưởng lão" },
    { key: "gia chủ" },
    { key: "trưởng lão" },
    { key: "tộc trưởng" },
    { key: "điện chủ" },
    { key: "đường chủ" }
  ],
  emotion: [
    { pattern: "khóc không ra nước mắt" },
    { pattern: "tâm tình" },
    { pattern: "tê cả da đầu" },
    { pattern: "tâm động" },
    { pattern: "thổ tào" }
  ],
  action: [
    { pattern: "hút khí / hút một hơi khí lạnh" },
    { pattern: "ngốc trệ / ngốc lập" }
  ],
  sentence: [
    { pattern: "Nói đến..." },
    { pattern: "Đang khi nói chuyện..." },
    { pattern: "Nói rồi..." },
    { pattern: "Ngươi bị bỏ" }
  ],
  vocabulary: [
    { pattern: "lạp phong" },
    { pattern: "hảo hảo" },
    { pattern: "gặp quỷ" },
    { pattern: "thượng vị" }
  ]
};

function formatConvertPatternsForPrompt(patterns) {
  let output = "";
  if (patterns.protectedTitles && patterns.protectedTitles.length > 0) {
    output += "BẮT BUỘC BẢO VỆ DANH XƯNG CHÂN DUNG (Không được lược bỏ, thay thế, đổi thứ bậc):\n";
    patterns.protectedTitles.forEach(t => {
      output += `- "${t.key}"\n`;
    });
    output += "\n";
  }
  if (patterns.emotion && patterns.emotion.length > 0) {
    output += "QUY TẮC DỊCH BIỂU THỊ CẢM XÚC (EMOTION PATTERNS):\n";
    patterns.emotion.forEach(e => {
      output += `- Bản gốc: "${e.pattern}"\n`;
    });
    output += "\n";
  }
  if (patterns.action && patterns.action.length > 0) {
    output += "QUY TẮC DỊCH HÀNH ĐỘNG THƯỜNG GẶP (ACTION PATTERNS):\n";
    patterns.action.forEach(a => {
      output += `- Bản gốc: "${a.pattern}"\n`;
    });
    output += "\n";
  }
  if (patterns.sentence && patterns.sentence.length > 0) {
    output += "CẤU TRÚC CÂU CẦN TRÁNH VÀ VIẾT LẠI DỰA TRÊN NGỮ CẢNH (SENTENCE STRUCTURES):\n";
    patterns.sentence.forEach(s => {
      output += `- Bản gốc: "${s.pattern}"\n`;
    });
    output += "\n";
  }
  if (patterns.vocabulary && patterns.vocabulary.length > 0) {
    output += "BẢNG DỊCH THUẬT NGỮ CONVERT ĐẶC THÙ (CONVERT VOCABULARY):\n";
    patterns.vocabulary.forEach(v => {
      output += `- "${v.pattern}"\n`;
    });
    output += "\n";
  }
  return output.trim();
}

function getConvertFlaggingPatterns() {
  const patterns = new Set();
  const staticTerms = [
    "minh bạch", "lên vị", "bị bỏ", "nói chuyện", "gặp sư phụ", "bị bỏ rồi",
    "thiếu chủ vị", "tộc lão", "đại trưởng lão", "thiếu chủ", "gia chủ", "trưởng lão", "tộc trưởng", "điện chủ", "đường chủ"
  ];
  staticTerms.forEach(t => patterns.add(t.toLowerCase()));

  const categories = ['emotion', 'action', 'sentence', 'vocabulary'];
  categories.forEach(cat => {
    const list = CONVERT_PATTERNS[cat];
    if (Array.isArray(list)) {
      list.forEach(item => {
        if (item.pattern) {
          const parts = item.pattern.split('/');
          parts.forEach(p => {
            const clean = p.replace(/\.+/g, '').trim().toLowerCase();
            if (clean) patterns.add(clean);
          });
        }
      });
    }
  });

  if (Array.isArray(CONVERT_PATTERNS.protectedTitles)) {
    CONVERT_PATTERNS.protectedTitles.forEach(item => {
      if (item.key) {
        patterns.add(item.key.trim().toLowerCase());
      }
    });
  }
  return Array.from(patterns);
}

function splitIntoSentences(text) {
  const segments = [];
  let current = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    current += char;
    if (char === '\n') {
      segments.push(current);
      current = "";
    } else if (['.', '!', '?', '…', '。', '！', '？'].includes(char)) {
      while (i + 1 < text.length && ["\"", "'", "”", "』", " ", "\r"].includes(text[i + 1])) {
        i++;
        current += text[i];
      }
      segments.push(current);
      current = "";
    }
  }
  if (current) {
    segments.push(current);
  }
  return segments;
}

function shouldFlagSentence(text, patterns) {
  const lower = text.toLowerCase();
  for (const pattern of patterns) {
    if (lower.includes(pattern)) {
      return pattern;
    }
  }
  return null;
}

// 2. Load raw text
const chapter = cache.chapters[0];
let rawText = chapter.raw;

// Strip header if present
const startIndex = rawText.indexOf("Triệu Vân ngây ngốc đứng lặng");
if (startIndex !== -1) {
  rawText = rawText.substring(startIndex);
}

const rawSegments = splitIntoSentences(rawText);
const segments = [];
let sentenceCounter = 0;
const flaggingPatterns = getConvertFlaggingPatterns();

for (const seg of rawSegments) {
  const isSentence = /[a-zA-Zà-ỹÀ-Ỹ0-9]/.test(seg);
  if (isSentence) {
    sentenceCounter++;
    const matchedPattern = shouldFlagSentence(seg, flaggingPatterns);
    segments.push({
      id: sentenceCounter,
      type: 'sentence',
      text: seg,
      flagged: !!matchedPattern,
      matchedPattern: matchedPattern
    });
  } else {
    segments.push({
      type: 'separator',
      text: seg
    });
  }
}

const sentenceSegments = segments.filter(s => s.type === 'sentence');
const flaggedSentences = sentenceSegments.filter(s => s.flagged);

const flaggedItems = flaggedSentences.map(item => {
  const idx = sentenceSegments.findIndex(s => s.id === item.id);
  return {
    sentenceId: item.id,
    original: item.text.trim(),
    context: {
      prev_2: idx >= 2 ? sentenceSegments[idx - 2].text.trim() : "",
      prev_1: idx >= 1 ? sentenceSegments[idx - 1].text.trim() : "",
      next_1: idx + 1 < sentenceSegments.length ? sentenceSegments[idx + 1].text.trim() : "",
      next_2: idx + 2 < sentenceSegments.length ? sentenceSegments[idx + 2].text.trim() : ""
    }
  };
});

const formattedPatterns = formatConvertPatternsForPrompt(CONVERT_PATTERNS);
const pronoun = 'balanced';
const memory = '';
const extra = '';
const preserve = '';

const selectivePrompt = `Bạn là biên tập viên truyện dịch tối giản kiêm chuyên gia Việt hóa tiểu thuyết.
Nhiệm vụ của bạn là xem xét các câu tiếng Việt dịch thô hoặc chứa từ ngữ convert trong danh sách dưới đây và sửa lại chúng cho tự nhiên, mượt mà.

QUY TẮC CỰC KỲ QUAN TRỌNG:
1. CHỈ sửa đổi câu mục tiêu (original). Giữ nguyên ý nghĩa, bối cảnh, không bịa thêm thông tin, hành động hay cảm xúc.
2. TUYỆT ĐỐI không thay đổi, loại bỏ hay hạ thấp các danh xưng bảo vệ (thiếu chủ, đại trưởng lão, gia chủ, trưởng lão, tộc trưởng, điện chủ, đường chủ...). Không thay thế chúng bằng tên riêng hay mô tả khác.
3. Sử dụng 2 câu trước (prev_2, prev_1) và 2 câu sau (next_1, next_2) trong trường 'context' làm ngữ cảnh để quyết định xưng hô và nghĩa phù hợp nhất. Tuyệt đối KHÔNG thay đổi các câu ngữ cảnh này và KHÔNG trả chúng về trong kết quả.
4. Nếu câu mục tiêu (original) vốn đã tự nhiên, dễ hiểu, hãy giữ nguyên câu gốc.
5. Định dạng đầu ra bắt buộc phải là một JSON array của các object chứa:
   - "sentenceId": số ID của câu.
   - "original": câu mục tiêu gốc.
   - "edited": câu mục tiêu sau khi đã được sửa (hoặc giữ nguyên nếu đã chuẩn).

Các quy tắc dịch convert:
${formattedPatterns}

Cài đặt bổ sung:
- Từ ngữ cần bảo toàn: ${preserve || 'Không có'}
- Xưng hô ưu tiên: ${pronoun}
- Ghi nhớ riêng bộ truyện: ${memory || 'Không có'}
- Yêu cầu khác: ${extra || 'Không có'}

Dưới đây là danh sách các câu cần xử lý dưới dạng JSON:
${JSON.stringify(flaggedItems, null, 2)}`;

async function tryModels(prompt) {
  const activeKeys = cache.apiPool.filter(k => k.lastStatus === 'active').map(k => k.key);
  // We'll try each active key and different models
  const models = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
  
  for (const key of activeKeys) {
    for (const model of models) {
      console.log(`Trying model: ${model} with key: ${key.substring(0, 10)}...`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
      
      const payload = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.35,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
          responseSchema: {
            type: "ARRAY",
            description: "Danh sách các câu đã được sửa đổi",
            items: {
              type: "OBJECT",
              properties: {
                sentenceId: { type: "INTEGER" },
                original: { type: "STRING" },
                edited: { type: "STRING" }
              },
              required: ["sentenceId", "original", "edited"]
            }
          }
        }
      };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const resJson = await response.json();
          const text = resJson.candidates[0].content.parts[0].text;
          console.log("Success!");
          return { text, model, key };
        } else {
          const errText = await response.text();
          console.log(`Failed! HTTP ${response.status}: ${errText.substring(0, 200)}`);
        }
      } catch(e) {
        console.log(`Error: ${e.message}`);
      }
    }
  }
  throw new Error("All keys and models failed.");
}

async function main() {
  try {
    const result = await tryModels(selectivePrompt);
    console.log(`\n=== GEMINI RESPONSE (Model: ${result.model}) ===`);
    console.log(result.text);
    
    const editedList = JSON.parse(result.text);
    
    console.log("\n=== COMPARISON & PATCH ANALYSIS ===");
    let editedCount = 0;
    
    editedList.forEach(item => {
      const sId = Number(item.sentenceId);
      const originalText = item.original;
      const editedText = item.edited;
      
      const seg = segments.find(s => s.type === 'sentence' && s.id === sId);
      if (seg) {
        const trimmedOrig = originalText.trim();
        const trimmedEdit = editedText.trim();
        const isChanged = trimmedEdit !== trimmedOrig;
        
        let finalPatched = seg.text;
        if (isChanged && trimmedEdit) {
          const matchWhitespace = seg.text.match(/\s*$/);
          const trailingWhitespace = matchWhitespace ? matchWhitespace[0] : "";
          finalPatched = editedText.trim() + trailingWhitespace;
          editedCount++;
        }
        
        console.log(`\nSentence ID: ${sId}`);
        console.log(`  - Original: "${seg.text.trim()}"`);
        console.log(`  - Gemini Edited: "${editedText}"`);
        console.log(`  - Patched:       "${finalPatched.trim()}"`);
        console.log(`  - Did change?     ${isChanged ? 'YES' : 'NO'}`);
      }
    });
    
    console.log(`\nTotal Edited Count: ${editedCount}`);
    
  } catch(err) {
    console.error("Error in execution:", err.message);
  }
}

main();
