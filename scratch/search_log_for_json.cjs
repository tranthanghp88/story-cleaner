const fs = require('fs');
const path = require('path');
const os = require('os');

const logPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Story Cleaner', 'title-debug.log');
if (!fs.existsSync(logPath)) {
  console.log("Log file not found:", logPath);
  process.exit(1);
}

const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');
console.log(`Log file has ${lines.length} lines.`);

let matchCount = 0;
lines.forEach((line, idx) => {
  if (line.includes('"sentenceId"') || line.includes('"edited"') || line.includes('sentenceId')) {
    matchCount++;
    console.log(`L${idx+1}: ${line.substring(0, 300)}`);
  }
});

console.log(`Total matches found: ${matchCount}`);
