const fs = require('fs');
const path = require('path');

// 1. Define CONVERT_PATTERNS as it is in convertPatterns.js
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

// Replicate getConvertFlaggingPatterns
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

// Replicate splitIntoSentences
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
      return pattern; // return matched pattern for debugging
    }
  }
  return null;
}

// Main execution
const rawTextPath = path.join(__dirname, 'mat_mu_extracted_clean.txt');
let rawText = fs.readFileSync(rawTextPath, 'utf8');

// Strip the ad at the end and title header if they are in the file
// But we want to match the log's [Final Text] which starts with "Triệu Vân ngây ngốc đứng lặng..."
// Let's find "Triệu Vân ngây ngốc đứng lặng" and slice from there
const startIndex = rawText.indexOf("Triệu Vân ngây ngốc đứng lặng");
if (startIndex !== -1) {
  rawText = rawText.substring(startIndex);
}

// Also strip the ad at the end
const adIndex = rawText.indexOf("Áo thun trơn basic form");
if (adIndex !== -1) {
  rawText = rawText.substring(0, adIndex).trim();
}

console.log("Cleaned Text Length:", rawText.length);

const rawSegments = splitIntoSentences(rawText);
const segments = [];
let sentenceCounter = 0;
const flaggingPatterns = getConvertFlaggingPatterns();
console.log("Flagging Patterns:", flaggingPatterns);

for (const seg of rawSegments) {
  const isSentence = /[a-zA-Zà-ỹÀ-Ỹ0-9]/.test(seg);
  if (isSentence) {
    sentenceCounter++;
    const matchedPattern = shouldFlagSentence(seg, flaggingPatterns);
    segments.push({
      id: sentenceCounter,
      type: 'sentence',
      text: seg.trim(),
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

console.log("\n--- STATISTICS ---");
console.log("Total Sentences:", sentenceSegments.length);
console.log("Flagged Sentences:", flaggedSentences.length);
console.log("Preserved Sentences:", sentenceSegments.length - flaggedSentences.length);

console.log("\n--- FIRST 20 FLAGGED SENTENCES ---");
flaggedSentences.slice(0, 20).forEach((s, idx) => {
  console.log(`[${idx+1}] (ID: ${s.id}, Matched: "${s.matchedPattern}"): ${s.text}`);
});

console.log("\n--- SAMPLE UNFLAGGED SENTENCES ---");
// Let's print some unflagged sentences so we can identify clearly convert ones
sentenceSegments.filter(s => !s.flagged).slice(0, 40).forEach((s, idx) => {
  console.log(`[UF ${idx+1}] (ID: ${s.id}): ${s.text}`);
});

// Let's also search for some typical convert terms that were NOT in the patterns
// (e.g. "thần tình", "nực cười", "động phòng hoa chúc", "hồng khăn cô dâu", "xốc", "thân thể lạnh run", "trống rỗng", "vong cổ thành", "con ngươi", "đại đường")
const unflagged = sentenceSegments.filter(s => !s.flagged);
console.log("\n--- SEARCHING FOR UNFLAGGED CONVERT SENTENCES ---");
let count = 0;
const convertKeywords = ["động phòng", "xốc", "mù lòa", "khăn cô dâu", "nực cười", "vong cổ thành", "thần tình", "con ngươi", "hơi nước", "sỉ nhục", "võ tu", "chà đạp", "đoạn mạch", "đạo cô", "basic", " basic", "shopee"];
unflagged.forEach(s => {
  const hasKeyword = convertKeywords.some(kw => s.text.toLowerCase().includes(kw));
  if (hasKeyword && count < 30) {
    count++;
    console.log(`[UC ${count}] (ID: ${s.id}): ${s.text}`);
  }
});
