const fs = require('fs');
const path = require('path');

const text = fs.readFileSync(path.join(__dirname, 'mat_mu_extracted_clean.txt'), 'utf8');
console.log("Length of text:", text.length);

const term = "đại đường";
const idx = text.toLowerCase().indexOf(term);
console.log(`Index of '${term}':`, idx);

if (idx !== -1) {
  console.log("Snippet around match:");
  console.log(text.substring(idx - 100, idx + 400));
} else {
  console.log("Not found.");
}
