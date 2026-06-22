const fs = require('fs');
const path = require('path');
const os = require('os');

const leveldbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Story Cleaner', 'Local Storage', 'leveldb');
const filePath = path.join(leveldbPath, '003108.log');

const buffer = fs.readFileSync(filePath);
const key = 'story-cleaner-v7-cache';
const utf8Text = buffer.toString('utf8');
const idx = utf8Text.indexOf(key);

if (idx !== -1) {
  const valueStart = idx + key.length + 4;
  const valueBuffer = buffer.slice(valueStart);
  const valueText = valueBuffer.toString('utf16le');
  
  // Find matching closing bracket
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
    const pos = 26261;
    console.log("Characters around position 26261:");
    console.log("Before: " + JSON.stringify(jsonStr.substring(pos - 50, pos)));
    console.log("At pos: " + JSON.stringify(jsonStr[pos]) + " (char code: " + jsonStr.charCodeAt(pos) + ")");
    console.log("After:  " + JSON.stringify(jsonStr.substring(pos + 1, pos + 50)));
  }
}
