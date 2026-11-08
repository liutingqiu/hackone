/* 算法层测试：配色同一性、限色合并、背景识别、镜像。
   这些是"结果对不对"的核心，不涉及界面。 */
const { makeStub } = require('./stub.js');

let fail = 0;
const ok = m => console.log('  PASS  ' + m);
const bad = m => { fail++; console.log('  FAIL  ' + m); };

const env = makeStub();
const API = env.API;
const S = API.S;

/* ---------- 1. 配色同一性 ---------- */
console.log('== 1. 配色同一性 ==');
try {
  S.brandId = 'standard'; API.colourSystemOptions(); S.codeSys = 'mard'; API.buildPalette();

  // 把色板里每个颜色本身当作输入，必须匹配回它自己
  let hit = 0, miss = [];
  for (let i = 0; i < S.palette.length; i += 7) {         // 抽样，控制耗时
    const p = S.palette[i];
    const got = API.nearestIdx(p.rgb, new Map(), 'de2000');
    if (got === i) hit++; else miss.push(`${p.code} -> ${S.palette[got].code}`);
  }
  if (!miss.length) ok(`抽样 ${Math.ceil(S.palette.length / 7)} 个颜色，全部匹配回自身`);
  else bad(`有颜色匹配不回自身: ${miss.slice(0, 5).join(', ')}`);

  // 缓存必须与不缓存结果一致
  const cache = new Map();
  const rgb = [123, 45, 200];
  const a = API.nearestIdx(rgb, cache, 'de2000');
  const b = API.nearestIdx(rgb, cache, 'de2000');
  if (a === b) ok('配色缓存结果一致'); else bad('缓存前后结果不同');

  // 三种算法都必须给出合法索引
  const badIdx = [];
  for (const algo of ['de2000', 'de76', 'rgb']) {
    for (const t of [[0, 0, 0], [255, 255, 255], [74, 138, 62], [200, 30, 30]]) {
      const i = API.nearestIdx(t, new Map(), algo);
      if (!(i >= 0 && i < S.palette.length)) badIdx.push(algo);
    }
  }
  if (!badIdx.length) ok('三种匹配算法都返回合法索引');
  else bad('越界索引: ' + badIdx.join(','));
} catch (e) { bad('配色测试抛错: ' + e.message); }

/* ---------- 2. 限色合并 ---------- */
console.log('\n== 2. 限色合并 ==');
try {
  API.buildPalette();
  // 造一个 8 色、用量递减的格子数组：下标 0 用得最多
  const counts = [40, 20, 10, 8, 6, 4, 2, 1];
  const total = counts.reduce((a, b) => a + b, 0);
  const build = () => {
    const arr = new Int32Array(total);
    let k = 0;
    counts.forEach((c, id) => { for (let i = 0; i < c; i++) arr[k++] = id; });
    return arr;
  };

  const src = build();
  const out3 = API.limitColors(src, 3);
  const kinds = new Set([...out3].filter(v => v >= 0));
  if (kinds.size <= 3) ok(`8 色限到 3 色，实际 ${kinds.size} 色`);
  else bad(`限色失效，仍有 ${kinds.size} 色`);

  if (src.every((v, i) => v === build()[i])) ok('limitColors 不修改传入数组（无原地副作用）');
  else bad('limitColors 改动了传入数组');

  if (kinds.has(0)) ok('用得最多的颜色(下标0)被保留');
  else bad('用得最多的颜色被合并掉了');

  // 限色后每颗豆子仍然存在，只是换了色号
  if ([...out3].every(v => v >= 0 && v < S.palette.length)) ok('限色后索引全部合法');
  else bad('限色产生了非法索引');

  // max 大于色数时保持原样
  const same = API.limitColors(src, 99);
  if (same.every((v, i) => v === src[i])) ok('色数上限大于实际色数时保持原样');
  else bad('上限宽松时结果被改动');

  // max = 1 时全部并成一色
  const one = new Set([...API.limitColors(src, 1)]);
  if (one.size === 1) ok('限到 1 色时全部并成一色');
  else bad('限到 1 色失败: ' + one.size);
} catch (e) { bad('限色测试抛错: ' + e.message); }

