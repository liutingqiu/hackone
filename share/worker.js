/* 拼豆分享短链服务：POST /api/save 存图纸，GET /api/get/:id 取，GET /s/:id 跳到应用 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type'
};
const LIMIT = 400000;          // 单张图纸上限，约 400 KB 压缩文本

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

export default {
  async fetch(req, env){
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (url.pathname === '/api/save' && req.method === 'POST'){
      const body = await req.text();
      if (!body) return json({ error: 'empty' }, 400);
      if (body.length > LIMIT) return json({ error: 'too_large', limit: LIMIT, size: body.length }, 413);
      let id = '';
      for (let i = 0; i < 6 && !id; i++){
        const cand = makeId(7);
        if (!(await env.PINDA.get(cand))) id = cand;
      }
      if (!id) return json({ error: 'id_conflict' }, 500);
      await env.PINDA.put(id, body, { expirationTtl: 60 * 60 * 24 * 180 });
      return json({ id: id, size: body.length });
    }

    const get = /^\/api\/get\/([A-Za-z0-9_-]{4,16})$/.exec(url.pathname);
    if (get){
      const v = await env.PINDA.get(get[1]);
      if (!v) return new Response('not found', { status: 404, headers: CORS });
      return new Response(v, {
        headers: { ...CORS, 'content-type': 'text/plain; charset=utf-8',
                   'cache-control': 'public, max-age=31536000, immutable' }
      });
    }

    const s = /^\/s\/([A-Za-z0-9_-]{4,16})$/.exec(url.pathname);
    if (s) return Response.redirect(env.APP_URL + '/#s=' + s[1], 302);

    if (url.pathname === '/') return new Response('pinda-share ok', { headers: { ...CORS, 'content-type': 'text/plain' } });
    return new Response('not found', { status: 404, headers: CORS });
  }
};
