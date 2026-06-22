const fs = require('fs');
const path = require('path');

async function main() {
  const url = 'https://truyen.nhanisme.com/vinh-hang-chi-mon/chuong-1/';
  try {
    const response = await fetch(url);
    const html = await response.text();
    console.log("HTML length:", html.length);
    console.log("Contains 'Luân Hồi'?", html.includes('Luân Hồi'));
    console.log("Contains 'mịt mờ'?", html.includes('mịt mờ'));
    
    // Find all occurrences of "Liễu Như Tâm" in the raw HTML
    let idx = -1;
    let occurrences = 0;
    while ((idx = html.indexOf('Liễu Như Tâm', idx + 1)) !== -1) {
      occurrences++;
      console.log(`Occurrence ${occurrences} at index ${idx}:`);
      console.log(html.substring(idx - 100, idx + 200).replace(/\s+/g, ' '));
    }
  } catch(e) {
    console.error("Error:", e.message);
  }
}

main();
