/* 注入假的 NativeSave，验证页面里的原生桥胶水是否被正确调用（PNG / A4 / 复制 / 外链） */
const puppeteer = require('puppeteer-core');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const root = path.resolve(__dirname, '..');
const url = 'file:///' + path.join(root, 'tablet', 'index.html').replace(/\\/g, '/');

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1, hasTouch: true });
  await page.evaluateOnNewDocument(() => {
    window.__calls = [];
    window.NativeSave = {
      isNative: () => true,
      saveStart: (n, m) => { window.__calls.push(['saveStart', n, m]); return 'j1'; },
      saveChunk: (id, b64) => { window.__calls.push(['saveChunk', id, b64.length]); return true; },
      saveEnd: (id, share) => { window.__calls.push(['saveEnd', id, share]); },
      saveAbort: () => { window.__calls.push(['saveAbort']); },
      pdfStart: (n) => { window.__calls.push(['pdfStart', n]); return 'p1'; },
      pdfPage: (id, b64) => { window.__calls.push(['pdfPage', b64.length]); return true; },
      pdfEnd: (id, share) => { window.__calls.push(['pdfEnd', id, share]); },
      pdfAbort: () => { window.__calls.push(['pdfAbort']); },
      openUrl: (u) => { window.__calls.push(['openUrl', u]); },
      copyText: (t) => { window.__calls.push(['copyText', t.slice(0, 12)]); },
      toast: (m) => { window.__calls.push(['toast', m]); },
    };
  });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => !document.documentElement.classList.contains('intro-on'), { timeout: 20000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 500));
  await (await page.$('#file')).uploadFile(path.join(root, 'dist', 'screenshots', 'sample.png'));
  await new Promise(r => setTimeout(r, 2500));

  await page.click('#expPng');
  await new Promise(r => setTimeout(r, 2500));
  const pngCalls = await page.evaluate(() => window.__calls.filter(c => c[0].startsWith('save')));
  console.log('PNG calls:', JSON.stringify(pngCalls.slice(0, 4)), '... chunkCount=', pngCalls.filter(c => c[0] === 'saveChunk').length);

  await page.evaluate(() => { window.__calls.length = 0; });
  await page.click('#expA4');
  await new Promise(r => setTimeout(r, 9000));
  const pdfCalls = await page.evaluate(() => window.__calls.filter(c => c[0].startsWith('pdf')));
  console.log('A4 calls:', JSON.stringify(pdfCalls));

  await page.evaluate(() => { window.__calls.length = 0; });
  await page.click('#copyPurchase');
  await new Promise(r => setTimeout(r, 800));
  console.log('copy calls:', JSON.stringify(await page.evaluate(() => window.__calls)));

  await browser.close();
})();