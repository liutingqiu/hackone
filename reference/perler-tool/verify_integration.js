/* 集成测试：在 DOM/Canvas 桩件里真实执行成品的整段主脚本，
   跑通 初始化 -> 生成网格 -> 统计 -> 绘制 -> 交互 -> 缩放/撤销 -> 导出 全流程。
   桩件记录 addEventListener 的处理器，所以下面点按钮、拖画布、按 Ctrl+Z 都是真的触发处理器。 */
const { makeStub } = require('./stub.js');

let fail = 0;
const ok = m => console.log('  PASS  ' + m);
const bad = m => { fail++; console.log('  FAIL  ' + m); };

const env = makeStub();
const API = env.API;
const S = API.S;
const { getEl, fire, fireDoc, html, IW, IH, setPix } = env;
const info = () => String(getEl('sizeInfo').innerHTML).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const BANDS = [[200, 60, 60], [60, 180, 90], [60, 80, 200], [210, 200, 50]];
const paintAt = (x, y) => ({ clientX: x * S.cell + 1, clientY: y * S.cell + 1, button: 0 });

function resetBrand(id = 'standard', cs = 'mard', remap = true) {
  S.brandId = id;
  API.colourSystemOptions();
  if (cs) S.codeSys = cs;
  API.buildPalette(remap ? undefined : { remap:false });
}
function clearHistory() {
  S.history.length = 0; S.future.length = 0; S.histBytes = 0;
}
function freshImage(painter) {
  if (painter) setPix(painter);
  S.img = {}; S.srcW = IW; S.srcH = IH; S.gw = IW; S.gh = IH;
  S.flip = false; S.maxColors = 0; S.dither = false; S.dropBg = false;
  S.sample = 'nearest'; S.algo = 'de2000';
  S.tool = 'inspect'; S.brush = 1; S.shapeFill = false; S.conn = 4;
  resetBrand('standard', 'mard', false);
  clearHistory();
  API.mapCells();
}
function blank(w, h) {
  API.newBlank(w, h);
  clearHistory();
}

/* ---------- 1. 初始化 ---------- */
console.log('== 1. 主脚本执行 ==');
if (API && S) ok('脚本初始化完成，无异常抛出');
else { bad('脚本初始化失败'); process.exit(1); }

/* ---------- 2. 初始化状态 ---------- */
console.log('\n== 2. 初始化状态 ==');
console.log(`    品牌 ${S.brandId} / 色号体系 ${S.codeSys} / 色板 ${S.palette.length} 色`);
if (S.brandId === 'standard' && S.codeSys === 'mard' && S.palette.length === 291) ok('默认 标准291 / MARD');
else bad('默认状态不符预期');
if (S.palette.every(p => p.code && p.hex && p.lab)) ok('每个颜色都有 色号/HEX/Lab');
else bad('有色板条目缺 code/hex/lab');
if (getEl('paintCode').textContent === S.palette[S.paintIdx].code) ok('启动即显示铅笔色');
else bad('铅笔色指示未初始化');
if (S.cells === null) ok('启动时没有文档（等导入或新建）');
else bad('启动就凭空有文档');

/* ---------- 3. 生成网格 ---------- */
console.log('\n== 3. 生成网格（合成 16x16 贴图）==');
{
  setPix((x, y) => {
    const corner = (x < 3 && y < 3) || (x > 12 && y > 12);
    if (corner) return [0, 0, 0, 0];
    let c;
    if (y < 5) c = [120, 72, 40];
    else if (y < 11) c = [70, 130, 60];
    else c = [150, 150, 155];
    if ((x + y) % 7 === 0) c = c.map(v => Math.max(0, v - 30));
    return c;
  });
  S.img = {}; S.srcW = IW; S.srcH = IH; S.gw = IW; S.gh = IH;
  S.sample = 'nearest'; S.dither = false; S.dropBg = false; S.algo = 'de2000'; S.maxColors = 0;
  try { API.mapCells(); ok('mapCells 执行成功'); } catch (e) { bad('生成失败: ' + e.message); }
  const cells = S.cells;
  const empty = [...cells].filter(v => v < 0).length;
  const used = new Set([...cells].filter(v => v >= 0));
  const total = S.used.reduce((a, u) => a + u.c, 0);
  console.log(`    格子 ${cells.length}，空 ${empty}，用到 ${used.size} 色，共 ${total} 颗`);
  if (cells.length === IW * IH) ok(`格子数 = ${IW * IH}`); else bad('格子数不对');
  if (empty === 18) ok('透明角被识别为空（18 个）'); else bad(`空格 ${empty}，期望 18`);
  if ([...used].every(v => v >= 0 && v < S.palette.length)) ok('索引都在色板范围内'); else bad('出现越界索引');
  if (total === cells.length - empty) ok('统计总数与空格数吻合'); else bad('统计不吻合');
  if (S.used.every((u, k, a) => k === 0 || a[k - 1].c >= u.c)) ok('用量列表降序'); else bad('用量未降序');
  if (S.base && S.base.length === cells.length) ok('文档真身 S.base 同步生成'); else bad('S.base 缺失');
}