/* ---------- 3. 背景识别 ---------- */
console.log('\n== 3. 背景识别 ==');
try {
  // 16×16：四周白色边框(背景)，中间 6×6 红块里再嵌一个白点（不该被吃掉）
  const W = 16, H = 16;
  const rgba = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = (y * W + x) * 4;
    const inBlock = x >= 5 && x <= 10 && y >= 5 && y <= 10;
    const isHole = x === 7 && y === 7;               // 红块内部的白点
    const white = !inBlock || isHole;
    rgba[k] = white ? 255 : 200;
    rgba[k + 1] = white ? 255 : 30;
    rgba[k + 2] = white ? 255 : 30;
    rgba[k + 3] = 255;
  }
  const ext = API.maskBackground(rgba, W, H, 60);
  const extCount = [...ext].filter(v => v).length;
  if (ext[0] === 1) ok('边缘背景被识别');
  else bad('边缘背景没被识别');
  const holeIdx = 7 * W + 7;
  if (ext[holeIdx] === 0) ok('图案内部同色区域没有被误吃（泛洪只走连通）');
  else bad('把图案内部白点也当成背景了');
  if (ext[7 * W + 5] === 0) ok('红块本身不算背景');
  else bad('红块被当成背景');
  console.log(`    背景像素 ${extCount} 个`);
} catch (e) { bad('背景识别抛错: ' + e.message); }

/* ---------- 4. 透明像素 ---------- */
console.log('\n== 4. 透明像素 ==');
try {
  env.setPix((x, y) => (x < 8 && y < 8) ? [30, 30, 30, 0] : [30, 30, 30, 255]);
  S.img = {}; S.srcW = 16; S.srcH = 16; S.gw = 16; S.gh = 16;
  S.dither = false; S.dropBg = false; S.maxColors = 0;
  API.buildPalette(); API.mapCells();
  const empty = [...S.cells].filter(v => v < 0).length;
  if (empty === 64) ok('透明区（8×8=64 格）自动为空，不参与拼豆');
  else bad(`透明处理异常：空格 ${empty} 个，期望 64`);
  if (S.cells[0] < 0 && S.cells[15 * 16 + 15] >= 0) ok('透明与非透明区分正确');
  else bad('透明/非透明判定位错');
} catch (e) { bad('透明像素测试抛错: ' + e.message); }

/* ---------- 5. 镜像 ---------- */
console.log('\n== 5. 镜像 ==');
try {
  S.gw = 5; S.gh = 3;
  const a = Int32Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  const orig = Int32Array.from(a);
  API.mirrorCells(a);
  const want = [4, 3, 2, 1, 0, 9, 8, 7, 6, 5, 14, 13, 12, 11, 10];
  if (a.every((v, i) => v === want[i])) ok('5×3 镜像结果逐格正确');
  else bad('镜像结果错误: ' + a.join(','));
  API.mirrorCells(a);
  if (a.every((v, i) => v === orig[i])) ok('镜像两次回到原样（对合性）');
  else bad('镜像两次没回到原样');

  // mirrorIndex 说的"这一格镜像后落到哪"，必须和 mirrorCells 的实际移动一致
  const b = Int32Array.from(orig);
  API.mirrorCells(b);
  let idxOk = true;
  for (let i = 0; i < 15; i++) {
    const mi = API.mirrorIndex(i);
    const x = i % 5, y = (i / 5) | 0;
    if (mi !== y * 5 + (5 - 1 - x)) idxOk = false;
    if (b[mi] !== orig[i]) idxOk = false;
  }
  if (idxOk) ok('mirrorIndex 与 mirrorCells 下标一致');
  else bad('mirrorIndex 与 mirrorCells 不一致');
} catch (e) { bad('镜像测试抛错: ' + e.message); }

