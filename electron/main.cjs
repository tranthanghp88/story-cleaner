
// Intercept console.log to filter out old debug logs
const originalConsoleLog = console.log;
console.log = (...args) => {
  const msg = args.map(arg => {
    try {
      return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
    } catch {
      return String(arg);
    }
  }).join(' ');
  const blacklist = [
    '[Title Candidates]', '[Title Ranking]', '[Ranking Decision]', '[Metadata Extract]',
    '[Title Write]', '[Title Final]', '[Parser Input]', '[Parser Step 1]',
    '[Parser Step 2]', '[Parser Step 3]', '[Parser Step 4]', '[Parser Step 5]',
    '[Parser Final]', '[Title Decision]', '[Title Source]', '[Volume Header]',
    '[Title Cleanup]', '[Pipeline Trace]', '[IPC Send]', '[IPC Receive]',
    '[Chapter HTML]', '[Removed Nodes]', '[After DOM Extract]', '[Paragraph Before Extraction]',
    '[Paragraph After Extraction]', '[Paragraph After Normalize]', '[Paragraph Before UI]',
    '[Final Text]', '[Paragraph Stage', '[Reflow Call]', '[Sanitizer Removed]',
    '[Sanitizer Summary]'
  ];
  if (blacklist.some(prefix => msg.includes(prefix))) {
    return;
  }
  originalConsoleLog(...args);
};

const { app, BrowserWindow, ipcMain, Menu, nativeImage, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

const DEBUG_TITLE = false;
const DEBUG_TEXT = true;


const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5188';
const isDev = !app.isPackaged;
function resolveIconPath() {
  const candidates = [
    path.join(__dirname, '..', 'build', 'icon.ico'),
    path.join(process.resourcesPath || '', 'build', 'icon.ico'),
    path.join(process.resourcesPath || '', 'icon.ico'),
    path.join(__dirname, 'icon.ico')
  ];

  return candidates.find(file => {
    try {
      return file && fs.existsSync(file);
    } catch {
      return false;
    }
  }) || path.join(__dirname, '..', 'build', 'icon.ico');
}

const iconPath = resolveIconPath();

if (process.platform === 'win32') {
  app.setAppUserModelId('com.easy.storycleaner');
}

function getRendererIndexPath() {
  // Works in dev source, unpacked build, and packaged asar.
  const candidates = [
    path.join(app.getAppPath(), 'dist', 'index.html'),
    path.join(__dirname, '..', 'dist', 'index.html'),
    path.join(process.resourcesPath || '', 'app.asar', 'dist', 'index.html'),
    path.join(process.resourcesPath || '', 'dist', 'index.html')
  ];

  for (const file of candidates) {
    try {
      if (file && fs.existsSync(file)) return file;
    } catch {}
  }

  return path.join(app.getAppPath(), 'dist', 'index.html');
}

function createWindow() {
  Menu.setApplicationMenu(null);

  const windowIcon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined;

  const win = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    title: 'Story Cleaner',
    backgroundColor: '#f8fafc',
    icon: windowIcon || iconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    win.loadURL(DEV_URL);
  } else {
    const indexPath = getRendererIndexPath();
    win.loadFile(indexPath).catch(err => {
      console.error('[Story Cleaner] loadFile failed:', err, indexPath);
    });
  }

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[Story Cleaner] Renderer load failed:', {
      errorCode,
      errorDescription,
      validatedURL,
      isDev,
      appPath: app.getAppPath(),
      dirname: __dirname,
      resourcesPath: process.resourcesPath
    });
  });
}

const blacklistRegexes = [
  /Bạn đang đọc truyện mới tại/i,
  /Truyện được cập nhật liên tục/i,
  /Hãy nhớ hàng ngày vào đọc bạn nhé/i,
  /Bên khác copy sẽ thiếu nội dung/i,
  /Rất xin lỗi mọi người vì hiện quảng cáo/i,
  /Mong các bạn tiếp tục ủng hộ chúng mình/i
];

function removeBlacklistParagraphs(text) {
  if (!text) return '';
  const lines = text.split('\n');
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    return !blacklistRegexes.some(regex => regex.test(trimmed));
  });
  const result = [];
  for (const line of filteredLines) {
    if (line.trim() === '') {
      if (result.length > 0 && result[result.length - 1].trim() !== '') {
        result.push(line);
      }
    } else {
      result.push(line);
    }
  }
  return result.join('\n');
}

const ctaRegexes = [
  /Bạn đang đọc truyện mới tại/i,
  /Bạn đang đọc truyện tại/i,
  /Bạn đang đọc tại/i,
  /Truyện được cập nhật liên tục/i,
  /Truyện được dịch trực tiếp tại/i,
  /Truyện dịch trực tiếp tại/i,
  /Hãy nhớ hàng ngày vào đọc bạn nhé/i,
  /Bên khác copy sẽ thiếu nội dung/i,
  /Rất xin lỗi mọi người vì hiện quảng cáo/i,
  /Mong các bạn tiếp tục ủng hộ/i,
  /ủng hộ chúng mình/i,
  /ủng hộ team/i,
  /Chúc bạn đọc truyện vui vẻ/i,
  /dịch giả:/i,
  /editor:/i,
  /truyện được đăng tải duy nhất tại/i,
  /đọc truyện vui vẻ/i,
  /vào đọc bạn nhé/i,
  /thiếu nội dung chương đó/i,
  /vui lòng đọc tại/i
];

const footerRegexes = [
  /^(?:Nguồn|Nguon|Website|Website chính thức|Website chinh thuc|Theo dõi chúng tôi|Theo doi chung toi|Fanpage|Telegram|Discord|Facebook|Group|Group Facebook|Kênh|Kênh chính thức|Kenh chinh thuc)[:\-\s]/i,
  /^(?:Nguồn|Nguon|Website|Website chính thức|Website chinh thuc|Theo dõi chúng tôi|Theo doi chung toi|Fanpage|Telegram|Discord|Facebook|Group|Group Facebook)[:\s]/i,
  /^(?:Đọc truyện online tại|Doc truyen online tai|Truy cập để đọc|Truy cap de doc|Ghé thăm|Ghe tham|Truyện được cập nhật sớm nhất tại)[:\s]/i
];

function logSanitizerAction(reason, text) {
  const cleanText = text.trim();
  const logMsg = `\n[Sanitizer Removed]\n\nreason:\n${reason}\n\nremoved:\n${cleanText}\n`;
  console.log(logMsg);
  appendTitleDebugLog(logMsg);
}