/* ---------- 4. 左右翻转 ---------- */
console.log('\n== 4. 左右翻转 ==');
try {
  // 左右不对称、上下也不同的图：能区分"只镜像列"和"行序也被打乱"
  const PATTERN = (x, y) => {
    const base = x < 8 ? [210, 40, 40] : [40, 40, 210];
    const dim = y < 8 ? 0 : 70;
    return base.map(v => Math.max(0, v - dim));
  };
  const fresh = () => { freshImage(PATTERN); S.tool = 'inspect'; };
  const checkMirror = (before, label) => {
    let badCell = null;
    for (let y = 0; y < S.gh && !badCell; y++) for (let x = 0; x < S.gw; x++) {
      if (S.cells[y * S.gw + x] !== before[y * S.gw + (S.gw - 1 - x)]) {
        badCell = [x, y]; break;
      }
    }
    if (!badCell) ok(`${label}：逐格等于参照镜像`);
    else bad(`${label}：(${badCell}) 处不符`);
  };

  fresh();
  const before = Int32Array.from(S.cells);
  API.flipGrid();
  checkMirror(before, '翻转后');
  if (S.flip === true) ok('S.flip 置位');
  if (/已左右翻转/.test(getEl('barInfo').innerHTML)) ok('工具栏显示「已左右翻转」');
  else bad('工具栏没显示翻转状态');

  API.flipGrid();
  if (S.cells.every((v, i) => v === before[i])) ok('翻两次回到原图');
  else bad('翻两次没回到原图');
  if (S.flip === false) ok('翻回来 S.flip 复位');

  // 手改的格子要跟着镜面走
  fresh();
  S.tool = 'pencil'; S.paintIdx = 5; API.act(3);
  S.tool = 'inspect';
  const markX = 3 % S.gw, markY = (3 / S.gw) | 0;
  API.flipGrid();
  const movedTo = markY * S.gw + (S.gw - 1 - markX);
  if (S.cells[movedTo] === 5) ok('手改的格子随镜像移动');
  else bad(`手改格子镜像后位置错误：${S.cells[movedTo]}`);

  // 翻转后按撤销，必须还原"眼前看到的那一格"
  fresh();
  API.flipGrid();                          // 先进入翻转状态
  clearHistory();
  const p = 5;
  const q = (S.gw - 1 - p) + ((p / S.gw) | 0) * S.gw;
  const oldAtP = S.cells[p];
  const NEWV = oldAtP === 7 ? 8 : 7;
  S.tool = 'pencil'; S.paintIdx = NEWV;
  API.act(p);
  S.tool = 'inspect';
  if (S.cells[p] === NEWV) ok('翻转状态下改色生效');
  else bad('翻转状态下改色无效');
  API.flipGrid();                          // 翻回来，p 那格移到 q
  fire(getEl('undo'), 'click');            // 真实点击「撤销」
  if (S.cells[q] === oldAtP) ok('翻转后撤销还原的是眼前那一格（撤销坐标已随镜像）');
  else bad(`翻转后撤销落点错误: cells[${q}]=${S.cells[q]}，期望 ${oldAtP}`);

  // 改品牌重算后仍保持镜像
  fresh();
  API.flipGrid();
  const flipped = Int32Array.from(S.cells);
  resetBrand('perler', null);
  API.applyLimit();
  if (S.flip === true) ok('改品牌重算后仍保持镜像方向');
  else bad('改品牌后镜像状态丢失');
  resetBrand('standard', 'mard');

  // 载入新图回到未翻转
  S.flip = true;
  API.loadImage('data:,x', 't.png');
  if (S.flip === false) ok('载入新图自动回到未翻转');
  else bad('载入新图后仍是翻转状态');
} catch (e) { bad('翻转测试抛错: ' + e.message); }

/* ---------- 5. 尺寸控件（缩放当前画面） ---------- */
console.log('\n== 5. 尺寸控件 ==');
try {
  freshImage();
  getEl('square').checked = true;
  getEl('sideLen').value = '40';
  fire(getEl('sideLen'), 'change');
  if (S.gw === 40 && S.gh === 40) ok('边长 40（正方形）-> 40×40');
  else bad(`边长设置失败: ${S.gw}×${S.gh}`);

  // 取消"正方形"时不能把复选框又抢回勾上
  getEl('square').checked = false;
  fire(getEl('square'), 'change');
  if (getEl('square').checked === false) ok('「正方形」取消勾选不会被自动回写');
  else bad('取消勾选后被 syncDocInputs 抢回勾上');

  getEl('square').checked = true;
  getEl('gw').value = '50';
  fire(getEl('gw'), 'change');
  if (S.gw === 50 && S.gh === 50) ok('正方形模式下改「宽」-> 高跟随 50×50');
  else bad(`改宽未带动高: ${S.gw}×${S.gh}`);

  // 相对倍率：16×16 点 ×2 -> 32；再点 ×2 -> 64；×8 -> 封顶 400
  freshImage();
  const multis = env.documentStub.querySelectorAll('#mults button');
  console.log(`    倍率按钮：${multis.map(b => '×' + b.dataset.m).join(' / ')}`);
  fire(multis[0], 'click');
  if (S.gw === 32 && S.gh === 32) ok('点「×2」-> 16×16 变 32×32');
  else bad(`×2 相对放大失效: ${S.gw}×${S.gh}`);
  fire(multis[0], 'click');
  if (S.gw === 64 && S.gh === 64) ok('再点「×2」-> 64×64（相对连乘）');
  else bad(`相对连乘失效: ${S.gw}×${S.gh}`);
  fire(multis[2], 'click');
  if (S.gw === 400 && S.gh === 400) ok('点「×8」-> 封顶 400×400');
  else bad(`倍率封顶失效: ${S.gw}×${S.gh}`);

  freshImage();
  API.setSide(32); const n32 = S.gw * S.gh;
  API.setSide(64); const n64 = S.gw * S.gh;
  if (n64 === n32 * 4) ok(`边长 32->64：格位 ${n32} -> ${n64}（4 倍）`);
  else bad(`格位换算异常 ${n32} -> ${n64}`);

  // 扩展 / 裁切画布：内容 1:1 不动，按锚点摆放
  blank(10, 10);
  S.tool = 'pencil'; S.paintIdx = 9;
  API.act(0); API.act(9);                   // 左上角与右上角各一颗
  const old = Int32Array.from(S.cells);
  API.expandCanvas(14, 10, 0);              // 左上对齐
  if (S.gw === 14 && S.gh === 10 && S.cells[0] === old[0] && S.cells[9] === old[9])
    ok('扩展画布（左上锚点）内容原样保留');
  else bad('扩展画布后内容错位');
  API.expandCanvas(10, 10, 0);              // 裁回去
  if (S.cells[0] === old[0] && S.cells[9] === old[9]) ok('裁切画布（左上锚点）内容原样保留');
  else bad('裁切画布后内容错位');

  blank(10, 10);
  S.tool = 'pencil'; S.paintIdx = 9; API.act(0);
  API.expandCanvas(12, 12, 8);              // 右下对齐：原内容移到 (2,2)
  const shifted = 2*12 + 2;
  if (S.cells[shifted] === 9) ok('右下锚点把内容推到新画布右下');
  else bad(`右下锚点错位: cells[${shifted}]=${S.cells[shifted]}`);
} catch (e) { bad('尺寸测试抛错: ' + e.message); }

