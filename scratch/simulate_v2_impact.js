import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONVERT_PATTERNS_V2 } from '../src/convertPatterns.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ch0Path = path.join(__dirname, 'chapter_0_raw.txt');
const ch1Path = path.join(__dirname, 'chapter_1_raw.txt');

const ch0Raw = fs.readFileSync(ch0Path, 'utf8');
const ch1Raw = fs.readFileSync(ch1Path, 'utf8');

function simulateReplacements(text, patterns) {
  let processed = text;
  let stats = {};
  
  patterns.forEach(item => {
    const regex = new RegExp(item.pattern, 'gi');
    const matches = processed.match(regex);
    const count = matches ? matches.length : 0;
    
    if (count > 0) {
      stats[item.pattern] = (stats[item.pattern] || 0) + count;
      processed = processed.replace(regex, item.replacement);
    }
  });
  
  return { text: processed, stats };
}

console.log("=== SIMULATING CONVERT PATTERNS V2 IMPACT ===");

const res0 = simulateReplacements(ch0Raw, CONVERT_PATTERNS_V2);
const res1 = simulateReplacements(ch1Raw, CONVERT_PATTERNS_V2);

console.log("\n--- Chapter 0: Mắt mù tân nương ---");
console.log("Original Length:", ch0Raw.length);
console.log("Processed Length:", res0.text.length);
console.log("Modified Patterns count:");
let totalModified0 = 0;
Object.entries(res0.stats).forEach(([pattern, count]) => {
  console.log(`  - "${pattern}": ${count} times`);
  totalModified0 += count;
});
console.log("Total Replacements in Chapter 0:", totalModified0);

console.log("\n--- Chapter 1: Cuối cùng một phần nhân từ ---");
console.log("Original Length:", ch1Raw.length);
console.log("Processed Length:", res1.text.length);
console.log("Modified Patterns count:");
let totalModified1 = 0;
Object.entries(res1.stats).forEach(([pattern, count]) => {
  console.log(`  - "${pattern}": ${count} times`);
  totalModified1 += count;
});
console.log("Total Replacements in Chapter 1:", totalModified1);

console.log("\nTotal Replacements Overall:", totalModified0 + totalModified1);

// Write simulated cleaned texts for manual inspection
fs.writeFileSync(path.join(__dirname, 'chapter_0_sim_cleaned.txt'), res0.text, 'utf8');
fs.writeFileSync(path.join(__dirname, 'chapter_1_sim_cleaned.txt'), res1.text, 'utf8');
console.log("\nSimulated cleaned texts written to chapter_0_sim_cleaned.txt and chapter_1_sim_cleaned.txt");
