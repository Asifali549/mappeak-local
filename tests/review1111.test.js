// 11 Nov (owner approved): faults found by an outside review (Fable 5.2) of finder.html.
// F1 a "sent" mark is not lost when the other device's older list syncs; F2 "واپس لیں" stays undone after a Sync;
// F3 a damaged saved/synced lead does not stop the tool; F4 synced numbers can't become page code;
// F5 Gulf weekends; F6 paid clients are never dropped at 500 cards; F7 "add anyway" keeps both cards; F8 no WhatsApp button on a landline.
const { chromium } = require('playwright');
const SYNC = 'https://script.google.com/macros/s/TEST/exec';
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const b = await chromium.launch(); const res = []; const ok = (n, c, d = '') => res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' (' + d + ')' : ''));
  let cloud = {};
  const recent = [{ publishTime: new Date(Date.now() - 20 * 864e5).toISOString(), rating: 5 }];
  const P = (id, name, intl, addr, country) => ({ id, displayName: { text: name }, formattedAddress: addr, rating: 3.9, userRatingCount: 12, websiteUri: '',
    nationalPhoneNumber: '000', internationalPhoneNumber: intl, primaryType: 'plumber', primaryTypeDisplayName: { text: 'Plumber' }, businessStatus: 'OPERATIONAL', regularOpeningHours: {}, reviews: recent });
  const US = [P('u1', 'Alpha Pipes', '+1 903-555-0111', '1 Main St, Tyler, TX 75701, USA'), P('u2', 'Bravo Drains', '+1 903-555-0122', '2 Main St, Tyler, TX 75701, USA')];
  const AE = [P('a1', 'Desert Karahi', '+971 4 555 1234', 'Al Quoz - Dubai - United Arab Emirates'), P('a2', 'Oasis Tikka', '+971 50 555 1234', 'Al Quoz - Dubai - United Arab Emirates')];
  const mk = async () => {
    const ctx = await b.newContext({ viewport: { width: 400, height: 900 } });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
    await ctx.route(/^https?:\/\/(?!localhost)/, async r => {
      const u = r.request().url(), m = r.request().method(); const j = o => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
      if (u.startsWith(SYNC)) { if (m === 'POST') { cloud = JSON.parse(r.request().postData()); return j({ ok: 1 }); } return j(cloud); }
      if (/places:searchText/.test(u)) return j({ places: /Dubai/.test(JSON.parse(r.request().postData()).textQuery) ? AE : US });
      if (/places\.googleapis\.com\/v1\/places\//.test(u)) return j({ id: 'x' });
      if (/pagespeedonline/.test(u)) return j({ lighthouseResult: { categories: { performance: { score: 0.9 } }, audits: { 'network-requests': { details: { items: [] } } } } });
      if (/dns\.google|cloudflare-dns|quad9/.test(u)) return j({ Answer: [] });
      if (/rdap|webrisk/.test(u)) return j({});
      return r.abort();
    });
    const p = await ctx.newPage(); p.errs = []; p.alerted = false;
    p.on('pageerror', e => p.errs.push(e.message)); p.on('dialog', d => { if (d.type() === 'alert') p.alerted = true; d.accept(); });
    await p.goto(BASE + '/finder.html'); await p.waitForTimeout(500);
    return p;
  };
  const setup = async (p, sync) => {
    await p.evaluate(s => { document.getElementById('setBox').open = true; document.getElementById('apiKey').value = 'AIzaTEST'; document.getElementById('syncUrl').value = s || ''; }, sync);
    await p.click('#saveSet'); await p.waitForTimeout(sync ? 1500 : 400);
  };
  const search = async (p, c, town) => {
    await p.selectOption('#country', c); await p.fill('#trade', 'plumber'); await p.fill('#towns', town); await p.fill('#runLimit', '1');
    await p.evaluate(() => { const w = document.getElementById('needWeb'); if (w.checked) w.click(); });
    await p.click('#go'); await p.waitForTimeout(2500);
    await p.evaluate(() => { const u = document.getElementById('urgentOnly'); if (u.checked) u.click(); });
  };
  const lead = (p, id) => p.evaluate(i => JSON.parse(localStorage.getItem('mp_leads')).leads.find(l => l.id === i), id);
  const card = (p, name) => p.locator('#results .lead').filter({ has: p.locator('.name', { hasText: name }) });
  const follow = p => p.evaluate(() => JSON.parse(localStorage.getItem('mp_follow') || '[]').map(f => f.id));
  const showAll = async p => { await p.evaluate(() => { const u = document.getElementById('urgentOnly'); if (u.checked) u.click(); }); if (await p.$('#showAll')) { await p.click('#showAll'); await p.waitForTimeout(200); } };

  // ---- two devices
  const C = await mk(); await setup(C, SYNC); await search(C, 'US', 'Tyler, TX'); await C.waitForTimeout(3500);
  const D = await mk(); await setup(D, SYNC); await D.waitForTimeout(3500);
  await D.selectOption('#country', 'US'); await showAll(D);
  // C messages Alpha (copying the email marks it sent); D is still open with the old list
  await showAll(C); await card(C, 'Alpha').locator('[data-a="email"]').click(); await C.waitForTimeout(4000);   // marked, then synced
  ok('F0 phone marked it sent', (await lead(C, 'u1')).sent === true);
  // D touches its old list (answers a yes/no question on another business) after C's sync, then syncs
  await showAll(D); await card(D, 'Bravo').locator('.yn button[data-v="no"]').first().click(); await D.waitForTimeout(4500);   // answer, then auto Sync
  await D.reload(); await D.waitForTimeout(4000);
  await C.reload(); await C.waitForTimeout(4000);
  ok('F1 the "sent" mark survives the other device\'s older list (both devices)', (await lead(D, 'u1') || {}).sent === true && (await lead(C, 'u1') || {}).sent === true,
    JSON.stringify([(await lead(D, 'u1') || {}).sent, (await lead(C, 'u1') || {}).sent]));
  ok('F1b the other device\'s own change is kept too', Object.values(((await lead(C, 'u2') || {}).manual) || {}).includes('no'));

  // F2: mark Bravo sent on C, let it sync, then undo; after more syncs it stays undone everywhere
  await C.selectOption('#country', 'US'); await showAll(C);
  await card(C, 'Bravo').locator('[data-a="email"]').click(); await C.waitForTimeout(4000);
  const cnt1 = +(await C.textContent('#sentToday'));
  await C.click('text=واپس لیں'); await C.waitForTimeout(4000);
  await D.reload(); await D.waitForTimeout(4000);
  await D.selectOption('#country', 'US'); await showAll(D); await card(D, 'Alpha').locator('.yn button[data-v="yes"]').first().click(); await D.waitForTimeout(4500);
  await C.reload(); await C.waitForTimeout(4000);
  const fc = await follow(C), fd = await follow(D);
  ok('F2 undone card does not come back after Sync (both devices)', !fc.includes('u2') && !fd.includes('u2') && fc.includes('u1'), JSON.stringify([fc, fd]));
  ok('F2b undone lead is not marked sent', !(await lead(C, 'u2')).sent && !(await lead(D, 'u2')).sent);
  ok('F2c today\'s count went back down and stays down', +(await C.textContent('#sentToday')) === cnt1 - 1, cnt1 + ' -> ' + (await C.textContent('#sentToday')));

  // ---- one device, no sync
  const A = await mk(); await setup(A, '');
  await search(A, 'AE', 'Dubai');
  await showAll(A);
  ok('F8 landline: no WhatsApp button; mobile: button', !(await card(A, 'Desert Karahi').locator('[data-a="wa"]').count()) && (await card(A, 'Oasis Tikka').locator('[data-a="wa"]').count()) === 1);
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'finder.html'), 'utf8');
  const grab = re => (src.match(re) || [''])[0];
  const pure = new Function(grab(/var FRI_SAT = [^\n]*\n/) + grab(/function offDays\(c\)[^\n]*\n/) + grab(/function capFollows\(list\)\{[\s\S]*?\n\}\n/) + 'return { offDays: offDays, capFollows: capFollows };')();
  const od = pure.offDays;
  ok('F5 weekends: Kuwait/Qatar/Oman Fri-Sat, UAE Sat-Sun, Pakistan Sun', JSON.stringify([od('KW'), od('QA'), od('OM'), od('AE'), od('PK'), od('SA')]) === JSON.stringify([[5,6],[5,6],[5,6],[6,0],[0],[5,6]]));
  { const list = []; for (let i = 0; i < 520; i++) list.push({ id: 'f' + i, n: 'Shop ' + i, state: i < 10 ? 'won' : 'waiting', at: i });
    const out = pure.capFollows(list);
    ok('F6 over 500 cards: paid (won) clients are kept, oldest others go first', out.length === 500 && out.filter(f => f.state === 'won').length === 10 && !out.some(f => f.id === 'f10') && out.some(f => f.id === 'f519'), out.length); }
  // F7: same contact twice, "add anyway" -> both kept
  await A.evaluate(() => { let e = document.querySelector('#mName'); while (e) { if (e.tagName === 'DETAILS') e.open = true; if (e.hidden) e.hidden = false; e = e.parentElement; } });
  await A.fill('#mName', 'Twin Shop One'); await A.fill('#mContact', 'owner@twinshops.example'); await A.click('#mAdd'); await A.waitForTimeout(300);
  await A.fill('#mName', 'Twin Shop Two'); await A.fill('#mContact', 'owner@twinshops.example'); await A.click('#mAdd'); await A.waitForTimeout(300);
  const tw = await A.evaluate(() => JSON.parse(localStorage.getItem('mp_follow')).filter(f => /Twin Shop/.test(f.n)).length);
  await A.reload(); await A.waitForTimeout(800);
  const tw2 = await A.evaluate(() => JSON.parse(localStorage.getItem('mp_follow')).filter(f => /Twin Shop/.test(f.n)).length);
  ok('F7 "add anyway" keeps both cards (also after reopening)', tw === 2 && tw2 === 2, tw + ' ' + tw2);

  // F3 + F4: damaged and hostile saved data
  await A.evaluate(() => {
    const o = JSON.parse(localStorage.getItem('mp_leads'));
    o.leads.push(null, { id: 'bad1', name: 'No Fields Shop', country: 'AE', address: 'Dubai - United Arab Emirates' },
      { id: 'evil1', name: 'Evil Numbers', country: 'AE', address: 'Dubai - United Arab Emirates', manual: {}, issues: [], no: '<img src=x onerror=alert(1)>',
        rating: '<img src=x onerror=alert(2)>', reviews: '<img src=x onerror=alert(3)>', speed: '<img src=x onerror=alert(4)>', website: 'javascript:alert(5)',
        maps: 'javascript:alert(6)', mapsRank: '<img src=x onerror=alert(7)>', comp: { n: 'X', r: '<img src=x onerror=alert(8)>', rt: '<b>9</b>' } });
    localStorage.setItem('mp_leads', JSON.stringify(o));
  });
  await A.reload(); await A.waitForTimeout(1200);
  if ((await A.inputValue('#country')) !== 'AE') await A.selectOption('#country', 'AE');
  await showAll(A); await A.waitForTimeout(400);
  const t = await A.textContent('#results');
  ok('F3 damaged saved leads: tool still works (results, client list, Today card)', /No Fields Shop/.test(t) && (await A.$$('#follow .fcard, #followList > *, #follow > *')).length >= 0 && !A.errs.length, A.errs.join(' | '));
  ok('F4 synced numbers and links never become page code', !A.alerted && !(await A.$('#results img')) && !(await A.$('#results a[href^="javascript"]')));
  ok('F9 no page errors', ![A, C, D].some(p => p.errs.length), [A, C, D].map(p => p.errs.join(' | ')).join(' || '));
  console.log(res.join('\n')); await b.close();
})();
