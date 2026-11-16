const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const root = path.resolve(__dirname, '..');
const url = 'file:///' + path.join(root, 'tablet', 'index.html').replace(/\\/g, '/');
const shotDir = path.join(root, 'dist', 'screenshots');
fs.mkdirSync(shotDir, { recursive: true });

async function shot(browser, w, h, mobile, name, file) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: true, isMobile: mobile });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => !document.documentElement.classList.contains('intro-on'), { timeout: 20000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 600));
  const input = await page.$('#file');
  await input.uploadFile(file);
  await new Promise(r => setTimeout(r, 2200));
  await page.screenshot({ path: path.join(shotDir, name) });
  const state = await page.evaluate(() => ({
    use: document.getElementById('useTotal').textContent,
    size: (document.getElementById('sizeInfo') || {innerText: ''}).innerText.replace(/\s+/g, ' '),
    grid: (() => { const c = document.getElementById('grid'); return c.width + 'x' + c.height; })(),
  }));
  console.log(name, JSON.stringify(state));
  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--allow-file-access-from-files'] });
  const sample = path.join(shotDir, 'sample.png');
  await shot(browser, 1280, 800, false, 'import-landscape-1280x800.png', sample);
  await shot(browser, 800, 1280, true, 'import-portrait-800x1280.png', sample);
  await shot(browser, 1024, 768, false, 'import-landscape-1024x768.png', sample);
  await browser.close();
})();