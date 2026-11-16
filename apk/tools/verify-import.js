/* 验证：底部“导入”入口 + 图片 / TXT / ZIP 三种文件都能导入 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const root = path.resolve(__dirname, '..');
const url = 'file:///' + path.join(root, 'tablet', 'index.html').replace(/\\/g, '/');
const shotDir = path.join(root, 'dist', 'screenshots');

async function openPage(browser, w = 1280, h = 800) {
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: true });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => !document.documentElement.classList.contains('intro-on'), { timeout: 20000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 500));
  return page;
}

async function state(page) {
  return page.evaluate(() => {
    const g = document.getElementById('grid');
    return {
      useTotal: document.getElementById('useTotal').textContent,
      grid: g.hidden ? 'hidden' : g.width + 'x' + g.height,
      docName: (document.querySelector('#docList .doc') || {innerText: ''}).innerText.replace(/\s+/g, ' ').slice(0, 40),
      toast: document.getElementById('toast').textContent,
      importPill: (() => { const p = document.getElementById('importPill'); return p ? { hidden: p.hidden, text: p.textContent, rect: p.getBoundingClientRect().toJSON() } : null; })(),
      emptyText: (document.getElementById('empty').innerText || '').trim(),
      fileAccept: document.getElementById('file').getAttribute('accept'),
    };
  });
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--allow-file-access-from-files'] });

  // 1) 空状态截图 + 入口检查
  let page = await openPage(browser);
  const empty = await state(page);
  console.log('EMPTY:', JSON.stringify({ emptyText: empty.emptyText, pill: empty.importPill, accept: empty.fileAccept }));
  await page.screenshot({ path: path.join(shotDir, 'empty-new.png') });

  // 2) 导入图片，导出 TXT / ZIP 作为测试样本
  await (await page.$('#file')).uploadFile(path.join(shotDir, 'sample.png'));
  await new Promise(r => setTimeout(r, 2500));
  const afterImg = await state(page);
  console.log('IMAGE:', JSON.stringify(afterImg));

  const txt = await page.evaluate(() => window.PatternIO.buildText());
  fs.writeFileSync(path.join(shotDir, 'pattern-test.txt'), txt, 'utf8');

  const zipBytes = await page.evaluate(async () => {
    const data = new TextEncoder().encode(window.PatternIO.buildText());
    const zip = await window.PatternIO._zip.buildZip('pattern.txt', data);
    return Array.from(zip);
  });
  fs.writeFileSync(path.join(shotDir, 'pattern-test.zip'), Buffer.from(zipBytes));
  console.log('SAMPLES: txt bytes', txt.length, 'zip bytes', zipBytes.length);
  await page.close();

  // 3) 通过“导入”入口导入 TXT
  page = await openPage(browser);
  await (await page.$('#file')).uploadFile(path.join(shotDir, 'pattern-test.txt'));
  await new Promise(r => setTimeout(r, 2500));
  const afterTxt = await state(page);
  console.log('TXT:', JSON.stringify(afterTxt));
  await page.screenshot({ path: path.join(shotDir, 'import-txt.png') });
  await page.close();

  // 4) 通过“导入”入口导入 ZIP
  page = await openPage(browser);
  await (await page.$('#file')).uploadFile(path.join(shotDir, 'pattern-test.zip'));
  await new Promise(r => setTimeout(r, 2500));
  const afterZip = await state(page);
  console.log('ZIP:', JSON.stringify(afterZip));
  await page.screenshot({ path: path.join(shotDir, 'import-zip.png') });
  await page.close();

  await browser.close();

  const ok = afterTxt.useTotal === afterImg.useTotal && afterZip.useTotal === afterImg.useTotal
    && afterTxt.grid !== 'hidden' && afterZip.grid !== 'hidden';
  console.log(ok ? 'ROUNDTRIP OK' : 'ROUNDTRIP FAILED');
  process.exit(ok ? 0 : 1);
})();