/* ---------- 6. 成品厘米尺寸 ---------- */
console.log('\n== 6. 成品尺寸换算 ==');
try {
  S.gw = S.gh = 64;
  resetBrand('standard', 'mard'); API.updateSizeInfo();
  console.log('    标准291 64×64: ' + info());
  if (info().includes('16.6') && info().includes('cm')) ok('2.6mm 豆 -> 16.6 cm');
  else bad('cm 换算异常: ' + info());

  resetBrand('hama', null); API.updateSizeInfo();
  console.log('    Hama 64×64: ' + info());
  if (info().includes('32.0')) ok('5mm 豆 -> 32.0 cm（按品牌自动换豆径）');
  else bad('Hama cm 换算异常: ' + info());

  resetBrand('dmc', null); API.updateSizeInfo();
  if (info().includes('十字绣')) ok('DMC 不折算厘米');
  else bad('DMC 应提示无豆径');

  resetBrand('standard', 'mard'); API.updateSizeInfo();
  if (info().includes('9 块')) ok('64×64 -> 9 块 29×29 底板');
  else bad('底板数异常: ' + info());

  resetBrand('standard', 'mard');
  S.gw = IW; S.gh = IH;
} catch (e) { bad('成品尺寸测试抛错: ' + e.message); }

/* ---------- 7. 铅笔改色与限色联动 ---------- */
console.log('\n== 7. 铅笔改色后重算，改动不应被覆盖 ==');
try {
  freshImage();
  const target = [...S.cells].findIndex(v => v >= 0);
  const autoVal = S.cells[target];
  const NEWV = S.used.find(u => u.i !== autoVal).i;
  S.tool = 'pencil'; S.paintIdx = NEWV;
  API.act(target);
  S.tool = 'inspect';
  if (S.cells[target] === NEWV && S.base[target] === NEWV) ok('改色同时写入 cells 与 base');
  else bad(`改色未同步: cells=${S.cells[target]} base=${S.base[target]} 期望 ${NEWV}`);

  S.maxColors = 99; API.applyLimit();
  if (S.cells[target] === NEWV) ok('重算后手改的颜色仍保留（没被自动配色结果盖掉）');
  else bad(`重算后改动丢失: ${S.cells[target]} != ${NEWV}`);

  fire(getEl('undo'), 'click');
  if (S.cells[target] === autoVal) ok('撤销可还原');
  else bad(`撤销后 ${S.cells[target]} != ${autoVal}`);
  S.maxColors = 0; API.applyLimit();
} catch (e) { bad('改色联动测试抛错: ' + e.message); }

/* ---------- 8. 限色 ---------- */
console.log('\n== 8. 限色到 3 色 ==');
try {
  freshImage();
  const before = new Set([...S.cells].filter(v => v >= 0)).size;
  S.maxColors = 3; API.applyLimit();
  const after = new Set([...S.cells].filter(v => v >= 0)).size;
  console.log(`    ${before} 色 -> ${after} 色`);
  if (after <= 3) ok('限色生效'); else bad(`限色未生效: ${after} 色`);
  S.maxColors = 0; API.applyLimit();
} catch (e) { bad('限色抛错: ' + e.message); }

/* ---------- 9. 绘制 ---------- */
console.log('\n== 9. 绘制 ==');
try {
  freshImage();
  for (const o of [{ showCode: true, showGrid: true, showBoard: true, cell: 24 },
                   { showCode: false, showGrid: false, showBoard: false, cell: 3 },
                   { showCode: true, showGrid: true, showBoard: false, cell: 60 }]) {
    Object.assign(S, o);
    API.draw();
    ok(`draw(cell=${o.cell}, code=${o.showCode}) 无异常`);
  }
  Object.assign(S, { showCode: true, showGrid: true, showBoard: false, cell: 24 });
  // 大图纸：像素上限必须把格子尺寸压下来，画布不超限
  API.newBlank(400, 400);
  API.setCellSize(60);
  const px = S.gw * S.cell * S.gh * S.cell;
  if (S.cell <= 60 && px <= 24e6) ok(`400×400 自动限到 ${S.cell}px/格（画布 ${(px/1e6).toFixed(1)}M px）`);
  else bad(`像素上限失效: ${S.cell}px/格`);
  API.newBlank(IW, IH); API.setCellSize(24);
} catch (e) { bad('draw 抛错: ' + e.message); }

/* ---------- 10. 工具切换 ---------- */
console.log('\n== 10. 工具切换 ==');
try {
  const tb = env.documentStub.querySelectorAll('#tools button');
  const toolsHtml = (html.match(/<div class="tools" id="tools">([\s\S]*?)<\/div>/) || [, ''])[1];
  const realTools = [...toolsHtml.matchAll(/data-t="([a-z]+)"/g)].map(m => m[1]);
  if (realTools.join() === tb.map(b => b.dataset.t).join())
    ok(`桩件工具栏与真实 HTML 一致（${realTools.join(' / ')}）`);
  else bad(`桩件 [${tb.map(b => b.dataset.t)}] 与 HTML [${realTools}] 不一致，测试已失效`);

  for (const [i, want] of [[1, 'pencil'], [2, 'eraser'], [3, 'picker'], [4, 'line'],
                           [5, 'rect'], [6, 'ellipse'], [7, 'bucket'], [0, 'inspect']]) {
    fire(tb[i], 'click');
    if (S.tool === want) ok(`点按钮 -> S.tool = ${want}`);
    else bad(`点按钮后期望 ${want}，实际 ${S.tool}`);
  }
  fire(tb[3], 'click');
  if (/只读|不会改动/.test(getEl('toolHint').textContent)) ok('吸色按钮显示对应提示文案');
  else bad('吸色提示文案异常: ' + getEl('toolHint').textContent);
  fire(tb[0], 'click');
} catch (e) { bad('工具切换抛错: ' + e.message); }

