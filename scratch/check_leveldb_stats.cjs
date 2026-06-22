const fs = require('fs');
const path = require('path');
const os = require('os');

const leveldbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Story Cleaner', 'Local Storage', 'leveldb');
if (!fs.existsSync(leveldbPath)) {
  console.log("LevelDB path does not exist:", leveldbPath);
  process.exit(1);
}

const files = fs.readdirSync(leveldbPath);
console.log("LevelDB files:", files);

files.forEach(file => {
  const filePath = path.join(leveldbPath, file);
  if (fs.statSync(filePath).isFile()) {
    try {
      const buffer = fs.readFileSync(filePath);
      const text = buffer.toString('utf8');
      
      if (text.includes('aiSelectiveStats')) {
        console.log(`\nFound "aiSelectiveStats" in file: ${file}`);
        
        // Find all occurrences of aiSelectiveStats and print surrounding text
        let idx = -1;
        while ((idx = text.indexOf('aiSelectiveStats', idx + 1)) !== -1) {
          const start = Math.max(0, idx - 100);
          const end = Math.min(text.length, idx + 300);
          console.log(`Snippet: ... ${text.substring(start, end).replace(/\s+/g, ' ')} ...`);
        }
      }
    } catch(e) {
      // console.error(`Error reading ${file}:`, e.message);
    }
  }
});
