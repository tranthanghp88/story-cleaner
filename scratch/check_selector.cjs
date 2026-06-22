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

const targetBlock = blocks.find(b => b.content.includes('Vĩnh Hằng Chi Môn') && b.content.startsWith('[Content Source]'));
if (targetBlock) {
  console.log("Found Content Source block!");
  console.log(targetBlock.content.substring(0, 500));
} else {
  console.log("No Content Source block found for Vĩnh Hằng Chi Môn.");
}
