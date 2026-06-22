const fs = require('fs');
const path = require('path');

const text = fs.readFileSync(path.join(__dirname, 'mat_mu_extracted_clean.txt'), 'utf8');
const words = [
  'Triệu Uyên',
  'tộc lão',
  'Đại trưởng lão',
  'Triệu Vân',
  'Liễu Như Tâm',
  'như tâm',
  'Như Nguyệt',
  'Liễu Như Nguyệt'
];

words.forEach(w => {
  const count = (text.match(new RegExp(w, 'gi')) || []).length;
  console.log(`Word "${w}": ${count} occurrences`);
});
