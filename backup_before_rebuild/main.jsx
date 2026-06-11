import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import JSZip from 'jszip';
import {
  BookOpen, FileText, Wand2, Download, Trash2, ArrowUp, ArrowDown,
  Languages, ShieldCheck, Copy, Plus, Link as LinkIcon, Sparkles,
  AlignLeft, RefreshCcw, CheckCircle2, AlertTriangle, Upload, Save, EyeOff, Database, Search, ToggleLeft, ToggleRight, Clock
} from 'lucide-react';
import './styles.css';

const DEFAULT_FILTERS = {
  preserveTerms: `bổn tọa\nbản tọa\nLâm thiếu\nLâm Thiếu\nđạo hữu\ntiểu tử\nthánh nữ\nthánh tử\nma tôn\nlão phu\nbần đạo\nthần thức\nlinh khí\ntu vi\nkim đan\nnguyên anh\ntông môn\npháp bảo\nthiếu chủ\nđại trưởng lão`,
  replaceRules: `nữ nhân => cô gái\nnam nhân => người đàn ông\nkhóe miệng co quắp => khóe môi giật nhẹ\nthần sắc âm trầm => sắc mặt âm trầm\ncười lạnh một tiếng => cười lạnh\ntrong lòng âm thầm => thầm nghĩ\nnhìn qua => nhìn sang`,
  watermarks: `truyện được đăng tại\nđọc truyện tại\nnguồn:\nteam dịch\nnhóm dịch\nvui lòng không reup\nkhông copy\nủng hộ team\nwebsite đang đọc truyện\ntruyện chỉ được đăng tại`,
  restoreRules: `t*nh => tình\nch*t => chết\ngi*t => giết\nm*u => máu\nđ*m => đâm\ns*t => sát\nh*n => hôn\nth*n thể => thân thể`
};

const DEFAULT_NOVEL_MEMORY = `# Ghi nhớ riêng cho bộ truyện này
# Mỗi dòng một ghi chú. App sẽ gửi kèm khi AI humanize.
Giữ vibe tiên hiệp/huyền huyễn, không hiện đại hóa quá mức.
Không tự ý đổi tên riêng, môn phái, cảnh giới, công pháp.
Xưng hô ta/ngươi được giữ nếu hợp vibe cổ trang.
Chỉ chuyển sang bố/mẹ/anh/chị/em nếu ngữ cảnh gia đình hoặc đời thường thật sự rõ ràng.`;

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

