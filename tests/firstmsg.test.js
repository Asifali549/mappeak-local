// 13 Nov (owner asked): the first WhatsApp message follows what was found.
// claim button seen ("ہاں") -> claim problem + free "how to claim" gift; fresh 1-2 star review -> report and appeal, paid only if Google removes it;
// review gap never against another branch of the same chain.
const { chromium } = require('playwright');
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const b = await chromium.launch(); const res = []; const ok = (n, c, d = '') => res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' (' + d + ')' : ''));
  const now = Date.now(), rv = (d, r = 5) => ({ publishTime: new Date(now - d * 864e5).toISOString(), rating: r });
  const P = (id, name, n, o) => Object.assign({ id, displayName: { text: name }, formattedAddress: 'Industrial Area - Sharjah - United Arab Emirates', rating: 4.1, userRatingCount: n, websiteUri: '',
    nationalPhoneNumber: '050', internationalPhoneNumber: '+971 50 77' + String(100000 + n * 7 + name.length).slice(-6), primaryType: 'car_repair', primaryTypeDisplayName: { text: 'Car repair and maintenance service' },
    businessStatus: 'OPERATIONAL', reviews: [rv(20)] }, o);
  const places = [P('big', 'Desert Star Auto Service', 900), P('pk1', 'Lahore Auto Workshop', 30), P('bad1', 'Falcon Garage', 40, { reviews: [rv(10, 1), rv(30)] }),
    P('kp1', 'Karachi Palace Restaurant branch 1', 800, { primaryTypeDisplayName: { text: 'Pakistani restaurant' } }),
    P('kp3', 'Karachi Palace Restaurant branch 3', 15, { primaryTypeDisplayName: { text: 'Pakistani restaurant' } })];
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
  await p.selectOption('#country', 'AE'); await p.fill('#trade', 'car workshop'); await p.fill('#towns', 'Sharjah'); await p.fill('#runLimit', '1');
  await p.evaluate(() => { const w = document.getElementById('needWeb'); if (w.checked) w.click(); });
  await p.click('#go'); await p.waitForTimeout(3000);
  const all = async () => { await p.evaluate(() => { const u = document.getElementById('urgentOnly'); if (u.checked) u.click(); }); if (await p.$('#showAll')) { await p.click('#showAll'); await p.waitForTimeout(150); } };
  await all();
  const card = n => p.locator('#results .lead').filter({ has: p.locator('.name', { hasText: n }) });
  const msg = async n => { await all(); const h = await card(n).locator('[data-a="wa"]').getAttribute('href'); return new URL(h).searchParams.get('text') || ''; };
  // claim button seen on the Pakistani workshop
  await card('Lahore Auto').locator('.yn[data-k="unclaimed"] button[data-v="yes"]').click(); await p.waitForTimeout(400);
  const m1 = await msg('Lahore Auto');
  ok('M1 claim seen: Urdu message names the claim problem and offers to show how to claim', /کلیم نہیں ہوئی/.test(m1) && /اپنے نام کیسے کریں/.test(m1) && /بھیج دوں؟/.test(m1) && !/Desert Star/.test(m1), m1.slice(0, 160));
  const m0 = await msg('Falcon');
  ok('M2 fresh bad review: report and appeal, fee only if Google removes it, no promise', /recent bad review/.test(m0) && /pay only if Google removes it/.test(m0) && !/guarantee|we will remove|will be removed/i.test(m0), m0.slice(0, 200));
  ok('M3 no claim answer: no claim sentence, the review-gap line stays', !/not been claimed/.test(m0) && /Desert Star Auto Service nearby has 900/.test(m0));
  const m3 = await msg('branch 3');
  ok('M4 never compared with its own chain\'s other branch', !/branch 1/.test(m3), m3.slice(0, 200));
  // answer "no": back to the normal message
  await card('Lahore Auto').locator('.yn[data-k="unclaimed"] button[data-v="no"]').click(); await p.waitForTimeout(400);
  const m5 = await msg('Lahore Auto');
  ok('M5 claim answered "no": normal gift message', !/کلیم نہیں ہوئی/.test(m5) && /کارڈ بھیج دوں؟/.test(m5));
  ok('M6 no page errors', !errs.length, errs.join(' | '));
  console.log(res.join('\n')); await b.close();
})();
