/* 共用的 DOM / Canvas / Image 桩件：让成品 HTML 里的主脚本能在 Node 里真实跑起来。
   桩件会记录 addEventListener 的处理器，因此测试可以真的去"点"按钮、按快捷键。 */
const fs = require('fs');
const path = require('path');

function makeStub(opts = {}) {
  const ROOT = opts.root || __dirname;
  const html = fs.readFileSync(path.join(ROOT, '拼豆图纸工具.html'), 'utf8');

  const IW = opts.W || 16, IH = opts.H || 16;
  const PIX = new Uint8ClampedArray(IW * IH * 4);

  const app = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
    .map(m => m[2]).find(b => b.includes('function nearestIdx'));
  const jsonText = [...html.matchAll(/<script[^>]*application\/json[^>]*>([\s\S]*?)<\/script>/g)][0][1];

  const calls = { toBlob: 0, click: 0 };

  function ctxStub() {
    const noop = () => {};
    return {
      fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '',
      textBaseline: '', globalAlpha: 1, imageSmoothingEnabled: false,
      imageSmoothingQuality: 'high',
      clearRect: noop, fillRect: noop, strokeRect: noop, drawImage: noop,
      setTransform: noop, beginPath: noop, moveTo: noop, lineTo: noop,
      stroke: noop, rect: noop, fillText: noop, save: noop, restore: noop,
      setLineDash: noop, translate: noop, scale: noop,
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
      putImageData: noop,
      measureText: () => ({ width: 12 }),
      // 模拟 drawImage 缩放：把源图按最近邻铺到目标尺寸，这样任意网格尺寸都能测
      getImageData(x, y, w, h) {
        const out = new Uint8ClampedArray(w * h * 4);
        for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
          const sx = Math.min(IW - 1, Math.floor(xx * IW / w));
          const sy = Math.min(IH - 1, Math.floor(yy * IH / h));
          const si = (sy * IW + sx) * 4, di = (yy * w + xx) * 4;
          for (let k = 0; k < 4; k++) out[di + k] = PIX[si + k];
        }
        return { data: out, width: w, height: h };
      },
    };
  }
  const ctx = ctxStub();

  function el(id) {
    const o = {
      id, tagName: 'DIV', textContent: '', innerHTML: '', value: '', checked: false, hidden: false,
      max: 0, min: 0, width: 0, height: 0, dataset: {}, style: {}, _h: {},
      clientWidth: 1000, clientHeight: 800,
      isContentEditable: false,
      classList: {
        _s: new Set(),
        add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
        toggle(c, on) { if (on === undefined) on = !this._s.has(c); on ? this._s.add(c) : this._s.delete(c); },
        contains(c) { return this._s.has(c); },
      },
      addEventListener(t, fn) { (o._h[t] = o._h[t] || []).push(fn); },
      insertAdjacentHTML() {}, click() { calls.click++; },
      querySelector() { return null; }, querySelectorAll() { return []; },
      closest() { return null; }, contains() { return false; },
      focus() {}, scrollIntoView() {},
      getContext() { return ctx; },
      getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100 }; },
      toBlob(cb) { calls.toBlob++; cb({}); },
    };
    return o;
  }
  const els = new Map();
  const getEl = id => { if (!els.has(id)) els.set(id, el(id)); return els.get(id); };
  getEl('paletteData').textContent = jsonText;

  const multBtns = ['2', '4', '8'].map(m => { const e = el('mult-' + m); e.dataset.m = m; return e; });
  const toolBtns = ['inspect', 'pencil', 'eraser', 'picker', 'line', 'rect', 'ellipse', 'bucket']
    .map(t => { const e = el('tool-' + t); e.dataset.t = t; return e; });
  const anchorBtns = ['0', '1', '2', '3', '4', '5', '6', '7', '8']
    .map(a => { const e = el('anchor-' + a); e.dataset.a = a; return e; });
  const bucketBtns = ['4', '8'].map(c => { const e = el('bucket-' + c); e.dataset.c = c; return e; });

  const docHandlers = {};
  const documentStub = {
    getElementById: getEl,
    createElement: tag => el(tag),
    querySelectorAll: sel => sel === '#mults button' ? multBtns
                          : sel === '#tools button' ? toolBtns
                          : sel === '#anchor button' ? anchorBtns
                          : sel === '#bucket button' ? bucketBtns : [],
    addEventListener(t, fn) { (docHandlers[t] = docHandlers[t] || []).push(fn); },
  };
  const windowStub = {
    devicePixelRatio: 1, innerWidth: 1600, innerHeight: 900, _h: {},
    addEventListener(t, fn) { (this._h[t] = this._h[t] || []).push(fn); },
    requestAnimationFrame(fn) { fn(); return 1; },
  };
  const URLStub = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
  const FileReaderStub = function () { this.readAsDataURL = () => {}; };
  const ImageStub = function () {
    this.naturalWidth = IW; this.naturalHeight = IH;
    let _src = '';
    Object.defineProperty(this, 'src', {
      get() { return _src; },
      set(v) { _src = v; if (this.onload) this.onload(); },
    });
  };

  const runner = new Function(
    'document', 'window', 'Image', 'FileReader', 'URL', 'setTimeout', 'clearTimeout',
    app + '\nreturn {S, mapCells, recount, draw, inspect, renderUsage, exportPNG, exportCSV,'
        + ' fit, applyLimit, act, setSide, syncDocInputs, updateSizeInfo, clampN, clampInt, loadImage,'
        + ' flipGrid, mirrorCells, mirrorArray, mirrorIndex, updatePaintUI, setPaint, nearestIdx,'
        + ' srgbToLab, deltaE2000, de76, rgbDist, maskBackground, sampleImage, limitColors,'
        + ' buildPalette, colourSystemOptions, installDoc, resizeTo, expandCanvas, newBlank,'
        + ' resampleBase, tidyApply, despeckle, floodFill, lineCells, rectCells, ellipseCells,'
        + ' replaceColor, setHighlight, renderSimilar, similarList, undo, redo, pushSnap, pushHist,'
        + ' beginStroke, endStroke, paintCell, paintBrush, shapeIndices, commitShape, updatePreview,'
        + ' cellCap, setCellSize, cellsWith, requestDraw, visibleRange, effDpr, ensureBuffer,'
        + ' rebuildBuffer, paintBuffer, palFilter, renderPalGrid, openPalette, closePalette,'
        + ' pickPaletteIndex, toast, applyEntry};');
  const API = runner(documentStub, windowStub, ImageStub, FileReaderStub, URLStub,
                     fn => fn(), () => {});

  function fire(target, type, ev) {
    const hs = (target && target._h && target._h[type]) || [];
    if (!hs.length) throw new Error(`没有 ${target && (target.id || 'window')} 的 ${type} 处理器`);
    for (const h of hs) h(Object.assign({ target, preventDefault() {}, relatedTarget: null }, ev || {}));
  }
  function fireDoc(type, ev) {
    const hs = docHandlers[type] || [];
    if (!hs.length) throw new Error(`没有 document 的 ${type} 处理器`);
    for (const h of hs) h(Object.assign({ target: { tagName: 'BODY' }, preventDefault() {} }, ev || {}));
  }

  // 用 fn(x,y) -> [r,g,b] / [r,g,b,a] 重绘源图
  function setPix(fn) {
    for (let y = 0; y < IH; y++) for (let x = 0; x < IW; x++) {
      const k = (y * IW + x) * 4, c = fn(x, y);
      PIX[k] = c[0]; PIX[k + 1] = c[1]; PIX[k + 2] = c[2];
      PIX[k + 3] = c.length > 3 ? c[3] : 255;
    }
  }

  return { API, getEl, fire, fireDoc, docHandlers, documentStub, windowStub, calls, PIX, IW, IH, setPix, html };
}

module.exports = { makeStub };