async function buildDocx({ title, author, chapters }) {
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
        spacing: { before: 120, after: 180, line: 420 },
        indent: { firstLine: 420 }
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

function App() {
  const [books,setBooks]=useState(()=>[createEmptyBook(1)]);
  const [bookIndex,setBookIndex]=useState(0);
  const [collapsedBooks,setCollapsedBooks]=useState({});
  const rawTextRef=useRef(null);
  const cleanTextRef=useRef(null);
  const scrollSyncLock=useRef(false);
  const [importKeyText,setImportKeyText]=useState('');
  const [apiPool,setApiPool]=useState([]);
  const projectInputRef=useRef(null);
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
  const [apiSettings,setApiSettings]=useState({
    model:'gemini-2.5-flash-lite',
    chunkSize:4500,
    delayMs:6500,
    cooldownMs:120000,
    maxRetries:2
  });
  const [options,setOptions]=useState({normalizeSpaces:true,mergeBrokenLines:true,reflowLayout:true,removeWatermark:true,restoreFilteredWords:true,autoReplace:true});
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
  const setChapters = (next)=>updateBook(book=>({chapters: typeof next === 'function' ? next(book.chapters || []) : next}));
  const addBook = ()=>{
    const book = createEmptyBook(books.length+1);
    setBooks(prev=>[...prev, book]);
    setBookIndex(books.length);
    setSelected(0);
    setTab('editor');
  };
  const selectBook = (idx)=>{
    setBookIndex(idx);
    setSelected(0);
  };
  const toggleBookCollapsed = (idx)=>{
    setCollapsedBooks(prev=>({...prev,[idx]:!prev[idx]}));
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
  },[books,bookIndex,bookTitle,author,chapters,filters,options,apiSettings,apiPool,promptSettings,collapsedBooks]);
  const current=chapters[selected]||chapters[0];
  const stats=useMemo(()=>chapters.reduce((a,ch)=>a+(ch.cleaned||ch.raw||'').length,0),[chapters]);
  const updateChapter=(i,patch)=>setChapters(chapters.map((ch,idx)=>idx===i?{...ch,...patch}:ch));
  const cleanOne=(i)=>updateChapter(i,{cleaned:cleanStoryText(chapters[i].raw,options,filters)});
  const layoutOne=(i)=>updateChapter(i,{cleaned:localReflow(chapters[i].cleaned || chapters[i].raw || '')});
  const cleanAll=()=>setChapters(chapters.map(ch=>({...ch,cleaned:cleanStoryText(ch.raw,options,filters)})));
  const addChapter=()=>{setChapters([...chapters,{title:`Chương ${chapters.length+1}`,url:'',raw:'',cleaned:''}]);setSelected(chapters.length);};
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
  const exportDocx=async()=>{const ready=chapters.filter(ch=>(ch.cleaned||ch.raw||'').trim());if(!ready.length)return alert('Chưa có nội dung chương.');try{const blob=await buildDocx({title:bookTitle,author,chapters:ready});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${slugify(bookTitle)}.docx`;a.click();URL.revokeObjectURL(a.href);setStatus({type:'ok',message:'Đã xuất DOCX. Bạn có thể upload lên Drive rồi mở bằng Edge/Safari/Google Docs để nghe.'});}catch(err){setStatus({type:'error',message:err?.message||'Xuất DOCX thất bại. Hãy chạy npm install lại để cài package docx.'});}};
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

  const humanizeChapter = async(i)=>{
    const source = (chapters[i].cleaned || chapters[i].raw || '').trim();
    if(!source) return setStatus({type:'warn',message:'Chương này chưa có nội dung.'});
    if(aiRunning) return;
    const localCleaned = cleanStoryText(source, options, filters);
    const protector = protectTerms(localCleaned, filters.preserveTerms || '');
    const chunks = splitTextIntoChunks(protector.text, Number(apiSettings.chunkSize || 6000));
    if(!chunks.length) return;
    setAiRunning(true);
    setTab('ai');
    setAiProgress({done:0,total:chunks.length,message:'Bắt đầu AI humanize...'});
    setStatus({type:'warn',message:`Đang AI xử lý Natural VN ${chunks.length} chunk. App sẽ tự xoay key và nghỉ giữa request.`});
    try {
      let outputs=[];
      let keyIndex=0;
      let previousTail='';
      for (let c=0;c<chunks.length;c++) {
        const prompt = buildChunkPrompt(aiMode, chunks[c], filters, c+1, chunks.length, previousTail, promptSettings);
        const result = await callGeminiWithPool(prompt, `Chunk ${c+1}/${chunks.length}`, keyIndex);
        keyIndex = result.nextIndex;
        const fixed = (result.text || '').trim();
        outputs.push(fixed);
        previousTail = fixed.slice(-700);
        setAiProgress({done:c+1,total:chunks.length,message:`Đã xong ${c+1}/${chunks.length} chunk`});
        if (c < chunks.length-1) await sleep(Number(apiSettings.delayMs || 4500));
      }
      const merged = protector.restore(outputs.join('\n\n')).replace(/\n{3,}/g,'\n\n').trim();
      updateChapter(i,{cleaned:merged});
      setStatus({type:'ok',message:'AI đã xử lý Natural VN xong chương hiện tại.'});
    } catch(err) {
      setStatus({type:'error',message:err?.message || 'AI xử lý thất bại.'});
    } finally {
      setAiRunning(false);
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
    setTab('ai');
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
    setAiRunning(true);
    setTab('ai');
    let ok=0, fail=0;
    try{
      for(let i=0;i<keys.length;i++){
        setAiProgress({done:i,total:keys.length,message:`Đang test key #${i+1}/${keys.length} với ${apiSettings.model}...`});
        const res = await window.storyAPI.geminiGenerate({apiKey:keys[i], model:apiSettings.model, prompt:'Trả lời đúng 1 từ: OK'});
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
  },[apiPool]);
  const visibleKeys = useMemo(()=>apiPool.filter(k=>{
    const q=keySearch.trim().toLowerCase();
    const matchText = !q || `${k.label} ${maskKey(k.key)} ${k.lastStatus} ${k.lastError||''}`.toLowerCase().includes(q);
    const matchStatus = keyStatusFilter==='all' || (keyStatusFilter==='enabled' ? k.enabled!==false : k.lastStatus===keyStatusFilter);
    return matchText && matchStatus;
  }),[apiPool,keySearch,keyStatusFilter]);

  return <div className="app"><aside className="sidebar"><div className="brand">
  <img src="/icon.png" alt="Story Cleaner" className="brandLogo" />
  <div>
    <b>Story Cleaner</b>
  </div>
</div><button className="newBookBtn" onClick={addBook}><Plus size={16}/> Tạo truyện mới</button><div className="bookTree">{books.map((book,bIdx)=>{const isOpen=!collapsedBooks[bIdx]; const chs=book.chapters||[]; return <div key={book.id||bIdx} className={`bookNode ${bIdx===bookIndex?'activeBook':''} ${isOpen?'open':'collapsed'}`}><div className="bookNodeHeader"><button type="button" className="treeToggle" title={isOpen?'Đóng cây truyện':'Mở cây truyện'} onClick={()=>toggleBookCollapsed(bIdx)}>{isOpen?'▾':'▸'}</button><button className="bookTitleBtn" onClick={()=>selectBook(bIdx)} title={book.title || `Truyện ${bIdx+1}`}><span className="bookTitleText">{book.title || `Truyện ${bIdx+1}`}</span></button><button className="miniAddChapter" title="Thêm chương" onClick={()=>{selectBook(bIdx); const currentChs=book.chapters?.length?book.chapters:[]; setBooks(prev=>prev.map((x,i)=>i===bIdx?{...x,chapters:[...currentChs,{title:`Chương ${currentChs.length+1}`,url:'',raw:'',cleaned:''}],updatedAt:new Date().toISOString()}:x)); setCollapsedBooks(prev=>({...prev,[bIdx]:false})); setSelected(currentChs.length);}}>+ chương</button></div>{isOpen && <div className="chapterList treeChapters">{chs.map((ch,i)=><button key={i} className={bIdx===bookIndex&&i===selected?'chapter active':'chapter'} onClick={()=>{selectBook(bIdx);setSelected(i);}}><span>{ch.title||`Chương ${i+1}`}</span><small>{(ch.cleaned||ch.raw||'').length.toLocaleString()} ký tự</small></button>)}</div>}</div>})}</div></aside>
  <main className="main"><section className="topbar"><div><h1>Story Cleaner</h1></div><div className="actions"><input ref={projectInputRef} type="file" accept=".json" hidden onChange={e=>importProject(e.target.files?.[0])}/><button onClick={()=>projectInputRef.current?.click()}><Upload size={17}/> Import cache</button><button onClick={saveProject}><Save size={17}/> Export backup</button>{lastAutoSaved && <span className="autosave"><Database size={14}/> Auto saved {lastAutoSaved}</span>}<button className="primary" onClick={exportDocx}><Download size={17}/> DOCX</button></div></section>
  {status.message && <div className={`status ${status.type}`}>{status.type==='ok'?<CheckCircle2/>:status.type==='error'?<AlertTriangle/>:<RefreshCcw/>}<span>{status.message}</span></div>}
  {aiRunning && <div className="progressBox"><div className="progressHeader"><b>{aiProgress.message}</b><span>{aiProgress.done}/{aiProgress.total}</span></div><div className="progressTrack"><div style={{width: aiProgress.total ? `${Math.round(aiProgress.done/aiProgress.total*100)}%` : '8%'}} /></div></div>}
  <section className="tabs"><button className={tab==='editor'?'on':''} onClick={()=>setTab('editor')}>Biên tập</button><button className={tab==='filters'?'on':''} onClick={()=>setTab('filters')}><ShieldCheck size={16}/> Bộ lọc từ</button><button className={tab==='ai'?'on':''} onClick={()=>setTab('ai')}><Sparkles size={16}/> Gemini AI</button></section>
  <section className="bookInfo card"><label>Tên truyện<input value={bookTitle} onChange={e=>setBookTitle(e.target.value)}/></label><label>Tác giả<input value={author} onChange={e=>setAuthor(e.target.value)} placeholder="Không bắt buộc"/></label><button className="dangerSoft equalBtn" onClick={()=>deleteBook(bookIndex)}><Trash2 size={16}/> Xóa truyện</button><div className="stat chapterStat"><span>Số chương:</span><b>{chapters.length}</b></div></section>
  {tab==='editor'&&<><section className="chapterWorkspace card"><div className="chapterWorkspaceHead"><div><h2>Chương đang sửa</h2></div><div className="miniActions"><button onClick={()=>moveChapter(selected,-1)} title="Đưa lên"><ArrowUp size={16}/></button><button onClick={()=>moveChapter(selected,1)} title="Đưa xuống"><ArrowDown size={16}/></button><button onClick={()=>removeChapter(selected)} title="Xóa chương"><Trash2 size={16}/></button></div></div><div className="chapterMeta"><label>Tiêu đề chương<input value={current.title} onChange={e=>updateChapter(selected,{title:e.target.value})}/></label><label>Link chương<div className="urlRow"><input value={current.url} onChange={e=>updateChapter(selected,{url:e.target.value})} placeholder="https://..."/><button onClick={fetchCurrentUrl} disabled={fetching}><LinkIcon size={17}/>{fetching?'Đang lấy...':'Lấy nội dung'}</button></div></label></div><div className="chapterTools"><button onClick={()=>cleanOne(selected)}><Wand2 size={17}/> Dọn + chia đoạn</button><button onClick={()=>layoutOne(selected)}><AlignLeft size={17}/> Chỉ chia bố cục</button><button onClick={cleanAll}><Wand2 size={17}/> Dọn tất cả</button><button onClick={()=>humanizeChapter(selected)} className="softPrimary" disabled={aiRunning}><Sparkles size={17}/> AI Natural VN chương</button></div><div className="compareGrid"><label>Nội dung gốc<textarea ref={rawTextRef} value={current.raw} onScroll={()=>handleCompareScroll('raw')} onChange={e=>updateChapter(selected,{raw:e.target.value})} placeholder="Dán truyện convert / bản dịch thô / text lỗi vào đây..."/></label><label>Bản đã clean<textarea ref={cleanTextRef} value={current.cleaned} onScroll={()=>handleCompareScroll('clean')} onChange={e=>updateChapter(selected,{cleaned:e.target.value})} placeholder="Kết quả sau khi dọn / bản AI sửa sẽ đặt ở đây."/></label></div></section><section className="settings card"><h2>Tùy chọn dọn text</h2>{[['normalizeSpaces','Xóa khoảng trắng/dòng trống thừa'],['mergeBrokenLines','Gộp dòng bị ngắt sai'],['reflowLayout','Chia lại bố cục đoạn văn'],['removeWatermark','Xóa watermark/câu rác'],['restoreFilteredWords','Khôi phục từ bị lọc'],['autoReplace','Thay từ convert theo bộ lọc']].map(([k,t])=><label key={k} className="check"><input type="checkbox" checked={options[k]} onChange={e=>setOptions({...options,[k]:e.target.checked})}/> {t}</label>)}</section></>}
  {tab==='filters'&&<section className="filters card"><h2>Bộ lọc từ</h2><div className="filterGrid"><label>Giữ nguyên / Preserve<textarea value={filters.preserveTerms} onChange={e=>setFilters({...filters,preserveTerms:e.target.value})}/></label><label>Thay thế convert<textarea value={filters.replaceRules} onChange={e=>setFilters({...filters,replaceRules:e.target.value})}/></label><label>Watermark / câu rác<textarea value={filters.watermarks} onChange={e=>setFilters({...filters,watermarks:e.target.value})}/></label><label>Từ bị lọc cần khôi phục<textarea value={filters.restoreRules} onChange={e=>setFilters({...filters,restoreRules:e.target.value})}/></label></div></section>}
  {tab==='ai'&&<section className="ai card compactAi"><div className="aiHeader"><div><h2>Gemini AI Pool</h2></div><div className="poolStats managerStats"><span>Tổng key <b>{keySummary.totalKeys}</b></span><span>Đang bật <b>{keySummary.activeKeys}</b></span><span>Limited <b>{keySummary.limitedKeys}</b></span><span>Lỗi <b>{keySummary.errorKeys}</b></span><span>OK/Fail <b>{keySummary.totalSuccess}/{keySummary.totalFail}</b></span></div></div>
  <div className="managerTabs"><button className="on"><ShieldCheck size={16}/> Keys</button><button><Sparkles size={16}/> Prompt Preset</button><button onClick={()=>setStatus({type:'ok',message:`Session: auto-cache đang bật. Key đã dùng: ${apiPool.filter(k=>k.lastUsedAt).map(k=>k.label).join(', ') || 'chưa có'}.`})}><Database size={16}/> Session</button></div>
  <div className="keyManagerLayout"><div className="keyImportPanel"><div className="panelTitle"><FileText size={16}/><b>Import Gemini Keys</b></div><label>Nhập key <span className="hint">mỗi dòng một key, hoặc GEMINI_045=AIza...</span><textarea className="keyBox" value={importKeyText} onChange={e=>setImportKeyText(e.target.value)} placeholder={`GEMINI_001=AIza...\nGEMINI_002=AIza...\nAIza...`} /></label><div className="miniActions left"><button className="softPrimary" onClick={importKeys}><Upload size={16}/> Import</button><button onClick={testAllGeminiKeys} disabled={aiRunning}><Sparkles size={16}/> Test all</button><button onClick={loadGeminiModels} disabled={aiRunning}><RefreshCcw size={16}/> Lấy model</button></div></div>
  <div className="keyTablePanel"><div className="tableToolbar"><div className="searchBox"><Search size={15}/><input value={keySearch} onChange={e=>setKeySearch(e.target.value)} placeholder="Tìm label/status..."/></div><select value={keyStatusFilter} onChange={e=>setKeyStatusFilter(e.target.value)}><option value="all">Tất cả</option><option value="enabled">Đang bật</option><option value="active">Active</option><option value="limited">Limited</option><option value="error">Error</option><option value="unknown">Unknown</option></select><button onClick={()=>setApiPool(prev=>prev.map(k=>({...k,enabled:true})))}><ToggleRight size={15}/> Bật all</button><button onClick={()=>setApiPool(prev=>prev.map(k=>({...k,enabled:false})))}><ToggleLeft size={15}/> Tắt all</button><button onClick={()=>setApiPool([])}><Trash2 size={15}/> Xóa pool</button></div><div className="keyTable"><div className="keyRow head"><span>Key</span><span>Masked</span><span>Status</span><span>OK/Fail</span><span>Chars</span><span>Last used</span><span></span></div>{visibleKeys.length?visibleKeys.map((item,idx)=><div key={item.id||idx} className={`keyRow ${item.lastStatus||'unknown'}`}><label className="check slim"><input type="checkbox" checked={item.enabled!==false} onChange={e=>setApiPool(prev=>prev.map(k=>k.id===item.id?{...k,enabled:e.target.checked}:k))}/><b>{item.label}</b></label><code>{maskKey(item.key)}</code><span className={`badge ${item.lastStatus||'unknown'}`}>{item.lastStatus||'unknown'}</span><span>{item.totalSuccess||0}/{item.totalFail||0}</span><span>{(item.totalChars||0).toLocaleString()}</span><span className="lastUsed">{item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleTimeString() : '-'}</span><button onClick={()=>setApiPool(prev=>prev.filter(k=>k.id!==item.id))}><Trash2 size={14}/></button>{item.lastError && <small className="keyError">{item.lastError}</small>}</div>):<p className="note emptyKey">Chưa có key hoặc không có key khớp bộ lọc.</p>}</div></div></div>
  <div className="promptPanel"><div className="panelTitle"><Sparkles size={16}/><b>Prompt Engine / Context xưng hô</b></div><div className="promptGrid"><label>Model<select value={apiSettings.model} onChange={e=>updateApi({model:e.target.value})}>{modelOptions.map(m=><option key={m.name} value={m.name}>{m.displayName || m.name}</option>)}</select></label><label>Mode xử lý<select value={aiMode} onChange={e=>setAiMode(e.target.value)}><option value="humanize">Natural VN Audio — Việt hóa để nghe</option><option value="structure">Sửa bố cục + câu chữ</option><option value="proofread">Check/sửa nhẹ text</option></select></label><label>Mức biên tập<select value={promptSettings.humanizeStrength} onChange={e=>setPromptSettings({...promptSettings,humanizeStrength:e.target.value})}><option value="cleanup">Cleanup — ít sửa nhất</option><option value="naturalAudio">Natural VN Audio — khuyên dùng</option><option value="light">Light — giữ gần văn gốc</option><option value="balanced">Balanced — mượt vừa phải</option><option value="strong">Strong — mượt hơn</option></select></label><label>Xưng hô<select value={promptSettings.pronounStyle} onChange={e=>setPromptSettings({...promptSettings,pronounStyle:e.target.value})}><option value="preserve">Preserve — giữ ta/ngươi</option><option value="balanced">Balanced — theo ngữ cảnh</option><option value="modern">Modern VN — mềm hóa mạnh hơn</option></select></label><label>Chunk<input type="number" value={apiSettings.chunkSize} onChange={e=>updateApi({chunkSize:Number(e.target.value)})}/></label><label>Delay ms<input type="number" value={apiSettings.delayMs} onChange={e=>updateApi({delayMs:Number(e.target.value)})}/></label><label>Cooldown ms<input type="number" value={apiSettings.cooldownMs} onChange={e=>updateApi({cooldownMs:Number(e.target.value)})}/></label><label>Retry<input type="number" value={apiSettings.maxRetries} onChange={e=>updateApi({maxRetries:Number(e.target.value)})}/></label></div><div className="memoryGrid"><label>Novel Memory <span className="hint">chỉ áp dụng cho bộ truyện hiện tại</span><textarea value={promptSettings.novelMemory} onChange={e=>setPromptSettings({...promptSettings,novelMemory:e.target.value})}/></label><label>Ghi chú thêm <span className="hint">không bắt buộc</span><textarea value={promptSettings.additionalInstructions} onChange={e=>setPromptSettings({...promptSettings,additionalInstructions:e.target.value})} placeholder="Ví dụ: Giữ nguyên xưng hô sư phụ/đệ tử. Không đổi Lâm Thiếu thành cậu Lâm..."/></label></div></div>
  <div className="aiControls compactControls"><button onClick={()=>humanizeChapter(selected)} disabled={aiRunning}><Sparkles size={17}/> AI chương hiện tại</button><button onClick={humanizeAll} disabled={aiRunning}><Sparkles size={17}/> AI tất cả chương</button><button onClick={makePrompt}><Copy size={17}/> Tạo prompt thủ công</button><button onClick={saveProject}><Save size={17}/> Export project backup</button><button onClick={clearCache}><Trash2 size={17}/> Xóa auto-cache</button></div>
  <details className="promptDetails"><summary>Prompt thủ công / nâng cao</summary><div className="aiControls"><button onClick={copyPrompt} disabled={!aiPrompt}><Copy size={17}/> Copy prompt</button></div><textarea className="promptBox" value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} placeholder="Prompt thủ công sẽ hiện ở đây nếu bạn bấm Tạo prompt thủ công..."/></details><div className="sessionLog"><b>Session log</b><div>{apiPool.filter(k=>k.lastUsedAt).length ? apiPool.filter(k=>k.lastUsedAt).slice(0,8).map(k=><span key={k.id}>{k.label}: {k.lastStatus || 'unknown'} · {new Date(k.lastUsedAt).toLocaleTimeString()}</span>) : <span>Chưa có key nào được dùng trong phiên này.</span>}</div></div></section>}
  </main></div>;
}
createRoot(document.getElementById('root')).render(<App />);
