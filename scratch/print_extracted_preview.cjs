const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'mat_mu_extracted_clean.txt');
if (!fs.existsSync(filePath)) {
  console.log("File not found:", filePath);
  process.exit(1);
}

const text = fs.readFileSync(filePath, 'utf8');
console.log("Total text length:", text.length);

console.log("\n--- START PREVIEW (first 1000 chars) ---");
console.log(text.substring(0, 1000));

console.log("\n--- END PREVIEW (last 1000 chars) ---");
console.log(text.substring(text.length - 1000));

// Find the index of "Triệu Gia đại đường."
const startIndex = text.indexOf("Triệu Gia đại đường.");
console.log("\nIndex of 'Triệu Gia đại đường.':", startIndex);

// Find the index of "Lại mở mắt ra, đã là một mảnh hơi nước trắng mịt mờ thế giới."
const endSearch = "Lại mở mắt ra, đã là một mảnh hơi nước trắng mịt mờ thế giới.";
const endIndex = text.indexOf(endSearch);
console.log("Index of end text:", endIndex);
if (endIndex !== -1) {
  console.log("Length from start to end of chapter text:", (endIndex + endSearch.length) - startIndex);
}
