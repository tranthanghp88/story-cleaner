const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'app_cache_clean.json'), 'utf8'));

if (data.apiPool) {
  const activeKeys = data.apiPool.filter(k => k.lastStatus === 'active').map(k => k.key);
  console.log(`Found ${activeKeys.length} active keys:`);
  activeKeys.forEach((key, idx) => {
    console.log(`[${idx}] Length: ${key.length}, Key: ${key}`);
  });
} else {
  console.log("No apiPool found.");
}
