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
console.log("Buffer length:", buffer.length);

const key = 'story-cleaner-v7-cache';
const utf8Text = buffer.toString('utf8');
const idx = utf8Text.indexOf(key);

if (idx !== -1) {
  console.log(`Found key "${key}" at index ${idx} in UTF-8 string.`);
  
  // Let's print the hex bytes and character representations of the next 200 bytes
  console.log("\nHex and character dump (100 bytes from index):");
  for (let i = idx; i < Math.min(buffer.length, idx + 150); i++) {
    const byte = buffer[i];
    const hex = byte.toString(16).padStart(2, '0');
    const char = (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
    console.log(`[${i}] ${hex} '${char}'`);
  }
} else {
  console.log("Key not found in UTF-8.");
}
