import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import JSZip from 'jszip';
import {  BookOpen, FileText, Wand2, Download, Trash2, ArrowUp, ArrowDown,
  Languages, ShieldCheck, Copy, Plus, Link as LinkIcon, Sparkles,
  AlignLeft, RefreshCcw, CheckCircle2, AlertTriangle, Upload, Save, EyeOff, Database, Search, ToggleLeft, ToggleRight, Clock, Sliders
} from 'lucide-react';
import './styles.css';

const DEFAULT_FILTERS = {
  preserveTerms: `Lâm thiếu\nLâm Thiếu\ntiểu tử\nthánh nữ\nthánh tử\nma tôn\nthần thức\nlinh khí\ntu vi\nkim đan\nnguyên anh\ntông môn\npháp bảo\nthiếu chủ\nđại trưởng lão`,
  replaceRules: `nữ nhân => cô gái\nnam nhân => người đàn ông\nkhóe miệng co quắp => khóe môi giật nhẹ\nthần sắc âm trầm => sắc mặt âm trầm\ncười lạnh một tiếng => cười lạnh\ntrong lòng âm thầm => thầm nghĩ\nnhìn qua => nhìn sang`,
  watermarks: `truyện được đăng tại\nđọc truyện tại\nnguồn:\nteam dịch\nnhóm dịch\nvui lòng không reup\nkhông copy\nủng hộ team\nwebsite đang đọc truyện\ntruyện chỉ được đăng tại`,
  restoreRules: `t*nh => tình\nch*t => chết\ngi*t => giết\nm*u => máu\nđ*m => đâm\ns*t => sát\nh*n => hôn\nth*n thể => thân thể`,
  preservePronouns: `bổn tọa\nbản tọa\nlão phu\nbần đạo\nta\nngươi\nnàng\nhắn\ny\ncô nương\ntiền bối\nvãn bối\nhuynh\nmuội\nsư phụ\nsư tôn\nđồ nhi\nđệ tử`,
  convertPolishRules: `trong lòng cả kinh => kinh ngạc\nkhông khỏi hít sâu một hơi => khẽ hít một hơi thật sâu\ntrên mặt hiện lên vẻ => lộ vẻ\ntrong mắt hiện lên một tia => ánh mắt thoáng hiện\nđối với nàng nói => nói với nàng\nđối với hắn nói => nói với hắn\nđối với ta nói => nói với ta\nhướng về phía trước đi => đi về phía trước`
};

const DEFAULT_NOVEL_MEMORY = `# Ghi nhớ riêng cho bộ truyện này (Mỗi dòng một ghi chú)

[THỂ LOẠI & BỐI CẢNH] - BẮT BUỘC
Thể loại: Tiên hiệp / Cổ trang (Hoặc đổi thành: Đô thị / Hiện đại)

[BẢN ĐỒ NHÂN VẬT & XƯNG HÔ] - TÙY CHỌN (Không bắt buộc)
# Bạn có thể điền thông tin nhân vật chính để AI dịch nhất quán:
# - Lâm Phong: nam, thanh niên (22 tuổi). Narration: hắn. Thoại: ta/ngươi.`;

const PRONOUN_PRESETS = {
  preserve: `Ưu tiên giữ xưng hô convert/cổ trang như ta, ngươi, bổn tọa, bản tọa, lão phu nếu chúng hợp ngữ cảnh. Không ép chuyển sang tôi/anh/chị/bố/mẹ.`,
  balanced: `Xưng hô phải theo ngữ cảnh. Giữ ta/ngươi/bổn tọa khi đang là vibe tiên hiệp/cổ trang/quyền uy. Với quan hệ gia đình hoặc đời thường rõ ràng, có thể chuyển mềm sang bố/mẹ/cha/mẫu thân/anh/chị/em/con cho tự nhiên, nhưng không thay cứng toàn cục.`,
  modern: `Ưu tiên xưng hô tự nhiên với người Việt khi ngữ cảnh cho phép: bố/mẹ/anh/chị/em/con/tôi/cậu. Vẫn giữ các danh xưng đặc trưng như bổn tọa, đạo hữu, thiếu chủ, tông môn nếu là điểm tạo chất truyện.`
};

const HUMANIZE_PRESETS = {
  cleanup: `Chỉ dọn lỗi rõ ràng: dấu câu, xuống dòng, câu quá lủng củng, đoạn quá dài. Không rewrite nếu câu đã đọc được.`,
  naturalAudio: `Việt hóa câu convert/dịch máy thành tiếng Việt tự nhiên để nghe bằng TTS. Sửa câu lộn xộn, thiếu chủ vị, sai trật tự từ và hội thoại cứng. Không văn chương hóa, không thêm tình tiết.`,
  light: `Sửa nhẹ câu quá cứng, lỗi bố cục, dấu câu và đoạn quá dài. Giữ khá sát văn gốc.`,
  balanced: `Biên tập vừa phải: câu văn phải giống tiếng Việt hơn, đọc/nghe tự nhiên hơn, nhưng không rewrite quá đà.`,
  strong: `Biên tập mạnh hơn để dễ đọc/nghe, nhưng vẫn tuyệt đối không thêm tình tiết hoặc fanfic hóa.`
};