/* ---------- 11. 吸色工具 ---------- */
console.log('\n== 11. 吸色工具 ==');
try {
  setPix((x, y) => {
    if ((x < 3 && y < 3) || (x > 12 && y > 12)) return [0, 0, 0, 0];
    return y < 8 ? [200, 60, 60] : [60, 80, 200];
  });
  S.img = {}; S.srcW = IW; S.srcH = IH; S.gw = IW; S.gh = IH;
  S.maxColors = 0; S.dither = false; S.dropBg = false;
  clearHistory(); API.mapCells();

  const colored = [...S.cells].findIndex(v => v >= 0);
  const blankIdx = [...S.cells].findIndex(v => v < 0);
  if (colored >= 0 && blankIdx >= 0) ok(`测试图同时有实格(${colored})与空格(${blankIdx})`);
  else bad('测试图缺少实格或空格');

  const snapshot = Int32Array.from(S.cells);
  S.tool = 'picker'; S.paintIdx = 0; clearHistory();
  API.act(colored);
  if (S.paintIdx === S.cells[colored]) ok(`吸色取到了第 ${colored} 格的颜色（索引 ${S.paintIdx}）`);
  else bad(`吸色失败: paintIdx=${S.paintIdx}，该格是 ${S.cells[colored]}`);
  if (S.cells.every((v, i) => v === snapshot[i])) ok('吸色不改动图纸任何一格');
  else bad('吸色把图纸改了');
  if (S.history.length === 0) ok('吸色不产生撤销记录');
  else bad(`吸色产生了 ${S.history.length} 条撤销记录`);
  if (getEl('paintCode').textContent === S.palette[S.paintIdx].code
      && getEl('paintSw').style.background === S.palette[S.paintIdx].hex)
    ok('工具栏铅笔色指示已同步（色号 + 色块）');
  else bad('铅笔色指示未同步');

  S.paintIdx = 3;
  API.act(blankIdx);
  if (S.paintIdx === 3) ok('吸到空格不会清掉已有铅笔色');
  else bad(`吸空格后 pencilIdx 变成 ${S.paintIdx}`);
  if (/空/.test(getEl('inspBody').innerHTML)) ok('吸空格仍会更新检查器');
  else bad('吸空格后检查器异常');

  const g = getEl('grid');
  S.cell = 24;
  const c0 = [...S.cells].findIndex(v => v >= 0);
  S.tool = 'picker'; S.paintIdx = 0;
  fire(g, 'mousedown', paintAt(c0 % S.gw, (c0 / S.gw) | 0));
  const picked = S.paintIdx;
  const other = [...S.cells].findIndex((v, i) => v >= 0 && i !== c0);
  fire(g, 'mousemove', paintAt(other % S.gw, (other / S.gw) | 0));
  if (S.paintIdx === picked) ok('吸色拖拽不会一路改铅笔色');
  else bad('吸色拖拽时铅笔色被跟着改了');
  fire(env.windowStub, 'mouseup');

  S.paintIdx = S.palette.length - 1;
  const t1 = [...S.cells].findIndex(v => v < 0);
  const t2 = [...S.cells].findIndex((v, i) => v < 0 && i !== t1);
  S.tool = 'pencil';
  fire(g, 'mousedown', paintAt(t1 % S.gw, (t1 / S.gw) | 0));
  fire(g, 'mousemove', paintAt(t2 % S.gw, (t2 / S.gw) | 0));
  fire(env.windowStub, 'mouseup');
  if (S.cells[t1] === S.paintIdx && S.cells[t2] === S.paintIdx) ok('铅笔拖拽仍能连续涂色');
  else bad(`铅笔拖拽失效: ${S.cells[t1]} / ${S.cells[t2]}`);

  S.tool = 'inspect'; S.paintIdx = 0; API.updatePaintUI();
} catch (e) { bad('吸色工具测试抛错: ' + e.message); }

/* ---------- 12. 用量列表双击 ---------- */
console.log('\n== 12. 用量列表双击选色 ==');
try {
  setPix((x, y) => BANDS[Math.min(3, Math.floor(y / 4))]);
  S.img = {}; S.gw = S.gh = IW; S.maxColors = 0; S.dither = false; S.dropBg = false;
  API.mapCells();
  API.renderUsage();
  const ids = [...getEl('use').innerHTML.matchAll(/data-i="(\d+)"/g)].map(m => +m[1]);
  if (ids.length >= 3) ok(`用量列表渲染出 ${ids.length} 行，取前 3 行做双击测试`);
  else bad('用量行数不足，无法测试');

  const clickColor = i => fire(getEl('use'), 'click', {
    target: { closest: () => ({ dataset: { i: String(i) } }) },
  });

  S.paintIdx = ids[1]; S.highlight = -1;
  clickColor(ids[0]);
  if (S.highlight === ids[0]) ok('单击色块 -> 高亮该颜色');
  else bad(`单击未高亮: ${S.highlight} != ${ids[0]}`);
  if (S.paintIdx === ids[1]) ok('单击不改变铅笔色');
  else bad('单击就把铅笔色改了');

  clickColor(ids[2]); clickColor(ids[2]);
  if (S.paintIdx === ids[2]) ok(`双击色块 -> 铅笔色切到索引 ${ids[2]}`);
  else bad(`双击选色失败: paintIdx=${S.paintIdx}，期望 ${ids[2]}`);
  if (S.highlight === ids[2]) ok('双击后仍保持高亮（没有把高亮又切掉）');
  else bad(`双击后高亮被切掉了: ${S.highlight}`);
  if (getEl('paintCode').textContent === S.palette[ids[2]].code) ok('双击后工具栏铅笔色同步');
  else bad('双击后工具栏未同步');

  const realNow = Date.now;
  S.highlight = -1;
  const keep = S.paintIdx;
  clickColor(ids[0]);
  Date.now = () => realNow() + 5000;
  clickColor(ids[0]);
  Date.now = realNow;
  if (S.paintIdx === keep) ok('间隔过久的两次单击不会被误判成双击');
  else bad('慢速两次单击被误判成双击');
  if (S.highlight === -1) ok('两次慢速单击各自生效（高亮被切换两次）');
  else bad(`慢速单击高亮异常: ${S.highlight}`);

  S.highlight = -1; S.paintIdx = 0; API.updatePaintUI(); API.draw();
} catch (e) { bad('双击选色测试抛错: ' + e.message); }

