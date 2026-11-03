// "Today's best 10": auto search does 3 searches, the screen and the copy show only the 10 best-fitting businesses
// (mobile, one shop, Urdu, clear gap first; landlines and big companies last), the rest one tap away; same client twice = one card.
const { chromium } = require('playwright');
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const b = await chromium.launch(); const res = []; const ok = (n, c, d = '') => res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' (' + d + ')' : ''));
  const recent = [{ publishTime: new Date(Date.now() - 20 * 864e5).toISOString(), rating: 5 }];
  let qn = 0;
  const P = (id, name, rating, n, intl, web) => ({ id, displayName: { text: name }, formattedAddress: 'Al Muqta - Umm Al Quwain - United Arab Emirates', rating, userRatingCount: n,
    websiteUri: web || '', nationalPhoneNumber: intl.replace('+971 ', '0'), internationalPhoneNumber: intl, primaryType: 'restaurant', primaryTypeDisplayName: { text: 'Pakistani restaurant' },
    businessStatus: 'OPERATIONAL', reviews: recent });
  const places = q => {
    qn++;
    if (qn > 1) return [];   // only the first search brings results; the other two are empty
    const a = [];
    ['Afridi','Bannu','Chitral','Dawood','Ehsan','Farooq','Ghazi','Hamza','Iqbal'].forEach((w, i) => a.push(P('ok' + i, w + ' Karahi House', 4.2, 100 + i, '+971 50 111 22' + (10 + i))));   // average, mobile, Urdu
    a.push(P('gap1', 'Wadi Lahore Restaurant', 3.4, 79, '+971 50 232 5231'));         // low rating
    a.push(P('gap2', 'Faizan Karahi', 4.5, 4, '+971 56 545 4938'));                     // tiny, big gap to the leader
    a.push(P('lead', 'Karachi Palace Restaurant', 4.2, 790, '+971 52 000 0000'));      // the leader (competitor)
    a.push(P('land', 'Pathan Darbar Restaurant', 3.8, 119, '+971 4 338 4551'));        // landline
    a.push(P('big1', 'Dumpukht Restaurant Al Ain', 3.9, 65, '+971 54 397 8178', 'https://duchingroup.com/'));   // group site
    a.push(P('eng', 'Golden Fork Bistro', 3.9, 60, '+971 55 000 1111'));               // not Urdu
    return a;
  };
  const ctx = await b.newContext({ viewport: { width: 400, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const now = Date.now();
  const dupes = [{ id: 'f1', n: 'Bravura Build', c: 'SA', phone: '+966533346117', manual: true, at: now - 6 * 864e5, state: 'waiting' },
                 { id: 'f2', n: 'Bravura Build', c: 'SA', phone: '+966 53 334 6117', manual: true, at: now - 5 * 864e5, state: 'waiting' }];
  await ctx.addInitScript(f => { if (!localStorage.getItem('mp_follow')) localStorage.setItem('mp_follow', f); }, JSON.stringify(dupes));
  await ctx.route(/^https?:\/\/(?!localhost)/, async r => {
    const u = r.request().url(); const j = o => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (/places:searchText/.test(u)) return j({ places: places() });
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
  // the same client added twice shows once
  ok('T0 same client twice = one reminder card', (await p.$$eval('#fuList .lead .name', ns => ns.filter(n => /Bravura/.test(n.textContent)).length)) === 1);
  await p.selectOption('#autoC', 'AE'); await p.click('#autoGo');
  await p.waitForFunction(() => !/جاری/.test(document.getElementById('autoGo').textContent), null, { timeout: 30000 });
  await p.waitForTimeout(1500);
  ok('T1 auto search makes only 3 searches', qn === 3, qn);
  const names = async () => p.$$eval('#results .lead .name', ns => ns.map(n => n.textContent.replace(/^#\d+/, '')));
  let shown = await names();
  ok('T2 only the best 10 are shown', shown.length === 10, shown.length);
  ok('T3 clear gaps come first', shown.slice(0, 2).sort().join('|') === ['Faizan Karahi', 'Wadi Lahore Restaurant'].join('|'), shown.slice(0, 3).join(' / '));
  ok('T4 landline and group site are not in the 10', !shown.some(n => /Pathan|Dumpukht/.test(n)), shown.join(' / '));
  ok('T5 a button shows how many more there are', /باقی بھی دکھائیں \(4\)/.test(await p.textContent('#showAll')));
  await p.click('#copyAll'); await p.waitForTimeout(300);
  const t = await p.evaluate(() => navigator.clipboard.readText());
  ok('T6 the copy has the same 10', (t.match(/^#\d+ /gm) || []).length === 10 && /Faizan Karahi/.test(t) && !/Pathan/.test(t), t.slice(0, 120));
  // messaging one brings the next one in
  await p.$$eval('#results .lead', ls => { const l = ls.find(x => /Faizan/.test(x.querySelector('.name').textContent.replace(/^#\d+/, ''))); l.querySelector('[data-a="sent"]').click(); });
  await p.waitForTimeout(400); shown = await names();
  ok('T7 after messaging one, the list refills to 10 without it', shown.length === 10 && !shown.includes('Faizan Karahi'));
  await p.click('#showAll'); await p.waitForTimeout(200);
  ok('T8 "show the rest" shows everything, worst at the bottom', (await names()).length === 14 && /Dumpukht/.test((await names()).slice(-1)[0]) && /Pathan/.test((await names()).slice(-2)[0]));
  await p.click('#showTop'); await p.waitForTimeout(200);
  ok('T9 back to the best 10', (await names()).length === 10);
  ok('T10 no page errors', !errs.length, errs.join(' | '));
  console.log(res.join('\n')); await b.close();
})();
