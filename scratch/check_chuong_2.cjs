const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

async function main() {
  const url = 'https://truyen.nhanisme.com/vinh-hang-chi-mon/chuong-2/';
  console.log("Fetching URL:", url);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Remove unwanted elements
    $('script, style, noscript, iframe, svg, canvas, form, button, input, select, textarea, nav, footer, header, aside, .ads, .advert, .advertisement, .banner, .comment, .comments, #comments, .share, .social, .related, .notice, .warning, .alert, .ad-container, .ads-wrapper').remove();
    
    const text = $('article').first().text();
    console.log("Cleaned text (first 1000 chars):");
    console.log(text.substring(0, 1000));
  } catch(e) {
    console.error("Error:", e.message);
  }
}

main();