/* ---------- 13. 换品牌铅笔色不越界 ---------- */
console.log('\n== 13. 换品牌后铅笔色不越界 ==');
try {
  resetBrand('standard', 'mard');
  const big = S.palette.length - 1;
  API.setPaint(big);
  console.log(`    标准色板第 ${big} 色 = ${S.palette[big].code} ${S.palette[big].hex}`);

  API.setPaint(10);
  S.codeSys = 'coco'; API.buildPalette();
  if (S.paintIdx === 10) ok('色板长度够时铅笔色索引原样保留');
  else bad(`色板够长却把 pencilIdx 改成了 ${S.paintIdx}`);
  S.codeSys = 'mard'; API.buildPalette();

  API.setPaint(big);
  resetBrand('hama', null);
  if (S.paintIdx >= 0 && S.paintIdx < S.palette.length)
    ok(`291 色板第 ${big} 色 -> 换到 50 色 Hama，铅笔色就近落到合法索引 ${S.paintIdx}（${S.palette[S.paintIdx].code}）`);
  else bad(`换成 Hama 后 pencilIdx 越界: ${S.paintIdx} / ${S.palette.length}`);

  const t = [...S.cells].findIndex(v => v >= 0);
  S.tool = 'pencil'; API.act(t); S.tool = 'inspect';
  if (S.cells[t] === S.paintIdx) ok('改色只写入合法索引');
  else bad(`写入了异常索引 ${S.cells[t]}，pencilIdx=${S.paintIdx}`);
  try { API.draw(); ok('换品牌后绘制不抛错（无越界索引）'); }
  catch (e) { bad('换品牌后绘制抛错: ' + e.message); }

  S.paintIdx = 99999;
  API.act(t);
  if (S.cells[t] < S.palette.length) ok('pencilIdx 被人为越界时 act() 拒绝写入');
  else bad('越界 pencilIdx 被写进了 cells');
  try { API.draw(); ok('越界状态下 draw() 仍不抛错'); }
  catch (e) { bad('越界状态下 draw() 抛错: ' + e.message); }

  resetBrand('standard', 'mard');
  S.paintIdx = 0; API.updatePaintUI();
  if ([...S.cells].every(v => v < S.palette.length)) ok('换回标准色板后索引全部合法');
  else bad('换回标准色板后出现越界索引');
} catch (e) { bad('换品牌铅笔色测试抛错: ' + e.message); }