function normalizeForComparison(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function getChapterInfo(line) {
  const numMatch = line.match(/(?:Chương|chuong|Chap|chap|Chapter|chapter|Tập|tap|Quyển|quyển)\s*(\d+(?:\.\d+)?)/i);
  if (!numMatch) return null;
  const num = parseFloat(numMatch[1]);
  
  const index = line.toLowerCase().indexOf(numMatch[0].toLowerCase());
  let titlePart = '';
  if (index !== -1) {
    titlePart = line.slice(index + numMatch[0].length).replace(/^[:\s\-–—\._]+/, '').trim();
  }
  return { num, titlePart };
}

function checkDuplicateTitles(lineA, lineB) {
  const infoA = getChapterInfo(lineA);
  const infoB = getChapterInfo(lineB);
  
  if (infoA && infoB && infoA.num === infoB.num) {
    const normA = normalizeForComparison(infoA.titlePart);
    const normB = normalizeForComparison(infoB.titlePart);
    
    if (normA === normB || (normA && normB && (normA.includes(normB) || normB.includes(normA)))) {
      const isANav = /home|trang chủ|trang chu|danh mục|danh muc/i.test(lineA);
      const isBNav = /home|trang chủ|trang chu|danh mục|danh muc/i.test(lineB);
      
      if (isANav && !isBNav) {
        return { keep: lineB, remove: lineA };
      } else if (isBNav && !isANav) {
        return { keep: lineA, remove: lineB };
      } else {
        if (lineA.length > lineB.length) {
          return { keep: lineB, remove: lineA };
        } else {
          return { keep: lineA, remove: lineB };
        }
      }
    }
  }
  return null;
}

function isNavigation(trimmed, bookTitle = '') {
  const lower = trimmed.toLowerCase();
  
  const shortNavTerms = [
    'danh mục', 'danh mục truyện', 'đọc truyện', 'đọc truyện online', 
    'chương trước', 'chương tiếp', 'chương sau', 'trở lại', 'mục lục',
    'báo lỗi', 'cài đặt', 'góp ý'
  ];
  if (shortNavTerms.includes(lower)) {
    return true;
  }
  
  if (
    (lower.includes('chương trước') || lower.includes('chương tiếp') || lower.includes('chương sau') || lower.includes('mục lục') || lower.includes('trang chủ') || lower.includes('danh mục')) &&
    (lower.includes('|') || lower.includes('-') || lower.includes('•') || lower.includes('·') || lower.includes('>') || lower.includes('<') || lower.includes('/') || lower.includes('\\') || lower.includes('»') || lower.includes('«'))
  ) {
    return true;
  }

  const breadcrumbKeywords = ['home', 'trang chủ', 'danh mục', 'đọc truyện', 'chương trước', 'chương tiếp', 'chương sau'];
  const hasKeyword = breadcrumbKeywords.some(kw => lower.includes(kw));
  const hasSeparator = />|»|«|<|\/|\||\\|•|·/.test(trimmed);
  if (hasKeyword && hasSeparator) {
    if (trimmed.length < 250) {
      return true;
    }
  }
  
  if (/^(home|trang chủ)\b/i.test(trimmed)) {
    if (lower.includes('chương') || lower.includes('tập') || lower.includes('quyển') || (bookTitle && lower.includes(bookTitle.toLowerCase()))) {
      if (trimmed.length < 250) {
        return true;
      }
    }
  }

  if (/^[><»«\s\-|\/\\•·]+$/.test(trimmed)) {
    return true;
  }

  return false;
}

function sanitizeContent(text, bookTitle = '') {
  if (!text) return '';
  const lines = text.split('\n');
  
  let removedBreadcrumbs = 0;
  let removedCTA = 0;
  let removedDuplicateTitles = 0;
  let removedFooterBlocks = 0;

  const lineObjects = lines.map(line => ({
    text: line,
    trimmed: line.trim(),
    removed: false,
    reason: ''
  }));

  // Pass 1: Duplicate Chapter Titles on consecutive non-empty lines
  for (let i = 0; i < lineObjects.length - 1; i++) {
    if (lineObjects[i].removed || !lineObjects[i].trimmed) {
      continue;
    }
    
    let nextIdx = -1;
    for (let j = i + 1; j < lineObjects.length; j++) {
      if (lineObjects[j].trimmed && !lineObjects[j].removed) {
        nextIdx = j;
        break;
      }
    }
    
    if (nextIdx === -1) {
      break;
    }
    
    const dupResult = checkDuplicateTitles(lineObjects[i].text, lineObjects[nextIdx].text);
    if (dupResult) {
      removedDuplicateTitles++;
      const removeIdx = (dupResult.remove === lineObjects[i].text) ? i : nextIdx;
      lineObjects[removeIdx].removed = true;
      lineObjects[removeIdx].reason = 'duplicate-title';
      logSanitizerAction('duplicate-title', dupResult.remove);
    }
  }

  // Pass 2: Navigation, CTA, and Footer on remaining non-empty lines
  for (let i = 0; i < lineObjects.length; i++) {
    const obj = lineObjects[i];
    if (obj.removed || !obj.trimmed) {
      continue;
    }

    if (isNavigation(obj.trimmed, bookTitle)) {
      removedBreadcrumbs++;
      obj.removed = true;
      obj.reason = 'breadcrumb';
      logSanitizerAction('breadcrumb', obj.text);
      continue;
    }

    if (ctaRegexes.some(rx => rx.test(obj.trimmed))) {
      removedCTA++;
      obj.removed = true;
      obj.reason = 'cta';
      logSanitizerAction('cta', obj.text);
      continue;
    }

    if (footerRegexes.some(rx => rx.test(obj.trimmed))) {
      removedFooterBlocks++;
      obj.removed = true;
      obj.reason = 'footer-block';
      logSanitizerAction('footer-block', obj.text);
      continue;
    }
  }

  const finalLines = [];
  for (const obj of lineObjects) {
    if (obj.removed) {
      continue;
    }
    finalLines.push(obj.text);
  }

  const finalParagraphCount = finalLines.filter(line => line.trim() !== '').length;
  
  const summaryMsg = `\n[Sanitizer Summary]\n\nremovedBreadcrumbs:\n${removedBreadcrumbs}\n\nremovedCTA:\n${removedCTA}\n\nremovedDuplicateTitles:\n${removedDuplicateTitles}\n\nremovedFooterBlocks:\n${removedFooterBlocks}\n\nfinalParagraphCount:\n${finalParagraphCount}\n`;
  console.log(summaryMsg);
  appendTitleDebugLog(summaryMsg);

  return finalLines.join('\n');
}

function normalizeText(text = '') {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function appendTitleDebugLog(message) {
  if (!DEBUG_TITLE) {
    const titleHeaders = [
      '[Parser Input]', '[Parser Step 1]', '[Parser Step 2]', '[Parser Step 3]',
      '[Parser Step 4]', '[Parser Step 5]', '[Parser Final]', '[Title Candidates]',
      '[Title Ranking]', '[Ranking Decision]', '[Title Decision]', '[Metadata Extract]',
      '[Title Write]', '[Title Final]', '[IPC Send]', '[IPC Receive]', '[BookTitle Write]'
    ];
    if (titleHeaders.some(h => message.trim().startsWith(h))) {
      return;
    }
  }
  if (!DEBUG_TEXT) {
    const textHeaders = [
      '[Chapter HTML]', '[Removed Nodes]', '[After DOM Extract]',
      '[Paragraph Before Extraction]', '[Paragraph After Extraction]',
      '[Paragraph After Normalize]', '[Paragraph Before UI]', '[Final Text]', '[Paragraph Stage]',
      '[Sanitizer Removed]', '[Sanitizer Summary]'
    ];
    if (textHeaders.some(h => message.trim().startsWith(h))) {
      return;
    }
  }

  try {
    let logDir = process.cwd();
    try {
      if (app && app.getPath) {
        logDir = app.getPath('userData');
      }
    } catch {}
    const logFilePath = path.join(logDir, 'title-debug.log');
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timestamp = `[${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}]`;
    const formattedEntry = `${timestamp}\n${message}\n\n`;
    fs.appendFileSync(logFilePath, formattedEntry, 'utf8');
    console.log(formattedEntry);
  } catch (err) {
    console.error('Failed to append to title-debug.log:', err);
  }
}

function logBackendStage(stageName, text) {
  if (!DEBUG_TEXT) return;
  const snippetFirst = text ? text.slice(0, 1000) : '';
  const snippetLast = text ? text.slice(-1000) : '';
  const len = text ? text.length : 0;
  const logMsg = `[${stageName}]\nlength: ${len}\nfirst 1000 chars:\n${snippetFirst}\nlast 1000 chars:\n${snippetLast}\n--------------------------------------------------`;
  console.log(logMsg);
  appendTitleDebugLog(logMsg);
}

function removeVietnameseTones(str) {
  if (typeof str !== 'string') return '';
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  str = str.replace(/Ỳ|Ý|Y|Ỷ|Ỹ/g, "Y");
  str = str.replace(/Đ/g, "D");
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeMetadataCompare(str) {
  if (!str) return '';
  let clean = str.replace(/[\*_`~]/g, '');
  clean = clean.toLowerCase();
  clean = removeVietnameseTones(clean);
  clean = clean.replace(/[^a-z0-9\s]/g, ' ');
  clean = clean.replace(/\s+/g, ' ').trim();
  return clean;
}

function isInvalidChapterTitle(chapterTitle, bookTitle, author) {
  const logInvalid = (reason) => {
    let invalidLog = `\n[isInvalidChapterTitle = true]\n`;
    invalidLog += `chapterTitle: "${chapterTitle || ''}"\n`;
    invalidLog += `bookTitle: "${bookTitle || ''}"\n`;
    invalidLog += `author: "${author || ''}"\n`;
    invalidLog += `reason: ${reason}\n`;
    console.log(invalidLog);
    appendTitleDebugLog(invalidLog);
  };

  if (!chapterTitle) {
    logInvalid('chapterTitle is empty/falsy');
    return true;
  }
  const normTitle = normalizeMetadataCompare(chapterTitle);
  if (!normTitle) {
    logInvalid('normalized title is empty');
    return true;
  }

  if (/^\d+$/.test(normTitle.replace(/\s+/g, ''))) {
    logInvalid('title is digits only');
    return true;
  }

  if (/(?:chuong|chap|chapter|tap|vol|volume|quyen|c)\s*(?:\d+|[ivxlcm]+)\b/i.test(normTitle)) {
    logInvalid('title contains chapter pattern only');
    return true;
  }

  const cleanedTitleWithoutChapter = normTitle
    .replace(/^(chuong|chapter|chap|tap|vol|volume|quyen|c)\s*(?:\d+|[ivxlcm]+)/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
  if (cleanedTitleWithoutChapter === '') {
    logInvalid('cleaned title without chapter prefix is empty');
    return true;
  }

  if (bookTitle && bookTitle !== 'Truyện đã dọn') {
    const normBook = normalizeMetadataCompare(bookTitle);
    if (normBook && normTitle.includes(normBook)) {
      logInvalid(`normalized title "${normTitle}" contains normalized bookTitle "${normBook}"`);
      return true;
    }
  }

  if (author) {
    const normAuthor = normalizeMetadataCompare(author);
    if (normAuthor && normTitle.includes(normAuthor)) {
      logInvalid(`normalized title "${normTitle}" contains normalized author "${normAuthor}"`);
      return true;
    }
  }

  return false;
}

function cleanTitlePart(titlePart) {
  if (!titlePart) return '';
  let clean = titlePart.trim();
  
  let prev;
  do {
    prev = clean;
    
    // Remove leading punctuation/formatting
    clean = clean.replace(/^[-_:\s\.\/\)\}\]]+/, '').trim();
    
    // Remove "Chương X:" or "Chương X -" or "Chương X" followed by separator/spaces/end
    clean = clean.replace(/^(?:chương|chuong|chapter|chap|c|tập|tap|vol|volume|quyển|quyen)\s*\d+(?:\.\d+)?(?:\s*[:\-\–\—\._\s]+|\s+|$)/i, '').trim();
    
    // Remove "X:" or "X -" or "X." followed by spaces or separator
    clean = clean.replace(/^\d+(?:\.\d+)?(?:\s*[:\-\–\—\._\s]+|\s+|$)/, '').trim();
    
    // Remove leading punctuation/formatting again
    clean = clean.replace(/^[-_:\s\.\/\)\}\]]+/, '').trim();
    
  } while (clean !== prev);
  
  return clean;
}

function parseBookAndAuthor(str) {
  if (!str) return null;
  const authorPattern1 = /(.*?)\s*\(\s*(?:tác giả|tac gia)\s*[:\-–—]?\s*(.*?)\)/i;
  const authorPattern2 = /(.*?)\s*[-–—|]\s*(?:tác giả|tac gia)\s*[:\-–—]?\s*(.*)/i;
  
  let match = str.match(authorPattern1);
  if (match) {
    return {
      bookTitle: match[1].trim(),
      author: match[2].trim()
    };
  }
  match = str.match(authorPattern2);
  if (match) {
    return {
      bookTitle: match[1].trim(),
      author: match[2].trim()
    };
  }
  return null;
}

function isValidAuthor(authorName) {
  if (!authorName) return false;
  const clean = authorName.toLowerCase();
  if (
    clean.includes('http') ||
    clean.includes('https') ||
    clean.includes('www') ||
    clean.includes('.com') ||
    clean.includes('.net') ||
    clean.includes('.me') ||
    clean.includes('/')
  ) {
    return false;
  }
  return true;
}

function isOgTitleOnlySEO(str) {
  if (!str) return false;
  const seoPattern = /^(.*?)\s*[-|–—_]\s*(?:chương|chuong|chapter|chap|tập|tap)\s*\d+(?:\.\d+)?\s*$/i;
  return seoPattern.test(str);
}

function parseMetadataFromTitleString(str, existingBookTitle) {
  if (!str) return null;
  
  const bookAndAuthor = parseBookAndAuthor(str);
  let searchStr = str;
  let parsedBook = '';
  let parsedAuthor = '';
  if (bookAndAuthor) {
    parsedBook = bookAndAuthor.bookTitle;
    parsedAuthor = bookAndAuthor.author;
    if (parsedAuthor && !isValidAuthor(parsedAuthor)) {
      parsedAuthor = '';
    }
    // Remove the author parenthesis or hyphen expression from str to keep the rest of the text
    searchStr = str.replace(/\(\s*(?:tác giả|tac gia)\s*[:\-–—]?\s*(.*?)\)/i, '');
    searchStr = searchStr.replace(/[-–—|]\s*(?:tác giả|tac gia)\s*[:\-–—]?\s*(.*)/i, '');
    searchStr = searchStr.trim();
  }

  const parts = searchStr.split(/\s*[\-\|\_\–\—•/\\\u2013\u2014]\s*/);
  const segments = parts.map(p => p.trim()).filter(Boolean);
  
  const detailRegex = /(?:Chương|chuong|Chap|chap|Chapter|chapter|Tập|tap)\s*(\d+(?:\.\d+)?)(?:\s*[\:\-\–\—\._\s]|\s+)?(.*)$/i;

  const processed = segments.map(seg => {
    const match = seg.match(detailRegex);
    if (match) {
      const num = parseFloat(match[1]);
      const titlePart = cleanTitlePart(match[2]);
      return {
        raw: seg,
        hasChapter: true,
        chapterNumber: num,
        chapterTitle: titlePart
      };
    } else {
      return {
        raw: seg,
        hasChapter: false,
        chapterNumber: null,
        chapterTitle: seg
      };
    }
  });

  const chapSegs = processed.filter(p => p.hasChapter);
  const nonChapSegs = processed.filter(p => !p.hasChapter);

  let result = null;

  // generic title check inside parsing context to prevent overrides
  const bookTitleCleanParam = existingBookTitle && existingBookTitle !== 'Truyện đã dọn' && !/^Truyện\s*\d+$/i.test(existingBookTitle) ? existingBookTitle : '';

  if (chapSegs.length === 0) {
    const wholeMatch = searchStr.match(detailRegex);
    if (wholeMatch) {
      const num = parseFloat(wholeMatch[1]);
      const titlePart = cleanTitlePart(wholeMatch[2]);
      result = {
        bookTitle: parsedBook || bookTitleCleanParam || '',
        author: parsedAuthor || '',
        chapterNumber: num,
        chapterTitle: titlePart
      };
    }
  } else {
    let bookTitle = parsedBook || bookTitleCleanParam;
    let author = parsedAuthor || '';
    let chapterNumber = chapSegs[0].chapterNumber;
    let chapterTitle = '';

    if (chapSegs.length === 1) {
      const chapSeg = chapSegs[0];
      chapterNumber = chapSeg.chapterNumber;
      let remaining = chapSeg.chapterTitle;

      if (nonChapSegs.length === 0) {
        chapterTitle = remaining;
      } else if (nonChapSegs.length === 1) {
        const other = nonChapSegs[0].raw;
        const normRemaining = normalizeMetadataCompare(remaining);
        const normBook = normalizeMetadataCompare(bookTitle);
        const normOther = normalizeMetadataCompare(other);

        if (bookTitle && normRemaining === normBook) {
          if (!author) author = other;
          chapterTitle = '';
        } else if (bookTitle && normOther === normBook) {
          chapterTitle = remaining;
        } else {
          if (bookTitle) {
            chapterTitle = remaining;
          } else {
            if (remaining.length >= other.length) {
              bookTitle = bookTitle || remaining;
              if (!author) author = other;
              chapterTitle = '';
            } else {
              bookTitle = bookTitle || other;
              chapterTitle = remaining;
            }
          }
        }
      } else {
        bookTitle = bookTitle || nonChapSegs[0].raw;
        if (!author) author = nonChapSegs[1].raw;
        chapterTitle = remaining;
      }
    } else {
      let bookSeg = chapSegs[0];
      let chapSeg = chapSegs[chapSegs.length - 1];

      if (bookTitle) {
        const normBook = normalizeMetadataCompare(bookTitle);
        for (const seg of chapSegs) {
          if (normalizeMetadataCompare(seg.chapterTitle) === normBook) {
            bookSeg = seg;
            break;
          }
        }
        const remainingChapSegs = chapSegs.filter(s => s !== bookSeg);
        if (remainingChapSegs.length > 0) {
          chapSeg = remainingChapSegs[remainingChapSegs.length - 1];
        }
      } else {
        bookTitle = bookSeg.chapterTitle;
      }

      chapterNumber = chapSeg.chapterNumber;
      chapterTitle = chapSeg.chapterTitle;

      if (nonChapSegs.length > 0 && !author) {
        author = nonChapSegs[0].raw;
      }
    }

    if (author && !isValidAuthor(author)) {
      author = '';
    }

    result = {
      bookTitle: bookTitle.trim(),
      author: author.trim(),
      chapterNumber,
      chapterTitle: chapterTitle.trim()
    };
  }

  return result;
}

function extractChapterMetadata(html, url, existingBookTitle) {
  const $ = cheerio.load(html);
  const bookTitleClean = (existingBookTitle && existingBookTitle !== 'Truyện đã dọn') ? existingBookTitle.trim() : '';

  let bookTitle = bookTitleClean;
  let author = '';
  let chapterNumber = null;
  let chapterTitle = '';
  let volume = '';

  const extractVolumeFromText = (text) => {
    if (!text) return '';
    const match = text.match(/(?:Tập|Vol|Volume|Quyển|T[ậ]p)\s*(\d+)/i);
    return match ? `Tập ${match[1]}` : '';
  };

  const mergeMetadata = (meta) => {
    if (!meta) return;
    if (meta.bookTitle) {
      const trimmedBook = meta.bookTitle.trim();
      const isGeneric = !bookTitle || bookTitle === 'Truyện đã dọn' || /^Truyện\s*\d+$/i.test(bookTitle);
      if (isGeneric && trimmedBook) {
        bookTitle = trimmedBook;
      }
    }
    if (meta.author) {
      const trimmedAuthor = meta.author.trim();
      if (isValidAuthor(trimmedAuthor) && !author) {
        author = trimmedAuthor;
      }
    }
    if (meta.chapterNumber !== null && meta.chapterNumber !== undefined && chapterNumber === null) {
      chapterNumber = meta.chapterNumber;
    }
    if (meta.chapterTitle && !chapterTitle) {
      const before = chapterTitle;
      chapterTitle = meta.chapterTitle.trim();
      const err = new Error();
      const stack = err.stack || '';
      let writeLog = '\n[Title Write]\n';
      writeLog += `before: ${before || ''}\n`;
      writeLog += `after: ${chapterTitle || ''}\n`;
      writeLog += `source: mergeMetadata\n`;
      writeLog += `stack:\n${stack}\n`;
      appendTitleDebugLog(writeLog);
    }
  };

  const h1Candidates = [];
  $('h1').each((_, el) => {
    const t = $(el).text().trim();
    if (t) h1Candidates.push({ source: 'h1', rawText: t, score: 95 });
  });

  const h2Candidates = [];
  $('h2').each((_, el) => {
    const t = $(el).text().trim();
    if (t) h2Candidates.push({ source: 'h2', rawText: t, score: 90 });
  });

  const selCandidates = [];
  const priority1Selectors = ['.chapter-title', '.chapter-header', '.chapter-name', '.entry-title', '.post-title', '.read-title'];
  priority1Selectors.forEach(sel => {
    $(sel).each((_, el) => {
      const t = $(el).text().trim();
      if (t) selCandidates.push({ source: sel, rawText: t, score: 80 });
    });
  });

  const articleCandidates = [];
  $('article h1, article h2, main h1, main h2, #chapter-content h1, #chapter-content h2, .chapter-content h1, .chapter-content h2').each((_, el) => {
    const t = $(el).text().trim();
    if (t) articleCandidates.push({ source: 'article heading', rawText: t, score: 70 });
  });

  const breadcrumbCandidates = [];
  const breadcrumbs = $('.breadcrumb a, .breadcrumbs a, .crumb a, ul.breadcrumbs li a, [class*="breadcrumb"] a');
  let breadcrumbBookTitle = '';
  if (breadcrumbs.length >= 2) {
    const breadcrumbTexts = [];
    breadcrumbs.each((_, el) => {
      breadcrumbTexts.push($(el).text().trim());
    });
    for (let i = breadcrumbTexts.length - 1; i >= 0; i--) {
      const txt = breadcrumbTexts[i];
      if (txt && !/(?:Chương|chuong|Chap|chap|Chapter|chapter|Tập|tap)\s*(\d+(?:\.\d+)?)/i.test(txt) && !/trang chủ|home/i.test(txt)) {
        breadcrumbBookTitle = txt;
        break;
      }
    }
  }
  const breadcrumbContainer = $('.breadcrumb, .breadcrumbs, .crumb, ul.breadcrumbs, [class*="breadcrumb"]').first();
  if (breadcrumbContainer.length > 0) {
    const text = breadcrumbContainer.text().trim();
    if (text) {
      breadcrumbCandidates.push({ source: 'breadcrumb chapter node', rawText: text, score: 60 });
    }
  }

  const ogTitleCandidates = [];
  const ogTitle = $('meta[property="og:title"]').attr('content') || '';
  if (ogTitle) {
    ogTitleCandidates.push({ source: 'og:title', rawText: ogTitle, score: 50 });
  }

  const docTitleCandidates = [];
  const docTitle = $('title').first().text().trim();
  if (docTitle) {
    docTitleCandidates.push({ source: 'document.title', rawText: docTitle, score: 40 });
  }

  const ogBookTitle = $('meta[property="og:novel:book_name"]').attr('content') ||
                      $('meta[property="og:book_name"]').attr('content') ||
                      $('meta[property="novel:book_name"]').attr('content') || '';
  
  const ogAuthor = $('meta[property="og:novel:author"]').attr('content') ||
                   $('meta[property="og:author"]').attr('content') ||
                   $('meta[property="novel:author"]').attr('content') ||
                   $('meta[name="author"]').attr('content') ||
                   $('meta[property="book:author"]').attr('content') || '';

  let h12Book = '';
  let h12Author = '';
  [...h1Candidates, ...h2Candidates].forEach(c => {
    const parsed = parseBookAndAuthor(c.rawText);
    if (parsed) {
      if (parsed.bookTitle) h12Book = parsed.bookTitle;
      if (parsed.author) h12Author = parsed.author;
    }
  });

  let resolvedBookTitle = bookTitleClean;
  if (!resolvedBookTitle || resolvedBookTitle === 'Truyện đã dọn' || /^Truyện\s*\d+$/i.test(resolvedBookTitle)) {
    resolvedBookTitle = h12Book || ogBookTitle || breadcrumbBookTitle || '';
  }

  const allChapterCandidates = [
    ...h1Candidates,
    ...h2Candidates,
    ...selCandidates,
    ...articleCandidates,
    ...breadcrumbCandidates,
    ...ogTitleCandidates,
    ...docTitleCandidates
  ];

  const processedCands = allChapterCandidates.map(c => {
    const parsed = parseMetadataFromTitleString(c.rawText, resolvedBookTitle);
    return { ...c, parsed };
  }).filter(c => c.parsed && c.parsed.chapterNumber !== null);

  const hasChapterPattern = (text) => {
    if (!text) return false;
    return /(?:chương|chuong|chapter|chap|tập|tap|vol|volume|quyển|quyen)\s*\d+/i.test(text);
  };

  const priority1to5HasChapter = processedCands.some(c => 
    c.score >= 60 && 
    c.parsed && 
    c.parsed.chapterNumber !== null && 
    hasChapterPattern(c.rawText)
  );

  const filteredCands = processedCands.map(c => {
    if (priority1to5HasChapter && c.score < 60) {
      return {
        ...c,
        parsed: {
          ...c.parsed,
          chapterNumber: null,
          chapterTitle: ''
        }
      };
    }
    return c;
  });

  const activeChapterCands = filteredCands.filter(c => c.parsed && c.parsed.chapterNumber !== null);
  activeChapterCands.sort((a, b) => {
    const aIsH2Chapter = a.source === 'h2' && /(?:Chương|chuong|Chap|chap|Chapter|chapter|Tập|tap)\s*\d+/i.test(a.rawText);
    const bIsH2Chapter = b.source === 'h2' && /(?:Chương|chuong|Chap|chap|Chapter|chapter|Tập|tap)\s*\d+/i.test(b.rawText);

    if (aIsH2Chapter && b.source === 'og:title') return -1;
    if (bIsH2Chapter && a.source === 'og:title') return 1;
    if (aIsH2Chapter && b.source === 'document.title') return -1;
    if (bIsH2Chapter && a.source === 'document.title') return 1;

    return b.score - a.score;
  });

  let acceptedSource = 'none';
  let acceptedValue = '';
  let highestScoreChapterCand = null;

  let rankingLog = '[Title Ranking]\n';
  activeChapterCands.forEach((c, idx) => {
    let accepted = false;
    let reason = '';
    if (idx === 0) {
      accepted = true;
      reason = 'Highest rank';
    } else {
      const best = activeChapterCands[0];
      accepted = false;
      reason = `Skipped: Lower rank than ${best.source}`;
    }
    rankingLog += `candidate: ${c.source}\nscore: ${c.score}\naccepted: ${accepted}\nreason: ${reason}\n\n`;

    if (accepted) {
      highestScoreChapterCand = c;
    }
  });
  console.log(rankingLog.trim());
  appendTitleDebugLog(rankingLog.trim());

  if (activeChapterCands.length > 0) {
    const winner = activeChapterCands[0];
    const losers = activeChapterCands.slice(1);
    const loserStr = losers.map(l => l.source).join(', ') || 'none';
    
    let reasonText = `Score of winner (${winner.score}) >= losers.`;
    const winnerIsH2Chapter = winner.source === 'h2' && /(?:Chương|chuong|Chap|chap|Chapter|chapter|Tập|tap)\s*\d+/i.test(winner.rawText);
    if (winnerIsH2Chapter && losers.some(l => l.source === 'og:title' || l.source === 'document.title')) {
      reasonText = `h2 containing chapter heading prioritised over SEO titles.`;
    }

    let rankingDecisionLog = '[Ranking Decision]\n\n';
    rankingDecisionLog += `winner:\n${winner.source}\n\n`;
    rankingDecisionLog += `loser:\n${loserStr}\n\n`;
    rankingDecisionLog += `reason:\n${reasonText}`;
    
    console.log(rankingDecisionLog);
    appendTitleDebugLog(rankingDecisionLog);
  }

  if (highestScoreChapterCand) {
    acceptedSource = highestScoreChapterCand.source;
    acceptedValue = highestScoreChapterCand.rawText;
    
    let finalChapterTitle = highestScoreChapterCand.parsed.chapterTitle || '';
    if (highestScoreChapterCand.source === 'og:title' && isOgTitleOnlySEO(highestScoreChapterCand.rawText)) {
      finalChapterTitle = '';
    }
    
    mergeMetadata({
      ...highestScoreChapterCand.parsed,
      chapterTitle: finalChapterTitle
    });
    if (!volume) volume = extractVolumeFromText(highestScoreChapterCand.rawText);
  }

  if (h12Book) mergeMetadata({ bookTitle: h12Book });
  if (h12Author) mergeMetadata({ author: h12Author });
  if (ogBookTitle) mergeMetadata({ bookTitle: ogBookTitle });
  if (ogAuthor) mergeMetadata({ author: ogAuthor });
  if (breadcrumbBookTitle) mergeMetadata({ bookTitle: breadcrumbBookTitle });

  const metaAuthor = $('.author, .post-author, .tac-gia, a[href*="tac-gia"], a[href*="author"]').first().text().trim().replace(/^(tác giả|tac gia|author|by)\s*[:\-–—]?\s*/i, '').trim();
  if (metaAuthor) mergeMetadata({ author: metaAuthor });

  if (!isValidAuthor(author)) {
    author = '';
  }

  let candidatesLog = '[Title Candidates]\n';
  candidatesLog += `document.title: ${docTitle || ''}\n`;
  candidatesLog += `og:title: ${ogTitle || ''}\n`;
  candidatesLog += `og:novel:book_name: ${ogBookTitle || ''}\n`;
  candidatesLog += `og:novel:author: ${ogAuthor || ''}\n`;
  candidatesLog += `h1: ${h1Candidates.map(c => c.rawText).join(' | ')}\n`;
  candidatesLog += `h2: ${h2Candidates.map(c => c.rawText).join(' | ')}\n`;
  candidatesLog += `breadcrumb: ${breadcrumbBookTitle || ''}\n`;
  candidatesLog += `selectedSource: ${acceptedSource}\n`;
  candidatesLog += `selectedValue: ${acceptedValue}`;
  console.log(candidatesLog);
  appendTitleDebugLog(candidatesLog);

  let chapterSource = acceptedSource;
  let bookSource = 'none';
  let authorSource = 'none';

  if (bookTitle) {
    if (ogBookTitle && bookTitle === ogBookTitle) bookSource = 'og:novel:book_name';
    else if (h12Book && bookTitle === h12Book) bookSource = 'h1/h2 parsing';
    else if (breadcrumbBookTitle && bookTitle === breadcrumbBookTitle) bookSource = 'breadcrumb';
    else bookSource = acceptedSource;
  }
  if (author) {
    if (ogAuthor && author === ogAuthor) authorSource = 'og:novel:author';
    else if (h12Author && author === h12Author) authorSource = 'h1/h2 parsing';
    else if (metaAuthor && author === metaAuthor) authorSource = 'metadata selector';
    else authorSource = acceptedSource;
  }

  let decisionReason = '';
  if (priority1to5HasChapter) {
    decisionReason = `Valid chapter heading found (source: ${chapterSource}). SEO titles ignored.`;
  } else if (chapterSource !== 'none') {
    decisionReason = `No chapter heading found. Fallback to SEO title (source: ${chapterSource}).`;
  } else {
    decisionReason = 'No chapter number detected.';
  }

  let decisionLog = '[Title Decision]\n';
  decisionLog += `chapterSource: ${chapterSource}\n`;
  decisionLog += `bookSource: ${bookSource}\n`;
  decisionLog += `authorSource: ${authorSource}\n`;
  decisionLog += `decisionReason: ${decisionReason}`;
  console.log(decisionLog);
  appendTitleDebugLog(decisionLog);

  let finalConfidence = 0.0;
  if (acceptedSource === 'h1' || acceptedSource === 'h2') {
    finalConfidence = 0.95;
  } else if (acceptedSource === 'document.title') {
    finalConfidence = 0.60;
  } else if (acceptedSource !== 'none') {
    finalConfidence = 0.85;
  }

  return finalizeMetadata(finalConfidence, acceptedSource, acceptedValue);

  function finalizeMetadata(confidence, source, rawTitle) {
    let finalChapterTitle = chapterTitle || '';
    if (isInvalidChapterTitle(finalChapterTitle, bookTitle || bookTitleClean, author)) {
      finalChapterTitle = '';
    }
    logMetadata(source, confidence, rawTitle);
    return {
      bookTitle: (bookTitle || bookTitleClean || '').trim(),
      author: (author || '').trim(),
      chapterNumber,
      chapterTitle: finalChapterTitle.trim(),
      confidence: confidence || 0.0,
      source: source || 'none',
      volume: volume || '',
      rawTitle: rawTitle || ''
    };
  }

  function logMetadata(source, confidence, rawTitle) {
    let finalChapterTitle = chapterTitle || '';
    if (isInvalidChapterTitle(finalChapterTitle, bookTitle || bookTitleClean, author)) {
      finalChapterTitle = '';
    }
    let extractLog = '[Metadata Extract]\n';
    extractLog += `rawTitle: ${rawTitle || ''}\n`;
    extractLog += `source: ${source || 'none'}\n`;
    extractLog += `bookTitle: ${bookTitle || bookTitleClean || ''}\n`;
    extractLog += `author: ${author || ''}\n`;
    extractLog += `chapterNumber: ${chapterNumber !== null ? chapterNumber : ''}\n`;
    extractLog += `chapterTitle: ${finalChapterTitle}\n`;
    extractLog += `confidence: ${confidence !== undefined ? confidence : 0.0}`;
    console.log(extractLog);
    appendTitleDebugLog(extractLog);
  }
}

function getPreservedText($, element) {
  if (!element) return '';
  const clone = $(element).clone();
  clone.find('br, p, div, li, tr, h1, h2, h3, h4, h5, h6').before('\n').after('\n');
  return clone.text();
}

function extractWithCheerio(html, url) {
  const $ = cheerio.load(html);
  
  const removedElements = [];
  $('script, style, noscript, iframe, svg, canvas, form, button, input, select, textarea, nav, footer, header, aside, .ads, .advert, .advertisement, .banner, .comment, .comments, #comments, .share, .social, .related, .notice, .warning, .alert, .ad-container, .ads-wrapper').each((_, el) => {
    const $el = $(el);
    const tagName = el.tagName ? el.tagName.toLowerCase() : '';
    const className = $el.attr('class') ? '.' + $el.attr('class').split(/\s+/).join('.') : '';
    const idName = $el.attr('id') ? '#' + $el.attr('id') : '';
    removedElements.push(`${tagName}${idName}${className}`);
  });
  if (removedElements.length > 0) {
    logBackendStage('Removed Nodes', removedElements.join(', '));
  } else {
    logBackendStage('Removed Nodes', '(none)');
  }

  $('script, style, noscript, iframe, svg, canvas, form, button, input, select, textarea, nav, footer, header, aside, .ads, .advert, .advertisement, .banner, .comment, .comments, #comments, .share, .social, .related, .notice, .warning, .alert, .ad-container, .ads-wrapper').remove();

  const title =
    $('h1').first().text().trim() ||
    $('.chapter-title').first().text().trim() ||
    $('.entry-title').first().text().trim() ||
    $('title').first().text().trim() ||
    'Chương mới';

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

  if (!best || best.length < 300) {
    const bodyText = normalizeText(getPreservedText($, $('body').first()));
    if (bodyText.length > best.length) {
      best = bodyText;
      bestSelector = 'body-fallback';
    }
  }

  // Node Scan for CTA Nodes
  if (bestSelector) {
    const container = bestSelector === 'body-fallback' ? $('body').first() : $(bestSelector).first();
    const outerHTML = $.html(container) || '';
    
    let contentSourceLog = `[Content Source]\n`;
    contentSourceLog += `selector: ${bestSelector}\n\n`;
    contentSourceLog += `outerHTML:\n${outerHTML.slice(0, 2000)}\n`;
    contentSourceLog += `--------------------------------------------------`;
    console.log(contentSourceLog);
    appendTitleDebugLog(contentSourceLog);

    container.find('*').each((_, el) => {
      const $el = $(el);
      const text = $el.text();
      const lowerText = text.toLowerCase();
      const targets = ["rất xin lỗi mọi người", "ủng hộ chúng mình", "nhớ tên miền này"];
      const hasMatch = targets.some(target => lowerText.includes(target));
      if (hasMatch) {
        const tagName = el.tagName ? el.tagName.toLowerCase() : '';
        const className = $el.attr('class') || '';
        const idName = $el.attr('id') || '';
        const textPreview = text.slice(0, 200).trim();
        
        let scanLog = `[Node Scan]\ntag: ${tagName}\nclass: ${className}\nid: ${idName}\ntext preview: ${textPreview}\n--------------------------------------------------`;
        console.log(scanLog);
        appendTitleDebugLog(scanLog);
        
        const outerHTMLNode = $.html(el) || '';
        const outerHTMLPreview = outerHTMLNode.slice(0, 2000);
        
        let ctaLog = `[CTA Candidate]\ntag: ${tagName}\nclass: ${className}\nid: ${idName}\ntext:\n${text}\nouterHTML:\n${outerHTMLPreview}\n--------------------------------------------------`;
        console.log(ctaLog);
        appendTitleDebugLog(ctaLog);
      }
    });
  }

  return { title, text: best, selector: bestSelector, url };
}

async function extractWithReadability(html, url) {
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  if (!article) return null;

  if (article.content) {
    let contentSourceLog = `[Content Source]\n`;
    contentSourceLog += `selector: readability\n\n`;
    contentSourceLog += `outerHTML:\n${article.content.slice(0, 2000)}\n`;
    contentSourceLog += `--------------------------------------------------`;
    console.log(contentSourceLog);
    appendTitleDebugLog(contentSourceLog);
  }

  return {
    title: article.title || 'Chương mới',
    text: normalizeText(article.textContent || ''),
    selector: 'readability',
    url
  };
}

async function fetchWithOffscreenBrowser(url) {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  try {
    await win.loadURL(url);
    const maxWaitMs = 8000;
    const pollIntervalMs = 500;
    const startTime = Date.now();
    let html = '';

    while (Date.now() - startTime < maxWaitMs) {
      const state = await win.webContents.executeJavaScript(`
        (() => {
          const bodyText = document.body ? document.body.innerText : '';
          const article = document.querySelector('article');
          const articleText = article ? article.innerText : '';
          
          const chapterSelectors = ['.chapter-content', '.story-content', '.reading-content', '#chapter-content', '#content', '.prose', '.markdown'];
          let maxSelectorLen = 0;
          for (const sel of chapterSelectors) {
            const el = document.querySelector(sel);
            if (el && el.innerText && el.innerText.length > maxSelectorLen) {
              maxSelectorLen = el.innerText.length;
            }
          }

          const hasContent = articleText.length > 500 || maxSelectorLen > 500 || bodyText.length > 1500;
          return {
            hasContent,
            html: document.documentElement.outerHTML
          };
        })()
      `).catch(() => ({ hasContent: false, html: '' }));

      if (state.html) {
        html = state.html;
      }
      if (state.hasContent) {
        break;
      }
      await new Promise(r => setTimeout(r, pollIntervalMs));
    }
    return html;
  } finally {
    win.close();
  }
}

function parseNextChapterUrl(html, url, chapterNumber) {
  if (!html) return '';
  try {
    const $ = cheerio.load(html);
    const candidates = [];
    const resolveUrl = (relativeOrAbsoluteUrl, baseUrl) => {
      try {
        return new URL(relativeOrAbsoluteUrl, baseUrl).href;
      } catch (e) {
        return relativeOrAbsoluteUrl;
      }
    };

    $('a').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      if (!href || href.startsWith('javascript:') || href.startsWith('#')) return;
      
      const text = $el.text().trim();
      const textLower = text.toLowerCase();
      const rel = $el.attr('rel') || '';
      const relLower = rel.toLowerCase();
      const className = $el.attr('class') || '';
      const classLower = className.toLowerCase();
      const id = $el.attr('id') || '';
      const idLower = id.toLowerCase();
      
      let score = 0;
      
      if (classLower.includes('next') || idLower.includes('next')) {
        score += 50;
      }
      if (relLower.includes('next')) {
        score += 40;
      }
      if (textLower === 'chương tiếp' || textLower === 'next' || textLower === 'chương tiếp 》' || textLower === 'chương sau' || textLower === 'tiếp') {
        score += 100;
      } else if (textLower.includes('chương tiếp') || textLower.includes('next') || textLower.includes('chương sau')) {
        score += 80;
      } else if (textLower.includes('tiếp') && !textLower.includes('tiếp tục') && !textLower.includes('trước')) {
        score += 30;
      } else if (textLower === '›' || textLower === '»') {
        score += 60;
      }
      
      if (textLower.includes('trước') || textLower.includes('prev') || textLower.includes('back') || classLower.includes('prev') || classLower.includes('back') || idLower.includes('prev') || idLower.includes('back')) {
        score -= 150;
      }
      
      if (chapterNumber !== null && chapterNumber !== undefined) {
        const nextNum = chapterNumber + 1;
        const targetPattern = new RegExp(`[-_](?:chuong|chapter|chap|vol|tap|c)(?:-|_)?${nextNum}(?:[-_]|$)`, 'i');
        if (targetPattern.test(href)) {
          score += 120;
        }
      }
      
      if (score > 0) {
        candidates.push({
          text,
          href,
          resolvedUrl: resolveUrl(href, url),
          class: className,
          id,
          rel,
          score
        });
      }
    });

    candidates.sort((a, b) => b.score - a.score);
    let nextUrl = '';
    if (candidates.length > 0 && candidates[0].score >= 20) {
      nextUrl = candidates[0].resolvedUrl;
    }

    const selectedNextUrl = nextUrl || '';
    let parseNextUrlLog = '';
    if (selectedNextUrl) {
      parseNextUrlLog = `[PARSE_NEXT_URL]
candidateCount: ${candidates.length}
candidates: ${JSON.stringify(candidates.slice(0, 5).map(c => ({ text: c.text, href: c.href, score: c.score })))}
selectedNextUrl: ${selectedNextUrl}
status: pass`;
    } else {
      parseNextUrlLog = `[PARSE_NEXT_URL]
candidateCount: ${candidates.length}
candidates: ${JSON.stringify(candidates.slice(0, 5).map(c => ({ text: c.text, href: c.href, score: c.score })))}
selectedNextUrl: `;
    }

    console.log(parseNextUrlLog);
    if (typeof appendTitleDebugLog === 'function') {
      appendTitleDebugLog(parseNextUrlLog + '\n--------------------------------------------------');
    }

    return nextUrl;
  } catch (err) {
    console.error('Error in parseNextChapterUrl:', err);
    return '';
  }
}

ipcMain.handle('story:fetch-chapter', async (_, url, bookTitle) => {
  if (!url || !/^https?:\/\//i.test(url)) {
    return { ok: false, error: 'Link không hợp lệ. Link cần bắt đầu bằng http:// hoặc https://.' };
  }

  try {
    let html = '';

    // Fast path: HonTruyen API
    if (url.includes('hontruyen.com')) {
      const match = url.match(/hontruyen\.com\/(?:[a-z]{2}\/)?story\/([^\/]+)\/chap\/(\d+)/i);
      if (match) {
        try {
          const apiRes = await axios.get(`https://hontruyen.com/api/chapter/story/slug/${match[1]}/${match[2]}`, {
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36',
              'Accept': 'application/json, text/plain, */*'
            }
          });
          if (apiRes.data && apiRes.data.data) {
            const chapData = apiRes.data.data;
            const text = (chapData.paragraphs || []).map(p => p.content || '').join('\n\n');
            const finalTitle = chapData.title || `Chương ${chapData.chap_number}`;
            const parsedMeta = parseMetadataFromTitleString(finalTitle, chapData.story_name || bookTitle);
            
            return {
              ok: true,
              title: finalTitle,
              text: sanitizeContent(normalizeText(text), chapData.story_name || bookTitle),
              rawHtmlSnippet: '(HonTruyen API used)',
              selector: 'hontruyen-api',
              url,
              bookTitle: chapData.story_name || bookTitle,
              author: '',
              chapterNumber: chapData.chap_number,
              chapterTitle: parsedMeta.chapterTitle || '',
              confidence: 0.95,
              source: 'hontruyen-api',
              volume: '',
              rawTitle: finalTitle
            };
          }
        } catch (apiErr) {
          console.warn('HonTruyen API fast-path failed, falling back:', apiErr.message);
        }
      }
    }

    // Axios Fetch
    try {
      const res = await axios.get(url, {
        timeout: 25000,
        maxRedirects: 5,
        responseType: 'text',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8'
        }
      });
      html = String(res.data || '');
    } catch (axiosErr) {
      console.warn('Axios fetch failed, falling back to offscreen browser:', axiosErr.message);
    }

    if (html) {
      logBackendStage('Chapter HTML', html);
    }

    let a = extractWithCheerio(html, url);
    let b = await extractWithReadability(html, url).catch(() => null);
    let best;
    const hasValidCheerioSelector = a.selector && a.selector !== 'body-fallback' && a.text && a.text.length >= 300;
    if (hasValidCheerioSelector) {
      best = a;
    } else {
      best = b && b.text.length > a.text.length * 0.65 ? b : a;
    }

    // Fallback if no content extracted or if content is generic landing page text
    const isGenericText = (txt) => {
      if (!txt) return true;
      if (txt.length < 150) return true;
      const lower = txt.toLowerCase();
      if (txt.length < 800 && (lower.includes('slogan') || lower.includes('zalo') || lower.includes('kho truyện') || lower.includes('chào mừng'))) {
        return true;
      }
      return false;
    };

    if (isGenericText(best.text)) {
      console.log('No content or generic text detected. Launching offscreen browser...');
      html = await fetchWithOffscreenBrowser(url);
      if (html) {
        logBackendStage('Chapter HTML (offscreen browser)', html);
      }
      a = extractWithCheerio(html, url);
      b = await extractWithReadability(html, url).catch(() => null);
      const hasValidCheerioSelectorFallback = a.selector && a.selector !== 'body-fallback' && a.text && a.text.length >= 300;
      if (hasValidCheerioSelectorFallback) {
        best = a;
      } else {
        best = b && b.text.length > a.text.length * 0.65 ? b : a;
      }
    }

    best.text = removeBlacklistParagraphs(best.text);
    best.text = sanitizeContent(best.text, bookTitle);

    logBackendStage('After DOM Extract', best.text);

    if (!best.text || best.text.length < 80) {
      return { ok: false, error: 'Đã tải được trang nhưng không nhận diện được nội dung chương. Có thể web chặn hoặc nội dung render bằng JavaScript.' };
    }

    const metadata = extractChapterMetadata(html, url, bookTitle);
    const nextUrl = parseNextChapterUrl(html, url, metadata.chapterNumber);

    let standardizedTitle = '';
    if (metadata.chapterNumber !== null && metadata.chapterNumber !== undefined) {
      if (metadata.chapterTitle) {
        standardizedTitle = `Chương ${metadata.chapterNumber}: ${metadata.chapterTitle}`;
      } else {
        standardizedTitle = `Chương ${metadata.chapterNumber}`;
      }
    } else {
      standardizedTitle = best.title || 'Chương mới';
    }

    // Search for 'uốn', 'muốn', 'máuốn' or entity variations in raw HTML for debugging
    let rawHtmlSnippet = '';
    const htmlLower = html.toLowerCase();
    const targets = ['muốn', 'máuốn', 'uốn', '&#7889;', '&#x1ed1;', '&ocirc;'];
    for (const t of targets) {
      const idx = htmlLower.indexOf(t);
      if (idx !== -1) {
        rawHtmlSnippet = '...' + html.substring(Math.max(0, idx - 60), Math.min(html.length, idx + 60)).replace(/\s+/g, ' ') + '...';
        break;
      }
    }

    const payload = {
      ok: true,
      title: standardizedTitle,
      text: best.text,
      rawHtmlSnippet,
      selector: best.selector,
      url,
      bookTitle: metadata.bookTitle,
      author: metadata.author,
      chapterNumber: metadata.chapterNumber,
      chapterTitle: metadata.chapterTitle,
      confidence: metadata.confidence,
      source: metadata.source,
      volume: metadata.volume,
      rawTitle: metadata.rawTitle,
      htmlLength: html.length,
      nextUrl: nextUrl
    };

    let ipcSendLog = '\n[IPC Send]\n';
    ipcSendLog += `chapterTitle: ${payload.chapterTitle || ''}\n`;
    console.log(ipcSendLog);
    appendTitleDebugLog(ipcSendLog);

    return payload;
  } catch (err) {
    return { ok: false, error: err?.message || 'Không lấy được nội dung từ link.' };
  }
});

