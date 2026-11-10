// "Alive but neglected" (10 Nov, owner asked): customers still leave reviews but the owner never added photos -> green badge, listed first;
// closed / abandoned -> grey badge, listed last; owner who uploads photos -> "looks after it", a bit lower. Nothing hidden.
const { chromium } = require('playwright');
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const b = await chromium.launch(); const res = []; const ok = (n, c, d = '') => res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' (' + d + ')' : ''));
  const DAY = 864e5, now = Date.now(), iso = t => new Date(t).toISOString();
  const rv = (d, r = 5) => ({ publishTime: iso(now - d * DAY), rating: r });
  const ph = (who, n) => Array.from({ length: n }, () => ({ name: 'x', authorAttributions: [{ displayName: who }] }));
  const P = (id, name, o) => Object.assign({ id, displayName: { text: name }, formattedAddress: 'Al Muqta - Umm Al Quwain - United Arab Emirates', rating: 4.2, userRatingCount: 30,
    websiteUri: '', nationalPhoneNumber: '050 000 0000', internationalPhoneNumber: '+971 50 000 0' + (100 + id.length * 7 + name.length), primaryType: 'restaurant',
    primaryTypeDisplayName: { text: 'Pakistani restaurant' }, businessStatus: 'OPERATIONAL', regularOpeningHours: {}, reviews: [rv(20)], photos: ph('Ali Customer', 6) }, o);
  const places = [
    P('care', 'Karachi Darbar Grill', { photos: ph('Karachi Darbar Grill', 4).concat(ph('A Customer', 2)) }),            // owner uploads photos
    P('negl', 'Sufi Tikka House', { photos: ph('Some Customer', 5) }),                                                   // alive, owner never added photos
    P('plain', 'Mehran Biryani Point', { reviews: [rv(400)], userRatingCount: 40 }),                                      // busy, only old "relevant" reviews: unknown
    P('dead', 'Old Lahore Dhaba', { reviews: [rv(300), rv(500), rv(600), rv(700)], userRatingCount: 4 }),                     // all reviews known, newest 300 days
    P('shut', 'Hamza Karahi', { businessStatus: 'CLOSED_TEMPORARILY' }),
    P('evil', '<img src=x onerror=alert(1)>', { photos: [{ authorAttributions: [{ displayName: '<b>owner</b>' }] }] }),
  ];
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
  const p = await ctx.newPage(); const errs = []; let alerted = false;
  p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => { if (d.type() === 'alert') alerted = true; d.accept(); });
  await p.goto(BASE + '/finder.html'); await p.waitForTimeout(500);
  await p.evaluate(() => { document.getElementById('setBox').open = true; document.getElementById('apiKey').value = 'AIzaTEST'; });
  await p.click('#saveSet'); await p.waitForTimeout(400);
  await p.selectOption('#country', 'AE'); await p.fill('#trade', 'restaurant'); await p.fill('#towns', 'Umm Al Quwain'); await p.fill('#runLimit', '1');
  await p.click('#go'); await p.waitForTimeout(3000);
  await p.evaluate(() => { const u = document.getElementById('urgentOnly'); if (u.checked) u.click(); });
  if (await p.$('#showAll')) { await p.click('#showAll'); await p.waitForTimeout(200); }
  const cards = await p.$$eval('#results .lead', ls => ls.map(l => ({ n: l.querySelector('.name').textContent.replace(/^#\d+/, ''), t: l.textContent })));
  const card = n => (cards.find(c => c.n.indexOf(n) >= 0) || {}).t || '';
  ok('L1 alive + no owner photos: green "alive, neglected" badge', /زندہ کاروبار، پروفائل نظر انداز/.test(card('Sufi Tikka')));
  ok('L2 owner uploads photos: "owner looks after it"', /مالک خود دیکھ بھال کرتا ہے/.test(card('Karachi Darbar')) && !/نظر انداز/.test(card('Karachi Darbar')));
  ok('L3 newest review 300 days (all reviews known): "maybe closed or abandoned"', /شاید بند یا چھوڑا ہوا/.test(card('Old Lahore')));
  ok('L4 Google says temporarily closed: left out of the results (as before)', !card('Hamza Karahi'));
  ok('L5 busy listing with only old picked reviews: no guess', !/زندہ کاروبار|شاید بند|دیکھ بھال/.test(card('Mehran')));
  const order = cards.map(c => c.n);
  const pos = n => order.findIndex(x => x.indexOf(n) >= 0);
  ok('L6 order: neglected first, cared below it, abandoned last', pos('Sufi') <= 1 && pos('Karachi Darbar') > pos('Sufi') && pos('Mehran') > pos('Sufi') && pos('Old Lahore') === order.length - 1, order.join(' / '));
  await p.click('#copyAll'); await p.waitForTimeout(300);
  const t = await p.evaluate(() => navigator.clipboard.readText());
  ok('L7 copy for Claude carries the reason', /ALIVE, PROFILE NEGLECTED \(newest review 20 days ago; no photos from the owner \(5 from customers\)\)/.test(t) && /MAYBE CLOSED\/ABANDONED \(newest review 300 days ago\)/.test(t) && /OWNER LOOKS AFTER PROFILE \(newest review 20 days ago; 4 photos from the owner\)/.test(t));
  ok('L8 hostile names stay text', !alerted && !(await p.$('#results img')));
  // results saved before this change: no badge, no error
  await p.evaluate(() => { const o = JSON.parse(localStorage.getItem('mp_leads')); o.leads.forEach(L => { delete L.lr; delete L.oph; delete L.ph; delete L.rvAll; delete L.closed; }); localStorage.setItem('mp_leads', JSON.stringify(o)); });
  await p.reload(); await p.waitForTimeout(800);
  if ((await p.inputValue('#country')) !== 'AE') await p.selectOption('#country', 'AE');
  await p.evaluate(() => { const u = document.getElementById('urgentOnly'); if (u.checked) u.click(); });
  ok('L9 old saved results: no life badges, page fine', !/زندہ کاروبار|شاید بند یا چھوڑا|دیکھ بھال کرتا/.test(await p.textContent('#results')) && (await p.$$('#results .lead')).length > 0);
  ok('L10 no page errors', !errs.length, errs.join(' | '));
  console.log(res.join('\n')); await b.close();
})();
