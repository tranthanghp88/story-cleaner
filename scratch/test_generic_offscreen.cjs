const { app, BrowserWindow } = require('electron');
const cheerio = require('cheerio');
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');

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

  console.log(`[Offscreen Browser] Loading: ${url}`);
  await win.loadURL(url);

  // Poll for content
  const maxWaitMs = 8000;
  const pollIntervalMs = 500;
  const startTime = Date.now();
  let html = '';

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const state = await win.webContents.executeJavaScript(`
        (() => {
          const bodyText = document.body ? document.body.innerText : '';
          const article = document.querySelector('article');
          const articleText = article ? article.innerText : '';
          
          // Check if we have substantial content loaded
          const hasContent = articleText.length > 500 || bodyText.length > 1500;
          return {
            hasContent,
            bodyLength: bodyText.length,
            articleLength: articleText.length,
            html: document.documentElement.outerHTML
          };
        })()
      `);

      html = state.html;
      if (state.hasContent) {
        console.log(`[Offscreen Browser] Content detected after ${Date.now() - startTime}ms. Body len: ${state.bodyLength}, Article len: ${state.articleLength}`);
        break;
      }
    } catch (err) {
      console.error("[Offscreen Browser] Poll error:", err.message);
    }
    await new Promise(r => setTimeout(r, pollIntervalMs));
  }

  win.close();
  return html;
}

app.whenReady().then(async () => {
  const url = 'https://hontruyen.com/vi/story/bach-duyen-nhap-dao/chap/30';
  const html = await fetchWithOffscreenBrowser(url);
  console.log(`HTML loaded, length: ${html.length}`);

  // Now extract text using Readability or Cheerio
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  if (article && article.textContent) {
    console.log("\n[Extraction Success via Readability]");
    console.log("Title:", article.title);
    console.log("Text length:", article.textContent.trim().length);
    console.log("Snippet:", article.textContent.trim().slice(0, 500).replace(/\s+/g, ' '));
  } else {
    console.log("\n[Readability failed, trying Cheerio fallback]");
    const $ = cheerio.load(html);
    const text = $('article').text();
    console.log("Cheerio <article> text length:", text.length);
    console.log("Snippet:", text.slice(0, 500).replace(/\s+/g, ' '));
  }

  app.quit();
});