/* ---------- 14. 检查器 / 用量 ---------- */
console.log('\n== 14. 检查器与用量列表 ==');
try {
  setPix((x, y) => {
    if ((x < 3 && y < 3) || (x > 12 && y > 12)) return [0, 0, 0, 0];
    return BANDS[Math.min(3, Math.floor(y / 4))];
  });
  S.img = {}; S.gw = S.gh = IW; S.maxColors = 0; API.mapCells();
  resetBrand('standard', 'mard');

  API.inspect([...S.cells].findIndex(v => v >= 0));
  const ih = getEl('inspBody').innerHTML;
  if (/第 \d+ 列/.test(ih)) ok('检查器输出坐标'); else bad('检查器内容异常');
  const n = (ih.match(/<div class="r/g) || []).length;
  if (n === 5) ok('跨品牌色号对照列出 5 个体系'); else bad(`跨品牌对照 ${n} 行，期望 5`);

  API.inspect([...S.cells].findIndex(v => v < 0));
  if (/空（不拼）/.test(getEl('inspBody').innerHTML)) ok('点空格显示「空（不拼）」');
  else bad('空格显示异常');

  API.renderUsage();
  const rows = (getEl('use').innerHTML.match(/class="u/g) || []).length;
  if (rows === S.used.length) ok(`用量列表 ${rows} 行，与色数一致`); else bad('用量行数不符');
  if (getEl('useTotal').textContent.includes('颗')) ok('总量显示正确');
  else bad('总量显示异常');
} catch (e) { bad('渲染抛错: ' + e.message); }

/* ---------- 15. 品牌切换 ---------- */
console.log('\n== 15. 切换品牌与色号体系 ==');
try {
  freshImage((x, y) => BANDS[Math.min(3, Math.floor(y / 4))]);
  const switchTo = (brandId, codeSys) => {
    S.brandId = brandId;
    API.colourSystemOptions();
    if (codeSys) S.codeSys = codeSys;
    API.buildPalette();
    API.updateSizeInfo();
    return S.palette.length;
  };
  for (const [b, cs] of [['standard', 'mard'], ['standard', 'coco'], ['standard', 'panpan'],
                         ['standard', 'mixiaowo'], ['hama', null], ['perler', null],
                         ['artkal-s', null], ['kaka', null], ['shishi', null],
                         ['tongqu', null], ['youken', null], ['dmc', null]]) {
    let n;
    try { n = switchTo(b, cs); } catch (e) { bad(`切到 ${b} 抛错: ${e.message}`); continue; }
    const codesOk = S.palette.every(p => p.code && p.code !== '?');
    const idxOk = S.cells ? [...S.cells].every(v => v < S.palette.length) : false;
    const cntOk = S.cells ? S.used.reduce((a, u) => a + u.c, 0) === [...S.cells].filter(v => v >= 0).length : false;
    const tag = `${b}${cs ? '/' + cs : ''}`.padEnd(18);
    if (codesOk && idxOk && cntOk)
      console.log(`    ok    ${tag} ${String(n).padStart(3)} 色  色号正常  索引合法  统计吻合`);
    else bad(`${tag} 色板 ${n} 色 色号=${codesOk} 索引=${idxOk} 统计=${cntOk}`);
  }
  resetBrand('standard', 'mard');
  getEl('codeSys').value = 'panpan'; fire(getEl('codeSys'), 'change');
  if (S.palette.every(p => /^\d+$/.test(p.code))) ok('盼盼体系色号为纯数字');
  else bad('盼盼色号格式异常');
  getEl('codeSys').value = 'mard'; fire(getEl('codeSys'), 'change');
  if (S.brandId === 'standard' && S.codeSys === 'mard' && S.palette.length === 291) ok('切回 标准291 / MARD');
  else bad('切回默认失败');
  if ([...S.cells].every(v => v < S.palette.length)) ok('切换色号体系后格子索引仍合法');
  else bad('切换色号体系后出现越界索引');
} catch (e) { bad('品牌切换测试抛错: ' + e.message); }

/* ---------- 16. 核心回归：缩放基于当前画面 ---------- */
console.log('\n== 16. 核心回归：×2 基于当前画面（含手改） ==');
try {
  freshImage();
  S.tool = 'pencil'; S.paintIdx = 77; S.brush = 1;
  API.act(3);
  API.act(3 + 5 * 16);                     // 手改两格
  S.tool = 'inspect';
  const before = Int32Array.from(S.cells);
  const multis = env.documentStub.querySelectorAll('#mults button');

  fire(multis[0], 'click');                 // 16×16 -> 32×32
  let blockOk = true;
  for (let y = 0; y < 16 && blockOk; y++) for (let x = 0; x < 16; x++){
    const v = before[y * 16 + x];
    for (let dy = 0; dy < 2 && blockOk; dy++) for (let dx = 0; dx < 2; dx++){
      if (S.cells[(y * 2 + dy) * 32 + x * 2 + dx] !== v){ blockOk = false; break; }
    }
  }
  if (blockOk) ok('×2 后逐格复制，颜色完全一致（没有重新配色）');
  else bad('×2 后内容和放大前不一致');
  if (S.cells[(5 * 2) * 32 + 3 * 2] === 77) ok('手改的格子跟着放大（2×2 块）');
  else bad('手改格子在放大后丢失');

  // 换品牌：手改仍在，且不会退回原图
  S.brandId = 'hama'; API.colourSystemOptions(); API.buildPalette();
  const cell = (5 * 2) * 32 + 3 * 2;
  if (S.cells[cell] >= 0 && S.cells[cell] < S.palette.length) ok('换品牌后手改格子仍是一个合法豆色');
  else bad('换品牌后手改格子越界');

  // 缩回 16×16：仍是放大前的内容
  resetBrand('standard', 'mard');
  API.resizeTo(16, 16);
  let backOk = true;
  for (let i = 0; i < 16 * 16; i++){
    const v = before[i];
    const got = S.cells[i];
    if (v < 0){ if (got >= 0) { backOk = false; break; } continue; }
    if (got < 0) { backOk = false; break; }
  }
  if (backOk && S.gw === 16) ok('缩回原尺寸后内容仍在（空格/实格结构保持）');
  else bad('缩回原尺寸后内容结构被破坏');

  // 撤销：结构变化也可撤销
  fire(getEl('undo'), 'click');
  if (S.gw === 32) ok('撤销缩放回到 32×32');
  else bad(`撤销缩放后尺寸 ${S.gw}（期望 32）`);
  fire(getEl('redo'), 'click');
  if (S.gw === 16) ok('重做回到 16×16');
  else bad(`重做后尺寸 ${S.gw}（期望 16）`);
} catch (e) { bad('缩放回归测试抛错: ' + e.message); }

/* ---------- 17. 新建空白图纸 ---------- */
console.log('\n== 17. 新建空白图纸 ==');
try {
  API.newBlank(24, 18);
  if (S.gw === 24 && S.gh === 18) ok('新建 24×18 空白图纸');
  else bad(`新建尺寸不对: ${S.gw}×${S.gh}`);
  if ([...S.cells].every(v => v < 0)) ok('空白图纸所有格子都是空（不拼）');
  else bad('空白图纸里有颜色');
  API.renderUsage();
  if (getEl('use').innerHTML.includes('还没有生成')) ok('空白图纸用量列表显示空状态');
  else bad('空白图纸用量列表异常');

  S.tool = 'pencil'; S.paintIdx = 12; S.brush = 1;
  API.act(0);
  API.expandCanvas(30, 24, 0);
  if (S.gw === 30 && S.gh === 24 && S.cells[0] === 12) ok('空白图纸可随时扩展，内容不缩放');
  else bad('空白图纸扩展失败');

  // 空白图纸也能导出
  env.calls.toBlob = 0;
  API.exportPNG();
  if (env.calls.toBlob > 0) ok('空白/手绘图纸可导出 PNG');
  else bad('空白图纸导出失败');
} catch (e) { bad('空白图纸测试抛错: ' + e.message); }

/* ---------- 18. Ctrl+Z / Ctrl+Shift+Z ---------- */
console.log('\n== 18. 快捷键撤销 / 重做 ==');
try {
  blank(10, 10);
  S.tool = 'pencil'; S.paintIdx = 30; S.brush = 1;
  API.act(0);
  API.act(1);
  const nHist = S.history.length;
  if (nHist === 2) ok('两次点击 = 两条撤销记录');
  else bad(`撤销记录数 ${nHist}（期望 2）`);

  fireDoc('keydown', { key:'z', ctrlKey:true, shiftKey:false,
                       target:{ tagName:'BODY' }, preventDefault(){} });
  if (S.cells[1] === -1) ok('Ctrl+Z 撤销上一步');
  else bad(`Ctrl+Z 未生效: cells[1]=${S.cells[1]}`);
  fireDoc('keydown', { key:'z', ctrlKey:true, shiftKey:true,
                       target:{ tagName:'BODY' }, preventDefault(){} });
  if (S.cells[1] === 30) ok('Ctrl+Shift+Z 重做');
  else bad(`Ctrl+Shift+Z 未生效: cells[1]=${S.cells[1]}`);
  fireDoc('keydown', { key:'y', ctrlKey:true,
                       target:{ tagName:'BODY' }, preventDefault(){} });

  // 输入框里按 Ctrl+Z 不能被拦截
  const before = S.cells[0];
  fireDoc('keydown', { key:'z', ctrlKey:true, shiftKey:false,
                       target:{ tagName:'INPUT' }, preventDefault(){} });
  if (S.cells[0] === before) ok('输入框聚焦时 Ctrl+Z 不拦截（交给浏览器）');
  else bad('输入框里的 Ctrl+Z 被工具抢走了');

  // 一次拖拽只产生一条记录
  blank(12, 12);
  const g = getEl('grid');
  S.cell = 10; S.tool = 'pencil'; S.paintIdx = 40; S.brush = 1;
  const h0 = S.history.length;
  fire(g, 'mousedown', paintAt(0, 0));
  fire(g, 'mousemove', paintAt(1, 0));
  fire(g, 'mousemove', paintAt(2, 0));
  fire(env.windowStub, 'mouseup');
  if (S.history.length === h0 + 1) ok('一次拖拽合并成一条撤销记录');
  else bad(`拖拽产生 ${S.history.length - h0} 条记录（期望 1）`);

  // 结构操作进历史：撤销后尺寸回退
  const w0 = S.gw;
  S.tool = 'inspect';
  API.resizeTo(24, 24);
  API.undo();
  if (S.gw === w0) ok('缩放可撤销（结构快照）');
  else bad('缩放撤销失败');
} catch (e) { bad('撤销快捷键测试抛错: ' + e.message); }

/* ---------- 19. 笔刷 / 形状 ---------- */
console.log('\n== 19. 笔刷与直线/矩形/圆形 ==');
try {
  blank(12, 12);
  S.tool = 'pencil'; S.paintIdx = 60; S.brush = 3;
  API.act(6 * 12 + 6);
  let painted = 0;
  for (const v of S.cells) if (v === 60) painted++;
  if (painted === 9) ok('笔刷 3×3：一次涂 9 格');
  else bad(`笔刷 3×3 涂了 ${painted} 格`);

  S.brush = 1;
  const line = API.lineCells(0, 11 * 12 + 11);
  if (line.length === 12) ok('对角线直线长度正确（12 格）');
  else bad(`直线长度 ${line.length}，期望 12`);
  const rectOutline = API.rectCells(0, 11 * 12 + 11, false);
  const rectFill = API.rectCells(0, 11 * 12 + 11, true);
  if (rectOutline.length === 44 && rectFill.length === 144) ok('矩形：空心 44 格 / 实心 144 格');
  else bad(`矩形格数异常 outline=${rectOutline.length} fill=${rectFill.length}`);
  const ellOutline = API.ellipseCells(0, 11 * 12 + 11, false);
  const ellFill = API.ellipseCells(0, 11 * 12 + 11, true);
  if (ellOutline.length > 20 && ellFill.length > ellOutline.length && ellFill.length < 144)
    ok(`圆形：空心 ${ellOutline.length} 格 / 实心 ${ellFill.length} 格`);
  else bad(`圆形格数异常 ${ellOutline.length}/${ellFill.length}`);

  // 真实拖拽画矩形
  blank(12, 12);
  S.cell = 10; S.tool = 'rect'; S.paintIdx = 70; S.shapeFill = true;
  fire(getEl('grid'), 'mousedown', paintAt(2, 2));
  fire(getEl('grid'), 'mousemove', paintAt(5, 5));
  if (S.preview && S.preview.cells.length === 16) ok('矩形拖拽预览 4×4=16 格（未落笔）');
  else bad(`矩形预览异常: ${S.preview && S.preview.cells.length}`);
  if ([...S.cells].every(v => v < 0)) ok('预览阶段不改图纸');
  else bad('预览阶段就把格子改了');
  fire(env.windowStub, 'mouseup');
  let filledRect = 0;
  for (let y = 2; y <= 5; y++) for (let x = 2; x <= 5; x++) if (S.cells[y * 12 + x] === 70) filledRect++;
  if (filledRect === 16) ok('松开鼠标后矩形落笔 16 格');
  else bad(`矩形落笔 ${filledRect} 格`);
  if (S.history.length === 1) ok('整个矩形 = 一条撤销记录');
  else bad(`矩形产生了 ${S.history.length} 条记录`);
} catch (e) { bad('笔刷/形状测试抛错: ' + e.message); }

/* ---------- 20. 油漆桶 4 / 8 连通 ---------- */
console.log('\n== 20. 油漆桶 ==');
try {
  blank(6, 6);
  if (API.floodFill(0, 4, 2) === 36) ok('空白图纸上油漆桶一次铺满 36 格');
  else bad('空白图纸填充数量不对');

  // 只在斜对角相连的两格：4 连通填 1 格，8 连通填 2 格
  blank(4, 4);
  S.cells[0] = 5; S.base[0] = 5;
  S.cells[5] = 5; S.base[5] = 5;
  API.recount();
  const n4 = API.floodFill(0, 4, 7);
  blank(4, 4);
  S.cells[0] = 5; S.base[0] = 5;
  S.cells[5] = 5; S.base[5] = 5;
  API.recount();
  const n8 = API.floodFill(0, 8, 7);
  if (n4 === 1 && n8 === 2) ok(`斜对角相邻：4 连通填 ${n4} 格，8 连通填 ${n8} 格`);
  else bad(`连通性判定异常 4→${n4} / 8→${n8}`);
} catch (e) { bad('油漆桶测试抛错: ' + e.message); }

/* ---------- 21. 相近色推荐 / 一键替换 ---------- */
console.log('\n== 21. 相近色与一键替换 ==');
try {
  freshImage((x, y) => BANDS[Math.min(3, Math.floor(y / 4))]);
  const a = S.used[0].i;
  const b = S.used[1].i;
  API.setHighlight(a);
  const simHtml = getEl('sim').innerHTML;
  if (getEl('simWrap').hidden === false && /data-i="\d+"/.test(simHtml))
    ok(`相近色面板列出了 ${(simHtml.match(/data-i=/g) || []).length} 个候选`);
  else bad('相近色面板没渲染');

  const beforeCount = S.counts.get(a) || 0;
  clearHistory();
  const moved = API.replaceColor(a, b);
  if (moved === beforeCount && !S.counts.has(a) && S.counts.get(b) >= beforeCount)
    ok(`一键替换：${beforeCount} 格从 ${S.palette[a].code} 换成 ${S.palette[b].code}`);
  else bad(`替换结果不对：moved=${moved} 期望 ${beforeCount}`);

  API.undo();
  if (S.counts.get(a) === beforeCount) ok('替换可撤销');
  else bad('替换撤销失败');
} catch (e) { bad('相近色测试抛错: ' + e.message); }

/* ---------- 22. 配色整理 ---------- */
console.log('\n== 22. 配色整理（合并相近色 / 清杂色）==');
try {
  // 找一对很相近的在用色（ΔE < 3）
  let pair = null;
  for (let i = 0; i < S.palette.length && !pair; i++)
    for (let j = i + 1; j < S.palette.length; j++)
      if (API.deltaE2000(S.palette[i].lab, S.palette[j].lab) < 3){ pair = [i, j]; break; }
  if (!pair){ bad('色板里找不到相近色对，无法测试整理'); }
  else {
    blank(8, 8);
    for (let i = 0; i < 64; i++){ S.cells[i] = pair[i % 2]; S.base[i] = pair[i % 2]; }
    API.recount(); API.renderUsage();
    getEl('tidyPreset').value = '8';
    getEl('tidyMin').value = '0';
    const changed = API.tidyApply();
    if (changed > 0 && S.used.length === 1) ok(`相近色整理：2 色 -> 1 色（改写 ${changed} 格）`);
    else bad(`整理后仍有 ${S.used.length} 色`);

    API.undo();
    if (S.used.length === 2) ok('整理可撤销');
    else bad('整理撤销失败');
  }

  // 清孤立杂色
  blank(9, 9);
  const A = 0, B = 120;
  for (let i = 0; i < 81; i++){ S.cells[i] = A; S.base[i] = A; }
  S.cells[4 * 9 + 4] = B; S.base[4 * 9 + 4] = B;
  API.recount();
  getEl('tidyPreset').value = '0';
  getEl('tidyMin').value = '1';
  API.tidyApply();
  if (S.cells[4 * 9 + 4] === A && S.used.length === 1) ok('孤立杂色（1 格）被并入邻域主色');
  else bad(`清杂色失败：cells=${S.cells[4 * 9 + 4]} 色数 ${S.used.length}`);
} catch (e) { bad('配色整理测试抛错: ' + e.message); }

/* ---------- 23. 色卡浮层 ---------- */
console.log('\n== 23. 色卡选色 ==');
try {
  resetBrand('standard', 'mard');
  API.openPalette();
  if (getEl('palPop').hidden === false) ok('点铅笔色打开色卡浮层');
  else bad('色卡浮层没打开');
  const hits = API.palFilter('B08');
  if (hits.length && hits.some(i => S.palette[i].code === 'B08')) ok('色号搜索命中 B08');
  else bad('色号搜索失败');
  const none = API.palFilter('ZZZZ');
  if (none.length === 0) ok('搜不到时返回空列表'); else bad('无效搜索返回了结果');
  API.renderPalGrid('B08');
  if (getEl('palGrid').innerHTML.includes('data-i=')) ok('色卡网格渲染出色块');
  else bad('色卡网格没渲染');
  API.pickPaletteIndex(hits[0]);
  if (S.paintIdx === hits[0] && getEl('palPop').hidden === true) ok('点色块选中并关闭浮层');
  else bad('点色块选色失败');
  if (getEl('paintCode').textContent === S.palette[hits[0]].code) ok('选中后铅笔色号同步');
  else bad('选中后铅笔色号未同步');
} catch (e) { bad('色卡测试抛错: ' + e.message); }

/* ---------- 24. 导出 ---------- */
console.log('\n== 24. 导出 ==');
try {
  freshImage((x, y) => BANDS[Math.min(3, Math.floor(y / 4))]);
  S.cell = 24;
  env.calls.toBlob = 0;
  env.calls.click = 0;
  API.exportPNG();
  ok(`exportPNG 无异常（toBlob ${env.calls.toBlob} 次）`);
  API.exportCSV();
  ok('exportCSV 无异常');
  if (env.calls.toBlob > 0 && env.calls.click > 0) ok('导出确实产出了文件');
  else bad('导出未触发下载');
} catch (e) { bad('导出测试抛错: ' + e.message); }

console.log('\n' + (fail ? `===== ${fail} 项失败 =====` : '===== 全部通过 ====='));
process.exit(fail ? 1 : 0);