/* ---------- 6. 缩放重采样（基于当前画面，不是原图） ---------- */
console.log('\n== 6. 缩放重采样 ==');
try {
  API.buildPalette({ remap:false });
  // 4×4 文档，每格一个不同的色板索引
  const src = Int32Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  S.gw = 4; S.gh = 4;
  API.installDoc(4, 4, Int32Array.from(src));

  const up = API.resampleBase(8, 8, 'nearest');
  let blockOk = true;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++){
    const v = src[y * 4 + x];
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++)
      if (up[(y * 2 + dy) * 8 + (x * 2 + dx)] !== v) blockOk = false;
  }
  if (blockOk) ok('4×4 -> 8×8：整数倍放大是逐格块复制（颜色零误差）');
  else bad('整数倍放大没有保持逐格一致');

  // 放大后再缩回：每块是均匀的，最近邻应逐格还原
  S.gw = 8; S.gh = 8; S.base = up;
  const back = API.resampleBase(4, 4, 'nearest');
  if (back.every((v, i) => v === src[i])) ok('8×8 -> 4×4：最近邻缩小可还原（块均匀时）');
  else bad('最近邻缩小结果错误: ' + [...back].join(','));

  // 面积平均：全同色块必须还原成同一个索引，且结果全部合法
  S.gw = 8; S.gh = 8; S.base = up;
  const avg = API.resampleBase(4, 4, 'area');
  const avgOk = avg.every(v => v >= 0 && v < S.palette.length);
  if (avgOk) ok('面积平均缩小：输出索引全部合法');
  else bad('面积平均产生了非法索引');
  if (avg[0] === src[0]) ok('面积平均对均匀色块保持原色');
  else bad(`面积平均把均匀色块改了: ${avg[0]} != ${src[0]}`);

  // 非法目标尺寸被 clamp
  API.installDoc(4, 4, Int32Array.from(src));
  API.resizeTo(9999, 0);
  if (S.gw === 400 && S.gh === 1) ok('尺寸越界被 clamp 到 400×1');
  else bad(`尺寸 clamp 异常: ${S.gw}×${S.gh}`);
} catch (e) { bad('缩放重采样测试抛错: ' + e.message); }

/* ---------- 7. 形状几何 ---------- */
console.log('\n== 7. 形状几何 ==');
try {
  S.gw = 9; S.gh = 9;
  const line = API.lineCells(0, 8 * 9 + 8);
  if (line.length === 9 && line[0] === 0 && line[8] === 80) ok('对角线直线：9 格、首尾正确');
  else bad(`直线异常: ${line.length} 格`);

  const horizontal = API.lineCells(0, 8);
  if (horizontal.length === 9 && horizontal.every((v, i) => v === i)) ok('水平直线逐格连续');
  else bad('水平直线不连续');

  const outline = API.rectCells(0, 8 * 9 + 8, false);
  const solid = API.rectCells(0, 8 * 9 + 8, true);
  const perim = 4 * 9 - 4;
  if (outline.length === perim) ok(`9×9 矩形空心 = ${perim} 格（周长）`);
  else bad(`矩形空心 ${outline.length} 格，期望 ${perim}`);
  if (solid.length === 81) ok('9×9 矩形实心 = 81 格');
  else bad(`矩形实心 ${solid.length} 格`);

  const ellLine = API.ellipseCells(0, 8 * 9 + 8, false);
  const ellSolid = API.ellipseCells(0, 8 * 9 + 8, true);
  if (ellLine.length > 0 && ellLine.length < ellSolid.length && ellSolid.length <= 81)
    ok(`9×9 圆：空心 ${ellLine.length} 格 < 实心 ${ellSolid.length} 格 ≤ 81`);
  else bad(`圆格数异常 ${ellLine.length}/${ellSolid.length}`);
  if (ellLine.every(v => v >= 0 && v < 81)) ok('圆的所有格子都在画布内');
  else bad('圆越界');

  // 退化情况：单格拖拽不能崩
  const dot = API.ellipseCells(4, 4, false);
  if (dot.length === 1 && dot[0] === 4) ok('单格圆退化为 1 格');
  else bad('单格圆异常');
} catch (e) { bad('形状几何测试抛错: ' + e.message); }

/* ---------- 8. 孤立杂色清理 ---------- */
console.log('\n== 8. 孤立杂色清理 ==');
try {
  S.gw = 5; S.gh = 5;
  const arr = new Int32Array(25).fill(1);
  arr[12] = 2;                              // 中心一颗孤立杂色
  const moved = API.despeckle(arr, 1);
  if (moved === 1 && arr[12] === 1) ok('1 格孤立杂色被并入周围主色');
  else bad(`孤立杂色清理失败: moved=${moved} arr[12]=${arr[12]}`);

  const arr2 = new Int32Array(25).fill(1);
  arr2[12] = 2; arr2[13] = 2;               // 2 格小块
  API.despeckle(arr2, 1);
  if (arr2[12] === 2) ok('2 格小块不会被"1 格以下"误删');
  else bad('清理阈值失效，2 格小块被误删');

  const arr3 = new Int32Array(25).fill(1);
  arr3[12] = 2;
  API.despeckle(arr3, 2);
  if (arr3[12] === 1) ok('阈值放宽到 2 格时小块被并入');
  else bad('放宽阈值后小块没被并入');
} catch (e) { bad('清杂色测试抛错: ' + e.message); }

console.log('\n' + (fail ? `===== ${fail} 项失败 =====` : '===== 全部通过 ====='));
process.exit(fail ? 1 : 0);
