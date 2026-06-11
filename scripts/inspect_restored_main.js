import fs from 'fs';

const filePath = 'C:\\Users\\TRAN PHUONG\\.gemini\\antigravity\\brain\\84d2f494-e6eb-4bff-9f84-314e4802fe7c\\scratch\\restored_main_final.jsx';
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Search for humanizeAll
  const idxAll = content.indexOf('const humanizeAll');
  if (idxAll !== -1) {
    console.log('--- humanizeAll IMPLEMENTATION ---');
    console.log(content.slice(idxAll, idxAll + 1200));
  } else {
    console.log('humanizeAll not found.');
  }

  // Search for fetchCurrentUrl
  const idxFetch = content.indexOf('const fetchCurrentUrl');
  if (idxFetch !== -1) {
    console.log('\n--- fetchCurrentUrl IMPLEMENTATION ---');
    console.log(content.slice(idxFetch, idxFetch + 800));
  } else {
    console.log('fetchCurrentUrl not found.');
  }

  // Search for getSelectedChapters
  const idxSel = content.indexOf('const getSelectedChapters');
  if (idxSel !== -1) {
    console.log('\n--- getSelectedChapters IMPLEMENTATION ---');
    console.log(content.slice(idxSel, idxSel + 500));
  } else {
    console.log('getSelectedChapters not found.');
  }
} else {
  console.log('Restored file not found.');
}
