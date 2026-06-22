const fs = require('fs');
const path = require('path');
const os = require('os');

const leveldbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Story Cleaner', 'Local Storage', 'leveldb');
const filePath = path.join(leveldbPath, '003108.log');

if (!fs.existsSync(filePath)) {
  console.log("003108.log not found");
  process.exit(1);
}

const buffer = fs.readFileSync(filePath);
// LevelDB uses little-endian. Chromium localStorage values are stored as UTF-16LE strings.
// Let's decode the buffer as UTF-16LE.
const utf16Text = buffer.toString('utf16le');

// Let's find "story-cleaner-v7-cache"
const key = 'story-cleaner-v7-cache';
const idx = utf16Text.indexOf(key);

if (idx !== -1) {
  console.log(`Found ${key} in 003108.log at UTF-16 index ${idx}`);
  
  // Let's find the first '{' after the key
  const jsonStart = utf16Text.indexOf('{', idx);
  if (jsonStart !== -1) {
    let bracketCount = 0;
    let jsonEnd = -1;
    for (let i = jsonStart; i < utf16Text.length; i++) {
      if (utf16Text[i] === '{') bracketCount++;
      else if (utf16Text[i] === '}') {
        bracketCount--;
        if (bracketCount === 0) {
          jsonEnd = i + 1;
          break;
        }
      }
    }
    
    if (jsonEnd !== -1) {
      const jsonStr = utf16Text.substring(jsonStart, jsonEnd);
      try {
        const parsed = JSON.parse(jsonStr);
        console.log("Successfully parsed UTF-16 JSON!");
        console.log("Keys:", Object.keys(parsed));
        
        // Write the parsed JSON cleanly to scratch folder
        fs.writeFileSync(path.join(__dirname, 'app_cache_utf16.json'), JSON.stringify(parsed, null, 2), 'utf8');
        console.log("Saved parsed UTF-16 JSON to scratch/app_cache_utf16.json");
        
        if (parsed.apiPool) {
          console.log(`apiPool has ${parsed.apiPool.length} items:`);
          parsed.apiPool.forEach((item, i) => {
            console.log(`  * [${i}] Key: ${item.key ? item.key.substring(0, 12) + '...' : 'none'}, Status: ${item.lastStatus}`);
          });
        }
      } catch(err) {
        console.log(`Failed to parse UTF-16 JSON: ${err.message}`);
        fs.writeFileSync(path.join(__dirname, 'app_cache_utf16_failed.txt'), jsonStr.substring(0, 5000), 'utf8');
      }
    } else {
      console.log("Matching '}' not found in UTF-16 string.");
    }
  } else {
    console.log("First '{' not found in UTF-16 string.");
  }
} else {
  console.log(`Key ${key} not found when decoding as UTF-16LE.`);
  
  // Let's try searching for the key in UTF-8
  const utf8Text = buffer.toString('utf8');
  const idx8 = utf8Text.indexOf(key);
  console.log(`Index in UTF-8: ${idx8}`);
}
