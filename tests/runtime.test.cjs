const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'app/app_template.html'), 'utf8');
const docs = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
  .map(m => m[1]).find(s => s.includes('var DOCS = window.__DOCS'));
const drain = async () => { for (let i = 0; i < 16; i++) await new Promise(setImmediate); };

function harness({ delayedBoot = false, local = {} } = {}) {
  const records = new Map(), waiting = [], counters = { puts: 0, local: 0 };
  let held = false, failures = 0, boot;
  const db = { transaction() {
    const tx = {};
    tx.objectStore = () => ({
      getAll() {
        const req = {};
        setImmediate(() => { req.result = [...records.values()].map(rec => structuredClone(rec)); tx.oncomplete(); });
        return req;
      },
      put(rec) {
        const copy = structuredClone(rec), req = {};
        const finish = () => {
          counters.puts++;
          if (failures) { failures--; tx.error = new Error('quota'); tx.onabort(); }
          else { records.set(copy.id, copy); req.result = copy.id; tx.oncomplete(); }
        };
        setImmediate(() => held ? waiting.push(finish) : finish());
        return req;
      },
      delete(id) { const req = {}; setImmediate(() => { records.delete(id); tx.oncomplete(); }); return req; }
    });
    return tx;
  } };
  const state = { cells: null, base: null, palette: [], brandId: 'standard', codeSys: 'mard',
    maxColors: 0, history: [], future: [], progress: new Uint8Array(), histBytes: 0 };
  const ctx = { S: state, BRANDS: { standard: { colors: Array(291).fill({}) } },
    indexedDB: { open() { const req = { result: db }; boot = () => req.onsuccess();
      if (!delayedBoot) setImmediate(boot); return req; } },
    document: { getElementById: () => null, addEventListener() {}, createElement() { throw Error('no canvas in storage test'); } },
    localStorage: { getItem: k => local[k] || null, setItem() { counters.local++; } },
    setInterval() {}, addEventListener() {}, toast() {}, confirm: () => true,
    clampN: n => Math.max(1, Math.min(400, Math.round(n))),
    colourSystemOptions() {}, buildPalette() {}, closePalette() {}, fit() {},
    renderProgress() {}, requestDraw() {}, progressPatternHash: () => '',
    saveDoc() { counters.local++; }, saveProgress() { counters.local++; }, newBlank() {},
    installDoc(w, h, base) { state.gw = w; state.gh = h; state.base = base; state.cells = base; ctx.saveDoc(); },
    pushHist() {}, resizeTo() {}, flipGrid() {}, applyLimit() {}, undo() {}, redo() {}
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(docs.replace('  boot();',
    '  window.api = { saveActive, createDoc, openDoc, deleteDoc, commitFromState }; boot();'), ctx);
  return { ctx, state, records, counters,
    start: () => boot(), fail: n => { failures = n; }, hold: () => { held = true; },
    release: () => { held = false; waiting.splice(0).forEach(fn => fn()); } };
}

test('blank canvas persists immediately; drawing does not save; edits avoid synchronous localStorage', async () => {
  const h = harness(); await drain();
  h.ctx.newBlank(2, 2); await drain();
  assert.equal(h.records.size, 1);
  const count = h.counters.puts;
  h.ctx.requestDraw(); h.ctx.api.saveActive(); await drain();
  assert.equal(h.counters.puts, count);
  h.state.base[0] = 3; h.ctx.saveDoc(); h.ctx.api.saveActive(); await drain();
  assert.equal([...h.records.values()][0].base[0], 3);
  assert.equal(h.counters.local, 0);
});

test('switching while a write is pending preserves both documents and their color limits', async () => {
  const h = harness(); await drain();
  h.ctx.newBlank(2, 2); await drain();
  const first = h.ctx.__DOCS.activeId;
  h.hold();
  h.state.base[0] = 4; h.state.maxColors = 7; h.ctx.saveDoc(); h.ctx.api.saveActive(); await drain();
  h.ctx.newBlank(3, 3); const second = h.ctx.__DOCS.activeId;
  h.state.base[0] = 5; h.state.maxColors = 2; h.ctx.saveDoc(); h.ctx.api.saveActive();
  h.release(); await drain();
  assert.equal(h.records.get(first).base[0], 4);
  assert.equal(h.records.get(second).base[0], 5);
  h.ctx.api.openDoc(first);
  assert.equal(h.state.maxColors, 7);
  assert.equal(h.ctx.__DOCS.dirty, false);
});

test('failed writes retry and never replace a newer edit with an old snapshot', async () => {
  const h = harness(); await drain(); h.ctx.newBlank(2, 2); await drain();
  const id = h.ctx.__DOCS.activeId;
  h.fail(1); h.state.base[0] = 1; h.ctx.saveDoc(); h.ctx.api.saveActive(); await drain();
  assert.equal(Object.keys(h.ctx.__DOCS.failedSaves).length, 1);
  h.state.base[0] = 9; h.ctx.saveDoc(); h.ctx.api.saveActive(); await drain();
  h.ctx.api.saveActive(); await drain();
  assert.equal(h.records.get(id).base[0], 9);
  assert.equal(Object.keys(h.ctx.__DOCS.failedSaves).length, 0);
});

test('new canvas and edits made before IndexedDB opens survive startup', async () => {
  const h = harness({ delayedBoot: true });
  h.ctx.newBlank(2, 3); h.state.base[1] = 8; h.ctx.saveDoc();
  h.start(); await drain();
  assert.equal(h.records.size, 1);
  assert.equal(h.state.base[1], 8);
  assert.equal([...h.records.values()][0].base[1], 8);
});

test('startup import preserves existing records and activates the imported document', async () => {
  const h = harness({ delayedBoot: true });
  h.records.set('old', { id: 'old', name: 'old', gw: 1, gh: 1, base: new Int16Array([1]),
    progress: new Uint8Array(1), brandId: 'standard', maxColors: 0 });
  h.state.gw = 2; h.state.gh = 1; h.state.base = h.state.cells = new Int32Array([2, 3]);
  h.ctx.__docAfterImport('imported'); h.start(); await drain();
  assert.equal(h.records.size, 2);
  assert.equal(h.ctx.__DOCS.list.find(d => d.id === h.ctx.__DOCS.activeId).name, 'imported');
});

test('legacy migration retains matching progress', async () => {
  let hash = 2166136261;
  for (const value of [2, 1, 2, 3]) hash = Math.imul(hash ^ value, 16777619);
  const h = harness({ local: {
    'hackone:doc:v1': JSON.stringify({ gw: 2, gh: 1, base: [1, 2], cells: [1, 2], brandId: 'standard' }),
    'hackone:progress:v1': JSON.stringify({ patternHash: (hash >>> 0).toString(16), bitmask: [1] })
  } });
  await drain();
  assert.equal(h.records.size, 1);
  assert.equal([...h.records.values()][0].progress[0], 1);
});

const shareSource = html.slice(html.indexOf('  function rle(arr)'), html.indexOf('  /* 短链服务'));
function shareContext() {
  const ctx = { BRANDS: { standard: { colors: Array(291).fill({}) } }, S: { brandId: 'standard' },
    TextDecoder, TextEncoder, Blob, Response, DecompressionStream, atob, btoa };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(shareSource, ctx); return ctx;
}
test('RLE rejects overflow, truncation, malformed counts, and oversized allocations', () => {
  const c = shareContext();
  assert.deepEqual(Array.from(c.unrle('1:2.0:1', 3)), [0, 0, -1]);
  for (const [str, n] of [['1:4', 3], ['1:1', 3], ['1:0', 1], ['x', 1], ['1:1', 160001]]) {
    assert.throws(() => c.unrle(str, n));
  }
});
test('share decoding rejects invalid sizes, palettes, indices, and encoding prefixes', async () => {
  const c = shareContext(), encode = raw => 'r' + Buffer.from(raw).toString('base64url');
  const good = await c.unpackDoc(encode('1:2|2,1,standard,mard,0'));
  assert.deepEqual(Array.from(good.base), [0, 0]);
  for (const raw of ['1:1|401,1,standard,mard,0', '1:1|1,1,missing,mard,0', 'zz:1|1,1,standard,mard,0']) {
    await assert.rejects(c.unpackDoc(encode(raw)));
  }
  await assert.rejects(c.unpackDoc('x' + encode('1:1|1,1,standard,mard,0').slice(1)));
  assert.throws(() => c.applyPacked({ w: 1, h: 1, base: [0.5], brand: 'standard' }));
});
test('imported documents do not inherit undo or redo history', () => {
  const c = shareContext();
  Object.assign(c.S, { history: [{ t: 'old' }], future: [{ t: 'old' }], histBytes: 12 });
  Object.assign(c, { $: () => null, colourSystemOptions() {}, buildPalette() {},
    installDoc(w, h, base) { c.S.cells = base; }, resetProgress() {}, fit() {} });
  c.applyPacked({ w: 1, h: 1, base: [2], brand: 'standard' });
  assert.equal(c.S.history.length, 0);
  assert.equal(c.S.future.length, 0);
  assert.equal(c.S.histBytes, 0);
  assert.equal(c.S.cells[0], 2);
});

test('both resize modes reset progress even when bitmask size is unchanged and undo restores it', () => {
  const source = html.slice(html.indexOf('function resizeTo('), html.indexOf('function newBlank(')) +
    html.slice(html.indexOf('function entryBytes('), html.indexOf('/* ------------------------------------------------ 绘画原语'));
  for (const mode of ['resizeTo', 'expandCanvas']) {
    const S = { gw: 2, gh: 3, base: new Int32Array(6).fill(1), cells: new Int32Array(6).fill(1),
      progress: new Uint8Array([5]), history: [], future: [], histBytes: 0, maxColors: 0 };
    const c = { S, HIST_BYTES: 1e6, clampN: n => n, limitColors: a => Int32Array.from(a),
      resampleBase: (w, h) => new Int32Array(w * h).fill(1),
      resetProgress() { S.progress = new Uint8Array(Math.ceil(S.cells.length / 8)); },
      progressByteCount: () => Math.ceil(S.cells.length / 8), progressPatternHash: () => '',
      installDoc(w, h, base) { S.gw = w; S.gh = h; S.base = base; S.cells = Int32Array.from(base); },
      ensureBuffer() {}, syncDocInputs() {}, recount() {}, renderUsage() {}, renderSimilar() {},
      requestDraw() {}, renderProgress() {}, fit() {}, toast() {} };
    vm.createContext(c); vm.runInContext(source, c);
    c[mode](3, 2, mode === 'resizeTo' ? {} : 0);
    assert.equal(S.progress[0], 0, mode);
    c.undo();
    assert.deepEqual([S.gw, S.gh, S.progress[0]], [2, 3, 5], mode);
    c.redo();
    assert.deepEqual([S.gw, S.gh, S.progress[0]], [3, 2, 0], mode);
  }
});

test('A4 overview keeps wide and tall supported grids within the page', () => {
  const source = html.slice(html.indexOf('function renderA4Overview('), html.indexOf('function renderA4Board('));
  for (const [w, h] of [[320, 29], [400, 1], [1, 400], [29, 29]]) {
    let grid;
    const c = { S: { gw: w, gh: h, used: [] }, A4_PAGE_W: 1240, A4_PAGE_H: 1754, A4_MARGIN: 64,
      a4Canvas: () => ({ getContext: () => ({ fillRect() {} }) }), a4CropMarks() {}, a4Header() {},
      boardCols: () => Math.ceil(w / 29), boardRows: () => Math.ceil(h / 29),
      a4DrawCells(ctx, x, y, size, sx, sy, cols, rows) { grid = { x, y, width: size * cols, height: size * rows }; },
      a4EdgeNumbers() {}, a4BoardOverlay() {}, a4Footer() {} };
    vm.createContext(c); vm.runInContext(source, c); c.renderA4Overview(1, 2);
    assert.ok(grid.x >= 64 && grid.x + grid.width <= 1240 - 64, `${w}x${h}`);
    assert.ok(grid.y >= 138 && grid.y + grid.height <= 138 + 1754 - 300, `${w}x${h}`);
  }
});
test('bounded stream cancels before concatenating an oversized decompressed payload', async () => {
  const c = shareContext(); let cancelled = false;
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(20)); },
    cancel() { cancelled = true; } });
  await assert.rejects(c.readTextBounded(stream, 10));
  assert.equal(cancelled, true);
});

