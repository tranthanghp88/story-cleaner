const fs = require('fs');
const path = require('path');
const os = require('os');

const logPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Story Cleaner', 'title-debug.log');
if (!fs.existsSync(logPath)) {
  console.log("Log file not found:", logPath);
  process.exit(1);
}

const content = fs.readFileSync(logPath, 'utf8');
const regex = /\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/g;

// Parse blocks
const timestamps = [];
let match;
while ((match = regex.exec(content)) !== null) {
  timestamps.push({
    time: match[1],
    index: match.index,
    length: match[0].length
  });
}

const blocks = [];
for (let i = 0; i < timestamps.length; i++) {
  const start = timestamps[i].index + timestamps[i].length;
  const end = (i + 1 < timestamps.length) ? timestamps[i + 1].index : content.length;
  blocks.push({
    time: timestamps[i].time,
    content: content.substring(start, end).trim()
  });
}

let count = 0;
blocks.forEach((b, idx) => {
  if (b.content.includes("Triệu Vân ngây ngốc đứng lặng")) {
    count++;
    const firstLine = b.content.split('\n')[0].trim();
    console.log(`\nOccurrence ${count}: Block ${idx} at [${b.time}] Header: "${firstLine}"`);
    console.log("Content length:", b.content.length);
    console.log("Content preview (first 500 chars):");
    console.log(b.content.substring(0, 500));
  }
});
