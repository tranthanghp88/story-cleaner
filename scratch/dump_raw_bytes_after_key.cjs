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
  if (!fs.statSync(filePath).isFile()) return;
  if (path.extname(file) === '.ldb' || path.extname(file) === '.log') {
    try {
      const buffer = fs.readFileSync(filePath);
      const text = buffer.toString('utf8');
      const key = 'story-cleaner-v7-cache';
      let idx = -1;
      
      while ((idx = text.indexOf(key, idx + 1)) !== -1) {
        console.log(`\nFound key in ${file} at index ${idx}`);
        // Let's dump the next 4000 characters, filtering out non-printable ones
        let output = '';
        for (let i = idx + key.length; i < Math.min(buffer.length, idx + key.length + 8000); i++) {
          const byte = buffer[i];
          if ((byte >= 32 && byte <= 126) || byte === 10 || byte === 13) {
            output += String.fromCharCode(byte);
          } else {
            output += ' ';
          }
        }
        // Trim multiple spaces to make it readable
        console.log("Data:");
        console.log(output.replace(/\s+/g, ' ').substring(0, 1000));
      }
    } catch(err) {
    }
  }
});
