/* 拼豆分享短链服务：POST /api/save 存图纸，GET /api/get/:id 取，GET /s/:id 跳到应用 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type'
};
const LIMIT = 400000;          // 单张图纸上限，约 400 KB 压缩文本
const SHARE_TTL = 60 * 60 * 24 * 180;
const SAVE_PER_HOUR = 30;

function json(obj, status = 200){
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' }
  });
}
function makeId(n){
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  let s = '';
  for (const b of a) s += abc[b % abc.length];
  return s;
}

async function readBodyLimited(req){
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > LIMIT) return null;
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true){
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > LIMIT){ await reader.cancel(); return null; }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks){ bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal:true }).decode(bytes);
}

async function allowSave(env, req){
  const ip = (req.headers.get('CF-Connecting-IP') || 'local').replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 80);
  const key = '~rl:' + (ip || 'local');
  const n = Number(await env.PINDA.get(key)) || 0;
  if (n >= SAVE_PER_HOUR) return false;
  await env.PINDA.put(key, String(n + 1), { expirationTtl: 3600 });
  return true;
}
async function putFresh(env, body){
  for (let i = 0; i < 6; i++){
    const id = makeId(7);
    if (await env.PINDA.get(id)) continue;
    await env.PINDA.put(id, body, { expirationTtl: SHARE_TTL });
    if ((await env.PINDA.get(id)) === body) return id;
  }
  return '';
}

export default {
  async fetch(req, env){
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (url.pathname === '/api/save' && req.method === 'POST'){
      let body;
      try { body = await readBodyLimited(req); }
      catch (e){ return json({ error: 'invalid_body' }, 400); }
      if (body === null) return json({ error: 'too_large', limit: LIMIT }, 413);
      if (!body) return json({ error: 'empty' }, 400);
      if (!(await allowSave(env, req))) return json({ error: 'rate_limited' }, 429);
      const id = await putFresh(env, body);
      if (!id) return json({ error: 'id_conflict' }, 500);
      return json({ id: id, size: body.length });
    }

    const get = /^\/api\/get\/([A-Za-z0-9_-]{4,16})$/.exec(url.pathname);
    if (get){
      const v = await env.PINDA.get(get[1]);
      if (!v) return new Response('not found', { status: 404, headers: CORS });
      return new Response(v, {
        headers: { ...CORS, 'content-type': 'text/plain; charset=utf-8',
                   'cache-control': 'public, max-age=' + SHARE_TTL }
      });
    }

    const s = /^\/s\/([A-Za-z0-9_-]{4,16})$/.exec(url.pathname);
    if (s) return Response.redirect(env.APP_URL + '/#s=' + s[1], 302);

    if (url.pathname === '/') return new Response('pinda-share ok', { headers: { ...CORS, 'content-type': 'text/plain' } });
    return new Response('not found', { status: 404, headers: CORS });
  }
};
