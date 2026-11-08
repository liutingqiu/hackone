/* 静态检查：结构、语法、DOM id 一致性、CIEDE2000 数学、色板完整性。
   这一层不需要 DOM/Cavas，跑得最快，用来挡掉最基础的错误。 */
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const html = fs.readFileSync(path.join(ROOT, '拼豆图纸工具.html'), 'utf8');

let fail = 0;
const ok = m => console.log('  PASS  ' + m);
const bad = m => { fail++; console.log('  FAIL  ' + m); };

/* ---------- 1. 结构 ---------- */
console.log('== 1. 结构 ==');
const jsonBlock = html.match(/<script type="application\/json" id="paletteData">([\s\S]*?)<\/script>/);
if (jsonBlock) ok('色板块存在'); else bad('找不到 paletteData 色板块');
const app = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
  .map(m => m[2]).find(b => b.includes('function nearestIdx'));
if (app) ok('主脚本块存在'); else bad('找不到主脚本块');

/* ---------- 2. 主脚本语法 ---------- */
console.log('\n== 2. 主脚本语法 ==');
try {
  new Function(app);
  ok(`语法可解析（${app.split('\n').length} 行）`);
} catch (e) {
  bad('语法错误: ' + e.message);
}

/* ---------- 3. DOM id 一致性 ---------- */
console.log('\n== 3. DOM id 一致性 ==');
// 只在标记里找 id：脚本内容里可能出现 id="..." 字样（注释、字符串），那不算 DOM id
const htmlNoScript = html.replace(/(<script[^>]*>)[\s\S]*?(<\/script>)/g, '$1$2');
const ids = [...htmlNoScript.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
if (!dup.length) ok(`无重复 id（共 ${ids.length} 个）`);
else bad(`重复 id: ${[...new Set(dup)].join(', ')}`);

const refs = [...new Set([...app.matchAll(/\$\('([^']+)'\)/g)].map(m => m[1]))];
const missing = refs.filter(r => !ids.includes(r));
if (!missing.length) ok(`${refs.length} 个 $('id') 引用全部存在`);
else bad(`引用了不存在的 id: ${missing.join(', ')}`);

const unused = ids.filter(i => !refs.includes(i) && !/\b(hidden|class|data-)/.test(i));
console.log('  提示  未被 JS 引用: ' + unused.join(', '));

/* ---------- 4. 色彩数学 ---------- */
console.log('\n== 4. CIEDE2000 算法（Sharma 测试向量）==');
const a0 = app.indexOf('/* ------------------------------------------------ 色彩数学');
const a1 = app.indexOf('/* ------------------------------------------------ 状态');
const M = new Function(app.slice(a0, a1) +
  '\nreturn {srgbToLab, deltaE2000, de76, rgbDist, textOn, clampN};')();

// Sharma et al. 2005 的 34 组官方测试向量
const VECTORS = [
  [[50.0000, 2.6772, -79.7751], [50.0000, 0.0000, -82.7485], 2.0425],
  [[50.0000, 3.1571, -77.2803], [50.0000, 0.0000, -82.7485], 2.8615],
  [[50.0000, 2.8361, -74.0200], [50.0000, 0.0000, -82.7485], 3.4412],
  [[50.0000, -1.3802, -84.2814], [50.0000, 0.0000, -82.7485], 1.0000],
  [[50.0000, -1.1848, -84.8006], [50.0000, 0.0000, -82.7485], 1.0000],
  [[50.0000, -0.9009, -85.5211], [50.0000, 0.0000, -82.7485], 1.0000],
  [[50.0000, 0.0000, 0.0000], [50.0000, -1.0000, 2.0000], 2.3669],
  [[50.0000, -1.0000, 2.0000], [50.0000, 0.0000, 0.0000], 2.3669],
  [[50.0000, 2.4900, -0.0010], [50.0000, -2.4900, 0.0009], 7.1792],
  [[50.0000, 2.4900, -0.0010], [50.0000, -2.4900, 0.0010], 7.1792],
  [[50.0000, 2.4900, -0.0010], [50.0000, -2.4900, 0.0011], 7.2195],
  [[50.0000, 2.4900, -0.0010], [50.0000, -2.4900, 0.0012], 7.2195],
  [[50.0000, -0.0010, 2.4900], [50.0000, 0.0009, -2.4900], 4.8045],
  [[50.0000, -0.0010, 2.4900], [50.0000, 0.0010, -2.4900], 4.8045],
  [[50.0000, -0.0010, 2.4900], [50.0000, 0.0011, -2.4900], 4.7461],
  [[50.0000, 2.5000, 0.0000], [50.0000, 0.0000, -2.5000], 4.3065],
  [[50.0000, 2.5000, 0.0000], [73.0000, 25.0000, -18.0000], 27.1492],
  [[50.0000, 2.5000, 0.0000], [61.0000, -5.0000, 29.0000], 22.8977],
  [[50.0000, 2.5000, 0.0000], [56.0000, -27.0000, -3.0000], 31.9030],
  [[50.0000, 2.5000, 0.0000], [58.0000, 24.0000, 15.0000], 19.4535],
  [[50.0000, 2.5000, 0.0000], [50.0000, 3.1736, 0.5854], 1.0000],
  [[50.0000, 2.5000, 0.0000], [50.0000, 3.2972, 0.0000], 1.0000],
  [[50.0000, 2.5000, 0.0000], [50.0000, 1.8634, 0.5757], 1.0000],
  [[50.0000, 2.5000, 0.0000], [50.0000, 3.2592, 0.3350], 1.0000],
  [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
  [[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.2630],
  [[61.2901, 3.7196, -5.3901], [61.4292, 2.2480, -4.9620], 1.8731],
  [[35.0831, -44.1164, 3.7933], [35.0232, -40.0716, 1.5901], 1.8645],
  [[22.7233, 20.0904, -46.6940], [23.0331, 14.9730, -42.5619], 2.0373],
  [[36.4612, 47.8580, 18.3852], [36.2715, 50.5065, 21.2231], 1.4146],
  [[90.8027, -2.0831, 1.4410], [91.1528, -1.6435, 0.0447], 1.4441],
  [[90.9257, -0.5406, -0.9208], [88.6381, -0.8985, -0.7239], 1.5381],
  [[6.7747, -0.2908, -2.4247], [5.8714, -0.0985, -2.2286], 0.6377],
  [[2.0776, 0.0795, -1.1350], [0.9033, -0.0636, -0.5514], 0.9082],
];
let worst = 0, worstPair = null;
for (const [l1, l2, want] of VECTORS) {
  const got = M.deltaE2000(l1, l2);
  const err = Math.abs(got - want);
  if (err > worst) { worst = err; worstPair = [want, got]; }
}
if (worst < 5e-4) ok(`${VECTORS.length} 组测试向量全部匹配（最大误差 ${worst.toExponential(1)}）`);
else bad(`CIEDE2000 偏差过大：期望 ${worstPair[0]}，实得 ${worstPair[1]}`);

const white = M.srgbToLab([255, 255, 255]);
if (Math.abs(white[0] - 100) < .01 && Math.abs(white[1]) < .02 && Math.abs(white[2]) < .02)
  ok('白色 -> Lab(100,0,0) 正确');
else bad('白色 Lab 异常: ' + white.map(v => v.toFixed(2)));

const black = M.srgbToLab([0, 0, 0]);
if (Math.abs(black[0]) < 1e-6) ok('黑色 L=0 正确'); else bad('黑色 L 异常: ' + black[0]);

if (M.deltaE2000([50, 10, 10], [50, 10, 10]) === 0) ok('同色色差为 0'); else bad('同色色差不为 0');

/* ---------- 5. 色板数据 ---------- */
console.log('\n== 5. 色板数据 ==');
let data = null;
try {
  data = JSON.parse(jsonBlock[1].replace(/<\\\//g, '</'));
  ok('色板 JSON 可解析');
} catch (e) { bad('色板 JSON 解析失败: ' + e.message); }

if (data) {
  const brands = data.brands;
  const expect = {
    standard: 291, hama: 50, perler: 70, 'artkal-s': 35,
    kaka: 284, shishi: 219, tongqu: 120, youken: 174, dmc: 508,
  };
  let allOk = true;
  for (const [id, b] of Object.entries(brands)) {
    const uniq = new Set(b.colors.map(c => c.hex)).size;
    const sysIds = b.codeSystems.map(cs => cs.id);
    let good = b.count === b.colors.length && expect[id] === b.count;
    for (const c of b.colors) {
      if (!/^#[0-9A-F]{6}$/.test(c.hex)) { good = false; break; }
      const rgb = c.rgb;
      const hex2 = '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
      if (hex2 !== c.hex) { good = false; console.log('    hex/rgb 不一致: ' + c.hex + ' vs ' + hex2); break; }
      if (!Array.isArray(c.lab) || c.lab.length !== 3 || !c.lab.every(Number.isFinite)) { good = false; break; }
      // 每个声明了的色号体系都必须有色号
      for (const s of sysIds) if (!c.codes[s]) { good = false; console.log(`    ${id} 缺 ${s} 色号 @${c.hex}`); break; }
      if (!good) break;
    }
    const tag = id.padEnd(11);
    if (good) console.log(`    ok    ${tag} ${String(b.count).padStart(3)} 色  唯一HEX ${String(uniq).padStart(3)}  ${sysIds.join('/')}`);
    else { allOk = false; console.log(`    FAIL  ${tag} ${b.count} 色  数据不完整`); }
    if (!good) fail++;
  }
  if (allOk) ok('全部品牌色板结构完整、hex 与 rgb 一致、色号无缺失');

  const total = Object.values(brands).reduce((a, b) => a + b.count, 0);
  console.log(`  合计 ${Object.keys(brands).length} 个品牌 / ${total} 色`);
  if (total === 1751) ok('合计 1751 色，与构建报告一致');
  else bad(`合计 ${total} 色，期望 1751`);

  if (brands.standard) {
    const need = ['mard', 'coco', 'manman', 'panpan', 'mixiaowo'];
    const have = brands.standard.codeSystems.map(c => c.id);
    if (need.every(n => have.includes(n))) ok('标准色板含五套色号体系');
    else bad('标准色板色号体系缺失: ' + have.join(','));
  }

  const pitch = Object.fromEntries(Object.entries(brands).map(([k, v]) => [k, v.pitch]));
  if (pitch.standard === 2.6 && pitch.hama === 5.0 && pitch.dmc === null) ok('豆径配置正确（2.6 / 5.0 / null）');
  else bad('豆径配置异常: ' + JSON.stringify(pitch));

  if (Array.isArray(data.aliases)) ok(`同款牌子提示 ${data.aliases.length} 条`);
  else bad('aliases 字段异常');
}

console.log('\n' + (fail ? `===== ${fail} 项失败 =====` : '===== 全部通过 ====='));
process.exit(fail ? 1 : 0);
