const fs = require('fs');
const path = require('path');

const cache = JSON.parse(fs.readFileSync('scratch/app_cache_clean.json', 'utf8'));

fs.writeFileSync('scratch/chapter_0_raw.txt', cache.chapters[0].raw, 'utf8');
fs.writeFileSync('scratch/chapter_1_raw.txt', cache.chapters[1].raw, 'utf8');

console.log("Extracted chapter 0 (raw length):", cache.chapters[0].raw.length);
console.log("Extracted chapter 1 (raw length):", cache.chapters[1].raw.length);
