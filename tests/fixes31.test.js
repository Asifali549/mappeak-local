// 31 Oct evening fixes: "no new reviews" only when Google gave all reviews; domain renewed last year not flagged;
// city/food words don't make "big company?"; big companies listed last; auto search resets filters for a new country; UAE restaurant time.
const { chromium } = require('playwright');
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const b = await chromium.launch(); const res = []; const ok = (n, c, d = '') => res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' (' + d + ')' : ''));
  const DAY = 864e5, now = Date.now(), iso = t => new Date(t).toISOString();
  const old = [{ publishTime: iso(now - 200 * DAY), rating: 5 }];
  const P = (id, name, n, web, intl, extra) => Object.assign({ id, displayName: { text: name }, formattedAddress: 'Al Salmah - Emirate of Umm Al Quwain - United Arab Emirates',
    rating: 4.2, userRatingCount: n, websiteUri: web || '', nationalPhoneNumber: '050 000 0000', internationalPhoneNumber: intl || '+971 50 000 00' + id.length,
    primaryType: 'restaurant', primaryTypeDisplayName: { text: 'Pakistani restaurant' }, businessStatus: 'OPERATIONAL', reviews: old }, extra || {});
  const places = [
    P('busy', 'Noufal Cafeteria And Restaurant', 140),
    P('tiny', 'Faizan Restaurant', 4, '', null, { reviews: [0, 1, 2, 3].map(i => ({ publishTime: iso(now - (150 + i) * DAY), rating: 5 })) }),
    P('lp', 'Lahore Palace Restaurant & Cafeteria', 121), P('lw', 'LAHORE WALY RESTAURANT', 13), P('ld', 'Lahore Darbar Restaurant and Kitchen', 147),
    P('p1', 'Punjab Restaurant', 133), P('p2', 'Punjab Pakistani Restaurant', 117),
    P('z1', 'Zaharaa Public Kitchen Restaurant', 29), P('z2', 'Zaharaa Public Kitchen Restaurant', 116),
    P('dg', 'Dumpukht Restaurant Al Ain', 65, 'https://duchingroup.com/', null, { reviews: [{ publishTime: iso(now - 10 * DAY), rating: 1 }] }),
    P('ren', 'Renewed Grill', 60, 'https://renewedgrill.com/'), P('lap', 'Lapsing Grill', 60, 'https://lapsinggrill.com/'),
  ];
  const exp = now + 40 * DAY;
  const rdap = d => ({ events: [{ eventAction: 'registration', eventDate: iso(exp - 2 * 365 * DAY) }, { eventAction: 'expiration', eventDate: iso(exp) },
    { eventAction: 'last changed', eventDate: iso(d === 'lapsinggrill.com' ? exp - 600 * DAY : exp - 366 * DAY) }] });
  const ctx = await b.newContext({ viewport: { width: 400, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await ctx.route(/^https?:\/\/(?!localhost)/, async r => {
    const u = r.request().url(); const j = o => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (/places:searchText/.test(u)) return j({ places: JSON.parse(r.request().postData()).textQuery.indexOf('plumber') === 0 ? [] : places });
    if (/places\.googleapis\.com\/v1\/places\//.test(u)) return j({ id: 'x' });
    if (/pagespeedonline/.test(u)) return j({ lighthouseResult: { categories: { performance: { score: 0.9 } }, audits: { 'network-requests': { details: { items: [] } } } } });
    if (/rdap/.test(u)) return j(rdap(u.split('/').pop()));
    if (/dns\.google|cloudflare-dns|quad9/.test(u)) return j({ Answer: [] });
    if (/webrisk/.test(u)) return j({});
    return r.abort();
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  await p.goto(BASE + '/finder.html'); await p.waitForTimeout(500);
  await p.evaluate(() => { document.getElementById('setBox').open = true; document.getElementById('apiKey').value = 'AIzaTEST'; });
  await p.click('#saveSet'); await p.waitForTimeout(400);
  // he last searched plumbers in Texas by hand (US: website-only ticked)
  await p.selectOption('#country', 'US'); await p.fill('#trade', 'plumber'); await p.fill('#towns', 'Abilene, TX');
  ok('F0 US starts with "website only" ticked', await p.isChecked('#needWeb'));
  // auto search for UAE
  await p.selectOption('#autoC', 'AE'); await p.click('#autoGo');
  await p.waitForFunction(() => !/جاری/.test(document.getElementById('autoGo').textContent), null, { timeout: 30000 });
  ok('F1 auto search to UAE clears "website only" and the Texas plumber fields', !(await p.isChecked('#needWeb')) && (await p.inputValue('#trade')) !== 'plumber' && !/Abilene/.test(await p.inputValue('#towns')));
  ok('F2 UAE hint gives the restaurant time', /ریسٹورنٹ کو شام پانچ بجے/.test(await p.textContent('#lawHint')));
  await p.waitForTimeout(2500);
  await p.click('#copyAll'); await p.waitForTimeout(300);
  const t = await p.evaluate(() => navigator.clipboard.readText());
  const block = name => { const i = t.indexOf(name); const j = t.indexOf('\n#', i); return i < 0 ? '' : t.slice(i, j < 0 ? undefined : j); };
  ok('F3 busy listing: no "no new reviews" (Google only sends 5 picked reviews)', block('Noufal').length > 0 && !/No new reviews/.test(block('Noufal')));
  ok('F3b tiny listing (all reviews known, last one old): still flagged', /No new reviews/.test(block('Faizan Restaurant')));
  ok('F4 city words do not make "big company" (Lahore x3, Punjab x2)', ['Lahore Palace', 'LAHORE WALY', 'Lahore Darbar', 'Punjab Restaurant', 'Punjab Pakistani'].every(n => block(n) && !/BIG COMPANY/.test(block(n))));
  ok('F4b real branches still flagged (Zaharaa x2, group site)', /BIG COMPANY/.test(block('Zaharaa')) && /BIG COMPANY/.test(block('Dumpukht')));
  const order = (t.match(/^#\d+ .*$/gm) || []).map(l => l.replace(/^#\d+ /, ''));
  const firstBig = order.findIndex(l => /Zaharaa|Dumpukht/.test(l)), lastSmall = Math.max(...order.map((l, i) => /Zaharaa|Dumpukht/.test(l) ? -1 : i));
  ok('F5 big companies listed last, even when urgent', firstBig > lastSmall, order.join(' / '));
  ok('F6 domain renewed on time last year: not "expires soon"', block('Renewed Grill') && !/expires soon/.test(block('Renewed Grill')));
  ok('F6b domain never renewed near expiry: still "expires soon"', /\*The website address \(domain\) expires soon/.test(block('Lapsing Grill')));
  // old saved data with "stale" on a busy listing
  await p.evaluate(() => { const o = JSON.parse(localStorage.getItem('mp_leads')); o.leads.forEach(L => { if (L.id === 'busy' && L.issues.indexOf('stale') < 0) L.issues.push('stale'); }); localStorage.setItem('mp_leads', JSON.stringify(o)); });
  await p.reload(); await p.waitForTimeout(800);
  if ((await p.inputValue('#country')) !== 'AE') await p.selectOption('#country', 'AE');
  await p.evaluate(() => { const u = document.getElementById('urgentOnly'); if (u.checked) u.click(); });
  const card = await p.$$eval('#results .lead', ls => (ls.find(l => /Noufal/.test(l.querySelector('.name').textContent)) || {}).textContent || '');
  ok('F7 old saved results: "no new reviews" hidden on busy listing', card && !/تین مہینے سے کوئی نیا ریویو نہیں/.test(card));
  // reopening the app with UAE saved: boxes show UAE, not the US plumber defaults
  await p.evaluate(() => localStorage.setItem('mp_country', 'AE')); await p.reload(); await p.waitForTimeout(600);
  ok('F9 reopened on UAE: no Texas plumber, no "website only"', (await p.inputValue('#country')) === 'AE' && (await p.inputValue('#trade')) !== 'plumber' && !/TX/.test(await p.inputValue('#towns')) && !(await p.isChecked('#needWeb')), (await p.inputValue('#trade')) + ' | ' + (await p.inputValue('#towns')));
  await p.evaluate(() => { localStorage.setItem('mp_country', 'XX'); localStorage.setItem('mp_otherC', 'Netherlands'); }); await p.reload(); await p.waitForTimeout(600);
  ok('F9b reopened on another country: no Texas towns', !/TX/.test(await p.inputValue('#towns')) && (await p.isChecked('#needWeb')));
  await p.evaluate(() => localStorage.setItem('mp_country', 'US')); await p.reload(); await p.waitForTimeout(600);
  ok('F9c reopened on US: US defaults and "website only"', /TX/.test(await p.inputValue('#towns')) && (await p.isChecked('#needWeb')));
  ok('F8 no page errors', !errs.length, errs.join(' | '));
  console.log(res.join('\n')); await b.close();
})();
