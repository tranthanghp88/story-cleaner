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
console.log("Log file size:", buffer.length);

const BLOCK_SIZE = 32768;
let offset = 0;
const records = [];

// LevelDB Log Record Types
// 1: FULL, 2: FIRST, 3: MIDDLE, 4: LAST
// Header: 4 bytes checksum, 2 bytes length (little endian), 1 byte type

let currentRecordBuffer = [];

while (offset < buffer.length) {
  const blockOffset = offset % BLOCK_SIZE;
  const remainingInBlock = BLOCK_SIZE - blockOffset;
  
  if (remainingInBlock < 7) {
    // Padding at the end of the block, skip to next block
    offset += remainingInBlock;
    continue;
  }
  
  const length = buffer.readUInt16LE(offset + 4);
  const type = buffer.readUInt8(offset + 6);
  
  if (length === 0 && type === 0) {
    // Zero length and type means padding/end of block
    offset += remainingInBlock;
    continue;
  }
  
  const dataStart = offset + 7;
  if (dataStart + length > buffer.length) {
    console.log(`Error: record extends beyond buffer at offset ${offset}`);
    break;
  }
  
  const recordData = buffer.slice(dataStart, dataStart + length);
  
  if (type === 1) { // FULL
    records.push(Buffer.from(recordData));
  } else if (type === 2) { // FIRST
    currentRecordBuffer = [Buffer.from(recordData)];
  } else if (type === 3) { // MIDDLE
    currentRecordBuffer.push(Buffer.from(recordData));
  } else if (type === 4) { // LAST
    currentRecordBuffer.push(Buffer.from(recordData));
    records.push(Buffer.concat(currentRecordBuffer));
    currentRecordBuffer = [];
  }
  
  offset += 7 + length;
}

console.log(`Parsed ${records.length} logical records.`);

// Let's search for "story-cleaner-v7-cache" inside the parsed records
records.forEach((rec, recIdx) => {
  // Let's search for key in UTF-8
  const recTextUtf8 = rec.toString('utf8');
  const key = 'story-cleaner-v7-cache';
  const keyIdx = recTextUtf8.indexOf(key);
  
  if (keyIdx !== -1) {
    console.log(`\nFound key in record ${recIdx} at index ${keyIdx}`);
    // The value starts after the key and 4 prefix bytes (local storage value header)
    const valStart = keyIdx + key.length + 4;
    const valBuffer = rec.slice(valStart);
    
    // Decode value as UTF-16LE
    const valText = valBuffer.toString('utf16le');
    
    // Find matching closing bracket
    let bracketCount = 0;
    let jsonEnd = -1;
    for (let i = 0; i < valText.length; i++) {
      if (valText[i] === '{') bracketCount++;
      else if (valText[i] === '}') {
        bracketCount--;
        if (bracketCount === 0) {
          jsonEnd = i + 1;
          break;
        }
      }
    }
    
    if (jsonEnd !== -1) {
      const jsonStr = valText.substring(0, jsonEnd);
      console.log(`Extracted clean JSON string of length ${jsonStr.length}`);
      try {
        const parsed = JSON.parse(jsonStr);
        console.log("Successfully parsed JSON!");
        console.log("Keys in cache:", Object.keys(parsed));
        if (parsed.apiPool) {
          console.log("apiPool keys:");
          parsed.apiPool.forEach((item, i) => {
            console.log(`  * [${i}] Key: ${item.key ? item.key.substring(0, 15) + '...' : 'none'}, Status: ${item.lastStatus}`);
          });
        }
        
        fs.writeFileSync(path.join(__dirname, 'app_cache_clean.json'), JSON.stringify(parsed, null, 2), 'utf8');
        console.log("Saved parsed JSON to scratch/app_cache_clean.json");
      } catch(err) {
        console.log("JSON parse failed:", err.message);
        fs.writeFileSync(path.join(__dirname, 'failed_clean_string.txt'), jsonStr, 'utf8');
      }
    } else {
      console.log("Could not find matching closing bracket in record UTF-16.");
    }
  }
});
