const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

async function main() {
  const url = 'https://truyen.nhanisme.com/vinh-hang-chi-mon/chuong-1/';
  console.log("Fetching URL:", url);
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Find all links containing "/chuong-1/"
    const links = new Set();
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.includes('/chuong-1/')) {
        links.add(href);
      }
    });
    
    console.log("Links with /chuong-1/ found in page:");
    links.forEach(l => console.log(" -", l));
    
    // Also look for class page-links or post-page-numbers or pagination
    console.log("\nChecking pagination elements:");
    console.log("page-links:", $('.page-links').length);
    console.log("post-page-numbers:", $('.post-page-numbers').length);
    console.log("pagination:", $('.pagination').length);
    if ($('.page-links').length > 0) {
      console.log("page-links content:", $('.page-links').html());
    }
  } catch(e) {
    console.error("Error:", e.message);
  }
}

main();
