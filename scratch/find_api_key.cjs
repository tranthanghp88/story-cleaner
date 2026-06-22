const fs = require('fs');
const path = require('path');
const os = require('os');

const leveldbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Story Cleaner', 'Local Storage', 'leveldb');
if (!fs.existsSync(leveldbPath)) {
  console.log("LevelDB path does not exist:", leveldbPath);
  process.exit(1);
}

const files = fs.readdirSync(leveldbPath);
let found = false;

files.forEach(file => {
  const filePath = path.join(leveldbPath, file);
  if (fs.statSync(filePath).isFile()) {
    try {
      const buffer = fs.readFileSync(filePath);
      const text = buffer.toString('utf8');
      
      const match = text.match(/AIzaSy[A-Za-z0-9_-]{33}/);
      if (match) {
        console.log(`Found API key in file ${file}: ${match[0]}`);
        found = true;
      }
    } catch(e) {
    }
  }
});

if (!found) {
  console.log("No API key starting with AIzaSy found in LevelDB.");
}
