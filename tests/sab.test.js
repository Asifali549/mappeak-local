// 10 Nov (owner asked): searches include service-area businesses (no public address); new businesses and fresh bad reviews move up;
// "emergency" trade words for plumbers/electricians/HVAC; more small towns. Nothing hidden.
const { chromium } = require('playwright');
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const b = await chromium.launch(); const res = []; const ok = (n, c, d = '') => res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' (' + d + ')' : ''));
  const DAY = 864e5, now = Date.now(), iso = t => new Date(t).toISOString();
  const rv = (d, r = 5) => ({ publishTime: iso(now - d * DAY), rating: r });
  const P = (id, name, o) => Object.assign({ id, displayName: { text: name }, formattedAddress: '12 Main St, Tyler, TX 75701, USA', rating: 4.3, userRatingCount: 40,
    websiteUri: 'https://' + id + '.example.com/', nationalPhoneNumber: '(903) 555-01' + (10 + id.length), internationalPhoneNumber: '+1 903-555-01' + (10 + id.length),
    primaryType: 'plumber', primaryTypeDisplayName: { text: 'Plumber' }, businessStatus: 'OPERATIONAL', regularOpeningHours: {}, reviews: [rv(400)], photos: [] }, o);
  const places = [
    P('shop', 'Tyler Pipe Works'),                                                                    // ordinary shop, nothing special
    P('sab', 'Rapid Rooter Mobile Plumbing', { formattedAddress: undefined }),                        // service-area business, no address
    P('newb', 'Fresh Start Plumbing', { userRatingCount: 5, reviews: [rv(40), rv(90), rv(120), rv(150), rv(200)] }),     // new: all reviews known, first < 1 year
    P('bad', 'Lone Oak Plumbing', { reviews: [rv(400), rv(10, 1)] }),                                  // fresh 1-star
  ];
  const bodies = [];
  const ctx = await b.newContext({ viewport: { width: 400, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await ctx.route(/^https?:\/\/(?!localhost)/, async r => {
    const u = r.request().url(); const j = o => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (/places:searchText/.test(u)) { const bd = JSON.parse(r.request().postData()); bodies.push(bd); return j({ places: /Rapid Rooter/.test(bd.textQuery) ? [places[1]] : places }); }
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
  await p.selectOption('#country', 'US'); await p.fill('#trade', 'plumber'); await p.fill('#towns', 'Tyler, TX'); await p.fill('#runLimit', '1');
  await p.evaluate(() => { const w = document.getElementById('needWeb'); if (w.checked) w.click(); });
  await p.click('#go'); await p.waitForTimeout(3000);
  await p.evaluate(() => { const u = document.getElementById('urgentOnly'); if (u.checked) u.click(); });
  if (await p.$('#showAll')) { await p.click('#showAll'); await p.waitForTimeout(200); }
  ok('S1 every search asks Google for service-area businesses too', bodies.length > 0 && bodies.every(x => x.includePureServiceAreaBusinesses === true));
  const cards = await p.$$eval('#results .lead', ls => ls.map(l => ({ n: l.querySelector('.name').textContent.replace(/^#\d+/, ''), t: l.textContent })));
  const card = n => (cards.find(c => c.n.indexOf(n) >= 0) || {}).t || '';
  ok('S2 service-area business is shown with its search town and a badge', /Service area · Tyler, TX/.test(card('Rapid Rooter')) && /گھر جا کر کام، دکان نہیں/.test(card('Rapid Rooter')), card('Rapid Rooter').slice(0, 120));
  ok('S3 new business badge', /نیا کاروبار/.test(card('Fresh Start')) && !/نیا کاروبار/.test(card('Tyler Pipe')));
  const order = cards.map(c => c.n), pos = n => order.findIndex(x => x.indexOf(n) >= 0);
  ok('S4 service-area, new and fresh-bad-review businesses come before the plain shop', pos('Tyler Pipe') === order.length - 1, order.join(' / '));
  await p.click('#copyAll'); await p.waitForTimeout(300);
  const t = await p.evaluate(() => navigator.clipboard.readText());
  ok('S5 copy for Claude: service-area + new business notes', /SERVICE-AREA BUSINESS \(no public address\)/.test(t) && /Address: hidden \(service area\), found in Tyler, TX/.test(t) && /NEW BUSINESS \(first review 200 days ago\)/.test(t));
  const L = await p.evaluate(() => JSON.parse(localStorage.getItem('mp_leads')).leads.find(l => l.id === 'sab'));
  ok('S6 service-area business keeps the searched country', L && L.country === 'US' && L.address === '');
  // name search for a service-area business: no address, so no competitor search, and no error
  const before = bodies.length;
  await p.fill('#byName', 'Rapid Rooter Mobile Plumbing'); await p.click('#goName'); await p.waitForTimeout(1500);
  ok('S7 name search on a service-area business works (one search, plus a competitor search only when its town is known)', bodies.length >= before + 1 && bodies.length <= before + 2, String(bodies.length - before));
  // auto search uses the new trade words
  await p.reload(); await p.waitForTimeout(600);
  await p.selectOption('#autoC', 'US');
  await p.evaluate(() => localStorage.setItem('mp_autoPos', JSON.stringify({ US: 0 })));
  const b0 = bodies.length;
  await p.click('#autoGo'); await p.waitForFunction(() => !/جاری/.test(document.getElementById('autoGo').textContent), null, { timeout: 30000 });
  ok('S8 auto search starts with "emergency plumber"', bodies[b0] && /^emergency plumber in /.test(bodies[b0].textQuery), bodies[b0] && bodies[b0].textQuery);
  ok('S9 no page errors', !errs.length, errs.join(' | '));
  console.log(res.join('\n')); await b.close();
})();
