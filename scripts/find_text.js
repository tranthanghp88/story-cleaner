const fs = require('fs');
const path = require('path');

const filePath = 'C:/Users/TRAN PHUONG/.gemini/antigravity/brain/84d2f494-e6eb-4bff-9f84-314e4802fe7c/scratch/restored_main_final.jsx';
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('getChapterRawContent') || line.includes('getChapterSourceContent')) {
      console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
  });
} else {
  console.log('File does not exist');
}
