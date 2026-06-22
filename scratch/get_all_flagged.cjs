const fs = require('fs');
const path = require('path');

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

const rawTextPath = path.join(__dirname, 'mat_mu_extracted_clean.txt');
let rawText = fs.readFileSync(rawTextPath, 'utf8');

// Strip titles and ads to match localCleaned
const startIndex = rawText.indexOf("Triệu Vân ngây ngốc đứng lặng");
if (startIndex !== -1) {
  rawText = rawText.substring(startIndex);
}
const adIndex = rawText.indexOf("Áo thun trơn basic form");
if (adIndex !== -1) {
  rawText = rawText.substring(0, adIndex).trim();
}

const rawSegments = splitIntoSentences(rawText);
const sentenceSegments = [];
let sentenceCounter = 0;
const flaggingPatterns = getConvertFlaggingPatterns();

for (const seg of rawSegments) {
  const isSentence = /[a-zA-Zà-ỹÀ-Ỹ0-9]/.test(seg);
  if (isSentence) {
    sentenceCounter++;
    const matchedPattern = shouldFlagSentence(seg, flaggingPatterns);
    sentenceSegments.push({
      id: sentenceCounter,
      text: seg.trim(),
      flagged: !!matchedPattern,
      matchedPattern: matchedPattern
    });
  }
}

const flagged = sentenceSegments.filter(s => s.flagged);
const unflagged = sentenceSegments.filter(s => !s.flagged);

console.log(`JSON_DATA_START`);
console.log(JSON.stringify({
  total: sentenceSegments.length,
  flaggedCount: flagged.length,
  preservedCount: unflagged.length,
  flaggedList: flagged.map(f => ({ id: f.id, text: f.text, pattern: f.matchedPattern })),
  unflaggedList: unflagged.map(u => ({ id: u.id, text: u.text }))
}));
console.log(`JSON_DATA_END`);
