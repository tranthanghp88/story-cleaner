const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

async function main() {
  const url = 'https://truyen.nhanisme.com/vinh-hang-chi-mon/chuong-1/';
  console.log("Fetching URL:", url);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const html = await response.text();
    console.log("Fetched HTML length:", html.length);
    
    // Parse using JSDOM
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    
    const entryContent = doc.querySelector('.entry-content');
    if (entryContent) {
      console.log("Found .entry-content!");
      let text = entryContent.textContent || '';
      text = normalizeText(text);
      console.log("Extracted text length:", text.length);
      console.log("First 500 chars:\n", text.substring(0, 500));
      console.log("\nLast 500 chars:\n", text.substring(text.length - 500));
      
      const outPath = path.join(__dirname, 'mat_mu_final_text.txt');
      fs.writeFileSync(outPath, text, 'utf8');
      console.log("Wrote text to:", outPath);
    } else {
      console.log(".entry-content not found");
    }
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
}

function normalizeText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n\n');
}

main();
