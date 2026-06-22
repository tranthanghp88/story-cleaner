const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app_cache_clean.json');
if (!fs.existsSync(filePath)) {
  console.log("File not found:", filePath);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

console.log("--- BOOK DETAILS ---");
if (data.books) {
  console.log(`Books count: ${data.books.length}`);
  data.books.forEach((b, i) => {
    console.log(`Book [${i}]: ID=${b.id}, Title="${b.title || b.bookTitle}", Chapters=${b.chapters ? b.chapters.length : 0}`);
  });
} else {
  console.log("No books array in cache.");
}

console.log(`\nActive Book Index: ${data.bookIndex}`);
console.log(`Active Book Title: "${data.bookTitle}"`);
console.log(`Active Author: "${data.author}"`);

console.log("\n--- CHAPTERS IN ACTIVE CACHE ---");
if (data.chapters) {
  console.log(`Chapters count: ${data.chapters.length}`);
  data.chapters.forEach((ch, i) => {
    console.log(`Chapter [${i}]: Title="${ch.title}", Number=${ch.number}, HasCleaned=${!!ch.cleaned}, aiProcessed=${ch.aiProcessed}`);
    if (ch.aiSelectiveStats) {
      console.log("  -> aiSelectiveStats:", ch.aiSelectiveStats);
    }
    if (ch.aiError) {
      console.log(`  -> aiError: "${ch.aiError}"`);
    }
  });
} else {
  console.log("No chapters array in cache.");
}

console.log("\n--- API SETTINGS ---");
console.log(data.apiSettings);
console.log("\n--- PROMPT SETTINGS ---");
console.log(data.promptSettings);
