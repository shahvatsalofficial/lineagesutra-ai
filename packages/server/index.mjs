import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {verify, impact} from '../core/index.mjs';

// Loopback, bearer-token, read-only report reader. NOT a production multi-tenant API.
export function createServer({reportPath, token, port = 0}) {
  if (!token || token.length < 16) throw new Error('Bearer token must be at least 16 characters');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
  const ref = Buffer.from('Bearer ' + token);
  const json = (res, code, body) => { res.writeHead(code, {'Content-Type': 'application/json'}); res.end(JSON.stringify(body)); };
  return http.createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    const auth = Buffer.from(String(req.headers.authorization || ''));
    const ok = auth.length === ref.length && crypto.timingSafeEqual(auth, ref);
    if (!ok) return json(res, 401, {error: 'unauthorized'});
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/health') return json(res, 200, {status: 'ok', mode: 'localhost-readonly'});
    if (url.pathname === '/report' || url.pathname === '/impact') {
      try {
        const doc = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        if (!verify(doc)) throw new Error('integrity');
        if (url.pathname === '/report') return json(res, 200, doc);
        const table = url.searchParams.get('table'), column = url.searchParams.get('column') || undefined;
        if (!table) return json(res, 400, {error: 'table query parameter required'});
        try { return json(res, 200, impact(doc, {table, column, change: url.searchParams.get('change') || 'modify'})); } catch (e) { return json(res, 400, {error: e.message}); }
      } catch { return json(res, 422, {error: 'report-invalid'}); }
    }
    res.writeHead(404); res.end();
  });
}

export async function serve(opts) {
  const server = createServer(opts);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(opts.port || 0, '127.0.0.1', resolve); });
  return server;
}