test('share Worker enforces streamed byte limits and rejects malformed UTF-8 before KV writes', async () => {
  const src = fs.readFileSync(path.join(root, 'share/worker.js'), 'utf8');
  const { default: worker } = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
  const saved = new Map();
  const env = { PINDA: { get: async k => saved.get(k), put: async (k, v) => saved.set(k, v) } };
  const request = (body, headers) => new Request('https://example.test/api/save',
    { method: 'POST', body, headers, duplex: 'half' });
  assert.equal((await worker.fetch(request('rpayload'), env)).status, 200);
  let cancelled = false;
  const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(400001)); }, cancel() { cancelled = true; } });
  assert.equal((await worker.fetch(request(stream), env)).status, 413);
  assert.equal(cancelled, true);
  assert.equal((await worker.fetch(request('x', { 'content-length': '400001' }), env)).status, 413);
  assert.equal((await worker.fetch(request(new Uint8Array([255])), env)).status, 400);
  assert.equal((await worker.fetch(request(''), env)).status, 400);
  assert.equal(saved.size, 1);
});

test('all production scripts parse and generated HTML matches both template and Pages artifact', () => {
  const built = fs.readFileSync(path.join(root, 'app/拼豆图纸工具.html'), 'utf8');
  const palette = fs.readFileSync(path.join(root, 'app/palettes.json'), 'utf8').replaceAll('</', '<\\/');
  assert.equal(built, html.replace('__PALETTE_JSON__', palette));
  assert.equal(built, fs.readFileSync(path.join(root, 'product/index.html'), 'utf8'));
  for (const m of built.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (!m[1].includes('application/json')) new vm.Script(m[2]);
  }
});
