/**
 * External uptime check (runs on GitHub's runners, outside Cloudflare). Checks the home page,
 * /api/copies.json and /sponsor/ for status 200 plus expected content, with one retry 20 s later
 * so a single blip does not open an issue. Names Cloudflare error codes (1027 = Workers free daily
 * request limit hit, 1101/1102 = Worker exception or CPU limit) when it sees them.
 * Usage: node scripts/resilience/uptime.mjs [--origin https://moneywithai.net] [--json out.json]
 * Exit 0 = all up, 1 = at least one check failed twice. No secrets needed.
 */
import { writeFileSync, appendFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const ORIGIN = opt('origin', process.env.SITE_ORIGIN || 'https://moneywithai.net').replace(/\/$/, '');
const CHECKS = [
  // Brand-agnostic: the home page must be complete HTML that lists bots.
  { name: 'Home', path: '/', expect: (b) => b.length > 5000 && /href="\/bots\/[a-z0-9-]+\/?"/.test(b) && /<\/html>/i.test(b) },
  { name: 'Download counts API', path: '/api/copies.json', expect: (b) => { try { const j = JSON.parse(b); return j && typeof j.counts === 'object' && !Array.isArray(j.counts); } catch { return false; } } },
  { name: 'Sponsor page', path: '/sponsor/', expect: (b) => /Sponsor/i.test(b) && /<\/html>/i.test(b) },
];
const cfCode = (b) => { const m = b.match(/error code:?\s*(10\d\d|11\d\d|52\d)/i) || b.match(/Error (10\d\d|11\d\d|52\d)/); return m ? m[1] : null; };
async function once(c) {
  const t0 = Date.now();
  try {
    const res = await fetch(ORIGIN + c.path + (c.path.includes('?') ? '&' : '?') + 'uptime=' + Date.now(), { headers: { 'User-Agent': 'moneywithai-uptime/1 (+github actions)', Accept: c.path.endsWith('.json') ? 'application/json' : 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(15000) });
    const body = await res.text();
    const ms = Date.now() - t0;
    const good = res.status === 200 && c.expect(body);
    return { ok: good, status: res.status, ms, cf_error: good ? null : cfCode(body), why: good ? '' : res.status !== 200 ? `HTTP ${res.status}` : 'unexpected content' };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - t0, cf_error: null, why: e.name === 'TimeoutError' ? 'timeout after 15 s' : e.message };
  }
}
const results = [];
for (const c of CHECKS) {
  let r = await once(c);
  if (!r.ok) { await new Promise((s) => setTimeout(s, 20000)); const r2 = await once(c); r = { ...r2, first_try: r.why }; }
  results.push({ name: c.name, url: ORIGIN + c.path, ...r });
}
const down = results.filter((r) => !r.ok);
const at = new Date().toISOString();
const where = process.env.GITHUB_ACTIONS ? 'a GitHub Actions runner (outside Cloudflare)' : 'a manual run';
const lines = [`Checked ${at} from ${where}.`, '', '| Check | URL | Result | Time |', '|---|---|---|---|',
  ...results.map((r) => `| ${r.name} | ${r.url} | ${r.ok ? 'OK' : `DOWN: ${r.why}${r.cf_error ? ` (Cloudflare error ${r.cf_error})` : ''}`} | ${r.ms} ms |`)];
if (down.some((r) => r.cf_error === '1027')) lines.push('', 'Cloudflare error 1027: the account hit the Workers free daily request limit (resets 04:00 UAE). See docs/resilience/FAILOVER.md, step "Workers quota".');
const summary = lines.join('\n');
console.log(summary);
if (opt('json')) writeFileSync(opt('json'), JSON.stringify({ at, origin: ORIGIN, ok: !down.length, results, summary }, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
process.exit(down.length ? 1 : 0);
