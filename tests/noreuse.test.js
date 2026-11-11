// 11 Nov (bug, owner approved): a business's number is never given to another one.
// Before: "چھوڑ دیں" removed the highest-numbered business and the next new business got its number again (#66 twice).
const { chromium } = require('playwright');
const SYNC = 'https://script.google.com/macros/s/TEST/exec';
(async () => {
  const BASE = process.env.BASE || 'http://localhost:8765';
  const b = await chromium.launch(); const res = []; const ok = (n, c, d = '') => res.push((c ? 'PASS ' : 'FAIL ') + n + (d ? ' (' + d + ')' : ''));
  let cloud = {}, batch = 1;
  const recent = [{ publishTime: new Date(Date.now() - 20 * 864e5).toISOString(), rating: 5 }];
  const P = (id, name) => ({ id, displayName: { text: name }, formattedAddress: '1 Main St, Tyler, TX 75701, USA', rating: 4.1, userRatingCount: 20, websiteUri: '',
    nationalPhoneNumber: '(903) 555-0100', internationalPhoneNumber: '+1 903-555-01' + (10 + id.length * 3 + name.length), primaryType: 'plumber',
    primaryTypeDisplayName: { text: 'Plumber' }, businessStatus: 'OPERATIONAL', regularOpeningHours: {}, reviews: recent });
  const sets = {
    1: [P('a1', 'Alpha Pipes'), P('a2', 'Bravo Drains'), P('a3', 'Charlie Plumbing')],
    2: [P('b1', 'Delta Rooter')],
    3: [P('c1', 'Echo Heating')],
    4: [P('d1', 'Foxtrot Plumbing')],
  };
  const mk = async () => {
    const ctx = await b.newContext({ viewport: { width: 400, height: 900 } });
    await ctx.route(/^https?:\/\/(?!localhost)/, async r => {
      const u = r.request().url(), m = r.request().method(); const j = o => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
      if (u.startsWith(SYNC)) { if (m === 'POST') { cloud = JSON.parse(r.request().postData()); return j({ ok: 1 }); } return j(cloud); }
      if (/places:searchText/.test(u)) return j({ places: sets[batch] });
      if (/places\.googleapis\.com\/v1\/places\//.test(u)) return j({ id: 'x' });
      if (/pagespeedonline/.test(u)) return j({ lighthouseResult: { categories: { performance: { score: 0.9 } }, audits: { 'network-requests': { details: { items: [] } } } } });
      if (/dns\.google|cloudflare-dns|quad9/.test(u)) return j({ Answer: [] });
      if (/rdap|webrisk/.test(u)) return j({});
      return r.abort();
    });
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto(BASE + '/finder.html'); await p.waitForTimeout(500);
    return p;
  };
  const setup = async (p, sync) => {
    await p.evaluate(s => { document.getElementById('setBox').open = true; document.getElementById('apiKey').value = 'AIzaTEST'; if (s) document.getElementById('syncUrl').value = s; }, sync || '');
    await p.click('#saveSet'); await p.waitForTimeout(sync ? 1500 : 400);
  };
  const search = async p => {
    await p.selectOption('#country', 'US'); await p.fill('#trade', 'plumber'); await p.fill('#towns', 'Tyler, TX'); await p.fill('#runLimit', '1');
    await p.evaluate(() => { const w = document.getElementById('needWeb'); if (w.checked) w.click(); });
    await p.click('#go'); await p.waitForTimeout(2500);
    await p.evaluate(() => { const u = document.getElementById('urgentOnly'); if (u.checked) u.click(); });
  };
  const nos = p => p.evaluate(() => { const o = {}; JSON.parse(localStorage.getItem('mp_leads')).leads.forEach(L => { o[L.id] = L.no; }); return o; });
  const skip = async (p, name) => {
    await p.evaluate(() => { const u = document.getElementById('urgentOnly'); if (u.checked) u.click(); });
    if (await p.$('#showAll')) { await p.click('#showAll'); await p.waitForTimeout(200); }
    return p.locator('#results .lead').filter({ has: p.locator('.name', { hasText: name }) }).locator('[data-a="skip"]').click({ timeout: 8000 });
  };

  const A = await mk(); await setup(A);
  await search(A);
  let n = await nos(A);
  const top = Math.max(n.a1, n.a2, n.a3);
  const topId = Object.keys(n).find(k => n[k] === top);
  const topName = { a1: 'Alpha', a2: 'Bravo', a3: 'Charlie' }[topId];
  await skip(A, topName); await A.waitForTimeout(400);
  batch = 2; await search(A);
  n = await nos(A);
  ok('R1 skipping the highest number: the next new business gets a new number', n.b1 === top + 1 && !(topId in n), JSON.stringify(n));
  await A.reload(); await A.waitForTimeout(800);
  await skip(A, 'Delta'); await A.waitForTimeout(400);
  await A.reload(); await A.waitForTimeout(800);
  batch = 3; await search(A);
  n = await nos(A);
  ok('R2 the highest number is remembered after closing and reopening the app', n.c1 === top + 2, JSON.stringify(n));
  // old saved data (before this fix, no remembered highest number): works, numbers kept
  await A.evaluate(() => { const o = JSON.parse(localStorage.getItem('mp_leads')); delete o.noMax; localStorage.setItem('mp_leads', JSON.stringify(o)); });
  await A.reload(); await A.waitForTimeout(800);
  const n2 = await nos(A);
  ok('R3 old saved results: numbers unchanged, no error', JSON.stringify(n2) === JSON.stringify(n) && !A.errs.length, A.errs.join(' | '));

  // two devices: B skips its highest after a sync; A must not reuse that number
  cloud = {}; batch = 1;
  const C = await mk(); await setup(C, SYNC); await search(C); await C.waitForTimeout(3500);
  const D = await mk(); await setup(D, SYNC); await D.waitForTimeout(3500);
  const nc = await nos(C), cTop = Math.max(...Object.values(nc));
  const cTopName = { a1: 'Alpha', a2: 'Bravo', a3: 'Charlie' }[Object.keys(nc).find(k => nc[k] === cTop)];
  await C.selectOption('#country', 'US'); await skip(C, cTopName); await C.waitForTimeout(4000);   // skip, then sync
  await D.reload(); await D.waitForTimeout(4000);
  batch = 4; await search(D); await D.waitForTimeout(500);
  const nd = await nos(D);
  ok('R4 the other device does not reuse a number skipped on this one', nd.d1 === cTop + 1, JSON.stringify(nd) + ' top ' + cTop);
  ok('R5 no page errors', ![A, C, D].some(p => p.errs.length), [A, C, D].map(p => p.errs.join(' | ')).join(' || '));
  console.log(res.join('\n')); await b.close();
})();
