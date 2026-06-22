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
const key = 'story-cleaner-v7-cache';
const utf8Text = buffer.toString('utf8');
const idx = utf8Text.indexOf(key);

if (idx !== -1) {
  const valueStart = idx + key.length + 4; // index 113
  console.log(`Value starts at byte index: ${valueStart}`);
  
  // Let's decode the rest of the buffer from valueStart as UTF-16LE
  const valueBuffer = buffer.slice(valueStart);
  const valueText = valueBuffer.toString('utf16le');
  
  // Let's find the matching closing bracket '}'
  let bracketCount = 0;
  let jsonEndCharIndex = -1;
  
  for (let i = 0; i < valueText.length; i++) {
    if (valueText[i] === '{') bracketCount++;
    else if (valueText[i] === '}') {
      bracketCount--;
      if (bracketCount === 0) {
        jsonEndCharIndex = i + 1;
        break;
      }
    }
  }
  
  if (jsonEndCharIndex !== -1) {
    const jsonStr = valueText.substring(0, jsonEndCharIndex);
    console.log(`Successfully extracted JSON of length ${jsonStr.length}!`);
    try {
      const parsed = JSON.parse(jsonStr);
      console.log("Successfully parsed JSON!");
      console.log("Keys in cache:", Object.keys(parsed));
      if (parsed.apiPool) {
        console.log(`Found apiPool with ${parsed.apiPool.length} keys:`);
        parsed.apiPool.forEach((item, i) => {
          console.log(`  * [${i}] Key: ${item.key ? item.key.substring(0, 15) + '...' : 'none'}, Status: ${item.lastStatus}`);
        });
      }
      fs.writeFileSync(path.join(__dirname, 'app_cache_extracted.json'), JSON.stringify(parsed, null, 2), 'utf8');
      console.log("Saved JSON to scratch/app_cache_extracted.json");
    } catch(err) {
      console.log("JSON parse failed:", err.message);
      fs.writeFileSync(path.join(__dirname, 'failed_string.txt'), jsonStr, 'utf8');
    }
  } else {
    console.log("Matching '}' not found in UTF-16 string.");
  }
} else {
  console.log("Key not found in UTF-8.");
}
