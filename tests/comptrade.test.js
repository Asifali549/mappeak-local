// 15 Nov (bug, owner approved): a new search in the same city for another trade must not change a business's competitor.
// Before: Riyadh workshops (auto search) were later compared with "PakMobiZone" after an auto search for mobile shops in Riyadh.
const { chromium } = require('playwright');
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const b = await chromium.launch(); const res = []; const ok = (n, c, d = '') => res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' (' + d + ')' : ''));
  const recent = [{ publishTime: new Date(Date.now() - 20 * 864e5).toISOString(), rating: 4 }];
  let k = 0;
  const P = (id, name, reviews, type, typeName, addr) => ({ id, displayName: { text: name }, formattedAddress: addr || 'Al Sina\'iyah, Riyadh 12871, Saudi Arabia', rating: 3.9, userRatingCount: reviews, websiteUri: '',
    nationalPhoneNumber: '055', internationalPhoneNumber: '+966 55 357 ' + (6100 + (k++)), primaryType: type, primaryTypeDisplayName: { text: typeName }, businessStatus: 'OPERATIONAL', reviews: recent });
  const W = [P('w1', 'Saad German Cars Workshop', 40, 'car_repair', 'Car repair and maintenance service'), P('w2', 'Big Star Auto Workshop', 140, 'car_repair', 'Car repair and maintenance service'), P('w3', 'Lahore Auto Works', 20, 'car_repair', 'Car repair and maintenance service')];
  const M = [P('m1', 'PakMobiZone Mobile Shop', 900, 'cell_phone_store', 'Cell phone store'), P('m2', 'Karachi Mobile Center', 30, 'cell_phone_store', 'Cell phone store')];
  const ctx = await b.newContext({ viewport: { width: 400, height: 900 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, async r => {
    const u = r.request().url(); const j = o => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (/places:searchText/.test(u)) { const q = JSON.parse(r.request().postData()).textQuery;
      return j({ places: /Riyadh/.test(q) ? (/car repair workshop/.test(q) ? W : /mobile phone shop/.test(q) ? M : []) : [] }); }
    if (/places\.googleapis\.com\/v1\/places\//.test(u)) return j({ id: 'x' });
    if (/pagespeedonline/.test(u)) return j({ lighthouseResult: { categories: { performance: { score: 0.9 } }, audits: { 'network-requests': { details: { items: [] } } } } });
    if (/dns\.google|cloudflare-dns|quad9/.test(u)) return j({ Answer: [] });
    if (/rdap|webrisk/.test(u)) return j({});
    return r.abort();
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/finder.html'); await p.waitForTimeout(500);
  await p.evaluate(() => { document.getElementById('setBox').open = true; document.getElementById('apiKey').value = 'AIzaTEST'; document.getElementById('dayLimit').value = '50'; });
  await p.click('#saveSet'); await p.waitForTimeout(400);
  const auto = async pos => {
    await p.evaluate(v => localStorage.setItem('mp_autoPos', JSON.stringify({ SA: v })), pos);
    await p.selectOption('#autoC', 'SA'); await p.click('#autoGo'); await p.waitForTimeout(3500);
  };
  const lead = id => p.evaluate(i => (JSON.parse(localStorage.getItem('mp_leads')).leads.find(l => l.id === i) || {}), id);
  // Saudi plan: 15 cities; trade 2 = car repair workshop (position 30 = Riyadh), trade 6 = mobile phone shop (position 90 = Riyadh)
  await auto(30);
  const before = (await lead('w1')).comp || {};
  ok('C1 a workshop gets a workshop as its competitor', before.n === 'Big Star Auto Workshop', JSON.stringify(before));
  // same session, then also after closing and reopening the app (the real case: a new day)
  await auto(90);
  let after = (await lead('w1')).comp || {};
  ok('C2 a mobile-shop search in the same city (same session) keeps the workshop\'s competitor', after.n === 'Big Star Auto Workshop', JSON.stringify(after));
  await p.reload(); await p.waitForTimeout(800);
  await auto(90 + 120);   // the same trade again in Riyadh after a full round of trades
  after = (await lead('w1')).comp || {};
  ok('C3 after reopening the app, the mobile-shop search still does not change it', after.n === 'Big Star Auto Workshop', JSON.stringify(after));
  const mob = (await lead('m2')).comp || {};
  ok('C4 a mobile shop gets a mobile shop as its competitor', mob.n === 'PakMobiZone Mobile Shop', JSON.stringify(mob));
  ok('C5 no page errors', !errs.length, errs.join(' | '));
  console.log(res.join('\n')); await b.close();
})();
