const fs = require('fs');
const path = require('path');

const results = JSON.parse(fs.readFileSync(path.join(__dirname, 'pattern_freq.json'), 'utf8'));

let output = "# Pattern Frequencies Sorted\n\n";
results.forEach((r, idx) => {
  output += `## ${idx+1}. "${r.pattern}" (Count: ${r.count})\n`;
  output += `- **Sample**: "${r.sample}"\n\n`;
});

fs.writeFileSync(path.join(__dirname, 'pattern_freq_formatted.md'), output, 'utf8');
console.log("Formatted frequencies written to pattern_freq_formatted.md");