function parseRules(text) {
  return text.split('\n').map(x => x.trim()).filter(Boolean).map(line => {
    const [from, ...rest] = line.split('=>');
    return { from: (from || '').trim(), to: rest.join('=>').trim() };
  }).filter(r => r.from && r.to);
}
function escapeRegExp(s='') { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function escapeHtml(text='') { return text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
function slugify(text='') { return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'ebook'; }
function splitTerms(s='') { return s.split('\n').map(x=>x.trim()).filter(Boolean).sort((a,b)=>b.length-a.length); }

function protectTerms(text, termsText) {
  const terms = splitTerms(termsText);
  const map = [];
  let out = text;
  terms.forEach((term, i) => {
    const token = `__PRESERVE_${i}_${Date.now()}__`;
    const re = new RegExp(escapeRegExp(term), 'gi');
    out = out.replace(re, m => { map.push([token, m]); return token; });
  });
  return { text: out, restore: (s) => map.reduce((acc,[token, original]) => acc.replaceAll(token, original), s) };
}

function normalizePunctuation(text='') {
  return text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+([,.!?;:…])/g, '$1')
    .replace(/([,.!?;:…])(?=[^\s\n"'])/g, '$1 ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n');
}

function localReflow(text='') {
  let t = text.trim();
  if (!t) return '';

  t = normalizePunctuation(t)
    .replace(/([.!?…])\s*(?=(?:"|“)?[A-ZÀ-ỸĐ])/g, '$1\n')
    .replace(/([.!?…])\s*(?=(?:Hắn|Nàng|Y|Gã|Lão|Lâm|Diệp|Tần|Tiêu|Sở|Trần|Vương|Đường|Người|Đám|Bọn|Trong|Sau|Lúc|Khi|Nhưng|Thế|Đột nhiên|Bỗng|Chỉ thấy)\b)/g, '$1\n')
    .replace(/([.!?…])\s*(?=(?:\"[^\"]+\"|“[^”]+”))/g, '$1\n')
    .replace(/([.!?…])\s*(?=(?:-\s*)?[^\n]{1,120}(?:nói|hỏi|quát|cười|thở dài|lẩm bẩm|gằn giọng)\b)/gi, '$1\n');

  const rawLines = t.split('\n').map(x=>x.trim()).filter(Boolean);
  const paragraphs = [];
  let bucket = [];
  let sentenceCount = 0;

  const flush = () => {
    if (bucket.length) paragraphs.push(bucket.join(' ').trim());
    bucket = [];
    sentenceCount = 0;
  };

  for (const line of rawLines) {
    const isDialogue = /^(["“].+["”]|[-–—]\s*.+)/.test(line) || /["“].+["”]/.test(line);
    const isChapterTitle = /^chương\s+\d+|^chapter\s+\d+/i.test(line);
    if (isChapterTitle) { flush(); paragraphs.push(line); continue; }
    if (isDialogue) { flush(); paragraphs.push(line); continue; }

    const sentences = line.match(/[^.!?…]+[.!?…]+["”']?|[^.!?…]+$/g) || [line];
    for (const s of sentences.map(x=>x.trim()).filter(Boolean)) {
      bucket.push(s);
      if (/[.!?…]["”']?$/.test(s)) sentenceCount++;
      const charLen = bucket.join(' ').length;
      if (sentenceCount >= 4 || charLen > 520) flush();
    }
  }
  flush();
  return paragraphs.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

function cleanStoryText(input, options, filters) {
  let text = input || '';
  text = text.replace(/\r\n/g, '\n').replace(/\t/g, ' ').replace(/\u00a0/g, ' ');
  const protector = protectTerms(text, filters.preserveTerms || '');
  text = protector.text;

  if (options.removeWatermark) {
    const marks = splitTerms(filters.watermarks || '');
    marks.forEach(mark => {
      const re = new RegExp(`^.*${escapeRegExp(mark)}.*$`, 'gim');
      text = text.replace(re, '');
    });
  }

  if (options.restoreFilteredWords) {
    parseRules(filters.restoreRules).forEach(r => {
      const pattern = escapeRegExp(r.from).replace(/\\\*/g, '[\\*\\.·…_ -]*');
      text = text.replace(new RegExp(pattern, 'gi'), r.to);
    });
  }

  if (options.autoReplace) {
    parseRules(filters.replaceRules).forEach(r => {
      text = text.replace(new RegExp(escapeRegExp(r.from), 'gi'), r.to);
    });
  }

  // Terminology Consistency
  text = text.replace(/Ba hồn bảy vía/g, 'Tam hồn thất phách');
  text = text.replace(/ba hồn bảy vía/gi, 'tam hồn thất phách');
  text = text.replace(/Ba hồn thất phách/g, 'Tam hồn thất phách');
  text = text.replace(/ba hồn thất phách/gi, 'tam hồn thất phách');
  text = text.replace(/Bảy vía/g, 'Thất phách');
  text = text.replace(/bảy vía/gi, 'thất phách');

  // Convert Cleanup
  text = text.replace(/Mặt đầy hồ nghi/g, 'Mặt đầy hoài nghi');
  text = text.replace(/mặt đầy hồ nghi/gi, 'mặt đầy hoài nghi');
  text = text.replace(/Lại lục soát hội/g, 'Lại lục soát');
  text = text.replace(/lại lục soát hội/gi, 'lại lục soát');
  text = text.replace(/Cổ khí tràng/g, 'Khí tràng');
  text = text.replace(/cổ khí tràng/gi, 'khí tràng');
  text = text.replace(/Cổ uy áp/g, 'Luồng uy áp');
  text = text.replace(/cổ uy áp/gi, 'luồng uy áp');
  text = text.replace(/Cổ trở lực/g, 'Sức cản');
  text = text.replace(/cổ trở lực/gi, 'sức cản');
  text = text.replace(/Người bị hại/g, 'Nạn nhân');
  text = text.replace(/người bị hại/gi, 'nạn nhân');

  if (options.normalizeSpaces) {
    text = normalizePunctuation(text);
    text = text.split('\n').map(line => line.trim()).join('\n').replace(/\n{3,}/g, '\n\n');
  }

  if (options.mergeBrokenLines) {
    const lines = text.split('\n');
    const result = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) { if (result[result.length-1] !== '') result.push(''); continue; }
      const prev = result[result.length - 1] || '';
      const isTitle = /^chương\s+\d+|^chapter\s+\d+/i.test(trimmed);
      const shouldMerge = prev && !isTitle && !/[.!?…:;"')\]]$/.test(prev) && trimmed.length < 180;
      if (shouldMerge) result[result.length - 1] = prev + ' ' + trimmed;
      else result.push(trimmed);
    }
    text = result.join('\n');
  }
  if (options.reflowLayout) {
    text = localReflow(text);
  }
  return protector.restore(text).trim();
}

function buildStyleGuide(filters, promptSettings={}) {
  const preserve = splitTerms(filters.preserveTerms).join(', ');
  const strength = HUMANIZE_PRESETS[promptSettings.humanizeStrength] || HUMANIZE_PRESETS.naturalAudio;
  const pronoun = PRONOUN_PRESETS[promptSettings.pronounStyle] || PRONOUN_PRESETS.balanced;
  const memory = (promptSettings.novelMemory || '').trim();
  const extra = (promptSettings.additionalInstructions || '').trim();
  return `VAI TRÒ:
Bạn là biên tập viên tiếng Việt cho truyện convert/dịch thô. Mục tiêu là làm văn bản DỄ NGHE bằng TTS và dễ đọc với người Việt, không phải viết lại thành văn chương AI.

NGUYÊN TẮC BẮT BUỘC:
- Giữ nguyên nội dung, thứ tự tình tiết, thông tin nhân vật và ý nghĩa câu gốc.
- Không thêm tình tiết, không thêm miêu tả mới, không fanfic hóa.
- Không tự ý đổi tên riêng, cảnh giới, công pháp, địa danh, môn phái.
- Câu văn phải giống tiếng Việt tự nhiên hơn: sửa trật tự từ convert, câu thiếu chủ vị, hội thoại gượng, cụm từ dịch máy.
- Không được làm văn hoa/AI hóa. Tránh thêm các từ như: khẽ, chậm rãi, tà mị, âm trầm, nhàn nhạt, lạnh lẽo... nếu bản gốc không thật sự có ý đó.
- Ưu tiên câu ngắn, rõ nghĩa, nghe không chối khi đọc bằng giọng máy.
- Giữ thuật ngữ/từ đặc trưng nếu chúng là chất truyện: ${preserve || 'không có'}.
- Nếu văn bản dính một cục, chia đoạn hợp lý. Lời thoại tách riêng. Không tách vụn từng câu.
- Chỉ trả về văn bản đã xử lý, không giải thích.

MỨC BIÊN TẬP:
${strength}

XƯNG HÔ:
${pronoun}

GHI NHỚ RIÊNG BỘ TRUYỆN:
${memory || 'Không có.'}

GHI CHÚ THÊM CỦA NGƯỜI DÙNG:
${extra || 'Không có.'}`;
}

function buildAiPrompt(mode, text, filters, promptSettings={}) {
  const styleGuide = buildStyleGuide(filters, promptSettings);
  const task = mode === 'structure'
    ? 'Sửa bố cục, chia đoạn, tách thoại, đồng thời sửa các câu convert lộn xộn để nghe tự nhiên hơn.'
    : mode === 'proofread'
      ? 'Rà chính tả, dấu câu, bố cục và sửa các câu lủng củng rõ ràng. Không rewrite nếu không cần.'
      : 'Việt hóa truyện convert/dịch thô sang tiếng Việt tự nhiên để nghe, giữ nội dung và không văn chương hóa.';
  return `${styleGuide}\n\nNHIỆM VỤ CỤ THỂ:\n${task}\n\nVĂN BẢN CẦN XỬ LÝ:\n${text}`;
}

function makeChapterXhtml(chapter, index) {
  const title = escapeHtml(chapter.title || `Chương ${index + 1}`);
  const body = escapeHtml(chapter.cleaned || chapter.raw || '').split(/\n{1,}/).map(p=>p.trim()).filter(Boolean).map(p=>`<p>${p}</p>`).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" lang="vi"><head><title>${title}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body><h1>${title}</h1>${body}</body></html>`;
}
async function buildEpub({ title, author, chapters }) {
  const zip = new JSZip();
  zip.file('mimetype','application/epub+zip',{compression:'STORE'});
  zip.folder('META-INF').file('container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  const oebps = zip.folder('OEBPS');
  oebps.file('style.css','body{font-family:serif;line-height:1.8;margin:5%;}h1{text-align:center;margin-bottom:2rem;}p{text-indent:1.5em;margin:0 0 .85em;}');
  chapters.forEach((ch,i)=>oebps.file(`chapter-${i+1}.xhtml`, makeChapterXhtml(ch,i)));
  const manifest = chapters.map((_,i)=>`<item id="ch${i+1}" href="chapter-${i+1}.xhtml" media-type="application/xhtml+xml"/>`).join('\n');
  const spine = chapters.map((_,i)=>`<itemref idref="ch${i+1}"/>`).join('\n');
  oebps.file('content.opf',`<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">${Date.now()}</dc:identifier><dc:title>${escapeHtml(title||'Truyện đã dọn')}</dc:title><dc:creator>${escapeHtml(author||'Unknown')}</dc:creator><dc:language>vi</dc:language></metadata><manifest><item id="style" href="style.css" media-type="text/css"/>${manifest}</manifest><spine>${spine}</spine></package>`);
  return zip.generateAsync({ type:'blob', mimeType:'application/epub+zip' });
}

async function buildDocx({ title, author, chapters, isSiri = false }) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak } = await import('docx');
  const children = [];
  children.push(new Paragraph({
    text: title || 'Truyện đã dọn',
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { after: 360 }
  }));
  if (author) {
    children.push(new Paragraph({
      text: author,
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 }
    }));
  }

  chapters.forEach((chapter, index) => {
    if (index > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(new Paragraph({
      text: chapter.title || `Chương ${index + 1}`,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 240 }
    }));
    const body = (chapter.cleaned || chapter.raw || '').trim();
    body.split(/\n{2,}|\n/).map(p => p.trim()).filter(Boolean).forEach(p => {
      children.push(new Paragraph({
        children: [new TextRun({ text: p, size: 28 })],
        spacing: isSiri ? { before: 0, after: 0, line: 360 } : { before: 120, after: 180, line: 420 },
        indent: isSiri ? { firstLine: 0 } : { firstLine: 420 }
      }));
    });
  });

  const doc = new Document({
    creator: 'Story Cleaner',
    title: title || 'Truyện đã dọn',
    description: 'DOCX tối ưu để upload Drive và nghe bằng Edge/Safari/Google Docs.',
    sections: [{
      properties: {
        page: { margin: { top: 1000, right: 900, bottom: 1000, left: 900 } }
      },
      children
    }]
  });
  return Packer.toBlob(doc);
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }


function maskKey(key='') {
  if (!key) return '';
  if (key.length <= 12) return key.slice(0, 4) + '••••';
  return key.slice(0, 7) + '••••••••' + key.slice(-4);
}
function shortHash(str='') {
  let h = 0;
  for (let i=0;i<str.length;i++) h = ((h<<5)-h) + str.charCodeAt(i) | 0;
  return String(Math.abs(h)%1000).padStart(3,'0');
}
function parseImportedKeyLines(text='', startIndex=0) {
  return text.split(/\r?\n|,/).map(x=>x.trim()).filter(Boolean).map((line, i)=>{
    let label='', key=line;
    if (line.includes('=')) {
      const parts=line.split('=');
      label=parts.shift().trim();
      key=parts.join('=').trim();
    }
    if (!label) label = `GEMINI_${String(startIndex+i+1).padStart(3,'0')}`;
    return { id:`${Date.now()}_${i}_${shortHash(key)}`, label, key, enabled:true, lastStatus:'unknown', totalSuccess:0, totalFail:0, totalChars:0, lastUsedAt:null, lastError:'' };
  }).filter(k=>k.key);
}
function uniqueKeyPool(pool) {
  const seen = new Set();
  const out = [];
  for (const item of pool) {
    if (!item?.key || seen.has(item.key)) continue;
    seen.add(item.key);
    out.push(item);
  }
  return out;
}
function activeKeysFromPool(pool=[]) { return pool.filter(k=>k.enabled && k.key).map(k=>k.key); }
function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href);
}
async function importEpubFile(file) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files).filter(f=>!f.dir && /\.(xhtml|html)$/i.test(f.name));
  const contentFiles = entries.filter(f=>!/nav|toc|cover/i.test(f.name));
  const files = (contentFiles.length ? contentFiles : entries).sort((a,b)=>a.name.localeCompare(b.name, undefined, {numeric:true}));
  const chapters = [];
  for (let i=0;i<files.length;i++) {
    const html = await files[i].async('string');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const title = (doc.querySelector('h1,h2,title')?.textContent || `Chương ${i+1}`).trim();
    doc.querySelectorAll('script,style,nav').forEach(n=>n.remove());
    const paragraphs = [...doc.body.querySelectorAll('p,div')].map(n=>n.textContent.trim()).filter(t=>t && t.length>1);
    const text = paragraphs.length ? paragraphs.join('\n\n') : (doc.body?.textContent || '').replace(/\n{3,}/g,'\n\n').trim();
    if (text) chapters.push({title, url:'', raw:text, cleaned:text});
  }
  return chapters;
}
const CACHE_KEY = 'story-cleaner-v7-cache';

function parseApiKeys(text='') {
  return text.split(/\r?\n|,/).map(x => x.trim()).filter(Boolean);
}

function splitTextIntoChunks(text='', maxChars=6000) {
  const clean = text.trim();
  if (!clean) return [];
  const paragraphs = clean.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const chunks = [];
  let buf = '';
  const push = () => { if (buf.trim()) chunks.push(buf.trim()); buf = ''; };

  for (const p of paragraphs) {
    if (p.length > maxChars) {
      push();
      const sentences = p.match(/[^.!?…]+[.!?…]+["”']?|[^.!?…]+$/g) || [p];
      let sbuf = '';
      for (const s of sentences.map(x=>x.trim()).filter(Boolean)) {
        if ((sbuf + ' ' + s).trim().length > maxChars) {
          if (sbuf.trim()) chunks.push(sbuf.trim());
          if (s.length > maxChars) {
            for (let i=0; i<s.length; i+=maxChars) chunks.push(s.slice(i, i+maxChars).trim());
            sbuf = '';
          } else sbuf = s;
        } else sbuf = (sbuf ? sbuf + ' ' : '') + s;
      }
      if (sbuf.trim()) chunks.push(sbuf.trim());
      continue;
    }
    if ((buf + '\n\n' + p).trim().length > maxChars) push();
    buf = (buf ? buf + '\n\n' : '') + p;
  }
  push();
  return chunks;
}

function buildChunkPrompt(mode, chunk, filters, index, total, previousTail='', promptSettings={}) {
  const styleGuide = buildStyleGuide(filters, promptSettings);
  const modeLine = mode === 'structure'
    ? 'Sửa bố cục, chia đoạn, tách thoại, đồng thời sửa các câu convert lộn xộn để nghe tự nhiên hơn.'
    : mode === 'proofread'
      ? 'Chỉ sửa chính tả, dấu câu, bố cục và câu lủng củng rõ ràng. Không rewrite nếu không cần.'
      : 'Việt hóa truyện convert/dịch thô thành tiếng Việt tự nhiên để nghe. Sửa câu lộn xộn, nhưng không viết lại quá đà.';
  return `${styleGuide}\n\nĐây là chunk ${index}/${total} của cùng một chương truyện.\n\nNHIỆM VỤ CỤ THỂ:\n${modeLine}\n${previousTail ? `\nNGỮ CẢNH CUỐI CHUNK TRƯỚC, chỉ để giữ mạch văn, KHÔNG lặp lại trong kết quả:\n${previousTail}\n` : ''}\nVĂN BẢN CẦN XỬ LÝ:\n${chunk}`;
}

function isRateLimitError(res) {
  const msg = `${res?.error || ''} ${res?.status || ''}`.toLowerCase();
  return msg.includes('429') || msg.includes('quota') || msg.includes('rate') || msg.includes('resource_exhausted') || msg.includes('too many');
}

function isZeroQuotaError(res) {
  const msg = `${res?.error || ''}`.toLowerCase();
  return msg.includes('limit: 0') || msg.includes('free_tier') || msg.includes('current quota');
}

function friendlyGeminiError(res, model) {
  const raw = res?.error || 'Gemini API lỗi không rõ.';
  if (isZeroQuotaError(res)) {
    return `Model ${model} đang có free quota = 0 với key/project này. Hãy bấm “Lấy model từ key” để xem model nào key này thật sự hỗ trợ, ưu tiên gemini-2.5-flash-lite hoặc gemini-2.5-flash nếu có. Chi tiết gốc: ${raw}`;
  }
  return raw;
}

const DEFAULT_MODEL_OPTIONS = [
  { name: 'gemini-2.5-flash-lite', displayName: 'gemini-2.5-flash-lite — ưu tiên key free nếu có' },
  { name: 'gemini-2.5-flash', displayName: 'gemini-2.5-flash — mạnh hơn' },
  { name: 'gemini-2.0-flash', displayName: 'gemini-2.0-flash — có thể quota 0' }
];

function createEmptyBook(index=1) {
  return {
    id: `book_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
    title: index === 1 ? 'Truyện đã dọn' : `Truyện ${index}`,
    author: '',
    chapters: [{title:'Chương 1',url:'',raw:'',cleaned:''}],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function classifyAiError(errOrString) {
  const msg = String(errOrString?.message || errOrString || '').trim();
  let type = 'Lỗi không xác định';
  
  const lowerMsg = msg.toLowerCase();
  if (lowerMsg.includes('chưa tải nội dung') || lowerMsg.includes('chương chưa tải')) {
    type = 'Chưa tải nội dung';
  } else if (lowerMsg.includes('nội dung rỗng') || lowerMsg.includes('chương này chưa có nội dung') || lowerMsg.includes('không có nội dung') || lowerMsg.includes('empty') || lowerMsg.includes('rỗng') || !msg) {
    type = 'Nội dung rỗng';
  } else if (lowerMsg.includes('401') || lowerMsg.includes('403') || lowerMsg.includes('auth') || lowerMsg.includes('api key') || lowerMsg.includes('invalid api key') || lowerMsg.includes('unauthorized') || lowerMsg.includes('key auth')) {
    type = 'Lỗi API/key';
  } else if (lowerMsg.includes('429') || lowerMsg.includes('quota') || lowerMsg.includes('rate limit') || lowerMsg.includes('resource_exhausted') || lowerMsg.includes('too many requests')) {
    type = 'Lỗi mạng/quota';
  } else if (lowerMsg.includes('500') || lowerMsg.includes('503') || lowerMsg.includes('server') || lowerMsg.includes('service unavailable') || lowerMsg.includes('internal error')) {
    type = 'Lỗi API/key';
  } else if (lowerMsg.includes('timeout') || lowerMsg.includes('fetch failed') || lowerMsg.includes('network') || lowerMsg.includes('aborted') || lowerMsg.includes('failed to fetch') || lowerMsg.includes('econnrefused')) {
    type = 'Lỗi mạng/quota';
  }
  
  return { type, message: msg || 'Lỗi không xác định' };
}

function getChapterSourceContent(ch) {
  if (!ch) return '';
  return String(ch.cleaned || ch.aiText || ch.naturalText || ch.cleanText || ch.raw || ch.rawText || ch.content || ch.text || '').trim();
}

function getChapterRawContent(ch) {
  if (!ch) return '';
  return String(ch.raw || ch.rawText || ch.content || ch.text || ch.cleaned || ch.aiText || ch.naturalText || ch.cleanText || '').trim();
}

function getChapterRawLength(ch) {
  return getChapterRawContent(ch).length;
}

function App() {
  const [books,setBooks]=useState(()=>[createEmptyBook(1)]);
  const [bookIndex,setBookIndex]=useState(0);
  const [keyPage, setKeyPage] = useState(1);
  const [keysPerPage, setKeysPerPage] = useState(10);
  const [collapsedBooks,setCollapsedBooks]=useState({});
  const rawTextRef=useRef(null);
  const cleanTextRef=useRef(null);
  const scrollSyncLock=useRef(false);
  const [importKeyText,setImportKeyText]=useState('');  const [apiPool,setApiPool]=useState([]);
  const projectInputRef=useRef(null);
  const cancelRef = useRef(false);
  const [cancelRequested, setCancelRequested] = useState(false);

  // States for DOCX dropdown and batch export modal
  const [showDocxDropdown, setShowDocxDropdown] = useState(false);
  const [showBatchExportModal, setShowBatchExportModal] = useState(false);
  const [exportStartCh, setExportStartCh] = useState(1);
  const [exportEndCh, setExportEndCh] = useState(10);
  const [exportFilename, setExportFilename] = useState('Tập 01');
  const [exportIsSiri, setExportIsSiri] = useState(false);

  // States for split buttons
  const [batchAiSelection, setBatchAiSelection] = useState('3');
  const [batchAiValue, setBatchAiValue] = useState(3);
  const [batchFetchSelection, setBatchFetchSelection] = useState('all');
  const [batchFetchValue, setBatchFetchValue] = useState('all');
  const [showFetchDropdown, setShowFetchDropdown] = useState(false);
  const [isEnteringFetchCustom, setIsEnteringFetchCustom] = useState(false);
  const [tempFetchCustomValue, setTempFetchCustomValue] = useState(10);
  const [showBatchAiDropdown, setShowBatchAiDropdown] = useState(false);
  const [isEnteringAiCustom, setIsEnteringAiCustom] = useState(false);
  const [tempAiCustomValue, setTempAiCustomValue] = useState(5);
  const [showOptionsPopup, setShowOptionsPopup] = useState(false);

  const updateDefaultFilename = (start, end) => {
    const s = parseInt(start) || 1;
    const e = parseInt(end) || 10;
    const diff = Math.max(1, e - s + 1);
    const tapNum = Math.max(1, Math.ceil(s / diff));
    const padNum = String(tapNum).padStart(2, '0');
    setExportFilename(`Tập ${padNum}`);
  };
  const handleStop = () => {
    cancelRef.current = true;
    setCancelRequested(true);
    setStatus({type: 'warn', message: 'Đang yêu cầu dừng quá trình...'});
  };
  const [selected,setSelected]=useState(0);
  const [tab,setTab]=useState('editor');
  const [aiMode,setAiMode]=useState('humanize');
  const [aiPrompt,setAiPrompt]=useState('');
  const [promptSettings,setPromptSettings]=useState({pronounStyle:'balanced',humanizeStrength:'naturalAudio',novelMemory:DEFAULT_NOVEL_MEMORY,additionalInstructions:''});
  const [keySearch,setKeySearch]=useState('');
  const [keyStatusFilter,setKeyStatusFilter]=useState('all');
  const [lastAutoSaved,setLastAutoSaved]=useState('');
  const [filters,setFilters]=useState(DEFAULT_FILTERS);
  const [status,setStatus]=useState({type:'',message:''});
  const [fetching,setFetching]=useState(false);
  const [aiRunning,setAiRunning]=useState(false);
  const [aiProgress,setAiProgress]=useState({done:0,total:0,message:''});
  const [keyCooldowns,setKeyCooldowns]=useState({});
  const [modelOptions,setModelOptions]=useState(DEFAULT_MODEL_OPTIONS);
  const [showAiReport, setShowAiReport] = useState(false);
  const [apiSettings,setApiSettings]=useState({
    model:'gemini-2.5-flash-lite',
    chunkSize:12000,
    delayMs:6500,
    cooldownMs:120000,
    maxRetries:2
  });
  const [options,setOptions]=useState({normalizeSpaces:true,mergeBrokenLines:true,reflowLayout:true,removeWatermark:true,restoreFilteredWords:true,autoReplace:true,siriReadingMode:true,mergeSingleLines:true,reduceDocxBreaks:true,safeRegexPolish:true});
  const currentBook = books[bookIndex] || books[0] || createEmptyBook(1);
  const bookTitle = currentBook.title || 'Truyện đã dọn';
  const author = currentBook.author || '';
  const chapters = currentBook.chapters?.length ? currentBook.chapters : [{title:'Chương 1',url:'',raw:'',cleaned:''}];
  const updateBook = (patchOrFn)=>setBooks(prev=>prev.map((book,idx)=>{
    if(idx!==bookIndex) return book;
    const patch = typeof patchOrFn === 'function' ? patchOrFn(book) : patchOrFn;
    return {...book, ...patch, updatedAt:new Date().toISOString()};
  }));
  const setBookTitle = (title)=>updateBook({title});
  const setAuthor = (author)=>updateBook({author});
  const setChapters = (next)=>updateBook(book=>({chapters: typeof next === 'function' ? next(book.chapters || []) : next}));  const addBook = ()=>{
    const book = createEmptyBook(books.length+1);
    setBooks(prev=>[...prev, book]);
    setBookIndex(books.length);
    setSelected(0);
    setTab('editor');
    setCollapsedBooks(()=>{
      const nextCollapsed = {};
      books.forEach((_, i) => { nextCollapsed[i] = true; });
      nextCollapsed[books.length] = false;
      return nextCollapsed;
    });
  };
  const selectBook = (idx)=>{
    setBookIndex(idx);
    setSelected(0);
    setCollapsedBooks(()=>{
      const nextCollapsed = {};
      books.forEach((_, i) => { nextCollapsed[i] = true; });
      nextCollapsed[idx] = false;
      return nextCollapsed;
    });
  };
  const toggleBookCollapsed = (idx)=>{
    setCollapsedBooks(prev=>{
      const isCurrentlyOpen = !prev[idx];
      const nextCollapsed = {};
      books.forEach((_, i) => { nextCollapsed[i] = true; });
      if (!isCurrentlyOpen) {
        nextCollapsed[idx] = false;
      }
      return nextCollapsed;
    });
  };
  const deleteBook = (idx)=>{
    if(!confirm('Xóa truyện này và toàn bộ chương bên trong?')) return;
    setBooks(prev=>{
      const next = prev.filter((_,i)=>i!==idx);
      if(!next.length) return [createEmptyBook(1)];
      return next;
    });
    setBookIndex(prev=>{
      if(books.length<=1) return 0;
      if(idx<prev) return Math.max(0,prev-1);
      if(idx===prev) return Math.max(0,Math.min(prev,books.length-2));
      return prev;
    });
    setSelected(0);
  };
  const handleCompareScroll=(source)=>{
    const raw=rawTextRef.current;
    const clean=cleanTextRef.current;
    if(!raw || !clean || scrollSyncLock.current) return;
    const from = source==='raw' ? raw : clean;
    const to = source==='raw' ? clean : raw;
    const maxFrom = Math.max(1, from.scrollHeight - from.clientHeight);
    const ratio = from.scrollTop / maxFrom;
    const maxTo = Math.max(0, to.scrollHeight - to.clientHeight);
    scrollSyncLock.current=true;
    to.scrollTop = ratio * maxTo;
    requestAnimationFrame(()=>{scrollSyncLock.current=false;});
  };

  useEffect(()=>{
    try {
      const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!saved) return;
      if (Array.isArray(saved.books) && saved.books.length) {
        setBooks(saved.books.map((b,idx)=>({
          ...createEmptyBook(idx+1),
          ...b,
          chapters: Array.isArray(b.chapters) && b.chapters.length ? b.chapters : [{title:'Chương 1',url:'',raw:'',cleaned:''}]
        })));
        if (Number.isInteger(saved.bookIndex)) setBookIndex(Math.max(0, Math.min(saved.bookIndex, saved.books.length-1)));
      } else {
        setBooks([{...createEmptyBook(1), title:saved.bookTitle || 'Truyện đã dọn', author:typeof saved.author === 'string' ? saved.author : '', chapters:Array.isArray(saved.chapters) && saved.chapters.length ? saved.chapters : [{title:'Chương 1',url:'',raw:'',cleaned:''}]}]);
      }
      if (saved.filters) setFilters({...DEFAULT_FILTERS, ...saved.filters});
      if (saved.options) setOptions(prev=>({...prev, ...saved.options}));
      if (saved.apiSettings) setApiSettings(prev=>({...prev, ...saved.apiSettings, apiKeys:undefined}));
      if (saved.promptSettings) setPromptSettings(prev=>({...prev, ...saved.promptSettings}));
      if (Array.isArray(saved.apiPool)) setApiPool(saved.apiPool.map(k=>({...k, lastStatus:k.lastStatus || 'Đã lưu'})));
      if (saved.collapsedBooks) setCollapsedBooks(saved.collapsedBooks);
      setStatus({type:'ok',message:'Đã khôi phục cache làm việc gần nhất.'});
    } catch {}
  },[]);
  useEffect(()=>{
    const timer = setTimeout(()=>{
      const updatedAt = new Date().toISOString();
      const data={books,bookIndex,bookTitle,author,chapters,filters,options,apiSettings,apiPool,promptSettings,collapsedBooks,updatedAt};
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      setLastAutoSaved(new Date(updatedAt).toLocaleTimeString());
    }, 900);
    return ()=>clearTimeout(timer);
  },[books,bookIndex,bookTitle,author,chapters,filters,options,apiSettings,apiPool,promptSettings,collapsedBooks]);  const current=chapters[selected]||chapters[0];
  const formatCharCount = (ch) => {
    if (!ch) return '0';
    const text = ch.raw || ch.cleaned || '';
    return text.length.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };
  const [createCount, setCreateCount] = useState(1);
  const [batchSizeInput, setBatchSizeInput] = useState(10);
  const [copiedClean, setCopiedClean] = useState(false);

  function getNextChapterUrl(url) {
    if (!url) return '';
    const [base, query] = url.split('?');
    const numberRegex = /\d+/g;
    const matches = base.match(numberRegex);
    if (matches && matches.length > 0) {
      const lastNumStr = matches[matches.length - 1];
      const lastNum = parseInt(lastNumStr, 10);
      const nextNum = lastNum + 1;
      const lastIdx = base.lastIndexOf(lastNumStr);
      if (lastIdx !== -1) {
        const nextBase = base.substring(0, lastIdx) + nextNum + base.substring(lastIdx + lastNumStr.length);
        return query ? `${nextBase}?${query}` : nextBase;
      }
    }
    return '';
  }

  function normalizeChapterTitle(title, bookTitleStr = '') {
    let t = String(title || '').trim();
    if (bookTitleStr) {
      t = t.replace(new RegExp(escapeRegExp(bookTitleStr) + '\\s*[-_:]*\\s*', 'gi'), '');
    }
    t = t.replace(/^(ch[ươ]ng\s+\d+)\s*[-_:]*\s*(ch[ươ]ng\s+\d+)\s*[-_:]*/i, '$1');
    const match = t.match(/^ch[ươ]ng\s+(\d+)\s*[-_:]*\s*(.*)$/i);
    if (match) {
      const chNum = match[1];
      let chName = match[2].trim();
      chName = chName.replace(/^\d+\s*[-_:]*\s*/, '');
      chName = chName.replace(/^(.+?)\s*[-_:]*\s*\1$/i, '$1');
      chName = chName.replace(/\s*[\(\[]?ch[ươ]ng\s+\d+[\)\]]?\s*$/i, '');
      if (bookTitleStr) {
        chName = chName.replace(new RegExp('\\s*[-_:]*\\s*' + escapeRegExp(bookTitleStr) + '\\s*$', 'gi'), '');
      }
      return `Chương ${chNum}${chName ? ': ' + chName : ''}`;
    }
    const matchDigit = t.match(/^(\d+)\s*[-_:]*\s*(.*)$/);
    if (matchDigit) {
      const chNum = matchDigit[1];
      let chName = matchDigit[2].trim();
      chName = chName.replace(/^(.+?)\s*[-_:]*\s*\1$/i, '$1');
      chName = chName.replace(/\s*[\(\[]?ch[ươ]ng\s+\d+[\)\]]?\s*$/i, '');
      if (bookTitleStr) {
        chName = chName.replace(new RegExp('\\s*[-_:]*\\s*' + escapeRegExp(bookTitleStr) + '\\s*$', 'gi'), '');
      }
      return `Chương ${chNum}${chName ? ': ' + chName : ''}`;
    }
    return t;
  }

  const continueChapter = (bIdx) => {
    const targetBookIndex = bIdx !== undefined ? bIdx : bookIndex;
    const book = books[targetBookIndex];
    if (!book) return;
    const chs = book.chapters || [];
    const newChNum = chs.length + 1;
    const newCh = {
      title: `Chương ${newChNum}`,
      url: '',
      raw: '',
      cleaned: '',
      selectedForExport: false
    };
    setBooks(prev => prev.map((x, i) => {
      if (i === targetBookIndex) {
        return {
          ...x,
          chapters: [...(x.chapters || []), newCh],
          updatedAt: new Date().toISOString()
        };
      }
      return x;
    }));
    if (targetBookIndex === bookIndex) {
      setSelected(chs.length);
    }
    setStatus({type:'ok',message:`Đã tạo chương mới: Chương ${newChNum}`});
  };

  const loadChapterList = async () => {
    const url = currentBook.url?.trim();
    if (!url) {
      setStatus({type: 'warn', message: 'Vui lòng nhập Link tổng của truyện.'});
      return;
    }
    if (!window.storyAPI?.fetchHtml) {
      setStatus({type: 'warn', message: 'Tính năng tải danh sách chỉ chạy trong app desktop Electron.'});
      return;
    }

    setFetching(true);
    setStatus({type: '', message: 'Đang tải danh sách chương từ Link tổng...'});
    try {
      const res = await window.storyAPI.fetchHtml(url);
      setFetching(false);
      if (!res.ok) {
        setStatus({type: 'error', message: res.error || 'Lỗi khi tải trang.'});
        return;
      }
      const parser = new DOMParser();
      const doc = parser.parseFromString(res.html, 'text/html');
      const links = Array.from(doc.querySelectorAll('a'));
      const chapterLinks = [];
      const seenUrls = new Set();
      links.forEach(a => {
        const text = a.textContent.trim();
        const hrefAttr = a.getAttribute('href');
        if (!hrefAttr) return;
        try {
          const absUrl = new URL(hrefAttr, url).toString();
          const lowerText = text.toLowerCase();
          const lowerHref = absUrl.toLowerCase();
          const isChapter = (
            lowerText.includes('chương') ||
            lowerText.includes('chapter') ||
            /ch[ươ]ng\s+\d+/i.test(lowerText) ||
            /chapter\s+\d+/i.test(lowerText) ||
            lowerHref.includes('chuong-') ||
            lowerHref.includes('chapter-')
          ) && !lowerHref.includes('comment') && !lowerHref.includes('feedback');

          if (isChapter && !seenUrls.has(absUrl)) {
            seenUrls.add(absUrl);
            chapterLinks.push({
              title: normalizeChapterTitle(text || `Chương ${chapterLinks.length + 1}`, bookTitle),
              url: absUrl,
              raw: '',
              cleaned: '',
              selectedForExport: false
            });
          }
        } catch {}
      });
      if (chapterLinks.length === 0) {
        setStatus({type: 'warn', message: 'Không tìm thấy chương nào từ link tổng. Bạn có thể tự dán link cho từng chương.'});
        return;
      }
      setChapters(chapterLinks);
      setSelected(0);
      setStatus({type: 'ok', message: `Đã tự động tải danh sách gồm ${chapterLinks.length} chương.`});
    } catch (err) {
      setFetching(false);
      setStatus({type: 'error', message: err.message || 'Lỗi khi parse danh sách chương.'});
    }
  };

  const fetchSelectedChapters = async () => {
    if (fetching || aiRunning) return;
    const targets = chapters.map((ch, idx) => ({ ch, idx })).filter(({ ch }) => ch.selectedForExport === true);
    if (!targets.length) {
      return setStatus({type: 'warn', message: 'Bạn chưa chọn chương nào (check ✓ ở cột trái).'});
    }
    if (!window.storyAPI?.fetchChapter) {
      return setStatus({type: 'warn', message: 'Lấy nội dung chỉ chạy trong app Electron.'});
    }

    setFetching(true);
    let successCount = 0;
    let failCount = 0;
    try {
      for (let i = 0; i < targets.length; i++) {
        const { ch, idx } = targets[i];
        if (!ch.url) {
          failCount++;
          continue;
        }
        setStatus({type: '', message: `Đang lấy nội dung chương ${idx + 1}/${chapters.length}...`});
        setSelected(idx);
        const res = await window.storyAPI.fetchChapter(ch.url);
        if (res.ok) {
          successCount++;
          updateChapter(idx, {
            title: normalizeChapterTitle(res.title || ch.title, bookTitle),
            raw: res.text || '',
            cleaned: cleanStoryText(res.text || '', options, filters)
          });
        } else {
          failCount++;
        }
        await sleep(1000);
      }
      setStatus({type: 'ok', message: `Đã lấy xong hàng loạt: ${successCount} thành công, ${failCount} thất bại.`});
    } catch (err) {
      setStatus({type: 'error', message: err.message || 'Lỗi lấy nội dung hàng loạt.'});
    } finally {
      setFetching(false);
    }
  };

  const fetchBatchChapters = async (option) => {
    if (fetching || aiRunning) return;
    let targets = [];
    if (option === 'all') {
      targets = chapters.map((ch, idx) => ({ ch, idx })).filter(({ ch }) => ch.url);
    } else {
      const count = parseInt(option) || 1;
      const startIndex = selected;
      const endIndex = Math.min(chapters.length, startIndex + count);
      for (let idx = startIndex; idx < endIndex; idx++) {
        if (chapters[idx].url) {
          targets.push({ ch: chapters[idx], idx });
        }
      }
    }

    if (!targets.length) {
      return setStatus({type: 'warn', message: 'Không tìm thấy chương nào có Link để lấy nội dung.'});
    }
    if (!window.storyAPI?.fetchChapter) {
      return setStatus({type: 'warn', message: 'Lấy nội dung chỉ chạy trong app Electron.'});
    }

    setFetching(true);
    let successCount = 0;
    let failCount = 0;
    try {
      for (let i = 0; i < targets.length; i++) {
        if (cancelRef.current) break;
        const { ch, idx } = targets[i];
        setStatus({type: '', message: `Đang lấy nội dung chương ${idx + 1}/${chapters.length}...`});
        setSelected(idx);
        const res = await window.storyAPI.fetchChapter(ch.url);
        if (res.ok) {
          successCount++;
          updateChapter(idx, {
            title: normalizeChapterTitle(res.title || ch.title, bookTitle),
            raw: res.text || '',
            cleaned: cleanStoryText(res.text || '', options, filters)
          });
        } else {
          failCount++;
        }
        await sleep(1000);
      }
      setStatus({type: 'ok', message: `Đã lấy xong hàng loạt: ${successCount} thành công, ${failCount} thất bại.`});
    } catch (err) {
      setStatus({type: 'error', message: err.message || 'Lỗi lấy nội dung hàng loạt.'});
    } finally {
      setFetching(false);
    }
  };

  const exportBatchDocx = async (start, end, filename, isSiri) => {
    const s = Math.max(1, parseInt(start) || 1) - 1;
    const e = Math.min(chapters.length, parseInt(end) || chapters.length) - 1;
    if (s > e) {
      alert('Chương bắt đầu phải nhỏ hơn hoặc bằng chương kết thúc.');
      return;
    }
    const ready = chapters.slice(s, e + 1).filter(ch => (ch.cleaned || ch.raw || '').trim());
    if (!ready.length) {
      alert('Không có nội dung chương trong khoảng đã chọn.');
      return;
    }
    try {
      const blob = await buildDocx({ title: filename, author, chapters: ready, isSiri });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${filename || slugify(bookTitle)}.docx`;
      a.click();
      URL.revokeObjectURL(a.href);
      setStatus({ type: 'ok', message: `Đã xuất ${filename}.docx (${ready.length} chương).` });
      setShowBatchExportModal(false);
    } catch (err) {
      setStatus({ type: 'error', message: err?.message || 'Xuất DOCX thất bại.' });
    }
  };

  const humanizeSelectedChapters = async () => {
    if (aiRunning || fetching) return;
    const targets = chapters.map((ch, idx) => ({ ch, idx })).filter(({ ch }) => ch.selectedForExport === true);
    if (!targets.length) {
      return setStatus({type: 'warn', message: 'Bạn chưa chọn chương nào (check ✓ ở cột trái).'});
    }

    cancelRef.current = false;
    setCancelRequested(false);
    setAiRunning(true);
    let successCount = 0;
    let failCount = 0;
    try {
      for (let i = 0; i < targets.length; i++) {
        if (cancelRef.current) break;
        const { idx } = targets[i];
        setSelected(idx);
        const success = await humanizeChapter(idx, true);
        if (success) successCount++;
        else failCount++;
        await sleep(Number(apiSettings.delayMs || 4500));
      }
      setStatus({type: 'ok', message: `AI hàng loạt hoàn thành: ${successCount} thành công, ${failCount} thất bại.`});
    } catch (err) {
      setStatus({type: 'error', message: err.message || 'Lỗi chạy AI hàng loạt.'});
    } finally {
      setAiRunning(false);
    }
  };

  const humanizeBatch = async (count) => {
    if (aiRunning || fetching) return;
    const n = Math.max(1, parseInt(count) || 1);
    
    cancelRef.current = false;
    setCancelRequested(false);
    setAiRunning(true);
    let successCount = 0;
    let failCount = 0;
    try {
      const startIndex = selected;
      const endIndex = Math.min(chapters.length, startIndex + n);
      for (let idx = startIndex; idx < endIndex; idx++) {
        if (cancelRef.current) break;
        setSelected(idx);
        const success = await humanizeChapter(idx, true);
        if (success) successCount++;
        else failCount++;
        if (idx < endIndex - 1) {
          await sleep(Number(apiSettings.delayMs || 4500));
        }
      }
      setStatus({type: 'ok', message: `AI hàng loạt hoàn thành: ${successCount} thành công, ${failCount} thất bại.`});
    } catch (err) {
      setStatus({type: 'error', message: err.message || 'Lỗi chạy AI hàng loạt.'});
    } finally {
      setAiRunning(false);
    }
  };

  const createNChapters = () => {
    const n = Math.max(1, parseInt(createCount) || 1);
    const newChs = [];
    const baseLength = chapters.length;
    for (let i = 0; i < n; i++) {
      newChs.push({
        title: `Chương ${baseLength + i + 1}`,
        url: '',
        raw: '',
        cleaned: '',
        selectedForExport: false
      });
    }
    setChapters([...chapters, ...newChs]);
    setSelected(baseLength);
    setStatus({type: 'ok', message: `Đã tạo ${n} chương rỗng.`});
  };

  const generateCleanLog = (targets) => {
    const successList = [];
    let emptyCount = 0;
    let noInputCount = 0;

    targets.forEach(({ ch, idx }) => {
      const raw = (ch.raw || '').trim();
      const cleaned = (ch.cleaned || '').trim();
      if (!raw) {
        noInputCount++;
      } else if (!cleaned) {
        emptyCount++;
      } else {
        successList.push(`Chương ${idx + 1}`);
      }
    });

    return (
      <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
        <div style={{ fontWeight: 'bold', color: '#047857' }}>Clean thành công ({successList.length})</div>
        {successList.length > 0 && (
          <ul style={{ margin: '4px 0 10px 15px', paddingLeft: '0', listStyleType: 'none' }}>
            {successList.map(name => <li key={name}>* {name}</li>)}
          </ul>
        )}
        <div style={{ fontWeight: 'bold', color: '#92400e', marginBottom: '10px' }}>Chương rỗng ({emptyCount})</div>
        <div style={{ fontWeight: 'bold', color: '#b91c1c' }}>Chương chưa nhập liệu ({noInputCount})</div>
      </div>
    );
  };

  const copyCleanText = async () => {
    const text = (current.cleaned || current.aiText || current.naturalText || current.cleanText || '').trim();
    if (!text) {
      return setStatus({ type: 'warn', message: 'Chưa có nội dung để copy' });
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopiedClean(true);
      setStatus({ type: 'ok', message: 'Đã copy nội dung sau clean' });
      setTimeout(() => setCopiedClean(false), 2000);
    } catch (err) {
      setStatus({ type: 'error', message: 'Không thể copy: ' + err.message });
    }
  };
  const stats=useMemo(()=>chapters.reduce((a,ch)=>a+getChapterSourceContent(ch).length,0),[chapters]);
  const getSelectedChapters = (list, selectedIdx, allowFallback = true) => {
    const selectedList = list
      .map((ch, idx) => ({ ch, idx }))
      .filter(({ ch }) => ch.selectedForExport === true);
    if (selectedList.length > 0) return selectedList;
    if (allowFallback && Number.isInteger(selectedIdx) && list[selectedIdx]) {
      return [{ ch: list[selectedIdx], idx: selectedIdx }];
    }
    return [];
  };
  const updateChapter=(i,patch)=>setChapters(prev=>prev.map((ch,idx)=>idx===i?{...ch,...patch}:ch));
  const cleanOne=(i)=>updateChapter(i,{cleaned:cleanStoryText(getChapterRawContent(chapters[i]),options,filters)});
  const layoutOne=(i)=>updateChapter(i,{cleaned:localReflow(getChapterSourceContent(chapters[i]), options)});
  const cleanAll=()=>{
    const targets = getSelectedChapters(chapters, selected, true);
    if (!targets.length) {
      return setStatus({type:'warn',message:'Bạn chưa chọn chương nào.'});
    }
    const updatedChapters = chapters.map((ch, idx) => {
      const target = targets.find(t => t.idx === idx);
      if (target) {
        return {...ch, cleaned: cleanStoryText(getChapterRawContent(ch), options, filters)};
      }
      return ch;
    });
    setChapters(updatedChapters);
    const loggedTargets = targets.map(({ idx }) => ({
      ch: updatedChapters[idx],
      idx
    }));
    setStatus({type:'ok',message: generateCleanLog(loggedTargets)});
  };
  const addChapter=()=>{setChapters([...chapters,{title:normalizeChapterTitle(`Chương ${chapters.length+1}`, bookTitle),url:'',raw:'',cleaned:'',selectedForExport:false}]);setSelected(chapters.length);};
  const removeChapter=(i)=>{const next=chapters.filter((_,idx)=>idx!==i);setChapters(next.length?next:[{title:'Chương 1',url:'',raw:'',cleaned:''}]);setSelected(Math.max(0,i-1));};
  const moveChapter=(i,dir)=>{const j=i+dir;if(j<0||j>=chapters.length)return;const next=[...chapters];[next[i],next[j]]=[next[j],next[i]];setChapters(next);setSelected(j);};
  const fetchCurrentUrl=async()=>{
    const url = current.url.trim();
    if(!url) return setStatus({type:'warn',message:'Bạn cần dán link chương trước.'});
    if(!window.storyAPI?.fetchChapter) return setStatus({type:'warn',message:'Tính năng lấy link chỉ chạy trong app desktop Electron. Nếu đang mở web, hãy chạy start-dev.bat.'});
    setFetching(true); setStatus({type:'',message:''});
    const res = await window.storyAPI.fetchChapter(url);
    setFetching(false);
    if(!res.ok) return setStatus({type:'error',message:res.error || 'Không lấy được chương.'});
    updateChapter(selected,{title:res.title || current.title, raw:res.text || '', cleaned:cleanStoryText(res.text || '', options, filters)});
    setStatus({type:'ok',message:`Đã lấy nội dung chương. Bộ nhận diện: ${res.selector || 'auto'}.`});
  };
  const exportTxt=()=>{const text=chapters.map((ch,i)=>`${ch.title||`Chương ${i+1}`}\n\n${ch.cleaned||ch.raw||''}`).join('\n\n---\n\n');const blob=new Blob([text],{type:'text/plain;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${slugify(bookTitle)}.txt`;a.click();URL.revokeObjectURL(a.href);};
  const exportEpub=async()=>{const ready=chapters.filter(ch=>(ch.cleaned||ch.raw||'').trim());if(!ready.length)return alert('Chưa có nội dung chương.');const blob=await buildEpub({title:bookTitle,author,chapters:ready});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${slugify(bookTitle)}.epub`;a.click();URL.revokeObjectURL(a.href);};
  const exportDocx=async(isSiri=false)=>{const ready=chapters.filter(ch=>(ch.cleaned||ch.raw||'').trim());if(!ready.length)return alert('Chưa có nội dung chương.');try{const blob=await buildDocx({title:bookTitle,author,chapters:ready,isSiri});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${slugify(bookTitle)}${isSiri?'-siri':''}.docx`;a.click();URL.revokeObjectURL(a.href);setStatus({type:'ok',message:`Đã xuất DOCX ${isSiri?'Siri':''}. Bạn có thể upload lên Drive rồi mở bằng Edge/Safari/Google Docs để nghe.`});}catch(err){setStatus({type:'error',message:err?.message||'Xuất DOCX thất bại. Hãy chạy npm install lại để cài package docx.'});}};
  const makePrompt=()=>{const text=(current.cleaned||current.raw||'').trim(); if(!text) return alert('Chưa có nội dung chương.'); setAiPrompt(buildAiPrompt(aiMode,text,filters,promptSettings)); setTab('ai');};
  const copyPrompt=async()=>{await navigator.clipboard.writeText(aiPrompt); setStatus({type:'ok',message:'Đã copy prompt.'});};

  const updateApi=(patch)=>setApiSettings(prev=>({...prev,...patch}));
  const getAvailableKeyIndex=(keys, preferred=0, cooldowns=keyCooldowns)=>{
    const now = Date.now();
    for (let offset=0; offset<keys.length; offset++) {
      const idx = (preferred + offset) % keys.length;
      if (!cooldowns[keys[idx]] || cooldowns[keys[idx]] <= now) return idx;
    }
    return -1;
  };
  const markKeyCooldown=(key)=>{
    const until = Date.now() + Number(apiSettings.cooldownMs || 90000);
    setKeyCooldowns(prev=>({...prev,[key]:until}));
    return until;
  };
  const callGeminiWithPool=async(prompt, chunkLabel, startIndex=0)=>{
    const keys = activeKeysFromPool(apiPool);
    if (!keys.length) throw new Error('Chưa nhập Gemini API key.');
    if (!window.storyAPI?.geminiGenerate) throw new Error('Gemini API chỉ chạy trong app desktop Electron.');
    let preferred = startIndex;
    let lastError = '';
    for (let attempt=0; attempt<=Number(apiSettings.maxRetries || 2); attempt++) {
      const idx = getAvailableKeyIndex(keys, preferred);
      if (idx < 0) {
        const waits = keys.map(k=>keyCooldowns[k]).filter(Boolean).map(t=>Math.max(1000,t-Date.now()));
        const waitMs = waits.length ? Math.min(...waits) : Number(apiSettings.cooldownMs || 90000);
        setAiProgress(p=>({...p,message:`Tất cả key đang nghỉ. Đợi ${Math.ceil(waitMs/1000)}s...`}));
        await sleep(waitMs);
        continue;
      }
      const key = keys[idx];
      setAiProgress(p=>({...p,message:`${chunkLabel} — dùng key #${idx+1}`}));
      const res = await window.storyAPI.geminiGenerate({apiKey:key, model:apiSettings.model, prompt});
      if (res.ok) {
        setApiPool(prev=>prev.map(k=>k.key===key?{...k,lastStatus:'active',totalSuccess:(k.totalSuccess||0)+1,totalChars:(k.totalChars||0)+prompt.length,lastUsedAt:new Date().toISOString(),lastError:''}:k));
        return { text: res.text, nextIndex: (idx+1)%keys.length };
      }
      lastError = friendlyGeminiError(res, apiSettings.model);
      setApiPool(prev=>prev.map(k=>k.key===key?{...k,lastStatus:isRateLimitError(res)?'limited':'error',totalFail:(k.totalFail||0)+1,lastUsedAt:new Date().toISOString(),lastError:lastError.slice(0,180)}:k));
      if (isRateLimitError(res)) {
        markKeyCooldown(key);
        preferred = (idx+1)%keys.length;
        await sleep(1200);
        continue;
      }
      if (attempt < Number(apiSettings.maxRetries || 2)) {
        await sleep(2000 + attempt * 1500);
        preferred = (idx+1)%keys.length;
        continue;
      }
    }
    throw new Error(lastError || 'Gemini API xử lý thất bại.');
  };

  const humanizeChapter = async(i, isBatch=false, forceReAi=false)=>{
    const source = (forceReAi ? chapters[i].raw : (chapters[i].cleaned || chapters[i].raw || '')).trim();
    if(!source) {
      setStatus({type:'warn',message:`Chương ${i+1} chưa có nội dung.`});
      return false;
    }
    if(aiRunning && !isBatch) return false;
    let localCleaned = cleanStoryText(source, options, filters);
    if (!localCleaned.trim()) {
      localCleaned = source;
    }
    const protector = protectTerms(localCleaned, filters.preserveTerms || '');
    const chunks = splitTextIntoChunks(protector.text, Number(apiSettings.chunkSize || 6000));
    if(!chunks.length) return false;
    
    if (!isBatch) {
      setAiRunning(true);
    }
    setAiProgress({done:0,total:chunks.length,message:`Bắt đầu AI humanize chương ${i+1}...`});
    setStatus({type:'warn',message:`Đang AI xử lý Natural VN ${chunks.length} chunk. App sẽ tự xoay key và nghỉ giữa request.`});
    try {
      let outputs=[];
      let keyIndex=0;
      let previousTail='';
      for (let c=0;c<chunks.length;c++) {
        if (cancelRef.current) throw new Error('USER_CANCELLED');
        const prompt = buildChunkPrompt(aiMode, chunks[c], filters, c+1, chunks.length, previousTail, promptSettings);
        const result = await callGeminiWithPool(prompt, `Chương ${i+1} Chunk ${c+1}/${chunks.length}`, keyIndex);
        keyIndex = result.nextIndex;
        const fixed = (result.text || '').trim();
        outputs.push(fixed);
        previousTail = fixed.slice(-700);
        setAiProgress({done:c+1,total:chunks.length,message:`Chương ${i+1}: Đã xong ${c+1}/${chunks.length} chunk`});
        if (c < chunks.length-1) await sleep(Number(apiSettings.delayMs || 4500));
      }
      const merged = protector.restore(outputs.join('\n\n')).replace(/\n{3,}/g,'\n\n').trim();
      updateChapter(i,{cleaned:merged, aiNaturalAt: new Date().toISOString()});
      setStatus({type:'ok',message:`AI đã xử lý Natural VN xong chương ${i+1}.`});
      return true;
    } catch(err) {
      setStatus({type:'error',message:`Chương ${i+1} lỗi: ${err?.message || 'AI xử lý thất bại.'}`});
      return false;
    } finally {
      if (!isBatch) {
        setAiRunning(false);
      }
    }
  };

  const humanizeAll = async()=>{
    if(aiRunning) return;
    for (let i=0;i<chapters.length;i++) {
      const hasText = (chapters[i].cleaned || chapters[i].raw || '').trim();
      if(!hasText) continue;
      setSelected(i);
      await humanizeChapter(i);
      await sleep(Number(apiSettings.delayMs || 4500));
    }
  };

  const loadGeminiModels=async()=>{
    const keys = activeKeysFromPool(apiPool);
    if(!keys.length) return setStatus({type:'warn',message:'Bạn cần nhập ít nhất 1 Gemini API key để lấy danh sách model.'});
    if(!window.storyAPI?.geminiListModels) return setStatus({type:'warn',message:'Lấy model chỉ chạy trong app desktop Electron. Hãy chạy start-dev.bat.'});
    setAiRunning(true);
    setAiProgress({done:0,total:1,message:'Đang lấy danh sách model từ key đầu...'});
    try {
      const res = await window.storyAPI.geminiListModels({apiKey: keys[0]});
      if(!res.ok) return setStatus({type:'error',message:res.error || 'Không lấy được danh sách model.'});
      const models = Array.isArray(res.models) ? res.models : [];
      if(!models.length) return setStatus({type:'error',message:'Key này không trả về model nào hỗ trợ generateContent. Hãy tạo key AI Studio khác hoặc kiểm tra project.'});
      setModelOptions(models);
      const currentStillExists = models.some(m => m.name === apiSettings.model);
      const preferred = models.find(m => m.name.includes('2.5-flash-lite')) || models.find(m => m.name.includes('2.5-flash')) || models.find(m => m.name.includes('flash')) || models[0];
      if(!currentStillExists && preferred?.name) updateApi({model: preferred.name});
      setAiProgress({done:1,total:1,message:'Đã lấy danh sách model'});
      setStatus({type:'ok',message:`Đã lấy ${models.length} model từ key. Model đang chọn: ${currentStillExists ? apiSettings.model : preferred.name}.`});
    } finally {
      setAiRunning(false);
    }
  };

  const testGeminiKey=async()=>{
    const keys = activeKeysFromPool(apiPool);
    if(!keys.length) return setStatus({type:'warn',message:'Bạn chưa nhập API key.'});
    if(!window.storyAPI?.geminiGenerate) return setStatus({type:'warn',message:'Test API chỉ chạy trong app desktop Electron.'});
    setAiRunning(true);
    try{
      const res = await window.storyAPI.geminiGenerate({apiKey:keys[0], model:apiSettings.model, prompt:'Trả lời đúng 1 từ: OK'});
      if(res.ok) setStatus({type:'ok',message:`Key #1 OK với model ${apiSettings.model}.`});
      else setStatus({type:'error',message:friendlyGeminiError(res, apiSettings.model)});
    } finally { setAiRunning(false); }
  };
  
  const testAllGeminiKeys=async()=>{
    const keys = activeKeysFromPool(apiPool);
    if(!keys.length) return setStatus({type:'warn',message:'Bạn chưa nhập API key.'});
    if(!window.storyAPI?.geminiGenerate) return setStatus({type:'warn',message:'Test API chỉ chạy trong app desktop Electron.'});
    cancelRef.current = false;
    setCancelRequested(false);
    setAiRunning(true);
    let ok=0, fail=0;
    try{
      for(let i=0;i<keys.length;i++){
        if (cancelRef.current) {
          throw new Error('USER_CANCELLED');
        }
        setAiProgress({done:i,total:keys.length,message:`Đang test key #${i+1}/${keys.length} với ${apiSettings.model}...`});
        const res = await window.storyAPI.geminiGenerate({apiKey:keys[i], model:apiSettings.model, prompt:'Trả lời đúng 1 từ: OK'});
        if (cancelRef.current) {
          throw new Error('USER_CANCELLED');
        }
        const keyValue = keys[i];
        if(res.ok) {
          ok++;
          setApiPool(prev=>prev.map(k=>k.key===keyValue?{...k,lastStatus:'active',totalSuccess:(k.totalSuccess||0)+1,lastUsedAt:new Date().toISOString(),lastError:''}:k));
        } else {
          fail++;
          const label = isRateLimitError(res) ? 'Rate-limit/quota' : 'Lỗi';
          setApiPool(prev=>prev.map(k=>k.key===keyValue?{...k,lastStatus:isRateLimitError(res)?'limited':'error',totalFail:(k.totalFail||0)+1,lastUsedAt:new Date().toISOString(),lastError:friendlyGeminiError(res, apiSettings.model).slice(0,180)}:k));
          if(isRateLimitError(res)) markKeyCooldown(keyValue);
        }
        if(i<keys.length-1) await sleep(Math.max(1500, Number(apiSettings.delayMs || 6500)));
      }
      setAiProgress({done:keys.length,total:keys.length,message:'Test key hoàn tất'});
      setStatus({type: ok ? 'ok' : 'error', message:`Test xong model ${apiSettings.model}: ${ok} key OK, ${fail} key lỗi. Nếu model not found/quota = 0, bấm “Lấy model từ key” hoặc dùng key/project khác.`});
    } finally { setAiRunning(false); }
  };

  const importKeys=()=>{
    const items = parseImportedKeyLines(importKeyText, apiPool.length);
    if(!items.length) return setStatus({type:'warn',message:'Chưa có key để import.'});
    setApiPool(prev=>uniqueKeyPool([...prev, ...items]));
    setImportKeyText('');
    setStatus({type:'ok',message:`Đã import ${items.length} key. Key đã được ẩn trong danh sách.`});
  };
  const clearCache=()=>{
    localStorage.removeItem(CACHE_KEY);
    setStatus({type:'ok',message:'Đã xóa cache lưu tạm trên máy.'});
  };
  
  const saveProject=()=>downloadJson(`${slugify(bookTitle)}-story-project.json`, {books,bookIndex,bookTitle,author,chapters,filters,options,apiSettings,apiPool,promptSettings,version:'v9-session'});

  const aiReportData = useMemo(() => {
    let total = chapters.length;
    let notLoaded = 0;
    let loaded = 0;
    let aiSuccess = 0;
    let aiError = 0;
    let aiPending = 0;
    
    const successList = [];
    const errorList = [];
    
    chapters.forEach((ch, idx) => {
      const hasContent = !!String(ch.raw || ch.cleaned || '').trim();
      const isAiSuccess = !!ch.aiNaturalAt || !!ch.aiText || !!ch.naturalText;
      const hasError = !!ch.aiError;
      
      if (!hasContent) {
        notLoaded++;
      } else {
        loaded++;
        if (isAiSuccess) {
          aiSuccess++;
          successList.push({
            idx,
            title: ch.title || `Chương ${idx+1}`,
            aiNaturalAt: ch.aiNaturalAt,
            rawLen: (ch.raw || '').length,
            aiLen: (ch.cleaned || ch.aiText || ch.naturalText || '').length
          });
        } else if (hasError) {
          aiError++;
          errorList.push({
            idx,
            title: ch.title || `Chương ${idx+1}`,
            error: ch.aiError,
            errorAt: ch.aiErrorAt,
            errorType: ch.aiErrorType || 'Lỗi không xác định'
          });
        } else {
          aiPending++;
        }
      }
    });
    
    return {
      total,
      notLoaded,
      loaded,
      aiSuccess,
      aiError,
      aiPending,
      successList,
      errorList
    };
  }, [chapters]);

  const getReportText = (format = 'txt') => {
    const data = aiReportData;
    let output = '';
    if (format === 'md') {
      output += `# BÁO CÁO TIẾN ĐỘ AI NATURAL - ${bookTitle.toUpperCase()}\n\n`;
      output += `*   **Tổng số chương:** ${data.total}\n`;
      output += `*   **Chương chưa tải nội dung:** ${data.notLoaded}\n`;
      output += `*   **Chương đã tải nội dung:** ${data.loaded}\n`;
      output += `*   **Đã AI Natural thành công:** ${data.aiSuccess}\n`;
      output += `*   **Chương bị lỗi AI:** ${data.aiError}\n`;
      output += `*   **Chương chờ AI:** ${data.aiPending}\n\n`;
      
      output += `## DANH SÁCH CHƯƠNG ĐÃ AI THÀNH CÔNG\n\n`;
      if (data.successList.length === 0) {
        output += `*(Chưa có chương nào)*\n`;
      } else {
        output += `| Số thứ tự | Tên chương | Thời gian AI | Ký tự gốc | Ký tự sau AI | Trạng thái |\n`;
        output += `| --- | --- | --- | --- | --- | --- |\n`;
        data.successList.forEach((item) => {
          output += `| ${item.idx + 1} | ${item.title} | ${item.aiNaturalAt || '-'} | ${item.rawLen} | ${item.aiLen} | OK |\n`;
        });
      }
      output += `\n## DANH SÁCH CHƯƠNG LỖI AI\n\n`;
      if (data.errorList.length === 0) {
        output += `*(Không có chương nào bị lỗi)*\n`;
      } else {
        output += `| Số thứ tự | Tên chương | Thời gian lỗi | Loại lỗi | Chi tiết lỗi |\n`;
        output += `| --- | --- | --- | --- | --- |\n`;
        data.errorList.forEach((item) => {
          output += `| ${item.idx + 1} | ${item.title} | ${item.errorAt || '-'} | ${item.errorType} | ${item.error} |\n`;
        });
      }
    } else {
      output += `BÁO CÁO TIẾN ĐỘ AI NATURAL - ${bookTitle.toUpperCase()}\n`;
      output += `=========================================\n\n`;
      output += `Tổng số chương: ${data.total}\n`;
      output += `Chương chưa tải nội dung: ${data.notLoaded}\n`;
      output += `Chương đã tải nội dung: ${data.loaded}\n`;
      output += `Đã AI Natural thành công: ${data.aiSuccess}\n`;
      output += `Chương bị lỗi AI: ${data.aiError}\n`;
      output += `Chương chờ AI: ${data.aiPending}\n\n`;
      
      output += `DANH SÁCH CHƯƠNG ĐÃ AI THÀNH CÔNG:\n`;
      if (data.successList.length === 0) {
        output += `(Chưa có chương nào)\n`;
      } else {
        data.successList.forEach((item) => {
          output += `- Chương ${item.idx + 1}: ${item.title} (${item.aiNaturalAt || '-'}) - ${item.rawLen} -> ${item.aiLen} ký tự\n`;
        });
      }
      output += `\nDANH SÁCH CHƯƠNG LỖI AI:\n`;
      if (data.errorList.length === 0) {
        output += `(Không có chương nào bị lỗi)\n`;
      } else {
        data.errorList.forEach((item) => {
          output += `- Chương ${item.idx + 1}: ${item.title} (${item.errorAt || '-'}) - ${item.errorType}: ${item.error}\n`;
        });
      }
    }
    return output;
  };

  const importProject=async(file)=>{
    if(!file) return;
    const data=JSON.parse(await file.text());
    if(data.bookTitle) setBookTitle(data.bookTitle);
    if(Array.isArray(data.books) && data.books.length){ setBooks(data.books); setBookIndex(Number.isInteger(data.bookIndex)?data.bookIndex:0); } else { if(typeof data.author==='string') setAuthor(data.author); if(Array.isArray(data.chapters) && data.chapters.length) setChapters(data.chapters); }
    if(data.filters) setFilters({...DEFAULT_FILTERS, ...data.filters});
    if(data.options) setOptions(prev=>({...prev, ...data.options}));
    if(data.apiSettings) setApiSettings(prev=>({...prev, ...data.apiSettings, apiKeys:undefined}));
    if(data.promptSettings) setPromptSettings(prev=>({...prev, ...data.promptSettings}));
    if(Array.isArray(data.apiPool)) setApiPool(data.apiPool);
    setStatus({type:'ok',message:'Đã import project/cache để làm tiếp.'});
  };

  const importEpub=async(file)=>{
    if(!file) return;
    try{
      const imported = await importEpubFile(file);
      if(!imported.length) return setStatus({type:'error',message:'Không đọc được chương nào từ EPUB này.'});
      setChapters(imported);
      setSelected(0);
      if(!bookTitle || bookTitle==='Truyện đã dọn') setBookTitle(file.name.replace(/\.epub$/i,''));
      setStatus({type:'ok',message:`Đã import ${imported.length} chương từ EPUB cũ.`});
    }catch(err){ setStatus({type:'error',message:err?.message || 'Import EPUB thất bại.'}); }
  };

  const apiKeys = activeKeysFromPool(apiPool);
  const cooledCount = apiKeys.filter(k => keyCooldowns[k] && keyCooldowns[k] > Date.now()).length;
  const keySummary = useMemo(()=>{
    const totalKeys = apiPool.length;
    const activeKeys = apiPool.filter(k=>k.enabled!==false).length;
    const limitedKeys = apiPool.filter(k=>k.lastStatus==='limited').length;
    const errorKeys = apiPool.filter(k=>['error','invalid'].includes(k.lastStatus)).length;
    const totalSuccess = apiPool.reduce((a,k)=>a+(k.totalSuccess||0),0);
    const totalFail = apiPool.reduce((a,k)=>a+(k.totalFail||0),0);
    return {totalKeys,activeKeys,limitedKeys,errorKeys,totalSuccess,totalFail};
  },[apiPool]);  const visibleKeys = useMemo(()=>apiPool.filter(k=>{
    const q=keySearch.trim().toLowerCase();
    const matchText = !q || `${k.label} ${maskKey(k.key)} ${k.lastStatus} ${k.lastError||''}`.toLowerCase().includes(q);
    const matchStatus = keyStatusFilter==='all' || (keyStatusFilter==='enabled' ? k.enabled!==false : k.lastStatus===keyStatusFilter);
    return matchText && matchStatus;
  }),[apiPool,keySearch,keyStatusFilter]);

  const totalPages = useMemo(() => {
    const limit = keysPerPage === 'all' ? visibleKeys.length : (parseInt(keysPerPage) || 10);
    if (limit <= 0) return 1;
    return Math.ceil(visibleKeys.length / limit) || 1;
  }, [visibleKeys, keysPerPage]);

  useEffect(() => {
    if (keyPage > totalPages) {
      setKeyPage(totalPages);
    } else if (keyPage < 1) {
      setKeyPage(1);
    }
  }, [totalPages, keyPage]);

  const paginatedKeys = useMemo(() => {
    const limit = keysPerPage === 'all' ? visibleKeys.length : (parseInt(keysPerPage) || 10);
    if (limit <= 0) return [];
    const maxPage = Math.max(1, Math.ceil(visibleKeys.length / limit));
    const activePage = Math.min(keyPage, maxPage);
    const startIndex = (activePage - 1) * limit;
    return visibleKeys.slice(startIndex, startIndex + limit);
  }, [visibleKeys, keyPage, keysPerPage]);


  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img src="/icon.png" alt="Story Cleaner" className="brandLogo" />
          <div>
            <b>Story Cleaner</b>
          </div>
        </div>
        <button className="newBookBtn" onClick={addBook}><Plus size={16}/> Tạo truyện mới</button>
        <div className="bookTree">
          {books.map((book, bIdx) => {
            const isOpen = !collapsedBooks[bIdx];
            const chs = book.chapters || [];
            if (!isOpen) {
              return (
                <div key={book.id || bIdx} className={`bookNode collapsed ${bIdx === bookIndex ? 'activeBook' : ''}`}>
                  <button className="bookTitleBtn" onClick={() => selectBook(bIdx)} title={book.title || `Truyện ${bIdx + 1}`} style={{ width: '100%', textAlign: 'left', fontWeight: 'bold' }}>
                    <span className="bookTitleText">{book.title || `Truyện ${bIdx + 1}`} ({chs.length} chương)</span>
                  </button>
                </div>
              );
            }

            return (
              <div key={book.id || bIdx} className={`bookNode open ${bIdx === bookIndex ? 'activeBook' : ''}`}>
                <div className="bookNodeHeader" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                  <button className="bookTitleBtn" onClick={() => toggleBookCollapsed(bIdx)} title={book.title || `Truyện ${bIdx + 1}`} style={{ fontWeight: 'bold', width: '100%', textAlign: 'left', padding: '4px 6px' }}>
                    <span className="bookTitleText">{book.title || `Truyện ${bIdx + 1}`} ({chs.length} chương)</span>
                  </button>
                  <div className="bookNodeActions" style={{ display: 'none' }}>
                    <button 
                      onClick={addChapter} 
                      style={{ 
                        padding: '4px 8px', 
                        fontSize: '11.5px', 
                        whiteSpace: 'nowrap', 
                        borderRadius: '6px', 
                        height: '28px', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        border: '1px solid #cbd5e1', 
                        backgroundColor: '#ffffff',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        margin: 0
                      }}
                    >
                      + Chương tiếp
                    </button>
                    <label style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '4px', 
                      cursor: 'pointer', 
                      fontSize: '11.5px', 
                      userSelect: 'none', 
                      border: '1px solid #cbd5e1', 
                      borderRadius: '6px', 
                      padding: '4px 6px', 
                      backgroundColor: '#f8fafc', 
                      fontWeight: 'bold', 
                      margin: 0, 
                      whiteSpace: 'nowrap', 
                      flexShrink: 0, 
                      height: '28px',
                      flexWrap: 'nowrap'
                    }}>
                      <input 
                        type="checkbox" 
                        style={{ width: '14px', height: '14px', margin: 0, flexShrink: 0, display: 'inline-block', cursor: 'pointer' }} 
                        checked={chs.length > 0 && chs.every(c => c.selectedForExport === true)} 
                        onChange={() => {
                          const allSelected = chs.every(c => c.selectedForExport === true);
                          setBooks(prev => prev.map((x, bookI) => {
                            if (bookI === bIdx) {
                              return {
                                ...x,
                                chapters: x.chapters.map(c => ({ ...c, selectedForExport: !allSelected }))
                              };
                            }
                            return x;
                          }));
                        }} 
                      />
                      <span style={{ fontSize: '11.5px', fontWeight: 'bold' }}>All</span>
                    </label>
                  </div>
                </div>

                <div className="chapterList treeChapters" style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', height: '24px', marginLeft: '-15px', width: 'calc(100% + 15px)' }}>
                    <div style={{ width: '25px', height: '2px', backgroundColor: '#dbeafe', flexShrink: 0 }} />
                    <div className="tree-action-row">
                      <button 
                        onClick={addChapter} 
                        className="softPrimary tree-continue-btn"
                        style={{ 
                          padding: '2px 8px', 
                          fontSize: '11px', 
                          borderRadius: '6px', 
                          height: '22px', 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          margin: 0,
                          border: '1px solid #bfdbfe'
                        }}
                      >
                        + Chương tiếp
                      </button>
                      <div className="tree-all-simple">
                        <input 
                          type="checkbox" 
                          checked={chs.length > 0 && chs.every(c => c.selectedForExport === true)} 
                          onChange={() => {
                            const allSelected = chs.every(c => c.selectedForExport === true);
                            setBooks(prev => prev.map((x, bookI) => {
                              if (bookI === bIdx) {
                                return {
                                  ...x,
                                  chapters: x.chapters.map(c => ({ ...c, selectedForExport: !allSelected }))
                                };
                              }
                              return x;
                            }));
                          }} 
                        />
                        <span>All</span>
                      </div>
                    </div>
                  </div>
                  {chs.map((ch, i) => {
                    const isActive = bIdx === bookIndex && i === selected;
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '36px', marginLeft: '-15px' }}>
                        <div style={{ width: '25px', height: '2px', backgroundColor: '#dbeafe', flexShrink: 0 }} />
                        <button className={isActive ? 'chapter active' : 'chapter'} onClick={() => {
                          selectBook(bIdx);
                          setSelected(i);
                        }} style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto', border: '1px solid #dbeafe', textAlign: 'left', padding: '6px 10px', height: '32px', minWidth: 0, overflow: 'hidden' }}>
                          <input 
                            type="checkbox" 
                            checked={ch.selectedForExport === true} 
                            onClick={e => e.stopPropagation()} 
                            onChange={e => {
                              setBooks(prev => prev.map((x, bookI) => {
                                if (bookI === bIdx) {
                                  return {
                                    ...x,
                                    chapters: x.chapters.map((c, chI) => chI === i ? { ...c, selectedForExport: e.target.checked } : c)
                                  };
                                }
                                return x;
                              }));
                            }} 
                            style={{ width: '14px', height: '14px', margin: 0, flexShrink: 0, cursor: 'pointer' }} 
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 800, fontSize: '13px', whiteSpace: 'nowrap' }}>
                              <span>Chương {i + 1}</span>
                              <span style={{ color: '#94a3b8', fontSize: '10.5px', fontWeight: 'normal', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                ({formatCharCount(ch)} ký tự)
                              </span>
                            </span>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <main className="main">
        <section className="topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div className="tabs" style={{ display: 'flex', gap: '6px', alignItems: 'center', margin: 0 }}>
            <button className={tab === 'editor' ? 'on' : ''} onClick={() => setTab('editor')} style={{ height: '34px', padding: '6px 12px', borderRadius: '8px', fontSize: '13px' }}>Biên tập</button>
            <button className={tab === 'filters' ? 'on' : ''} onClick={() => setTab('filters')} style={{ height: '34px', padding: '6px 12px', borderRadius: '8px', fontSize: '13px' }}><ShieldCheck size={14} /> Bộ lọc từ</button>
            <button className={tab === 'ai' ? 'on' : ''} onClick={() => setTab('ai')} style={{ height: '34px', padding: '6px 12px', borderRadius: '8px', fontSize: '13px' }}><Sparkles size={14} /> Gemini AI</button>
            <button className="reportTabBtn" onClick={() => setShowAiReport(true)} style={{ height: '34px', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}><FileText size={14} /> Báo cáo AI</button>
          </div>
          <div className="actions" style={{ display: 'flex', gap: '6px', alignItems: 'center', margin: 0 }}>
            <input ref={projectInputRef} type="file" accept=".json" hidden onChange={e => importProject(e.target.files?.[0])} />
            <button onClick={() => projectInputRef.current?.click()} style={{ height: '34px', padding: '6px 10px', borderRadius: '8px', fontSize: '13px' }}><Upload size={14} /> Import cache</button>
            <button onClick={saveProject} style={{ height: '34px', padding: '6px 10px', borderRadius: '8px', fontSize: '13px' }}><Save size={14} /> Export backup</button>
            {lastAutoSaved && <span className="autosave" style={{ height: '34px', display: 'inline-flex', alignItems: 'center', margin: 0, padding: '0 8px', borderRadius: '8px', fontSize: '12px' }}><Database size={12} /> Auto saved {lastAutoSaved}</span>}
            
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button className="primary" onClick={() => setShowDocxDropdown(!showDocxDropdown)} style={{ height: '34px', padding: '6px 12px', borderRadius: '8px', fontSize: '13px' }}>
                DOCX <span style={{ fontSize: '10px' }}>▼</span>
              </button>
              {showDocxDropdown && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '4px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                  zIndex: 1000,
                  minWidth: '180px',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '6px 0'
                }}>
                  <button style={{ border: 0, borderRadius: 0, justifyContent: 'flex-start', padding: '10px 16px', background: 'transparent', width: '100%' }} onClick={() => { setShowDocxDropdown(false); exportDocx(false); }}>DOCX Thường</button>
                  <button style={{ border: 0, borderRadius: 0, justifyContent: 'flex-start', padding: '10px 16px', background: 'transparent', width: '100%' }} onClick={() => { setShowDocxDropdown(false); exportDocx(true); }}>DOCX Siri</button>
                  <button style={{ border: 0, borderRadius: 0, justifyContent: 'flex-start', padding: '10px 16px', background: 'transparent', width: '100%' }} onClick={() => { setShowDocxDropdown(false); setExportIsSiri(false); setExportStartCh(1); setExportEndCh(Math.min(10, chapters.length)); updateDefaultFilename(1, Math.min(10, chapters.length)); setShowBatchExportModal(true); }}>DOCX Theo Tập</button>
                  <button style={{ border: 0, borderRadius: 0, justifyContent: 'flex-start', padding: '10px 16px', background: 'transparent', width: '100%' }} onClick={() => { setShowDocxDropdown(false); setExportIsSiri(true); setExportStartCh(1); setExportEndCh(Math.min(10, chapters.length)); updateDefaultFilename(1, Math.min(10, chapters.length)); setShowBatchExportModal(true); }}>DOCX Theo Tập Siri</button>
                </div>
              )}
            </div>
          </div>
        </section>

        {status.message && (
          <div className={`status ${status.type}`} style={{ padding: '8px 12px', minHeight: '34px', borderRadius: '10px', fontSize: '13px', margin: '4px 0' }}>
            {status.type === 'ok' ? <CheckCircle2 size={16} /> : status.type === 'error' ? <AlertTriangle size={16} /> : <RefreshCcw size={16} className={(aiRunning || fetching) ? 'spin' : ''} />}
            <div style={{ flex: 1 }}>{status.message}</div>
          </div>
        )}

        {(aiRunning || fetching) && (
          <div className="progressBox" style={{ padding: '8px 12px', borderRadius: '10px', margin: '4px 0' }}>
            <div className="progressHeader" style={{ fontSize: '13px' }}>
              <b>{aiProgress.message}</b>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span>{aiProgress.done}/{aiProgress.total}</span>
                <button onClick={handleStop} className="dangerSoft stopBtn" style={{ padding: '4px 8px', fontSize: '11px', color: '#b91c1c', backgroundColor: '#fef2f2', borderColor: '#fecaca', borderRadius: '6px', cursor: 'pointer', height: 'auto', minHeight: '0', display: 'inline-flex', alignItems: 'center', fontWeight: 'bold' }} disabled={cancelRequested}>{cancelRequested ? 'Đang dừng...' : 'Dừng'}</button>
              </div>
            </div>
            <div className="progressTrack" style={{ height: '6px', marginTop: '6px' }}>
              <div style={{ width: aiProgress.total ? `${Math.round(aiProgress.done / aiProgress.total * 100)}%` : '8%' }} />
            </div>
          </div>
        )}

        {tab === 'editor' && (
          <div className="chapterTools compactTools" style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', padding: '6px 10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'visible', margin: '4px 0' }}>
            
            {/* Lấy nội dung hàng loạt */}
            <div style={{ display: 'inline-flex', alignItems: 'stretch', borderRadius: '8px', border: '1px solid #bfdbfe', overflow: 'visible', height: '34px', position: 'relative', flexShrink: 0 }}>
              <button 
                onClick={() => {
                  if (batchFetchSelection === 'all') {
                    fetchBatchChapters('all');
                  } else {
                    fetchBatchChapters(batchFetchValue);
                  }
                }} 
                disabled={fetching || aiRunning} 
                className="softPrimary" 
                style={{ 
                  border: 0, 
                  borderRight: '1px solid #bfdbfe', 
                  borderRadius: '8px 0 0 8px', 
                  height: '100%', 
                  fontSize: '12px', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '4px', 
                  padding: '0 10px', 
                  margin: 0,
                  boxShadow: 'none',
                  transform: 'none',
                  fontWeight: 'bold'
                }}
              >
                {fetching ? <RefreshCcw className="spin" size={14} /> : <LinkIcon size={14} />} 
                Lấy nội dung hàng loạt {batchFetchSelection === 'all' ? '(Tất cả)' : `(${batchFetchValue} ch)`}
              </button>
              <button 
                onClick={() => {
                  setShowFetchDropdown(!showFetchDropdown);
                  setIsEnteringFetchCustom(false);
                }} 
                disabled={fetching || aiRunning} 
                className="softPrimary" 
                style={{ 
                  border: 0, 
                  borderRadius: '0 8px 8px 0', 
                  height: '100%', 
                  fontSize: '9px', 
                  padding: '0 8px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: 0,
                  boxShadow: 'none',
                  transform: 'none',
                  fontWeight: 'bold'
                }}
              >
                ▼
              </button>
              {showFetchDropdown && (
                <div style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  left: 0, 
                  marginTop: '4px', 
                  background: '#ffffff', 
                  border: '1px solid #cbd5e1', 
                  borderRadius: '8px', 
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
                  zIndex: 100, 
                  padding: '4px 0', 
                  minWidth: '160px' 
                }}>
                  {!isEnteringFetchCustom ? (
                    <>
                      <button 
                        style={{ display: 'block', width: '100%', padding: '8px 12px', border: 0, background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '13px', borderRadius: 0, fontWeight: 'normal', color: '#172033' }} 
                        onClick={() => { setBatchFetchSelection('all'); setBatchFetchValue('all'); setShowFetchDropdown(false); }}
                      >
                        Tất cả
                      </button>
                      <button 
                        style={{ display: 'block', width: '100%', padding: '8px 12px', border: 0, background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '13px', borderRadius: 0, fontWeight: 'normal', color: '#172033' }} 
                        onClick={() => { setIsEnteringFetchCustom(true); setTempFetchCustomValue(typeof batchFetchValue === 'number' ? batchFetchValue : 10); }}
                      >
                        Nhập số chương...
                      </button>
                    </>
                  ) : (
                    <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>Số chương:</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input 
                          type="number" 
                          min="1" 
                          value={tempFetchCustomValue} 
                          onChange={e => setTempFetchCustomValue(Math.max(1, parseInt(e.target.value) || 1))} 
                          style={{ width: '60px', padding: '4px', height: '28px', borderRadius: '4px', fontSize: '12.5px', border: '1px solid #cbd5e1' }} 
                        />
                        <button 
                          className="primary" 
                          style={{ padding: '0 8px', border: 0, borderRadius: '4px', fontSize: '12px', cursor: 'pointer', height: '28px', display: 'inline-flex', alignItems: 'center' }} 
                          onClick={() => {
                            setBatchFetchSelection('custom');
                            setBatchFetchValue(tempFetchCustomValue);
                            setIsEnteringFetchCustom(false);
                            setShowFetchDropdown(false);
                          }}
                        >
                          OK
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* AI hàng loạt */}
            <div style={{ display: 'inline-flex', alignItems: 'stretch', borderRadius: '8px', border: '1px solid #2563eb', overflow: 'visible', height: '34px', position: 'relative', flexShrink: 0 }}>
              <button 
                onClick={() => humanizeBatch(batchAiValue)} 
                disabled={aiRunning || fetching} 
                className="primary" 
                style={{ 
                  border: 0, 
                  borderRight: '1px solid #1d4ed8', 
                  borderRadius: '8px 0 0 8px', 
                  height: '100%', 
                  fontSize: '12px', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '4px', 
                  padding: '0 10px', 
                  margin: 0,
                  boxShadow: 'none',
                  transform: 'none',
                  background: '#2563eb',
                  color: 'white',
                  fontWeight: 'bold'
                }}
              >
                {aiRunning ? <RefreshCcw className="spin" size={14} /> : <Sparkles size={14} />} 
                AI hàng loạt ({batchAiSelection === 'custom' ? `${batchAiValue} ch` : `${batchAiSelection} ch`})
              </button>
              <button 
                onClick={() => {
                  setShowBatchAiDropdown(!showBatchAiDropdown);
                  setIsEnteringAiCustom(false);
                }} 
                disabled={aiRunning || fetching} 
                className="primary" 
                style={{ 
                  border: 0, 
                  borderRadius: '0 8px 8px 0', 
                  height: '100%', 
                  fontSize: '9px', 
                  padding: '0 8px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: 0,
                  boxShadow: 'none',
                  transform: 'none',
                  background: '#2563eb',
                  color: 'white',
                  fontWeight: 'bold'
                }}
              >
                ▼
              </button>
              {showBatchAiDropdown && (
                <div style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  left: 0, 
                  marginTop: '4px', 
                  background: '#ffffff', 
                  border: '1px solid #cbd5e1', 
                  borderRadius: '8px', 
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
                  zIndex: 100, 
                  padding: '4px 0', 
                  minWidth: '160px' 
                }}>
                  {!isEnteringAiCustom ? (
                    <>
                      {[3, 5, 10].map(num => (
                        <button 
                          key={num} 
                          style={{ display: 'block', width: '100%', padding: '8px 12px', border: 0, background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '13px', borderRadius: 0, fontWeight: 'normal', color: '#172033' }} 
                          onClick={() => { setBatchAiSelection(String(num)); setBatchAiValue(num); setShowBatchAiDropdown(false); }}
                        >
                          {num} chương
                        </button>
                      ))}
                      <button 
                        style={{ display: 'block', width: '100%', padding: '8px 12px', border: 0, background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '13px', borderRadius: 0, fontWeight: 'normal', color: '#172033' }} 
                        onClick={() => { setIsEnteringAiCustom(true); setTempAiCustomValue(batchAiValue); }}
                      >
                        Nhập số chương...
                      </button>
                    </>
                  ) : (
                    <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>Số chương:</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input 
                          type="number" 
                          min="1" 
                          value={tempAiCustomValue} 
                          onChange={e => setTempAiCustomValue(Math.max(1, parseInt(e.target.value) || 1))} 
                          style={{ width: '60px', padding: '4px', height: '28px', borderRadius: '4px', fontSize: '12.5px', border: '1px solid #cbd5e1' }} 
                        />
                        <button 
                          className="primary" 
                          style={{ padding: '0 8px', border: 0, borderRadius: '4px', fontSize: '12px', cursor: 'pointer', height: '28px', display: 'inline-flex', alignItems: 'center' }} 
                          onClick={() => {
                            setBatchAiSelection('custom');
                            setBatchAiValue(tempAiCustomValue);
                            setIsEnteringAiCustom(false);
                            setShowBatchAiDropdown(false);
                          }}
                        >
                          OK
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* AI chương đã chọn */}
            <button onClick={humanizeSelectedChapters} disabled={aiRunning || fetching} className="softPrimary" style={{ height: '34px', padding: '6px 10px', fontSize: '12.5px', borderRadius: '8px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #cbd5e1' }}>
              {aiRunning ? <RefreshCcw className="spin" size={13} /> : <Sparkles size={13} />} AI đã chọn
            </button>

            {/* AI chương hiện tại */}
            <button onClick={() => humanizeChapter(selected, false, false)} className="softPrimary" disabled={aiRunning || fetching} style={{ height: '34px', padding: '6px 10px', fontSize: '12.5px', borderRadius: '8px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #cbd5e1' }}>
              {aiRunning ? <RefreshCcw className="spin" size={13} /> : <Sparkles size={13} />} AI hiện tại
            </button>

            {/* Re-AI chương */}
            {current && current.cleaned && (
              <button onClick={() => humanizeChapter(selected, false, true)} className="dangerSoft" disabled={aiRunning || fetching} style={{ height: '34px', padding: '6px 10px', fontSize: '12.5px', borderRadius: '8px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #cbd5e1' }}>
                <RefreshCcw size={13} /> Re-AI chương
              </button>
            )}

          </div>
        )}

        {/* Fix cứng Block Tên truyện (fixed/non-scrollable) */}
        <section className="bookInfo card" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ margin: 0 }}>Tên truyện</label>
            <input value={bookTitle} onChange={e => setBookTitle(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ margin: 0 }}>Tác giả</label>
            <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Không bắt buộc" />
          </div>
          <div style={{ flex: 2, minWidth: '250px' }}>
            <label style={{ margin: 0 }}>Link tổng (Table of Contents)</label>
            <div className="urlRow">
              <input value={currentBook.url || ''} onChange={e => updateBook({ url: e.target.value })} placeholder="https://..." />
              <button onClick={loadChapterList} disabled={fetching} className="softPrimary">
                {fetching ? <RefreshCcw className="spin" size={15} /> : null} Load List
              </button>
            </div>
          </div>
          <button className="dangerSoft equalBtn" onClick={() => deleteBook(bookIndex)} style={{ height: '42px', alignSelf: 'flex-end' }}><Trash2 size={16} /> Xóa truyện</button>
        </section>

        <div className="scrollContent" style={{ overflowY: tab === 'editor' ? 'hidden' : 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {tab === 'editor' && (
            <section className="chapterWorkspace card" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, paddingBottom: '14px', gap: '6px' }}>
              {/* Fix cứng Header Chương đang sửa */}
              <div className="chapterWorkspaceHead" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '4px', gap: '12px', flexWrap: 'nowrap' }}>
                <h2 style={{ fontSize: '18px', margin: 0, whiteSpace: 'nowrap' }}>Chương đang sửa (Chương {selected + 1})</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
                  <button onClick={() => moveChapter(selected, -1)} title="Lên">↑</button>
                  <button onClick={() => moveChapter(selected, 1)} title="Xuống">↓</button>
                  <button onClick={() => setSelected(0)} disabled={selected === 0}>Chương 1</button>
                  <button onClick={() => setSelected(chapters.length - 1)} disabled={selected === chapters.length - 1}>Chương cuối</button>
                  <input type="number" min="1" max={chapters.length} value={selected + 1} onChange={e => {
                    const val = parseInt(e.target.value) - 1;
                    if (val >= 0 && val < chapters.length) {
                      setSelected(val);
                    }
                  }} style={{ width: '70px', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '8px' }} />
                  <button className="dangerSoft" onClick={() => removeChapter(selected)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Trash2 size={16} /> Xóa</button>
                </div>
              </div>

              {/* Chỉ cuộn phần nội dung chương từ Tiêu đề/Link chương trở xuống */}
              <div className="chapterWorkspaceBody" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
                {/* Đưa 2 dòng Tiêu đề chương và Link chương lên cùng 1 hàng */}
                <div className="chapterMeta" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '16px', alignItems: 'end' }}>
                  <label style={{ margin: 0 }}>Tiêu đề chương<input value={current.title} onChange={e => updateChapter(selected, { title: e.target.value })} /></label>
                  <label style={{ margin: 0 }}>Link chương
                    <div className="urlRow">
                      <input value={current.url} onChange={e => updateChapter(selected, { url: e.target.value })} placeholder="https://..." />
                      <button onClick={fetchCurrentUrl} disabled={fetching}>
                        {fetching ? <RefreshCcw className="spin" size={15} /> : <LinkIcon size={17} />}
                        {fetching ? 'Đang lấy...' : 'Lấy nội dung'}
                      </button>
                    </div>
                  </label>
                </div>

                <div className="chapterTools" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => cleanOne(selected)}><Wand2 size={17} /> Dọn + chia đoạn</button>
                  <button onClick={() => layoutOne(selected)}><AlignLeft size={17} /> Chỉ chia bố cục</button>
                  <button onClick={cleanAll}><Wand2 size={17} /> Dọn tất cả</button>
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <button onClick={() => setShowOptionsPopup(!showOptionsPopup)} className="softPrimary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Sliders size={17} /> Tùy chọn dọn text <span style={{ fontSize: '10px' }}>▼</span>
                    </button>
                    {showOptionsPopup && (
                      <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: 0,
                        marginBottom: '4px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '12px',
                        boxShadow: '0 -4px 16px rgba(0,0,0,0.12), 0 10px 25px rgba(0,0,0,0.15)',
                        zIndex: 1000,
                        minWidth: '280px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '4px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', color: '#172033' }}>
                          Tùy chọn dọn text
                        </div>
                        {[
                          ['normalizeSpaces', 'Xóa khoảng trắng/dòng trống thừa'],
                          ['mergeBrokenLines', 'Gộp dòng bị ngắt sai'],
                          ['reflowLayout', 'Chia lại bố cục đoạn văn'],
                          ['removeWatermark', 'Xóa watermark/câu rác'],
                          ['restoreFilteredWords', 'Khôi phục từ bị lọc'],
                          ['autoReplace', 'Thay từ convert theo bộ lọc']
                        ].map(([k, t]) => (
                          <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 'normal', margin: 0, userSelect: 'none', flexDirection: 'row', width: '100%', color: '#172033' }}>
                            <input 
                              type="checkbox" 
                              checked={options[k]} 
                              onChange={e => setOptions({ ...options, [k]: e.target.checked })} 
                              style={{ width: '15px', height: '15px', margin: 0, flexShrink: 0 }}
                            />
                            <span>{t}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="compareGrid">
                  <label>Nội dung gốc<textarea ref={rawTextRef} value={current.raw} onScroll={() => handleCompareScroll('raw')} onChange={e => updateChapter(selected, { raw: e.target.value })} placeholder="Dán truyện convert / bản dịch thô / text lỗi vào đây..." style={{ height: 'calc(100vh - 350px)', minHeight: '260px', resize: 'none' }} /></label>
                  <label>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Bản đã clean</span>
                      <button onClick={copyCleanText} className="softPrimary" style={{ padding: '3px 8px', fontSize: '12px', minHeight: 0, height: 'auto', borderRadius: '6px' }}>{copiedClean ? 'Đã Copy' : 'Copy'}</button>
                    </div>
                    <textarea ref={cleanTextRef} value={current.cleaned} onScroll={() => handleCompareScroll('clean')} onChange={e => updateChapter(selected, { cleaned: e.target.value })} placeholder="Kết quả sau khi dọn / bản AI sửa sẽ đặt ở đây." style={{ height: 'calc(100vh - 350px)', minHeight: '260px', resize: 'none' }} />
                  </label>
                </div>
              </div>
            </section>
          )}

          {tab === 'filters' && (
            <section className="filters card">
              <h2>Bộ lọc từ</h2>
              <div className="filterGrid">
                <label>Giữ nguyên / Preserve<textarea value={filters.preserveTerms} onChange={e => setFilters({ ...filters, preserveTerms: e.target.value })} /></label>
                <label>Thay thế convert<textarea value={filters.replaceRules} onChange={e => setFilters({ ...filters, replaceRules: e.target.value })} /></label>
                <label>Watermark / câu rác<textarea value={filters.watermarks} onChange={e => setFilters({ ...filters, watermarks: e.target.value })} /></label>
                <label>Từ bị lọc cần khôi phục<textarea value={filters.restoreRules} onChange={e => setFilters({ ...filters, restoreRules: e.target.value })} /></label>
              </div>
            </section>
          )}

          {tab === 'ai' && (
            <section className="ai card compactAi">
              <div className="aiHeader">
                <div><h2>Gemini AI Pool</h2></div>
                <div className="poolStats managerStats">
                  <span>Tổng key <b>{keySummary.totalKeys}</b></span>
                  <span>Đang bật <b>{keySummary.activeKeys}</b></span>
                  <span>Limited <b>{keySummary.limitedKeys}</b></span>
                  <span>Lỗi <b>{keySummary.errorKeys}</b></span>
                  <span>OK/Fail <b>{keySummary.totalSuccess}/{keySummary.totalFail}</b></span>
                </div>
              </div>
              <div className="managerTabs">
                <button className="on"><ShieldCheck size={16} /> Keys</button>
                <button><Sparkles size={16} /> Prompt Preset</button>
                <button onClick={() => setStatus({ type: 'ok', message: `Session: auto-cache đang bật. Key đã dùng: ${apiPool.filter(k => k.lastUsedAt).map(k => k.label).join(', ') || 'chưa có'}.` })}><Database size={16} /> Session</button>
              </div>
              <div className="keyManagerLayout">
                <div className="keyImportPanel">
                  <div className="panelTitle"><FileText size={16} /><b>Import Gemini Keys</b></div>
                  <label>Nhập key <span className="hint">mỗi dòng một key, hoặc GEMINI_045=AIza...</span>
                    <textarea className="keyBox" value={importKeyText} onChange={e => setImportKeyText(e.target.value)} placeholder={`GEMINI_001=AIza...\nGEMINI_002=AIza...\nAIza...`} />
                  </label>
                  <div className="miniActions left">
                    <button className="softPrimary" onClick={importKeys}><Upload size={16} /> Import</button>
                    <button onClick={testAllGeminiKeys} disabled={aiRunning}><Sparkles size={16} /> Test all</button>
                    <button onClick={loadGeminiModels} disabled={aiRunning}><RefreshCcw size={16} /> Lấy model</button>
                  </div>
                </div>
                <div className="keyTablePanel">
                  <div className="tableToolbar" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="searchBox" style={{ width: '130px', flex: 'none' }}>
                      <Search size={15} />
                      <input value={keySearch} onChange={e => setKeySearch(e.target.value)} placeholder="Tìm..." />
                    </div>
                    <select value={keyStatusFilter} style={{ width: '110px' }} onChange={e => setKeyStatusFilter(e.target.value)}>
                      <option value="all">Tất cả</option>
                      <option value="enabled">Đang bật</option>
                      <option value="active">Active</option>
                      <option value="limited">Limited</option>
                      <option value="error">Error</option>
                      <option value="unknown">Unknown</option>
                    </select>
                    <select value={keysPerPage} style={{ width: '110px' }} onChange={e => { setKeysPerPage(e.target.value); setKeyPage(1); }}>
                      <option value="10">10 Key/trang</option>
                      <option value="20">20 / trang</option>
                      <option value="50">50 / trang</option>
                      <option value="all">Tất cả</option>
                    </select>
                    <button onClick={() => setApiPool(prev => prev.map(k => ({ ...k, enabled: true })))}><ToggleRight size={15} /> Bật all</button>
                    <button onClick={() => setApiPool(prev => prev.map(k => ({ ...k, enabled: false })))}><ToggleLeft size={15} /> Tắt all</button>
                    <button onClick={() => setApiPool([])}><Trash2 size={15} /> Xóa pool</button>
                  </div>
                  <div className="keyTable">
                    <div className="keyRow head">
                      <span>Key</span>
                      <span>Masked</span>
                      <span>Status</span>
                      <span>OK/Fail</span>
                      <span>Chars</span>
                      <span>Last used</span>
                      <span></span>
                    </div>
                    {paginatedKeys.length ? paginatedKeys.map((item, idx) => (
                      <div key={item.id || idx} className={`keyRow ${item.lastStatus || 'unknown'}`}>
                        <label className="check slim">
                          <input type="checkbox" checked={item.enabled !== false} onChange={e => setApiPool(prev => prev.map(k => k.id === item.id ? { ...k, enabled: e.target.checked } : k))} />
                          <b>{item.label}</b>
                        </label>
                        <code>{maskKey(item.key)}</code>
                        <span className={`badge ${item.lastStatus || 'unknown'}`}>{item.lastStatus || 'unknown'}</span>
                        <span>{item.totalSuccess || 0}/{item.totalFail || 0}</span>
                        <span>{(item.totalChars || 0).toLocaleString()}</span>
                        <span className="lastUsed">{item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleTimeString() : '-'}</span>
                        <button onClick={() => setApiPool(prev => prev.filter(k => k.id !== item.id))}><Trash2 size={14} /></button>
                        {item.lastError && <small className="keyError">{item.lastError}</small>}
                      </div>
                    )) : <p className="note emptyKey">Chưa có key hoặc không có key khớp bộ lọc.</p>}
                  </div>
                  {visibleKeys.length > 0 && (
                    <div className="pagination" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                      <button onClick={() => setKeyPage(p => Math.max(1, p - 1))} disabled={keyPage <= 1}>Trang trước</button>
                      <span>Trang {keyPage} / {totalPages}</span>
                      <button onClick={() => setKeyPage(p => Math.min(totalPages, p + 1))} disabled={keyPage >= totalPages}>Trang sau</button>
                      <span className="totalKeys" style={{ marginLeft: 'auto' }}>Tổng số key: {visibleKeys.length}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="promptPanel">
                <div className="panelTitle"><Sparkles size={16} /><b>Prompt Engine / Context xưng hô</b></div>
                <div className="promptGrid">
                  <label>Model<select value={apiSettings.model} onChange={e => updateApi({ model: e.target.value })}>{modelOptions.map(m => <option key={m.name} value={m.name}>{m.displayName || m.name}</option>)}</select></label>
                  <label>Mode xử lý<select value={aiMode} onChange={e => setAiMode(e.target.value)}><option value="humanize">Natural VN Audio — Việt hóa để nghe</option><option value="structure">Sửa bố cục + câu chữ</option><option value="proofread">Check/sửa nhẹ text</option></select></label>
                  <label>Mức biên tập<select value={promptSettings.humanizeStrength} onChange={e => setPromptSettings({ ...promptSettings, humanizeStrength: e.target.value })}><option value="cleanup">Cleanup — ít sửa nhất</option><option value="naturalAudio">Natural VN Audio — khuyên dùng</option><option value="light">Light — giữ gần văn gốc</option><option value="balanced">Balanced — mượt vừa phải</option><option value="strong">Strong — mượt hơn</option></select></label>
                  <label>Xưng hô<select value={promptSettings.pronounStyle} onChange={e => setPromptSettings({ ...promptSettings, pronounStyle: e.target.value })}><option value="preserve">Preserve — giữ ta/ngươi</option><option value="balanced">Balanced — theo ngữ cảnh</option><option value="modern">Modern VN — mềm hóa mạnh hơn</option></select></label>
                  <label>Chunk<input type="number" value={apiSettings.chunkSize} onChange={e => updateApi({ chunkSize: Number(e.target.value) })} /></label>
                  <label>Delay ms<input type="number" value={apiSettings.delayMs} onChange={e => updateApi({ delayMs: Number(e.target.value) })} /></label>
                  <label>Cooldown ms<input type="number" value={apiSettings.cooldownMs} onChange={e => updateApi({ cooldownMs: Number(e.target.value) })} /></label>
                  <label>Retry<input type="number" value={apiSettings.maxRetries} onChange={e => updateApi({ maxRetries: Number(e.target.value) })} /></label>
                </div>
                <div className="memoryGrid">
                  <label>Novel Memory <span className="hint">chỉ áp dụng cho bộ truyện hiện tại</span><textarea value={promptSettings.novelMemory} onChange={e => setPromptSettings({ ...promptSettings, novelMemory: e.target.value })} /></label>
                  <label>Ghi chú thêm <span className="hint">không bắt buộc</span><textarea value={promptSettings.additionalInstructions} onChange={e => setPromptSettings({ ...promptSettings, additionalInstructions: e.target.value })} placeholder="Ví dụ: Giữ nguyên xưng hô sư phụ/đệ tử. Không đổi Lâm Thiếu thành cậu Lâm..." /></label>
                </div>
              </div>
              <div className="aiControls compactControls">
                <button onClick={() => humanizeChapter(selected, false, false)} disabled={aiRunning}><Sparkles size={17} /> AI chương hiện tại</button>
                <button onClick={humanizeAll} disabled={aiRunning}><Sparkles size={17} /> AI tất cả chương</button>
                <button onClick={makePrompt}><Copy size={17} /> Tạo prompt thủ công</button>
                <button onClick={saveProject}><Save size={17} /> Export project backup</button>
                <button onClick={clearCache}><Trash2 size={17} /> Xóa auto-cache</button>
              </div>
              <details className="promptDetails">
                <summary>Prompt thủ công / nâng cao</summary>
                <div className="aiControls">
                  <button onClick={copyPrompt} disabled={!aiPrompt}><Copy size={17} /> Copy prompt</button>
                </div>
                <textarea className="promptBox" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Prompt thủ công sẽ hiện ở đây nếu bạn bấm Tạo prompt thủ công..." />
              </details>
              <div className="sessionLog">
                <b>Session log</b>
                <div>
                  {apiPool.filter(k => k.lastUsedAt).length ? apiPool.filter(k => k.lastUsedAt).slice(0, 8).map(k => <span key={k.id}>{k.label}: {k.lastStatus || 'unknown'} · {new Date(k.lastUsedAt).toLocaleTimeString()}</span>) : <span>Chưa có key nào được dùng trong phiên này.</span>}
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {showAiReport && (
        <div className="modalOverlay" onClick={() => setShowAiReport(false)}>
          <div className="modalContent reportModal" onClick={e => e.stopPropagation()}>
            <div className="modalHeader">
              <h3><FileText size={20} /> Báo cáo AI Natural</h3>
              <button className="closeBtn" onClick={() => setShowAiReport(false)}>×</button>
            </div>
            <div className="modalBody">
              <div className="reportStatsGrid">
                <div className="statBox"><span>Tổng số chương</span><b>{aiReportData.total}</b></div>
                <div className="statBox warning"><span>Chưa tải nội dung</span><b>{aiReportData.notLoaded}</b></div>
                <div className="statBox success"><span>Đã AI OK</span><b>{aiReportData.aiSuccess}</b></div>
                <div className="statBox danger"><span>Lỗi AI</span><b>{aiReportData.aiError}</b></div>
                <div className="statBox warning"><span>Chờ AI</span><b>{aiReportData.aiPending}</b></div>
              </div>

              <div className="reportDetailsSection">
                <h4>Danh sách chương đã AI thành công ({aiReportData.aiSuccess})</h4>
                <div className="reportListScroll">
                  {aiReportData.successList.length > 0 ? (
                    <table className="reportTable">
                      <thead>
                        <tr>
                          <th>Chương</th>
                          <th>Tiêu đề</th>
                          <th>Thời gian AI</th>
                          <th>Gốc (ký tự)</th>
                          <th>Sau AI (ký tự)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiReportData.successList.map(item => (
                          <tr key={item.idx}>
                            <td>{item.idx + 1}</td>
                            <td>{item.title}</td>
                            <td>{item.aiNaturalAt ? new Date(item.aiNaturalAt).toLocaleTimeString() : '-'}</td>
                            <td>{item.rawLen}</td>
                            <td>{item.aiLen}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <p className="note">Chưa có chương nào AI thành công.</p>}
                </div>

                <h4 style={{ marginTop: '20px' }}>Danh sách chương lỗi AI ({aiReportData.aiError})</h4>
                <div className="reportListScroll">
                  {aiReportData.errorList.length > 0 ? (
                    <table className="reportTable">
                      <thead>
                        <tr>
                          <th>Chương</th>
                          <th>Tiêu đề</th>
                          <th>Thời gian lỗi</th>
                          <th>Loại lỗi</th>
                          <th>Chi tiết lỗi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiReportData.errorList.map(item => (
                          <tr key={item.idx}>
                            <td>{item.idx + 1}</td>
                            <td>{item.title}</td>
                            <td>{item.errorAt ? new Date(item.errorAt).toLocaleTimeString() : '-'}</td>
                            <td><span className="badge danger">{item.errorType}</span></td>
                            <td className="errorMsgCell" title={item.error}>{item.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <p className="note">Không có chương nào bị lỗi.</p>}
                </div>
              </div>
            </div>
            <div className="modalFooter">
              <button className="softPrimary" onClick={() => {
                const text = getReportText('txt');
                navigator.clipboard.writeText(text);
                setStatus({ type: 'ok', message: 'Đã copy báo cáo dạng text.' });
              }}><Copy size={16} /> Copy Text</button>
              <button className="softPrimary" onClick={() => {
                const text = getReportText('md');
                navigator.clipboard.writeText(text);
                setStatus({ type: 'ok', message: 'Đã copy báo cáo dạng Markdown.' });
              }}><Copy size={16} /> Copy MD</button>
              <button onClick={() => setShowAiReport(false)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {showBatchExportModal && (
        <div className="modalOverlay" onClick={() => setShowBatchExportModal(false)}>
          <div className="modalContent" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modalHeader">
              <h3><Download size={20} /> {exportIsSiri ? 'Xuất DOCX Theo Tập Siri' : 'Xuất DOCX Theo Tập'}</h3>
              <button className="closeBtn" onClick={() => setShowBatchExportModal(false)}>×</button>
            </div>
            <div className="modalBody" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <label style={{ flex: 1, gap: '6px' }}>Từ chương
                  <input type="number" min="1" max={chapters.length} value={exportStartCh} onChange={e => {
                    const start = Math.max(1, parseInt(e.target.value) || 1);
                    setExportStartCh(start);
                    updateDefaultFilename(start, exportEndCh);
                  }} />
                </label>
                <label style={{ flex: 1, gap: '6px' }}>Đến chương
                  <input type="number" min="1" max={chapters.length} value={exportEndCh} onChange={e => {
                    const end = Math.max(1, parseInt(e.target.value) || 1);
                    setExportEndCh(end);
                    updateDefaultFilename(exportStartCh, end);
                  }} />
                </label>
              </div>
              <label style={{ gap: '6px' }}>Tên file mặc định
                <input type="text" value={exportFilename} onChange={e => setExportFilename(e.target.value)} />
              </label>
            </div>
            <div className="modalFooter">
              <button className="softPrimary" onClick={() => setShowBatchExportModal(false)}>Hủy</button>
              <button className="primary" onClick={() => exportBatchDocx(exportStartCh, exportEndCh, exportFilename, exportIsSiri)}>Xuất file</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById('root')).render(<App />);
