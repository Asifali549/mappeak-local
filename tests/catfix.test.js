// 23 Nov (owner asked): two category faults the tool missed in a Sharjah/Ajman workshop search:
// (1) a workshop with NO main category at all (Jithu Garage, 108 reviews) -> "noCat", named first in the message;
// (2) a workshop listed as "Auto parts store" passed because the word "auto" counted as right -> now flagged as wrong category.
const { chromium } = require('playwright');
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const b = await chromium.launch(); const res = []; const ok = (n, c, d = '') => res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' (' + d + ')' : ''));
  const now = Date.now(), rv = d => ({ publishTime: new Date(now - d * 864e5).toISOString(), rating: 5 });
  let k = 0;
  const P = (id, name, n, cat, o) => Object.assign({ id, displayName: { text: name }, formattedAddress: 'Industrial Area 2, Sharjah, United Arab Emirates', rating: 4.5, userRatingCount: n, websiteUri: '',
    nationalPhoneNumber: '050', internationalPhoneNumber: '+971 50 77' + String(10000 + (k++)), primaryType: cat ? 'x' + k : undefined, primaryTypeDisplayName: cat ? { text: cat } : undefined,
    businessStatus: 'OPERATIONAL', reviews: [rv(20)], photos: [1, 2, 3, 4, 5, 6], regularOpeningHours: { x: 1 } }, o);
  const AE = [
    P('j1', 'Jithu Garage Ajman', 108, null),                              // no category at all
    P('q1', 'QAMAR LIWA AUTO MAINT', 126, 'Auto parts store'),            // workshop listed as a parts shop
    P('r1', 'Real Auto Spare Parts', 40, 'Auto parts store'),             // a real parts shop in the search: never flagged
    P('g1', 'Fast Garage Sharjah', 60, 'Auto repair shop'),               // right category
    P('m1', 'Al Noor Car Maintenance', 30, 'Car repair and maintenance service'),   // right category, long Google name
    P('u1', 'Punjab Auto Workshop', 25, null),                            // Urdu-speaking, no category
    P('a1', 'ورشة النور للسيارات', 25, null),                              // Arabic name, no category
    P('big', 'Sharjah Auto Centre', 900, 'Auto repair shop'),
  ];
  const ctx = await b.newContext({ viewport: { width: 400, height: 900 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, async r => {
    const u = r.request().url(); const j = o => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (/places:searchText/.test(u)) return j({ places: AE });
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
  await p.selectOption('#country', 'AE'); await p.fill('#trade', 'car repair workshop'); await p.fill('#towns', 'Sharjah'); await p.fill('#runLimit', '1');
  await p.evaluate(() => { const w = document.getElementById('needWeb'); if (w.checked) w.click(); const u = document.getElementById('urgentOnly'); if (u.checked) u.click(); });
  await p.click('#go'); await p.waitForTimeout(2500);
  if (await p.$('#showAll')) { await p.click('#showAll'); await p.waitForTimeout(150); }
  const card = n => p.locator('#results .lead').filter({ has: p.locator('.name', { hasText: n }) }).first();
  const msg = async n => { const h = await card(n).locator('[data-a="wa"]').getAttribute('href'); return new URL(h).searchParams.get('text') || ''; };
  const first = t => (t.split('\n').find(l => /^• /.test(l)) || '');

  const m1 = await msg('Jithu Garage');
  ok('C1 no category: named as the first problem, with the trade', /^• the listing has no main category at all/.test(first(m1)) && /search for car repair/.test(m1), first(m1));
  ok('C2 the card lists the missing category in Urdu', /کوئی بنیادی کیٹیگری ہی نہیں/.test(await card('Jithu Garage').textContent()));
  const m2 = await msg('QAMAR LIWA');
  ok('C3 "Auto parts store" workshop: wrong category named with the right one', /^• the main category is "Auto parts store", not "Auto repair shop"/.test(first(m2)), first(m2));
  ok('C4 a real parts shop in the same search is not told it is wrong', !/main category/.test(await msg('Real Auto Spare')));
  ok('C5 right categories stay quiet ("Auto repair shop", "Car repair and maintenance service")', !/main category/.test(await msg('Fast Garage')) && !/main category/.test(await msg('Al Noor Car')));
  const m3 = await msg('Punjab Auto');
  ok('C6 Urdu message names the missing category', /کوئی بنیادی کیٹیگری ہی نہیں لکھی، اس لیے جب کوئی گاڑیوں کی ورکشاپ ڈھونڈتا ہے/.test(m3), first(m3));
  const m4 = await msg('ورشة النور');
  ok('C7 Arabic message names the missing category', /ما فيها تصنيف أساسي أبداً، فقوقل ما يعرف يظهركم لما أحد يدوّر ورشة سيارات/.test(m4), first(m4));
  ok('C8 missing category does not also count as "wrong category"', !/اس کام کی نہیں|اوپر والے کاروباروں سے مختلف/.test(await card('Jithu Garage').textContent()));
  // old saved lead without the search words (found before this update): still flagged, safe fallback words
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('mp_leads')); s.leads.forEach(l => { if (l.id === 'j1') { delete l.mapsQ; delete l.ptype; } }); localStorage.setItem('mp_leads', JSON.stringify(s)); });
  await p.reload(); await p.waitForTimeout(1200);
  if (await p.$('#showAll')) { await p.click('#showAll'); await p.waitForTimeout(150); }
  const m5 = await msg('Jithu Garage');
  ok('C9 old saved lead: still flagged, plain words, no "undefined"', /no main category at all, so Google doesn't know to show you when people search for a business like yours/.test(m5) && !/undefined/.test(m5), first(m5));
  ok('C10 no page errors', !errs.length, errs.join(' | '));
  console.log(res.join('\n')); await b.close();
})();
