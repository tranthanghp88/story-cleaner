const fs = require('fs');
const path = require('path');
const os = require('os');

const leveldbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Story Cleaner', 'Local Storage', 'leveldb');
if (!fs.existsSync(leveldbPath)) {
  console.log("LevelDB path does not exist:", leveldbPath);
  process.exit(1);
}

const files = fs.readdirSync(leveldbPath);

files.forEach(file => {
  const filePath = path.join(leveldbPath, file);
  if (fs.statSync(filePath).isFile()) {
    try {
      const buffer = fs.readFileSync(filePath);
      const text = buffer.toString('utf8');
      
      const searchTerms = ['story-cleaner-v7-cache', 'apiPool', 'promptSettings'];
      searchTerms.forEach(term => {
        if (text.includes(term)) {
          console.log(`\nFound "${term}" in file: ${file}`);
          let idx = -1;
          while ((idx = text.indexOf(term, idx + 1)) !== -1) {
            const start = Math.max(0, idx - 100);
            const end = Math.min(text.length, idx + 300);
            console.log(`Snippet: ... ${text.substring(start, end).replace(/\s+/g, ' ')} ...`);
          }
        }
      });
    } catch(e) {
    }
  }
});