ipcMain.handle('story:append-title-debug-log', async (_, message) => {
  appendTitleDebugLog(message);
  return { ok: true };
});

ipcMain.handle('story:fetch-html', async (_, url, options = {}) => {
  if (!url || !/^https?:\/\//i.test(url)) {
    return { ok: false, error: 'Link không hợp lệ. Link cần bắt đầu bằng http:// hoặc https://.' };
  }
  try {
    const customHeaders = options?.headers || {};
    const res = await axios.get(url, {
      timeout: 25000,
      maxRedirects: 5,
      responseType: 'text',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
        ...customHeaders
      }
    });
    
    let dataStr = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    let html = dataStr;
    if (dataStr.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(dataStr);
        if (parsed) {
          if (parsed.data !== undefined) {
            html = String(parsed.data);
          } else if (parsed.html !== undefined) {
            html = String(parsed.html);
          } else if (parsed.content !== undefined) {
            html = String(parsed.content);
          }
        }
      } catch (e) {
        console.error('Error parsing JSON response in fetchHtml:', e);
      }
    }
    
    return { ok: true, html };
  } catch (err) {
    return { ok: false, error: err?.message || 'Không lấy được HTML từ link.' };
  }
});


function extractGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map(p => p.text || '').join('').trim();
}

ipcMain.handle('story:gemini-list-models', async (_, payload = {}) => {
  const apiKey = String(payload.apiKey || '').trim();
  if (!apiKey) return { ok: false, status: 400, error: 'Thiếu Gemini API key.' };

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
    const res = await axios.get(url, {
      timeout: 30000,
      validateStatus: () => true
    });

    if (res.status < 200 || res.status >= 300) {
      const err = res.data?.error;
      return { ok: false, status: res.status, error: err?.message || `Gemini ListModels HTTP ${res.status}`, details: res.data };
    }

    const models = (res.data?.models || [])
      .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
      .map(m => ({
        name: String(m.name || '').replace(/^models\//, ''),
        displayName: m.displayName || String(m.name || '').replace(/^models\//, ''),
        description: m.description || '',
        inputTokenLimit: m.inputTokenLimit || 0,
        outputTokenLimit: m.outputTokenLimit || 0,
        supportedGenerationMethods: m.supportedGenerationMethods || []
      }))
      .filter(m => m.name && /^gemini-/i.test(m.name))
      .sort((a, b) => {
        const score = (x) => {
          const n = x.name.toLowerCase();
          if (n.includes('2.5-flash-lite')) return 0;
          if (n.includes('2.5-flash')) return 1;
          if (n.includes('2.0-flash')) return 2;
          if (n.includes('flash')) return 3;
          if (n.includes('pro')) return 4;
          return 9;
        };
        return score(a) - score(b) || a.name.localeCompare(b.name);
      });

    return { ok: true, models };
  } catch (err) {
    return { ok: false, status: 500, error: err?.message || 'Không gọi được Gemini ListModels.' };
  }
});


ipcMain.handle('story:gemini-generate', async (_, payload = {}) => {
  const apiKey = String(payload.apiKey || '').trim();
  const model = String(payload.model || 'gemini-1.5-flash').trim();
  const prompt = String(payload.prompt || '').trim();
  if (!apiKey) return { ok: false, status: 400, error: 'Thiếu Gemini API key.' };
  if (!prompt) return { ok: false, status: 400, error: 'Prompt rỗng.' };

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const generationConfig = {
      temperature: 0.35,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 8192
    };
    if (payload.responseMimeType) {
      generationConfig.responseMimeType = payload.responseMimeType;
    }
    if (payload.responseSchema) {
      generationConfig.responseSchema = payload.responseSchema;
    }

    const res = await axios.post(url, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
      ]
    }, {
      timeout: 120000,
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true
    });

    const statusText = res.statusText || (res.status === 200 ? 'OK' : 'Error');
    if (res.status < 200 || res.status >= 300) {
      const err = res.data?.error;
      return { ok: false, status: res.status, statusText, error: err?.message || `Gemini HTTP ${res.status}`, details: res.data };
    }

    const text = extractGeminiText(res.data);
    if (!text) {
      const reason = res.data?.candidates?.[0]?.finishReason;
      return { ok: false, status: 500, statusText: 'No Text', error: reason ? `Gemini không trả text. Finish reason: ${reason}` : 'Gemini không trả text.', details: res.data };
    }
    return { ok: true, text, status: res.status, statusText, details: res.data };
  } catch (err) {
    const status = err.response?.status || 500;
    const statusText = err.response?.statusText || 'Internal Server Error';
    const details = err.response?.data || null;
    return { ok: false, status, statusText, error: err?.message || 'Không gọi được Gemini API.', details };
  }
});

