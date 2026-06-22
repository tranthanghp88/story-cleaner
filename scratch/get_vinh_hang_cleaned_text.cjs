const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

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

function getPreservedText($, element) {
  if (!element) return '';
  const clone = $(element).clone();
  clone.find('br, p, div, li, tr, h1, h2, h3, h4, h5, h6').before('\n').after('\n');
  return clone.text();
}

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
    
    const $ = cheerio.load(html);
    
    // Remove unwanted elements
    $('script, style, noscript, iframe, svg, canvas, form, button, input, select, textarea, nav, footer, header, aside, .ads, .advert, .advertisement, .banner, .comment, .comments, #comments, .share, .social, .related, .notice, .warning, .alert, .ad-container, .ads-wrapper').remove();
    
    const selectors = [
      '#chapter-content', '.chapter-content', '.chapter-c', '.chapter-cnt', '.chapter-text', '.chapter-body', '.chapter-detail',
      '#content_chap', '#content-chap', '#content', '.content', '.entry-content', '.post-content', '.reading-content',
      'article', 'main'
    ];

    let best = '';
    let bestSelector = '';
    for (const selector of selectors) {
      $(selector).each((_, el) => {
        const text = normalizeText(getPreservedText($, el));
        if (text.length > best.length) {
          best = text;
          bestSelector = selector;
        }
      });
    }

    console.log("Best selector found:", bestSelector);
    console.log("Extracted text length:", best.length);
    
    const outPath = path.join(__dirname, 'mat_mu_extracted_clean.txt');
    fs.writeFileSync(outPath, best, 'utf8');
    console.log("Wrote cleaned text to:", outPath);
  } catch(e) {
    console.error("Error:", e.message);
  }
}

main();
