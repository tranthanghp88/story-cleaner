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

  try {
    const buffer = fs.readFileSync(filePath);
    
    // We want to find the key 'story-cleaner-v7-cache' in the buffer.
    // Since it's stored in UTF-8 or UTF-16, let's convert the buffer to a string in UTF-8
    const text = buffer.toString('utf8');
    const key = 'story-cleaner-v7-cache';
    let idx = -1;
    
    while ((idx = text.indexOf(key, idx + 1)) !== -1) {
      console.log(`\nFound key at index ${idx} in file ${file}`);
      
      // Let's grab the buffer from this index onwards
      const subBuffer = buffer.slice(idx);
      
      // Look for the first '{' character in subBuffer
      let startIdx = -1;
      for (let i = 0; i < subBuffer.length; i++) {
        if (subBuffer[i] === 123) { // ASCII code for '{'
          startIdx = i;
          break;
        }
      }
      
      if (startIdx !== -1) {
        // Let's extract characters until we find a match, but filter out non-printable bytes
        // We'll collect valid JSON characters.
        let jsonStr = '';
        let bracketCount = 0;
        let foundJson = false;
        
        for (let i = startIdx; i < subBuffer.length; i++) {
          const byte = subBuffer[i];
          // Keep only printable ASCII + common Vietnamese characters
          // ASCII 32 to 126 is printable. Plus newlines (10, 13).
          // We can also allow some non-ASCII bytes but let's be careful.
          if ((byte >= 32 && byte <= 126) || byte === 10 || byte === 13 || byte > 127) {
            const char = String.fromCharCode(byte);
            jsonStr += char;
            if (char === '{') bracketCount++;
            else if (char === '}') {
              bracketCount--;
              if (bracketCount === 0) {
                foundJson = true;
                break;
              }
            }
          }
        }
        
        if (foundJson) {
          console.log(`Found candidate JSON block. Length: ${jsonStr.length}`);
          try {
            // Since we skipped non-printable chars, some characters in strings might be lost,
            // but we can try to parse it. If it fails, we will print the first 1000 characters of it!
            const parsed = JSON.parse(jsonStr);
            console.log("Successfully parsed JSON!");
            console.log("Keys:", Object.keys(parsed));
            if (parsed.apiPool) {
              console.log("apiPool:", parsed.apiPool);
            }
          } catch(err) {
            console.log(`Parse failed: ${err.message}`);
            console.log("Snippet of extracted string:");
            console.log(jsonStr.substring(0, 1000));
          }
        } else {
          console.log("Could not find matching closing bracket.");
        }
      }
    }
  } catch(e) {
  }
});
