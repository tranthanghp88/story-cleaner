import fs from 'fs';
import path from 'path';

const sysDir = 'C:\\Users\\TRAN PHUONG\\.gemini\\antigravity\\brain\\84d2f494-e6eb-4bff-9f84-314e4802fe7c\\.system_generated';

function scan(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    const p = path.join(dir, f);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      scan(p);
    } else {
      console.log(`File: ${p} | Size: ${stat.size}`);
    }
  });
}

console.log('--- SCANNING SYSTEM GENERATED ---');
scan(sysDir);
