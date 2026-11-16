/* 用 Edge(headless) 在平板尺寸下核对布局与触摸行为 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = 'file:///' + path.resolve(__dirname, '..', 'tablet', 'index.html').replace(/\\/g, '/');
const outDir = path.resolve(__dirname, '..', 'dist', 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

const summary = [];

async function measure(page) {
  return page.evaluate(() => {
    const box = el => {
      const b = el.getBoundingClientRect();
      return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
    };
    const app = document.getElementById('app');
    const btn = document.querySelector('#dock button');
    const cs = btn ? getComputedStyle(btn) : null;
    return {
      appPad: getComputedStyle(app).paddingLeft + ' / ' + getComputedStyle(app).paddingRight,
      side: box(document.getElementById('side')),
      right: box(document.getElementById('right')),
      view: box(document.getElementById('view')),
      bar: box(document.getElementById('bar')),
      barInfoShown: getComputedStyle(document.getElementById('barInfo')).display,
      barPosShown: getComputedStyle(document.getElementById('barPos')).display,
      modebar: box(document.getElementById('modebar')),
      barScroll: (() => { const e = document.getElementById('bar'); return e.scrollWidth + '/' + e.clientWidth; })(),
      modebarScroll: (() => { const e = document.getElementById('modebar'); return e.scrollWidth + '/' + e.clientWidth; })(),
      coarse: matchMedia('(pointer: coarse)').matches,
      btnMinH: cs && cs.minHeight,
      btnFont: cs && cs.fontSize,
      bodyFont: getComputedStyle(document.body).fontSize,
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      canvasWH: (() => { const c = document.getElementById('grid'); return c.width + 'x' + c.height; })(),
    };
  });
}

async function run(browser, name, w, h, mobile, withInteractions) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: true, isMobile: mobile });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => !document.documentElement.classList.contains('intro-on'), { timeout: 20000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 700));

  const before = await measure(page);
  await page.screenshot({ path: path.join(outDir, name + '-empty.png') });

  let draw = null, pinch = null;
  if (withInteractions) {
    await page.evaluate(() => document.getElementById('blankNew').click());
    await new Promise(r => setTimeout(r, 900));
    await page.click('#tools button[data-t="pencil"]');
    await new Promise(r => setTimeout(r, 250));
    await page.click('#paintSw');
    await new Promise(r => setTimeout(r, 300));
    await page.click('#palGrid .chip');
    await new Promise(r => setTimeout(r, 500));

    const useBefore = await page.evaluate(() => document.getElementById('useTotal').textContent);
    const bb = await (await page.$('#grid')).boundingBox();
    const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
    await page.touchscreen.tap(cx, cy);
    await new Promise(r => setTimeout(r, 600));
    const useAfter = await page.evaluate(() => document.getElementById('useTotal').textContent);
    draw = { before: useBefore, after: useAfter, painted: useBefore !== useAfter };

    const sizeBefore = await page.evaluate(() => document.getElementById('grid').width);
    const client = await page.createCDPSession();
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: cx - 50, y: cy, id: 1 }, { x: cx + 50, y: cy, id: 2 }],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: cx - 110, y: cy, id: 1 }, { x: cx + 110, y: cy, id: 2 }],
    });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await new Promise(r => setTimeout(r, 900));
    const sizeAfter = await page.evaluate(() => document.getElementById('grid').width);
    pinch = { before: sizeBefore, after: sizeAfter, zoomed: sizeBefore !== sizeAfter };

    await page.screenshot({ path: path.join(outDir, name + '-grid.png') });
  }

  const smallTargets = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('button').forEach(b => {
      const r = b.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;               // 隐藏元素
      if (getComputedStyle(b).display === 'none') return;
      if (r.height < 30) bad.push((b.id || b.textContent || b.getAttribute('aria-label') || b.className).trim().slice(0, 18) + ':' + Math.round(r.height));
    });
    return bad.slice(0, 12);
  });

  summary.push({ name, w, h, mobile, before, draw, pinch, smallTargets, errors });
  await page.close();
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-first-run', '--disable-extensions', '--allow-file-access-from-files'],
  });
  await run(browser, 'landscape-1600x1000', 1600, 1000, false, false);
  await run(browser, 'landscape-1280x800', 1280, 800, false, true);
  await run(browser, 'landscape-1024x768', 1024, 768, false, false);
  await run(browser, 'portrait-800x1280', 800, 1280, true, true);
  await run(browser, 'phone-700x1000', 700, 1000, true, false);
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
})().catch(e => { console.error(e); process.exit(1); });