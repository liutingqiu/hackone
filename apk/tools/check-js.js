const fs = require('fs');
const vm = require('vm');
const file = process.argv[2] || 'tablet/index.html';
const html = fs.readFileSync(file, 'utf8');
const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let m, i = 0, bad = 0;
while ((m = re.exec(html))) {
  i++;
  const attrs = m[1];
  if (/application\/json/.test(attrs)) { console.log(`#${i} json block skipped (${m[2].length} chars)`); continue; }
  try {
    new vm.Script(m[2], { filename: `${file}#script${i}` });
    console.log(`#${i} OK (${m[2].length} chars)`);
  } catch (e) {
    bad++;
    console.log(`#${i} SYNTAX ERROR: ${e.message}`);
  }
}
console.log(bad ? `FAILED ${bad}` : 'ALL SCRIPTS OK');
process.exit(bad ? 1 : 0);