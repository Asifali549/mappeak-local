// 12 Nov (owner asked): the competitor named in messages is a local shop, never a maker's or chain's office
// (a Multan solar search showed "Sungrow Power, 590 reviews" as the shop above every small solar business).
const { chromium } = require('playwright');
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const b = await chromium.launch(); const res = []; const ok = (n, c, d = '') => res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' (' + d + ')' : ''));
  const recent = [{ publishTime: new Date(Date.now() - 20 * 864e5).toISOString(), rating: 5 }];
  const P = (id, name, n, rt) => ({ id, displayName: { text: name }, formattedAddress: 'Hussain Agahi Rd, Multan, Pakistan', rating: rt, userRatingCount: n, websiteUri: '',
    nationalPhoneNumber: '0300', internationalPhoneNumber: '+92 300 12345' + (10 + name.length), primaryType: 'solar_energy_company', primaryTypeDisplayName: { text: 'Solar energy company' }, businessStatus: 'OPERATIONAL', reviews: recent });
  const places = [P('brand', 'Sungrow Power', 590, 5), P('kfc', 'KFC Multan', 3000, 4.2), P('amjad', 'Amjad Solar', 48, 4.7), P('sun', 'Sun Solar Energy Solutions', 8, 4.5)];
  const ctx = await b.newContext({ viewport: { width: 400, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await ctx.route(/^https?:\/\/(?!localhost)/, async r => {
    const u = r.request().url(); const j = o => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (/places:searchText/.test(u)) return j({ places });
    if (/places\.googleapis\.com\/v1\/places\//.test(u)) return j({ id: 'x' });
    if (/pagespeedonline/.test(u)) return j({ lighthouseResult: { categories: { performance: { score: 0.9 } }, audits: { 'network-requests': { details: { items: [] } } } } });
    if (/dns\.google|cloudflare-dns|quad9/.test(u)) return j({ Answer: [] });
    if (/rdap|webrisk/.test(u)) return j({});
    return r.abort();
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/finder.html'); await p.waitForTimeout(500);
  await p.evaluate(() => { document.getElementById('setBox').open = true; document.getElementById('apiKey').value = 'AIzaTEST'; });
  await p.click('#saveSet'); await p.waitForTimeout(400);
  await p.selectOption('#country', 'PK'); await p.fill('#trade', 'solar company'); await p.fill('#towns', 'Multan'); await p.fill('#runLimit', '1');
  await p.evaluate(() => { const w = document.getElementById('needWeb'); if (w.checked) w.click(); });
  await p.click('#go'); await p.waitForTimeout(3000);
  await p.evaluate(() => { const u = document.getElementById('urgentOnly'); if (u.checked) u.click(); });
  if (await p.$('#showAll')) await p.click('#showAll');
  const sun = await p.evaluate(() => JSON.parse(localStorage.getItem('mp_leads')).leads.find(l => l.id === 'sun'));
  ok('B1 competitor is the local shop, not the maker\'s office or a chain', sun && sun.comp && sun.comp.n === 'Amjad Solar', JSON.stringify(sun && sun.comp));
  const card = p.locator('#results .lead').filter({ has: p.locator('.name', { hasText: 'Sun Solar' }) });
  await card.locator('[data-a="urdu"]').click(); await p.waitForTimeout(200);
  const msg = await p.evaluate(() => navigator.clipboard.readText());
  ok('B2 the WhatsApp message compares with the local shop', /Amjad Solar/.test(msg) && !/Sungrow|KFC/.test(msg), msg.slice(0, 80));
  ok('B3 no page errors', !errs.length, errs.join(' | '));
  console.log(res.join('\n')); await b.close();
})();