ipcMain.handle('story:log-error', async (_, msg) => {
  try {
    fs.appendFileSync(path.join(__dirname, '..', 'runtime-error.txt'), msg);
  } catch {}
  return { ok: true };
});

ipcMain.handle('story:log-gemini-debug', async (_, payload = {}) => {
  try {
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = path.join(logDir, 'gemini-debug.log');

    const timestamp = payload.timestamp || new Date().toISOString();
    const keyLabel = payload.keyLabel || 'unknown';
    const keyPrefix = payload.key ? (String(payload.key).slice(0, 8) + '...') : 'unknown';
    const model = payload.model || 'unknown';
    const endpoint = payload.endpoint || 'unknown';
    const callSource = payload.callSource || 'unknown';
    const inputLength = payload.inputLength || 0;

    let logContent = `==================================================\n`;
    logContent += `[GEMINI_REQUEST]\n`;
    logContent += `timestamp: ${timestamp}\n`;
    logContent += `keyLabel: ${keyLabel}\n`;
    logContent += `keyPrefix: ${keyPrefix}\n`;
    logContent += `model: ${model}\n`;
    logContent += `endpoint: ${endpoint}\n`;
    logContent += `callSource: ${callSource}\n`;
    logContent += `inputLength: ${inputLength}\n\n`;

    logContent += `[GEMINI_RESPONSE]\n`;
    logContent += `status: ${payload.status || 'unknown'}\n`;
    logContent += `statusText: ${payload.statusText || 'unknown'}\n`;
    logContent += `responseBody: ${typeof payload.responseBody === 'object' ? JSON.stringify(payload.responseBody, null, 2) : (payload.responseBody || '{}')}\n`;

    if (payload.isError) {
      logContent += `\n[GEMINI_ERROR]\n`;
      logContent += `errorType: ${payload.errorType || 'unknown'}\n`;
      logContent += `rawMessage: ${payload.rawMessage || ''}\n`;
      if (payload.stack) {
        logContent += `stack: ${payload.stack}\n`;
      }
    }
    logContent += `==================================================\n\n`;

    fs.appendFileSync(logFile, logContent, 'utf8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('story:save-chapter-content', async (_, payload = {}) => {
  const { bookId, chapterIndex, raw, cleaned } = payload;
  if (!bookId) return { ok: false, error: 'Thiếu bookId' };
  try {
    const userDataPath = app.getPath('userData');
    const bookDir = path.join(userDataPath, 'chapters', String(bookId));
    if (!fs.existsSync(bookDir)) {
      fs.mkdirSync(bookDir, { recursive: true });
    }
    const filePath = path.join(bookDir, `chapter_${chapterIndex}.json`);
    fs.writeFileSync(filePath, JSON.stringify({ raw: raw || '', cleaned: cleaned || '' }, null, 2), 'utf8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('story:load-chapter-content', async (_, payload = {}) => {
  const { bookId, chapterIndex } = payload;
  if (!bookId) return { ok: false, error: 'Thiếu bookId' };
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, 'chapters', String(bookId), `chapter_${chapterIndex}.json`);
    if (fs.existsSync(filePath)) {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return { ok: true, raw: content.raw || '', cleaned: content.cleaned || '' };
    }
    return { ok: true, raw: '', cleaned: '' };
  } catch (err) {
    return { ok: true, raw: '', cleaned: '' };
  }
});

ipcMain.handle('story:delete-book-chapters', async (_, payload = {}) => {
  const { bookId } = payload;
  if (!bookId) return { ok: false, error: 'Thiếu bookId' };
  try {
    const userDataPath = app.getPath('userData');
    const bookDir = path.join(userDataPath, 'chapters', String(bookId));
    if (fs.existsSync(bookDir)) {
      fs.rmSync(bookDir, { recursive: true, force: true });
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('story:save-settings', async (_, data) => {
  try {
    const filePath = path.join(process.cwd(), 'settings.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return { ok: true };
  } catch (err) {
    try {
      const userDataPath = app.getPath('userData');
      const filePathFallback = path.join(userDataPath, 'settings.json');
      fs.writeFileSync(filePathFallback, JSON.stringify(data, null, 2), 'utf8');
      return { ok: true, fallback: true };
    } catch (errFallback) {
      return { ok: false, error: errFallback.message };
    }
  }
});

ipcMain.handle('story:load-settings', async () => {
  try {
    const filePath = path.join(process.cwd(), 'settings.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return { ok: true, data };
    }
    const userDataPath = app.getPath('userData');
    const filePathFallback = path.join(userDataPath, 'settings.json');
    if (fs.existsSync(filePathFallback)) {
      const data = JSON.parse(fs.readFileSync(filePathFallback, 'utf8'));
      return { ok: true, data };
    }
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('story:open-downloads-folder', async () => {
  try {
    const downloadsPath = app.getPath('downloads');
    if (fs.existsSync(downloadsPath)) {
      await shell.openPath(downloadsPath);
      return { ok: true };
    }
    return { ok: false, error: 'Downloads folder does not exist' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});


app.whenReady().then(() => {
  if (process.platform === 'darwin' && fs.existsSync(iconPath)) {
    app.dock.setIcon(iconPath);
  }
  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
