const cheerio = require('cheerio');

async function main() {
  const url = 'https://truyen.nhanisme.com/vinh-hang-chi-mon/chuong-2/';
  console.log("Fetching URL:", url);
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Remove unwanted elements
    $('script, style, noscript, iframe, svg, canvas, form, button, input, select, textarea, nav, footer, header, aside, .ads, .advert, .advertisement, .banner, .comment, .comments, #comments, .share, .social, .related, .notice, .warning, .alert, .ad-container, .ads-wrapper').remove();
    
    const text = $('article').first().text();
    console.log("Cleaned text length:", text.length);
    console.log("Last 1500 chars of Chapter 2:");
    console.log(text.substring(text.length - 1500));
  } catch(e) {
    console.error("Error:", e.message);
  }
}

main();
