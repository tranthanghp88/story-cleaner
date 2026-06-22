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
    const text = buffer.toString('utf8');
    
    const key = 'story-cleaner-v7-cache';
    let idx = -1;
    while ((idx = text.indexOf(key, idx + 1)) !== -1) {
      console.log(`Found ${key} in ${file} at index ${idx}`);
      // Find JSON after this key. LevelDB values have some prefix bytes, then the string.
      // Let's search for the first '{' after the key
      const jsonStart = text.indexOf('{', idx);
      if (jsonStart !== -1) {
        // Let's find the matching closing bracket '}'
        // Since the JSON is large, we can scan forward counting brackets
        let bracketCount = 0;
        let jsonEnd = -1;
        for (let i = jsonStart; i < text.length; i++) {
          if (text[i] === '{') bracketCount++;
          else if (text[i] === '}') {
            bracketCount--;
            if (bracketCount === 0) {
              jsonEnd = i + 1;
              break;
            }
          }
        }
        
        if (jsonEnd !== -1) {
          const jsonStr = text.substring(jsonStart, jsonEnd);
          try {
            const parsed = JSON.parse(jsonStr);
            console.log(`  -> Successfully parsed JSON of length ${jsonStr.length}!`);
            console.log("  -> Keys in cache:", Object.keys(parsed));
            if (parsed.apiPool) {
              console.log("  -> Found apiPool with items:", parsed.apiPool.length);
              parsed.apiPool.forEach((item, idx) => {
                console.log(`    * [${idx}] Key: ${item.key ? item.key.substring(0, 10) + '...' : 'none'}, Status: ${item.lastStatus}`);
              });
            }
            // Save the entire parsed JSON to scratch folder
            fs.writeFileSync(path.join(__dirname, 'app_cache_dump.json'), JSON.stringify(parsed, null, 2), 'utf8');
            console.log("  -> Saved parsed JSON to scratch/app_cache_dump.json");
          } catch(err) {
            console.log(`  -> Found JSON-like text but failed to parse: ${err.message}`);
            // Let's save the raw substring for manual inspection
            fs.writeFileSync(path.join(__dirname, 'app_cache_raw_substring.txt'), text.substring(jsonStart, jsonStart + 5000), 'utf8');
          }
        } else {
          console.log("  -> Matching '}' not found.");
        }
      }
    }
  } catch(e) {
  }
});
