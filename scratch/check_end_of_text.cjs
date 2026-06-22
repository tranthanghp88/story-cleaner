const fs = require('fs');
const path = require('path');

const text = fs.readFileSync(path.join(__dirname, 'mat_mu_extracted_clean.txt'), 'utf8');
console.log("Total length:", text.length);

console.log("\nLast 2000 characters:");
console.log(text.substring(text.length - 2000));

console.log("\nDoes it contain 'Luân Hồi'?", text.includes('Luân Hồi'));
console.log("Does it contain 'mịt mờ'?", text.includes('mịt mờ'));
console.log("Does it contain 'trắng mịt mờ'?", text.includes('trắng mịt mờ'));
